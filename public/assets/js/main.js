// public/assets/js/main.js
import { bindAllPhoneInputs } from './security.js';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBw8z2IL4dN5oldPzRW3a581mkXC7VuXe4';
const MIN_GOOGLE_SEARCH_TOKEN_COUNT = 3;
const SEARCH_DEBOUNCE_MS = 350;
const MAX_PREDICTIONS = 5;

let isRedirecting = false;
let googlePlacesPromise = null;

function countSearchTokens(value) {
    return (String(value || '').match(/[A-Za-z0-9]/g) || []).length;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function hasMinimumGoogleSearchInput(value) {
    return countSearchTokens(value) >= MIN_GOOGLE_SEARCH_TOKEN_COUNT;
}

function loadGooglePlaces() {
    if (window.google?.maps?.places?.AutocompleteService) {
        return Promise.resolve(window.google.maps.places);
    }

    if (googlePlacesPromise) {
        return googlePlacesPromise;
    }

    googlePlacesPromise = new Promise((resolve, reject) => {
        const callbackName = '__cfnAddressPlacesReady';
        let settled = false;

        const finish = (handler, value) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            try {
                delete window[callbackName];
            } catch (_error) {
                window[callbackName] = undefined;
            }
            handler(value);
        };

        const timeoutId = window.setTimeout(() => {
            if (window.google?.maps?.places?.AutocompleteService) {
                finish(resolve, window.google.maps.places);
                return;
            }
            finish(reject, new Error('Google Places took too long to load.'));
        }, 12000);

        window[callbackName] = () => {
            if (window.google?.maps?.places?.AutocompleteService) {
                finish(resolve, window.google.maps.places);
                return;
            }
            finish(reject, new Error('Google Places loaded without autocomplete support.'));
        };

        const script = document.createElement('script');
        script.id = 'cfn-google-places';
        script.async = true;
        script.defer = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places&callback=${callbackName}&loading=async`;
        script.onerror = () => finish(reject, new Error('Google Places failed to load.'));
        document.head.appendChild(script);
    });

    return googlePlacesPromise;
}

function ensureAddressSearchStyles() {
    if (document.getElementById('cfn-address-search-styles')) return;

    const style = document.createElement('style');
    style.id = 'cfn-address-search-styles';
    style.textContent = `
        .cfn-address-suggestions {
            position: absolute;
            left: 0;
            right: 0;
            top: calc(100% + 10px);
            z-index: 1000;
            overflow: hidden;
            border-radius: 12px;
            background: #ffffff;
            box-shadow: 0 16px 34px rgba(15, 23, 42, 0.2);
            text-align: left;
        }
        .cfn-address-suggestions[hidden] {
            display: none;
        }
        .cfn-address-suggestion {
            width: 100%;
            border: 0;
            border-top: 1px solid #e2e8f0;
            padding: 0.85rem 1rem;
            background: #ffffff;
            color: #0f172a;
            cursor: pointer;
            font: 600 0.95rem var(--font-body, 'Open Sans', sans-serif);
            text-align: left;
        }
        .cfn-address-suggestion:first-child {
            border-top: 0;
        }
        .cfn-address-suggestion:hover,
        .cfn-address-suggestion.is-active {
            background: #eff6ff;
        }
    `;
    document.head.appendChild(style);
}

function initializeAddressSearch() {
    const inputs = document.querySelectorAll('.cfn-address-input');
    if (!inputs.length) return;

    ensureAddressSearchStyles();
    inputs.forEach((input, instance) => setupAddressField(input, instance));
}

/**
 * Wires one address field. Each call keeps its own predictions, session token
 * and debounce timer in closure, so two fields on the same page never share
 * state - typing in one cannot clear or hijack the other's suggestions.
 */
function setupAddressField(input, instance) {
    const container = input.closest('.availability-search-container') || input.parentElement;
    const suggestions = document.createElement('div');
    // Unique per field: ids have to stay unique for aria-controls and
    // aria-activedescendant to point at the right element.
    suggestions.id = `cfn-address-suggestions-${instance}`;
    suggestions.className = 'cfn-address-suggestions';
    suggestions.setAttribute('role', 'listbox');
    suggestions.hidden = true;
    container.appendChild(suggestions);

    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', suggestions.id);

    let autocompleteService = null;
    let sessionToken = null;
    let debounceTimer = null;
    let latestRequestId = 0;
    let activeIndex = -1;
    let currentPredictions = [];

    function clearSuggestions() {
        currentPredictions = [];
        activeIndex = -1;
        suggestions.innerHTML = '';
        suggestions.hidden = true;
        input.removeAttribute('aria-activedescendant');
    }

    function setActiveIndex(index) {
        activeIndex = index;
        if (activeIndex < 0) {
            input.removeAttribute('aria-activedescendant');
        }
        suggestions.querySelectorAll('.cfn-address-suggestion').forEach((button, buttonIndex) => {
            const isActive = buttonIndex === activeIndex;
            button.classList.toggle('is-active', isActive);
            if (isActive) {
                input.setAttribute('aria-activedescendant', button.id);
            }
        });
    }

    function renderPredictions(predictions) {
        currentPredictions = predictions.slice(0, MAX_PREDICTIONS);
        if (currentPredictions.length === 0) {
            clearSuggestions();
            return;
        }

        suggestions.innerHTML = currentPredictions.map((prediction, index) => `
            <button type="button" id="cfn-address-suggestion-${instance}-${index}" class="cfn-address-suggestion" role="option" data-index="${index}">
                ${escapeHtml(prediction.description)}
            </button>
        `).join('');
        suggestions.hidden = false;
        setActiveIndex(-1);
    }

    function requestPredictions() {
        const value = input.value.trim();
        if (!hasMinimumGoogleSearchInput(value)) {
            clearSuggestions();
            return;
        }

        const requestId = ++latestRequestId;
        loadGooglePlaces()
            .then((places) => {
                autocompleteService = autocompleteService || new places.AutocompleteService();
                sessionToken = sessionToken || new places.AutocompleteSessionToken();
                autocompleteService.getPlacePredictions({
                    input: value,
                    types: ['address'],
                    componentRestrictions: { country: 'us' },
                    sessionToken
                }, (predictions, status) => {
                    if (requestId !== latestRequestId || !hasMinimumGoogleSearchInput(input.value)) {
                        return;
                    }

                    if (status !== places.PlacesServiceStatus.OK || !Array.isArray(predictions)) {
                        clearSuggestions();
                        return;
                    }

                    renderPredictions(predictions);
                });
            })
            .catch((error) => {
                console.error(error);
                clearSuggestions();
            });
    }

    input.addEventListener('input', () => {
        window.clearTimeout(debounceTimer);
        if (!hasMinimumGoogleSearchInput(input.value)) {
            latestRequestId += 1;
            clearSuggestions();
            return;
        }
        debounceTimer = window.setTimeout(requestPredictions, SEARCH_DEBOUNCE_MS);
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' && currentPredictions.length > 0) {
            event.preventDefault();
            setActiveIndex(Math.min(activeIndex + 1, currentPredictions.length - 1));
            return;
        }

        if (event.key === 'ArrowUp' && currentPredictions.length > 0) {
            event.preventDefault();
            setActiveIndex(Math.max(activeIndex - 1, 0));
            return;
        }

        if (event.key === 'Escape') {
            clearSuggestions();
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            const selected = currentPredictions[activeIndex];
            redirectToApp(selected?.description || input.value);
        }
    });

    // The Check button runs the same path as pressing Enter: use the highlighted
    // prediction if there is one, otherwise whatever has been typed. It is not
    // decoration — without it the only way to submit was a key press, which is
    // not discoverable on a phone where there is no visible Enter affordance.
    const submit = container.querySelector('.search-submit');
    if (submit) {
        submit.addEventListener('click', () => {
            const selected = currentPredictions[activeIndex];
            redirectToApp(selected?.description || input.value);
        });
    }

    suggestions.addEventListener('mousedown', (event) => {
        event.preventDefault();
    });

    suggestions.addEventListener('click', (event) => {
        const button = event.target.closest('.cfn-address-suggestion');
        if (!button) return;

        const prediction = currentPredictions[Number(button.dataset.index)];
        if (prediction?.description) {
            input.value = prediction.description;
            clearSuggestions();
            sessionToken = null;
            redirectToApp(prediction.description);
        }
    });

    document.addEventListener('click', (event) => {
        if (!container.contains(event.target)) {
            clearSuggestions();
        }
    });
}

/**
 * The availability bar is fixed, so it sits over whatever is at the bottom of
 * the page. The padding that compensates is added here rather than in CSS
 * because it must only apply when the bar is actually present and un-dismissed
 * — a permanent padding rule would leave a gap under the footer otherwise.
 */
function initializeAddressBar() {
    const bar = document.getElementById('address-bar');
    if (!bar) return;

    const DISMISS_KEY = 'cfn-address-bar-dismissed';
    let dismissed = false;
    try {
        dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
        // Private browsing can throw on sessionStorage; treat it as not dismissed.
    }

    // Reserve exactly the bar's height rather than a CSS constant. The bar is
    // not the same height on every page — different stylesheets give it
    // different type metrics, and it grew from 89px on the homepage to 120px on
    // residential, which a fixed 92px under-reserved and let it sit on the
    // footer. Measuring also covers the copy wrapping to another line.
    const reserveSpace = () => {
        if (bar.hidden) return;
        document.body.style.paddingBottom = `${Math.ceil(bar.getBoundingClientRect().height)}px`;
    };

    // The page already contains a full availability search. When that field is
    // approaching the viewport, hide the fixed duplicate instead of allowing
    // the two controls to stack on top of one another.
    let inPageSearchVisible = false;
    const syncAddressBar = () => {
        const shouldHide = dismissed || inPageSearchVisible;
        bar.hidden = shouldHide;
        document.body.classList.toggle('has-address-bar', !shouldHide);
        document.body.style.paddingBottom = shouldHide ? '' : `${Math.ceil(bar.getBoundingClientRect().height)}px`;
    };

    syncAddressBar();

    if (typeof ResizeObserver === 'function') {
        new ResizeObserver(reserveSpace).observe(bar);
    } else {
        window.addEventListener('resize', reserveSpace);
    }

    const inPageSearch = document.querySelector('#availability-check .availability-search-container');
    if (inPageSearch && typeof IntersectionObserver === 'function') {
        const barClearance = Math.ceil(bar.getBoundingClientRect().height) || 96;
        new IntersectionObserver(([entry]) => {
            inPageSearchVisible = entry.isIntersecting;
            syncAddressBar();
        }, {
            rootMargin: `0px 0px ${barClearance}px 0px`,
            threshold: 0
        }).observe(inPageSearch);
    }

    document.getElementById('address-bar-close')?.addEventListener('click', () => {
        dismissed = true;
        syncAddressBar();
        try {
            // Per-session, not permanent: someone who dismisses it today should
            // still get it on their next visit.
            sessionStorage.setItem(DISMISS_KEY, '1');
        } catch { /* nothing to do */ }
    });

    // The hero button hands off to whichever address field is currently being
    // presented. Focusing it directly beats a plain #anchor, which on a fixed
    // element scrolls nowhere and looks broken.
    document.querySelectorAll('[data-focus-address]').forEach((trigger) => {
        trigger.addEventListener('click', (event) => {
            const input = inPageSearchVisible
                ? document.getElementById('cfn-address-input-panel')
                : document.getElementById('cfn-address-input');
            if (!input) return;
            event.preventDefault();

            // If the bar was dismissed this session, bring it back: the visitor
            // has just asked for it, and a control that silently does nothing is
            // worse than no control.
            if (!inPageSearchVisible && dismissed) {
                dismissed = false;
                try {
                    sessionStorage.removeItem(DISMISS_KEY);
                } catch { /* nothing to do */ }
                syncAddressBar();
            }

            input.focus({ preventScroll: true });
        });
    });
}

function redirectToApp(address, siteSource) {
  if (isRedirecting) return;
  if (!hasMinimumGoogleSearchInput(address)) return;
  isRedirecting = true;

  // The latch stops a double submit firing two navigations. It only worked
  // because the page was assumed to be going away — but the lookup opens in
  // another tab, so this page survives, the flag stays true forever, and every
  // later search is silently swallowed. Release it once the navigation has had
  // time to start, and again if the browser restores this page from the back
  // /forward cache, where module state comes back exactly as it was left.
  window.setTimeout(() => { isRedirecting = false; }, 3000);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) isRedirecting = false;
  }, { once: true });

  const params = new URLSearchParams({
    auto: 'true',
    address,
    utm_source: 'community-fiber.web.app',          // e.g. "site_a" or "site_b"
    utm_medium: 'redirect',
    utm_campaign: 'address_lookup',
    utm_content: 'homepage_form'     // optional placement tag
  });

  window.location.href = `https://fiber-service-query.web.app/query.html?${params.toString()}`;
}


// --- Standard Site Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Order matters: the bar may hide itself if it was dismissed this session,
    // and initializeAddressSearch() reads the field's container to position the
    // suggestion list.
    initializeAddressBar();
    initializeAddressSearch();

    // --- Mobile Menu Toggle Logic ---
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent immediate closing if listener is on document
            navLinks.classList.toggle('active');

            // Sync the icon text
            const isOpen = navLinks.classList.contains('active');
            mobileMenuBtn.textContent = isOpen ? '✕' : '☰';

            // Accessibility: toggling expanded state
            mobileMenuBtn.setAttribute('aria-expanded', isOpen);

            console.log('Mobile menu toggled. Active class present:', isOpen);
        });

        // Close menu when clicking any link inside
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                mobileMenuBtn.textContent = '☰';
            });
        });

        // Optional: Close menu if clicking outside of the navbar
        document.addEventListener('click', (e) => {
            if (!navLinks.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                if (navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    mobileMenuBtn.textContent = '☰';
                }
            }
        });
    }

    // --- Scroll Animations ---
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const el = entry.target;
            el.classList.add('is-visible');
            obs.unobserve(el);
        });
    }, observerOptions);

    const animatedEls = document.querySelectorAll('.fade-in-section, .fade-in, [data-animate]');
    animatedEls.forEach(el => observer.observe(el));

    // Handle dynamically injected content in stagger containers
    const staggerContainers = document.querySelectorAll('[data-animate="stagger"]');
    staggerContainers.forEach(container => {
        if (container.children.length === 0) {
            const mo = new MutationObserver(() => {
                if (container.children.length > 0) {
                    mo.disconnect();
                    observer.unobserve(container);
                    observer.observe(container);
                }
            });
            mo.observe(container, { childList: true });
        }
    });
});


// Telephone fields format as they are typed, on every page that loads this
// file. Centralised here rather than per-form so a new form picks it up with
// no extra wiring. Values are still normalised to bare digits on submit.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bindAllPhoneInputs(), { once: true });
} else {
    bindAllPhoneInputs();
}
