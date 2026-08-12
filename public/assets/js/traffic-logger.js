import { getSessionId as getSharedSessionId, postJson } from './security.js';

const LOG_COOLDOWN = 1000 * 60 * 5; // 5 minutes cooldown per page to avoid refresh spam

function getSessionId() {
    return getSharedSessionId();
}

function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return "tablet";
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
        return "mobile";
    }
    return "desktop";
}

async function logVisit() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const storageKey = `last_visit_${page}`;
    const lastVisit = localStorage.getItem(storageKey);
    const now = Date.now();

    // Check cooldown
    if (lastVisit && (now - parseInt(lastVisit) < LOG_COOLDOWN)) {
        return;
    }

    try {
        const visitData = {
            page: page,
            sessionId: getSessionId(),
            referrer: document.referrer || 'direct',
            deviceType: getDeviceType(),
            screen: `${window.screen.width}x${window.screen.height}`,
            language: navigator.language || 'en-US',
            userAgent: navigator.userAgent
        };

        await postJson('/api/logPageView', visitData);
        localStorage.setItem(storageKey, now.toString());

    } catch (err) {
        // Start the cooldown even when the call failed. Without this the
        // timestamp is never written, so every subsequent page load retries
        // immediately and keeps hitting the same wall.
        localStorage.setItem(storageKey, now.toString());

        // 429 is the server's own rate limiter doing its job — expected
        // backpressure, not a fault worth reporting. Analytics is best effort;
        // nothing the visitor sees depends on it.
        if (err?.status !== 429) {
            console.debug('[Analytics] pageview not recorded:', err?.message || err);
        }
    }
}

// Run logic — analytics must never compete with rendering, so wait until the
// page has loaded and the main thread is idle before touching the network.
function scheduleLogVisit() {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
    idle(() => { logVisit(); }, { timeout: 5000 });
}

if (document.readyState === 'complete') {
    scheduleLogVisit();
} else {
    window.addEventListener('load', scheduleLogVisit, { once: true });
}
