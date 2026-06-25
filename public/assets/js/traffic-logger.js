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
        console.log(`[Analytics] Logged visit to ${page}`);

    } catch (err) {
        // Silent fail for analytics
        console.warn("[Analytics] Logging failed", err);
    }
}

// Run logic
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', logVisit);
} else {
    logVisit();
}
