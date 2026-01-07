import { db, app } from './config/firebase-config.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const LOG_COOLDOWN = 1000 * 60 * 5; // 5 minutes cooldown per page to avoid refresh spam

function getSessionId() {
    let sid = sessionStorage.getItem('analytics_session_id');
    if (!sid) {
        sid = crypto.randomUUID();
        sessionStorage.setItem('analytics_session_id', sid);
    }
    return sid;
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
        const auth = getAuth(app);
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }

        const visitData = {
            page: page,
            timestamp: new Date(),
            sessionId: getSessionId(),
            referrer: document.referrer || 'direct',
            deviceType: getDeviceType(),
            screen: `${window.screen.width}x${window.screen.height}`,
            language: navigator.language || 'en-US',
            userAgent: navigator.userAgent
        };

        // Fire and forget
        await addDoc(collection(db, 'artifacts', '162296779236', 'public', 'data', 'analytics_pageviews'), visitData);

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