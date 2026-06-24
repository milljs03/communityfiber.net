import {
    subscribeToOutageFeed,
    OUTAGE_PAGE_PATH
} from './services/outage-feed.js';

const BANNER_STYLE_ID = 'cfn-outage-banner-styles';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureBannerStyles() {
    if (document.getElementById(BANNER_STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = BANNER_STYLE_ID;
    style.textContent = `
        #site-announcement-root[hidden] { display: none; }
        .site-announcement {
            background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
            color: #ffffff;
            box-shadow: 0 10px 24px rgba(127, 29, 29, 0.18);
        }
        .site-announcement__inner {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0.9rem 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
        }
        .site-announcement__copy {
            display: grid;
            gap: 0.2rem;
        }
        .site-announcement__eyebrow {
            font-size: 0.74rem;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            opacity: 0.85;
        }
        .site-announcement__title {
            font-family: var(--font-heading, 'Montserrat', sans-serif);
            font-size: 1rem;
            font-weight: 700;
        }
        .site-announcement__message {
            font-size: 0.95rem;
            opacity: 0.96;
        }
        .site-announcement__link {
            color: #ffffff;
            text-decoration: none;
            font-family: var(--font-heading, 'Montserrat', sans-serif);
            font-weight: 700;
            white-space: nowrap;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 0.7rem 0.95rem;
            transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        .site-announcement__link:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.55);
        }
        @media (max-width: 800px) {
            .site-announcement__inner {
                align-items: flex-start;
                flex-direction: column;
            }
            .site-announcement__link {
                width: 100%;
                text-align: center;
            }
        }
    `;

    document.head.appendChild(style);
}

function ensureBannerRoot() {
    let root = document.getElementById('site-announcement-root');
    if (root) {
        return root;
    }

    root = document.createElement('div');
    root.id = 'site-announcement-root';
    document.body.insertAdjacentElement('afterbegin', root);
    return root;
}

function renderBanner(snapshot) {
    const root = ensureBannerRoot();
    const isActive = Boolean(snapshot.data?.summary?.active);

    if (!isActive) {
        root.innerHTML = '';
        root.hidden = true;
        return;
    }

    const title = snapshot.data.summary.title;
    const message = snapshot.data.summary.message;

    root.hidden = false;
    root.innerHTML = `
        <section class="site-announcement" aria-live="polite">
            <div class="site-announcement__inner">
                <div class="site-announcement__copy">
                    <span class="site-announcement__eyebrow">Network Status</span>
                    <span class="site-announcement__title">${escapeHtml(title)}</span>
                    <span class="site-announcement__message">${escapeHtml(message)}</span>
                </div>
                <a class="site-announcement__link" href="${OUTAGE_PAGE_PATH}">View outage map</a>
            </div>
        </section>
    `;
}

function bootBanner() {
    ensureBannerStyles();
    subscribeToOutageFeed(renderBanner);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootBanner, { once: true });
} else {
    bootBanner();
}
