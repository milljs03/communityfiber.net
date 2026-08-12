/**
 * mobile-plans.js
 *
 * Renders the NPTech Mobile plan cards from the `mobile_plans` Firestore
 * collection, which is edited from the Mobile Plans tab in the admin panel.
 *
 * The page ships with the current plans already written into #mobile-plans-grid
 * as real markup (see scripts/sync-mobile-plans.js). That baseline is what
 * non-JavaScript crawlers read, and it is what stays on screen if Firestore is
 * unreachable — the same arrangement residential.js uses for broadband pricing.
 * So the failure mode here is "slightly stale prices", never "empty page".
 */

import { db } from './config/firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { escapeHtml } from './security.js';

const CHECK_ICON = '<svg class="cfn-icon" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>';

function priceMarkup(plan) {
    // A blank price is deliberate, not missing data: it means the rate for that
    // tier is not published yet, so the card asks people to call rather than
    // showing a figure we cannot stand behind.
    if (plan.price === null || plan.price === undefined || plan.price === '') {
        return 'Call for pricing';
    }
    const note = plan.priceNote ? ` <span>${escapeHtml(plan.priceNote)}</span>` : '';
    return `$${escapeHtml(String(plan.price))}${note}`;
}

function planCard(plan) {
    const features = String(plan.features || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<li>${CHECK_ICON}<span>${escapeHtml(line)}</span></li>`)
        .join('');

    return `
        <article class="npt-plan${plan.isPopular ? ' npt-plan--featured' : ''}">
            ${plan.isPopular ? '<span class="npt-plan-badge">Most popular</span>' : ''}
            <h3 class="npt-plan-data">${escapeHtml(plan.name || '')}${
                plan.dataNote ? `<small>${escapeHtml(plan.dataNote)}</small>` : ''
            }</h3>
            <div class="npt-plan-price">${priceMarkup(plan)}</div>
            <ul class="npt-plan-features">${features}</ul>
            <a class="npt-btn npt-btn--solid" href="/support?topic=mobile#support-contact">Ask about this plan</a>
        </article>`;
}

async function renderMobilePlans() {
    const grid = document.getElementById('mobile-plans-grid');
    if (!grid) return;

    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'mobile_plans');
        const snapshot = await getDocs(ref);

        const plans = [];
        snapshot.forEach((doc) => plans.push(doc.data()));

        // An empty collection is not an instruction to blank the page — it just
        // means nobody has seeded it yet, so keep the pre-rendered cards.
        if (!plans.length) return;

        plans.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        grid.innerHTML = plans.map(planCard).join('');
    } catch (err) {
        console.error('Mobile plans: falling back to pre-rendered cards.', err);
    }
}

renderMobilePlans();
