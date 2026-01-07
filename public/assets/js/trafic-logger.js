import { db, app } from './config/firebase-config.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const LOG_COOLDOWN = 1000 * 60 * 30; // 30 minutes cooldown per page/session to avoid spamming

async function logVisit() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const storageKey = `last_visit_${page}`;
    const lastVisit = localStorage.getItem(storageKey);
    const now = Date.now();

    if (lastVisit && (now - parseInt(lastVisit) < LOG_COOLDOWN)) {
        return; // Skip logging if visited recently
    }

    try {
        const auth = getAuth(app);
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }

        await addDoc(collection(db, 'artifacts', '162296779236', 'public', 'data', 'analytics_pageviews'), {
            page: page,
            timestamp: new Date(),
            referrer: document.referrer || 'direct',
            userAgent: navigator.userAgent
        });

        localStorage.setItem(storageKey, now.toString());
        console.log(`Logged visit to ${page}`);

    } catch (err) {
        console.warn("Analytics logging failed:", err);
    }
}

// Run on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', logVisit);
} else {
    logVisit();
}