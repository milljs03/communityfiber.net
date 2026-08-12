#!/usr/bin/env node
/**
 * sync-mobile-plans.js
 *
 * Two jobs, one per mode:
 *
 *   node scripts/sync-mobile-plans.js --seed
 *       Writes the starting plan set into the `mobile_plans` Firestore
 *       collection. Run this once so the admin Mobile Plans tab has something
 *       to edit. Refuses to overwrite an existing collection unless you pass
 *       --force, so it can never clobber real pricing someone typed in.
 *
 *   node scripts/sync-mobile-plans.js
 *       Reads the live collection and writes the cards into public/mobile.html.
 *
 * Why the second mode exists: mobile-plans.js fetches from Firestore in the
 * browser, so the shipped HTML would otherwise contain whatever cards happened
 * to be committed. Most non-Google AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot) do not run JavaScript, so the pre-rendered baseline is the
 * only version of the plans they will ever see. Re-run after a pricing change.
 *
 * Seeding needs credentials; syncing does not (mobile_plans is world-readable
 * by design — the same rule that lets the page render it).
 */

const fs = require('fs');
const path = require('path');

const PROJECT = 'communityfiber-net';
const PLANS_PATH = 'artifacts/162296779236/public/data/mobile_plans';
const MOBILE_HTML = path.join(__dirname, '..', 'public', 'mobile.html');

const CHECK_ICON = '<svg class="cfn-icon" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>';

const escapeHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* -------------------------------------------------------------------------
 * Seed data — the plan set currently on the page.
 *
 * price is deliberately null on every tier. NPTech's rate card has not been
 * confirmed, and a placeholder number would be indistinguishable from a real
 * one once it is sitting in a database. null renders "Call for pricing", which
 * is true today. Replace these from the admin panel as the real rates land.
 * ---------------------------------------------------------------------- */
const SEED = [
  {
    order: 1,
    name: 'By the Gig',
    dataNote: 'Light data use',
    price: null,
    priceNote: '',
    isPopular: false,
    features: [
      'Pay only for the data you use',
      'No monthly data commitment',
      'Suits a spare or backup line',
    ].join('\n'),
  },
  {
    order: 2,
    name: 'Unlimited',
    dataNote: 'High-speed data included',
    price: null,
    priceNote: '',
    isPopular: true,
    features: [
      'Mobile hotspot included',
      'Room for streaming, maps and social',
      'Our everyday plan',
    ].join('\n'),
  },
  {
    order: 3,
    name: 'Unlimited Max',
    dataNote: 'Our largest high-speed allowance',
    price: null,
    priceNote: '',
    isPopular: false,
    features: [
      'The most high-speed data we offer',
      'Mobile hotspot included',
      'Built for heavy streaming and tethering',
    ].join('\n'),
  },
];

/* --- Firestore REST read -------------------------------------------------- */

function unwrap(field) {
  if (!field || typeof field !== 'object') return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return Number(field.doubleValue);
  if ('booleanValue' in field) return field.booleanValue;
  if ('nullValue' in field) return null;
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(unwrap);
  return null;
}

async function fetchPlans() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${PLANS_PATH}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore read failed: ${res.status} ${res.statusText}`);
  const body = await res.json();
  const plans = (body.documents || []).map((doc) => {
    const out = {};
    for (const [k, v] of Object.entries(doc.fields || {})) out[k] = unwrap(v);
    return out;
  });
  plans.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  return plans;
}

/* --- Card rendering ------------------------------------------------------- */

/** Mirrors planCard() in public/assets/js/mobile-plans.js. Keep the two in step. */
function planCard(plan) {
  const isPopular = plan.isPopular === true || plan.isPopular === 'true';
  const badge = isPopular
    ? '\n                        <span class="npt-plan-badge">Most popular</span>'
    : '';

  const hasPrice = plan.price !== null && plan.price !== undefined && plan.price !== '';
  const priceNote = plan.priceNote ? ` <span>${escapeHtml(plan.priceNote)}</span>` : '';
  const price = hasPrice ? `$${escapeHtml(String(plan.price))}${priceNote}` : 'Call for pricing';

  const note = plan.dataNote ? `<small>${escapeHtml(plan.dataNote)}</small>` : '';

  const features = String(plan.features || '')
    .split('\n').map((s) => s.trim()).filter(Boolean)
    .map((f) => `                            <li>${CHECK_ICON}<span>${escapeHtml(f)}</span></li>`)
    .join('\n');

  return `                    <article class="npt-plan${isPopular ? ' npt-plan--featured' : ''}">${badge}
                        <h3 class="npt-plan-data">${escapeHtml(plan.name)}${note}</h3>
                        <div class="npt-plan-price">${price}</div>
                        <ul class="npt-plan-features">
${features}
                        </ul>
                        <a class="npt-btn npt-btn--solid" href="/support?topic=mobile#support-contact">Ask about this plan</a>
                    </article>`;
}

function writeCards(plans) {
  let html = fs.readFileSync(MOBILE_HTML, 'utf8');
  const open = '<div class="npt-plans" id="mobile-plans-grid">';
  const start = html.indexOf(open);
  if (start === -1) throw new Error('Could not find #mobile-plans-grid in mobile.html');

  const close = '\n                </div>';
  const end = html.indexOf(close, start);
  if (end === -1) throw new Error('Could not find the end of #mobile-plans-grid');

  const rendered = plans.map(planCard).join('\n\n');
  const next = html.slice(0, start + open.length) + '\n' + rendered + html.slice(end);

  if (next === html) {
    console.log('mobile.html already matches the database — nothing to write.');
    return;
  }
  fs.writeFileSync(MOBILE_HTML, next);
  console.log(`Wrote ${plans.length} plan card(s) into public/mobile.html`);
}

/* --- Seeding -------------------------------------------------------------- */

async function seed({ force }) {
  // firebase-admin is a functions dependency; there is no root package.json.
  let admin;
  try {
    admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
  } catch {
    console.error('firebase-admin not found. Run "npm install" inside functions/ first.');
    process.exit(1);
  }

  admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();
  const ref = db.collection(PLANS_PATH);

  const existing = await ref.get();
  if (!existing.empty && !force) {
    console.error(
      `Refusing to seed: ${existing.size} document(s) already exist in ${PLANS_PATH}.\n` +
      'Those may be real prices someone entered in the admin panel.\n' +
      'Pass --force to replace them.'
    );
    process.exit(1);
  }

  const batch = db.batch();
  existing.forEach((doc) => batch.delete(doc.ref));
  SEED.forEach((plan) => batch.set(ref.doc(), plan));
  await batch.commit();

  console.log(`Seeded ${SEED.length} mobile plans into ${PLANS_PATH}`);
  console.log('Every price is null, so all three cards read "Call for pricing".');
  console.log('Edit them from the admin panel: Mobile Plans tab.');
}

/* --- Entry ---------------------------------------------------------------- */

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--seed')) {
    await seed({ force: args.includes('--force') });
    return;
  }

  const plans = await fetchPlans();
  if (!plans.length) {
    console.error(
      `No documents in ${PLANS_PATH}.\n` +
      'Seed the collection first:  node scripts/sync-mobile-plans.js --seed'
    );
    process.exit(1);
  }
  writeCards(plans);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
