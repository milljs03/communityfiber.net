#!/usr/bin/env node
/**
 * sync-pricing.js
 *
 * Renders the live Firestore plan data into the static HTML.
 *
 * Why this exists
 * ---------------
 * The pricing cards are fetched client-side from Firestore, so the shipped HTML
 * only ever said "Loading plans...". That has two costs:
 *
 *   1. Google's AI-features guidance asks that important content be present as
 *      text, and that structured data match the visible text. Prices that only
 *      exist after a Firestore round trip satisfy neither.
 *   2. Most non-Google AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not
 *      execute JavaScript at all, so they saw no pricing whatsoever.
 *
 * This script writes the current plans into three places that must agree:
 *   - the static plan cards inside #plans-grid
 *   - the JSON-LD Offer prices
 *   - the "Plans start at $X/mo ..." sentence on the city pages
 *
 * residential.js still overwrites #plans-grid with fresh Firestore data on
 * load, so visitors always see live pricing; this is the pre-render baseline.
 *
 * Re-run after any pricing change:  node scripts/sync-pricing.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT = 'communityfiber-net';
const PLANS_PATH = 'artifacts/162296779236/public/data/plans';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CITY_PAGES = ['goshen', 'bristol', 'middlebury', 'new-paris', 'syracuse', 'nappanee', 'wakarusa', 'milford'];

const escapeHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

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
  plans.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
    || (Number(a.price) || 0) - (Number(b.price) || 0));
  return plans;
}

/** Mirrors generatePlanCard() in public/assets/js/residential.js. */
function planCard(plan) {
  const isPopular = plan.isPopular === true || plan.isPopular === 'true';
  const badge = isPopular ? '<div class="popular-badge">Best Value</div>' : '';
  const requiresAutopay = plan.requiresAutopay === true || plan.requiresAutopay === 'true';
  const autopay = requiresAutopay
    ? '<div class="card-autopay-banner"><i class="fa-solid fa-circle-info"></i> E-Bill &amp; ACH Auto Pay Required</div>'
    : '';

  const priceNum = Number(plan.price) || 0;
  const originalNum = Number(plan.originalPrice) || 0;
  const isPromo = originalNum > priceNum;
  const wasPrice = isPromo ? `<span class="price-was">$${escapeHtml(String(plan.originalPrice))}</span>` : '';

  const universal = ['No annual contract', 'Unlimited data - no caps', 'Local support'];
  const skip = new Set(['local service', 'no contracts', 'no contract', 'local', 'unlimited data', 'no data caps']);
  const extras = Array.isArray(plan.features)
    ? plan.features.map((f) => String(f || '').trim()).filter((f) => f && !skip.has(f.toLowerCase()))
    : [];
  const featuresHtml = [...universal, ...extras]
    .map((f) => `<li><i class="fa-solid fa-check"></i><span>${escapeHtml(f)}</span></li>`)
    .join('');

  return `
                <div class="pricing-box ${isPopular ? 'popular' : ''}">
                    ${badge}
                    <div class="pricing-box-inner">
                        <h3 class="panel-heading">${escapeHtml(plan.name || '')}</h3>
                        <div class="price-wrapper ${isPromo ? 'is-promo' : ''}">
                            ${wasPrice}
                            <span class="price">$${escapeHtml(plan.price)}<small>/mo</small></span>
                        </div>
                        <div class="plan-speed">
                            <span class="plan-speed-val">${escapeHtml(plan.speed || '')}</span>
                            <span class="plan-speed-label">Symmetrical speeds</span>
                        </div>
                        <ul class="plan-features">${featuresHtml}</ul>
                        <a href="https://fiber-service-query.web.app/query.html" class="sign-up-btn">Check Availability</a>
                        ${autopay}
                    </div>
                </div>`;
}

const START = '<!-- PRERENDERED_PLANS_START -->';
const END = '<!-- PRERENDERED_PLANS_END -->';

function writeStaticPlans(html, plans) {
  const cards = plans.map(planCard).join('\n');
  const block = `${START}${cards}\n                ${END}`;
  // NB: the replacement must be a function. Passing `block` as a string would
  // let a price like "$35" be read as the backreference $3 followed by "5".
  if (html.includes(START)) {
    return html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), () => block);
  }
  // First run: seed the grid and let it render immediately instead of starting hidden.
  return html.replace(
    /(<div id="plans-grid" class="pricing-container)( hidden)?(">)/,
    (_all, open, _hidden, close) => `${open}${close}\n                ${block}`
  );
}

function updateOfferPrices(html, plans) {
  // Match each JSON-LD Offer to its plan by the speed named in the offer.
  return html.replace(/"name": "([^"]*?)(\d+ ?(?:Mbps|Gbps|Gig))([^"]*?)"([\s\S]{0,120}?)"price": "(\d+)"/g,
    (all, pre, speed, post, mid, oldPrice) => {
      const norm = (s) => String(s).toLowerCase().replace(/\s+/g, '').replace('gig', 'gbps');
      const match = plans.find((p) => norm(p.speed) === norm(speed));
      if (!match) return all;
      return `"name": "${pre}${speed}${post}"${mid}"price": "${match.price}"`;
    });
}

function updateStartingPriceCopy(html, plans) {
  const cheapest = plans.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
  const gig = plans.find((p) => /1 ?(gbps|gig)/i.test(String(p.speed)));
  let out = html.replace(/Plans start at \$\d+\/mo for [\d.]+ ?(?:Mbps|Gbps)/g,
    () => `Plans start at $${cheapest.price}/mo for ${cheapest.speed}`);
  if (gig) {
    out = out.replace(/our 1 Gig plan is currently \$\d+\/mo/g,
      () => `our 1 Gig plan is currently $${gig.price}/mo`);
  }
  return out;
}

(async () => {
  const plans = await fetchPlans();
  if (!plans.length) throw new Error('No plans returned from Firestore — refusing to write empty pricing.');
  console.log('Live plans from Firestore:');
  for (const p of plans) console.log(`  ${String(p.name).padEnd(10)} ${String(p.speed).padEnd(9)} $${p.price}${p.originalPrice ? ` (was $${p.originalPrice})` : ''}`);

  const targets = ['residential.html', ...CITY_PAGES.map((c) => `${c}.html`)];
  let changed = 0;

  for (const rel of targets) {
    const file = path.join(PUBLIC_DIR, rel);
    if (!fs.existsSync(file)) { console.warn('  skip (missing)', rel); continue; }
    let html = fs.readFileSync(file, 'utf8');
    const before = html;

    html = writeStaticPlans(html, plans);
    html = updateOfferPrices(html, plans);
    html = updateStartingPriceCopy(html, plans);

    if (html !== before) { fs.writeFileSync(file, html); console.log('  updated', rel); changed++; }
    else console.log('  unchanged', rel);
  }
  console.log(`\n${changed} file(s) updated.`);
})().catch((err) => { console.error('sync-pricing failed:', err.message); process.exit(1); });
