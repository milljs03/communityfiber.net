/**
 * team-grid.js
 *
 * Renders the employee cards. Shared by the About page and by the per-page team
 * sections on business, residential and builders, so all four show identical
 * cards from one source of truth.
 *
 * Page targeting
 * --------------
 * Each employee doc may carry a `pages` array, e.g. ["about", "business"],
 * edited from the Employees tab in the admin panel. A record with no `pages`
 * field at all is treated as About-only. That default matters: the field did not
 * exist until now, so without it every existing employee would either vanish
 * from About or appear on every page the moment this shipped.
 */

import { db } from '../config/firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { escapeHtml, safeUrl } from '../security.js';

const EMPLOYEES_PATH = ['artifacts', '162296779236', 'public', 'data', 'employees'];

const PLACEHOLDER_AVATAR = '<div class="employee-photo-empty"><svg class="cfn-icon" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg></div>';

/** Employees with no `pages` field predate page targeting; they belong to About. */
function showsOn(employee, page) {
    const pages = Array.isArray(employee.pages) ? employee.pages : null;
    if (!pages) return page === 'about';
    return pages.includes(page);
}

/**
 * Sort key for an employee's display order.
 *
 * "No order" has to sort LAST, so it cannot map to 0 — that is what put the two
 * people who had an order (1 and 2) behind the four who did not. Anything that
 * is not a positive number becomes Infinity instead. 0 counts as unset because
 * the form previously saved a blank field as 0, so existing records carry it.
 */
function orderRank(emp) {
    const n = Number(emp?.order);
    return Number.isFinite(n) && n > 0 ? n : Infinity;
}

/** Ordered people first by their number, everyone else after, A-Z within each. */
function byOrderThenName(a, b) {
    const ra = orderRank(a);
    const rb = orderRank(b);
    if (ra !== rb) return ra - rb;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function cardMarkup(emp) {
    const photo = emp.photoUrl
        ? `<img src="${safeUrl(emp.photoUrl, 'assets/images/community-fiber-logo.png', { allowDataImage: true })}" alt="${escapeHtml(emp.name || 'Team member')}" loading="lazy" decoding="async">`
        : PLACEHOLDER_AVATAR;

    // Years is optional — an employee added without it should render a clean
    // card, not "Team member for  Years".
    const years = String(emp.years ?? '').trim();

    return `
        <div class="employee-photo">${photo}</div>
        <div class="employee-info">
            <h3>${escapeHtml(emp.name || '')}</h3>
            <p class="employee-title">${escapeHtml(emp.title || '')}</p>
            ${years ? `<div class="employee-stats"><span class="years-badge">Team member for ${escapeHtml(years)} Years</span></div>` : ''}
        </div>`;
}

/**
 * @param {HTMLElement} container  where the cards are appended
 * @param {string} page            'about' | 'business' | 'residential' | 'builders'
 * @param {HTMLElement} [section]  hidden when nothing matches, so a page with no
 *                                 assigned staff shows no empty band
 * @returns {Promise<number>} how many cards were rendered
 */
export async function renderTeamGrid(container, page, section) {
    if (!container) return 0;

    try {
        const snapshot = await getDocs(collection(db, ...EMPLOYEES_PATH));

        const people = [];
        snapshot.forEach((doc) => {
            const emp = doc.data();
            if (showsOn(emp, page)) people.push(emp);
        });

        people.sort(byOrderThenName);

        if (!people.length) {
            if (section) section.hidden = true;
            return 0;
        }

        const frag = document.createDocumentFragment();
        for (const emp of people) {
            const card = document.createElement('div');
            card.className = 'employee-card fade-in-section';
            card.innerHTML = cardMarkup(emp);
            frag.appendChild(card);
        }
        container.appendChild(frag);

        // Cards are added after the page-load observer has already run, so they
        // need their own or they keep the fade-in start state forever.
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            });
        }, { threshold: 0.1 });

        container.querySelectorAll('.employee-card.fade-in-section').forEach((el) => observer.observe(el));

        return people.length;
    } catch (err) {
        console.error('Team grid: could not load employees.', err);
        if (section) section.hidden = true;
        return 0;
    }
}

/**
 * Wires the standalone team section used on business/residential/builders.
 * Reads its page key from data-team-page on the section.
 */
export function initPageTeamSection() {
    const section = document.querySelector('[data-team-page]');
    if (!section) return;
    const container = section.querySelector('.team-grid');
    renderTeamGrid(container, section.dataset.teamPage, section);
}
