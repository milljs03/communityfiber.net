/**
 * Firebase is loaded on demand rather than imported at module scope: most pages
 * only need the helpers below, and a static import would pull the Firebase SDK
 * plus reCAPTCHA onto every page that touches this file.
 */
async function getAppCheckToken() {
    try {
        const [{ getToken }, { getAppCheck }] = await Promise.all([
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js"),
            import('./config/firebase-config.js')
        ]);
        const appCheck = await getAppCheck();
        if (!appCheck) return null;
        const token = await getToken(appCheck);
        return token?.token || null;
    } catch (error) {
        console.warn('App Check token unavailable.', error);
        return null;
    }
}

export function text(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value);
}

export function escapeHtml(value) {
    return text(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function safeUrl(value, fallback = '#', { allowDataImage = false } = {}) {
    const raw = text(value).trim();
    if (!raw) return fallback;

    if (/[\u0000-\u001f\u007f"'<>`]/.test(raw)) {
        return fallback;
    }

    if (raw.startsWith('//')) {
        return fallback;
    }

    if (allowDataImage && /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(raw)) {
        return raw;
    }

    try {
        const origin = window.location.origin;
        const parsed = new URL(raw, origin);
        if (parsed.origin === origin && (
            raw.startsWith('/')
            || raw.startsWith('./')
            || raw.startsWith('../')
            || /^[a-z0-9/_-]+\.html(?:[?#].*)?$/i.test(raw)
        )) {
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }

        if (parsed.protocol === 'https:') {
            return parsed.href;
        }
    } catch (error) {
        return fallback;
    }

    return fallback;
}

export function setText(selectorOrElement, value, fallback = '') {
    const element = typeof selectorOrElement === 'string'
        ? document.querySelector(selectorOrElement)
        : selectorOrElement;
    if (element) element.textContent = text(value, fallback);
}

export function normalizeEmailInput(value) {
    return text(value).trim().toLowerCase();
}

export function normalizePhoneInput(value) {
    let digits = text(value).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
    }
    return digits;
}

/**
 * Render digits as a US phone number: 5748312176 -> (574) 831-2176.
 *
 * The area code stays unwrapped until there are enough digits to need the
 * brackets, so the field never shows a dangling "(" while someone is still
 * typing the first three numbers.
 */
export function formatPhoneNumber(value) {
    const digits = normalizePhoneInput(value).slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Format a phone field as the user types, without the usual cursor problems.
 *
 * Two behaviours make or break this:
 *   - The caret is restored by counting digits rather than characters, so
 *     editing mid-number does not fling the cursor to the end.
 *   - Backspacing over a bracket, space or dash removes the digit before it.
 *     Otherwise the separator is instantly re-added and the key appears dead.
 *
 * Submission is unaffected: every form already runs the value through
 * normalizePhoneInput, which strips this formatting back to bare digits.
 */
export function bindPhoneFormatting(input) {
    const el = typeof input === 'string' ? document.querySelector(input) : input;
    if (!el || el.dataset.phoneFormatted === 'true') return;
    el.dataset.phoneFormatted = 'true';

    if (!el.getAttribute('inputmode')) el.setAttribute('inputmode', 'tel');
    if (!el.getAttribute('autocomplete')) el.setAttribute('autocomplete', 'tel');
    el.setAttribute('maxlength', '14'); // (123) 456-7890

    const digitsBefore = (str, caret) => str.slice(0, caret).replace(/\D/g, '').length;

    el.addEventListener('input', () => {
        // `input` fires after the browser has already applied the edit, so the
        // value here is authoritative. Reformat from its digits and put the
        // caret back where the same number of digits ends. Deliberately no
        // special-casing for deleted separators: reconstructing what the user
        // removed from the post-edit value guesses wrong and eats real digits.
        const caret = el.selectionStart ?? el.value.length;
        const digitCount = digitsBefore(el.value, caret);

        el.value = formatPhoneNumber(el.value);

        let seen = 0;
        let position = 0;
        for (let i = 0; i < el.value.length; i++) {
            if (/\d/.test(el.value[i])) seen++;
            position = i + 1;
            if (seen >= digitCount) break;
        }
        if (digitCount === 0) position = 0;
        el.setSelectionRange(position, position);
    });

    // Catch autofill and programmatic changes, which do not raise `input`.
    el.addEventListener('change', () => { el.value = formatPhoneNumber(el.value); });
    if (el.value) el.value = formatPhoneNumber(el.value);
}

/** Format every telephone field on the page. */
export function bindAllPhoneInputs(root = document) {
    root.querySelectorAll('input[type="tel"]').forEach(bindPhoneFormatting);
}

export function getSessionId() {
    const key = 'cfn_submission_session_id';
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(key, sessionId);
    }
    return sessionId;
}

export function bindFormSpamSignals(form) {
    const startedAt = Date.now();
    let interactions = 0;

    const ensureHiddenInput = (name, initialValue = '') => {
        let input = form.querySelector(`[name="${name}"]`);
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            form.appendChild(input);
        }
        input.value = initialValue;
        return input;
    };

    const startedInput = ensureHiddenInput('form_started_at', String(startedAt));
    const interactionInput = ensureHiddenInput('form_interaction_count', '0');
    const trapNames = new Set(['website_check', 'company_url', 'referral_source']);

    const recordInteraction = (event) => {
        const target = event.target;
        if (target?.name && trapNames.has(target.name)) return;
        interactions += 1;
        interactionInput.value = String(Math.min(interactions, 999));
    };

    ['input', 'change', 'keydown', 'pointerdown', 'touchstart'].forEach((eventName) => {
        form.addEventListener(eventName, recordInteraction, { passive: true });
    });

    return {
        startedAt,
        getPayloadFields() {
            return {
                form_started_at: startedInput.value,
                form_interaction_count: interactionInput.value,
                company_url: form.querySelector('[name="company_url"]')?.value || '',
                referral_source: form.querySelector('[name="referral_source"]')?.value || ''
            };
        }
    };
}

export async function postJson(url, payload) {
    const sessionId = getSessionId();
    const headers = {
        'Content-Type': 'application/json',
        'X-CFN-Session': sessionId
    };

    const appCheckToken = await getAppCheckToken();
    if (appCheckToken) {
        headers['X-Firebase-AppCheck'] = appCheckToken;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ ...payload, sessionId })
    });

    let body = {};
    try {
        body = await response.json();
    } catch (error) {
        body = {};
    }

    if (!response.ok || body.ok === false) {
        const message = body.message || 'Request failed. Please try again.';
        const err = new Error(message);
        err.status = response.status;
        err.code = body.code;
        throw err;
    }

    return body;
}
