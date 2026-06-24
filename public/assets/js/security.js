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

    if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../') || /^[a-z0-9/_-]+\.html(?:[?#].*)?$/i.test(raw)) {
        return raw;
    }

    if (allowDataImage && /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(raw)) {
        return raw;
    }

    try {
        const parsed = new URL(raw, window.location.origin);
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

export function getSessionId() {
    const key = 'cfn_submission_session_id';
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(key, sessionId);
    }
    return sessionId;
}

export async function postJson(url, payload) {
    const sessionId = getSessionId();
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CFN-Session': sessionId
        },
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
