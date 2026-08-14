#!/usr/bin/env node
/**
 * sync-install-photos.js
 *
 * Bakes the Installation Process step photos out of Firestore and into static
 * files that the homepage hero collage can use.
 *
 *   node scripts/sync-install-photos.js
 *
 * Why not just read them in the browser
 * -------------------------------------
 * The step photos are uploaded through the admin panel and stored as base64
 * data URIs inside the `install_steps` documents. That is fine for the
 * Installation Process section further down the residential page, but the hero
 * collage is above the fold and is the homepage's LCP element. The five images
 * currently total about 1.35MB of base64, and base64 is roughly a third larger
 * than the bytes it encodes. Fetching that from Firestore before the hero can
 * paint would undo the homepage's whole performance budget.
 *
 * So: admin stays the place you edit the photos, and this script pushes them
 * out to disk, resized to what the collage actually displays. Re-run it after
 * changing a step photo in the admin panel.
 *
 * Resizing needs `sharp`. If it cannot be resolved the script still writes the
 * files, at their original weight, and tells you loudly.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT = 'communityfiber-net';
const STEPS_PATH = 'artifacts/162296779236/public/data/install_steps';
const OUT_DIR = path.join(__dirname, '..', 'public', 'assets', 'images', 'install');

// The tiles render at roughly 190 CSS px; 480 covers a 2x display with room to
// spare and keeps each file well under 60KB.
const TARGET_PX = 480;
const QUALITY = 80;

function loadSharp() {
  const candidates = [
    'sharp',
    path.join(__dirname, '..', 'functions', 'node_modules', 'sharp'),
  ];
  try {
    candidates.push(path.join(execSync('npm root -g').toString().trim(), 'sharp'));
  } catch { /* npm not on PATH; skip this candidate */ }

  for (const c of candidates) {
    try { return require(c); } catch { /* try the next one */ }
  }
  return null;
}

function unwrap(field) {
  if (!field || typeof field !== 'object') return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return Number(field.doubleValue);
  if ('booleanValue' in field) return field.booleanValue;
  return null;
}

const slug = (s) => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step';

async function main() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${STEPS_PATH}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore read failed: ${res.status} ${res.statusText}`);
  const body = await res.json();

  const steps = (body.documents || []).map((doc) => {
    const out = {};
    for (const [k, v] of Object.entries(doc.fields || {})) out[k] = unwrap(v);
    return out;
  })
    // The admin form writes stepNumber, not order — sorting on the wrong field
    // would silently scramble the sequence.
    .sort((a, b) => (Number(a.stepNumber) || 0) - (Number(b.stepNumber) || 0));

  if (!steps.length) throw new Error(`No documents in ${STEPS_PATH}`);

  const sharp = loadSharp();
  if (!sharp) {
    console.warn('sharp could not be resolved — writing images at their original size.');
    console.warn('Install it (npm i sharp) and re-run, or these will be far heavier than the hero needs.\n');
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const written = [];

  for (const step of steps) {
    const src = step.imageUrl || '';
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(src);
    if (!m) {
      console.warn(`skipped "${step.title}" — no inline image on this step`);
      continue;
    }

    const raw = Buffer.from(m[2], 'base64');
    const name = `${String(step.stepNumber || written.length + 1).padStart(2, '0')}-${slug(step.title)}.webp`;
    const dest = path.join(OUT_DIR, name);

    let out = raw;
    if (sharp) {
      out = await sharp(raw)
        // Square crop, attention-weighted so the crop keeps the part of the
        // frame with the most going on rather than blindly taking the centre.
        .resize(TARGET_PX, TARGET_PX, { fit: 'cover', position: sharp.strategy.attention })
        .webp({ quality: QUALITY })
        .toBuffer();
    }

    fs.writeFileSync(dest, out);
    written.push({ name, title: step.title, from: raw.length, to: out.length });
  }

  console.log(`Wrote ${written.length} file(s) to public/assets/images/install/\n`);
  for (const w of written) {
    const pct = ((1 - w.to / w.from) * 100).toFixed(0);
    console.log(
      `  ${w.name.padEnd(28)} ${w.title.padEnd(14)} ` +
      `${(w.from / 1024).toFixed(0)}KB -> ${(w.to / 1024).toFixed(0)}KB  (-${pct}%)`
    );
  }

  // Filenames carry the step number, so reordering the steps in admin renames
  // every file from the swap point on. Without pruning, the old names survive on
  // disk and the page keeps rendering the previous photos — silently, because
  // nothing 404s. Delete anything this run did not write.
  const keep = new Set(written.map((w) => w.name));
  const stale = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.webp') && !keep.has(f));
  for (const f of stale) fs.unlinkSync(path.join(OUT_DIR, f));
  if (stale.length) console.log(`\nRemoved ${stale.length} stale file(s): ${stale.join(', ')}`);

  // And fail loudly if the collage still points at a name that no longer exists.
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const referenced = [...new Set([...html.matchAll(/install\/([\w-]+\.webp)/g)].map((m) => m[1]))];
  const broken = referenced.filter((r) => !keep.has(r));
  const unused = [...keep].filter((k) => !referenced.includes(k));

  if (broken.length || unused.length) {
    console.log('\n' + '!'.repeat(70));
    if (broken.length) console.log(`public/index.html references files that no longer exist:\n  ${broken.join('\n  ')}`);
    if (unused.length) console.log(`These step photos are not on the homepage:\n  ${unused.join('\n  ')}`);
    console.log('Update the .install-tile list in public/index.html.');
    console.log('!'.repeat(70));
    process.exitCode = 1;
  } else {
    console.log('\npublic/index.html references all five, and nothing else.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
