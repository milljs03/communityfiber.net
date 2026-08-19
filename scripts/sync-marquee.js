#!/usr/bin/env node
/**
 * sync-marquee.js
 *
 * Writes the hero photo reel on the homepage from whatever is in
 * public/assets/images/marquee/.
 *
 *   node scripts/sync-marquee.js
 *
 * Add or remove a photo by dropping a file in that folder and re-running. Files
 * are used in filename order, so a numeric prefix (01-, 02-, ...) controls the
 * sequence. Source files are converted to webp, resized and renamed to a
 * URL-safe form; the original is removed once converted.
 *
 * Why a script rather than reading the folder in the browser: a static host does
 * not expose a directory listing, and the reel is above the fold, so the markup
 * has to be in the HTML for the first paint and for crawlers that never run JS.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PUB = path.join(__dirname, '..', 'public');
const DIR = path.join(PUB, 'assets', 'images', 'marquee');
const INDEX = path.join(PUB, 'index.html');

const TARGET_PX = 720;   // reel photos render ~280px wide, so this covers 2x
const QUALITY = 80;
const WARN_KB = 140;

function loadSharp() {
    const candidates = ['sharp', path.join(__dirname, '..', 'functions', 'node_modules', 'sharp')];
    try {
        candidates.push(path.join(execSync('npm root -g').toString().trim(), 'sharp'));
    } catch { /* npm not on PATH */ }
    for (const c of candidates) {
        try { return require(c); } catch { /* try the next one */ }
    }
    return null;
}

/**
 * Camera filenames make poor URLs: spaces, parentheses, mixed case.
 * "_DSC5649 (1) (1).jpg" -> "dsc5649.webp"
 */
function safeName(file) {
    const base = path.basename(file, path.extname(file))
        .toLowerCase()
        .replace(/\(.*?\)/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return (base || 'photo') + '.webp';
}

/**
 * Finds the end of the element starting at `open`, by counting nested tags.
 *
 * The first version of this script looked for a closing tag at a guessed
 * indentation. That matched the wrong </div> and left an entire column stranded
 * outside the reel, where it picked up the generic `.hero-image img` rule and
 * rendered as one oversized photo on top of everything else.
 */
function elementEnd(html, open, tag) {
    const openRe = new RegExp('<' + tag + '\\b', 'g');
    const closeRe = new RegExp('</' + tag + '>', 'g');
    let depth = 0;
    let i = open;

    while (i < html.length) {
        openRe.lastIndex = i;
        closeRe.lastIndex = i;
        const o = openRe.exec(html);
        const c = closeRe.exec(html);
        if (!c) return -1;
        if (o && o.index < c.index) { depth++; i = o.index + 1; continue; }
        depth--;
        if (depth === 0) return c.index + ('</' + tag + '>').length;
        i = c.index + 1;
    }
    return -1;
}

function buildColumn(list, cls, eager) {
    const passes = [0, 1].map((pass) => list.map((file, i) => {
        // Every photo is decorative: the reel container carries a single
        // aria-label for the whole set. Alt text derived from camera filenames
        // would announce "Img 1705", which is worse than nothing.
        const load = (eager && pass === 0 && i === 0)
            ? ' fetchpriority="high"'
            : ' loading="lazy"';
        return '                        <img src="assets/images/marquee/' + file + '" width="480" height="600"\n'
             + '                             alt="" aria-hidden="true"' + load + ' decoding="async">';
    }).join('\n')).join('\n');

    return '                    <div class="' + cls + '">\n' + passes + '\n                    </div>';
}

async function main() {
    if (!fs.existsSync(DIR)) throw new Error('missing folder: public/assets/images/marquee/');

    const files = fs.readdirSync(DIR)
        .filter((f) => /\.(webp|jpe?g|png|heic|heif|avif)$/i.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (!files.length) throw new Error('no images in public/assets/images/marquee/');

    const sharp = loadSharp();
    if (!sharp) console.warn('sharp not resolved - non-webp files will be skipped.\n');

    const used = [];
    const skipped = [];

    for (const file of files) {
        const full = path.join(DIR, file);
        const originalBytes = fs.statSync(full).size;

        if (sharp) {
            let out;
            try {
                out = await sharp(fs.readFileSync(full))
                    // Honours the EXIF orientation flag. Phone photos are often
                    // stored sideways with a rotation tag; without this they
                    // render rotated on the page.
                    .rotate()
                    .resize(TARGET_PX, null, { withoutEnlargement: true })
                    .webp({ quality: QUALITY })
                    .toBuffer();
            } catch (err) {
                // HEIC can fail depending on how libvips was built. Skip the
                // file rather than aborting the whole run, and report it.
                skipped.push({ file, why: String(err.message).split('\n')[0] });
                continue;
            }

            const dest = path.join(DIR, safeName(file));
            if (out.length < originalBytes * 0.9 || dest !== full) {
                fs.writeFileSync(dest, out);
                if (dest !== full) fs.unlinkSync(full);
                used.push({ file: path.basename(dest), bytes: out.length, converted: true });
                continue;
            }
        } else if (!/\.webp$/i.test(file)) {
            skipped.push({ file, why: 'needs sharp to convert' });
            continue;
        }

        used.push({ file, bytes: originalBytes, converted: false });
    }

    if (!used.length) throw new Error('nothing usable in the marquee folder');

    // Deal alternately so neither column runs several shots of the same subject
    // together, then give each column its own duplicate for the -50% loop.
    const colA = used.filter((_, i) => i % 2 === 0).map((u) => u.file);
    const colB = used.filter((_, i) => i % 2 === 1).map((u) => u.file);
    if (!colB.length) colB.push.apply(colB, colA);

    const markup = [
        buildColumn(colA, 'photo-reel-col photo-reel-col--up', true),
        buildColumn(colB, 'photo-reel-col photo-reel-col--down', false),
    ].join('\n');

    const raw = fs.readFileSync(INDEX, 'utf8');
    const crlf = raw.includes('\r\n');
    let html = crlf ? raw.replace(/\r\n/g, '\n') : raw;

    // Replace the whole .hero-image element rather than its inner contents, so
    // a previous bad splice cannot leave anything stranded beside the reel.
    const heroOpen = html.indexOf('<div class="hero-image">');
    if (heroOpen < 0) throw new Error('could not find .hero-image in index.html');
    const heroEnd = elementEnd(html, heroOpen, 'div');
    if (heroEnd < 0) throw new Error('could not find the end of .hero-image');

    const label = 'Photos from Community Fiber installs across Elkhart and Kosciusko counties';
    const block = [
        '<div class="hero-image">',
        '                <div class="photo-reel" role="img"',
        '                     aria-label="' + label + '">',
        markup,
        '                </div>',
        '            </div>',
    ].join('\n');

    html = html.slice(0, heroOpen) + block + html.slice(heroEnd);

    html = html.replace(/(<link rel="preload" as="image" href=")[^"]+(")/,
        '$1assets/images/marquee/' + colA[0] + '$2');

    fs.writeFileSync(INDEX, crlf ? html.replace(/\n/g, '\r\n') : html);

    const total = used.reduce((n, u) => n + u.bytes, 0);
    console.log(used.length + ' photo(s) -> ' + colA.length + ' up / ' + colB.length + ' down\n');
    for (const u of used) {
        const kb = u.bytes / 1024;
        console.log('  ' + (kb > WARN_KB ? 'HEAVY ' : '      ')
            + u.file.padEnd(28) + kb.toFixed(0).padStart(4) + 'KB'
            + (u.converted ? '  (converted)' : ''));
    }
    console.log('\n  total ' + (total / 1024).toFixed(0) + 'KB, preloading ' + colA[0]);

    if (skipped.length) {
        console.log('\n  SKIPPED - not on the page:');
        for (const sk of skipped) console.log('    ' + sk.file + '\n      ' + sk.why);
    }
    if (used.length < 8) {
        console.log('\n  Only ' + used.length + ' photos. A reel this short visibly repeats;');
        console.log('  10-14 reads as a continuous stream.');
    }
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
