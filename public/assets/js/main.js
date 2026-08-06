// public/assets/js/main.js

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
    const input = document.getElementById('cfn-address-input');
    if (!input) return;

    ensureAddressSearchStyles();

    const container = input.closest('.availability-search-container') || input.parentElement;
    const suggestions = document.createElement('div');
    suggestions.id = 'cfn-address-suggestions';
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
            <button type="button" id="cfn-address-suggestion-${index}" class="cfn-address-suggestion" role="option" data-index="${index}">
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

function redirectToApp(address, siteSource) {
  if (isRedirecting) return;
  if (!hasMinimumGoogleSearchInput(address)) return;
  isRedirecting = true;

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
