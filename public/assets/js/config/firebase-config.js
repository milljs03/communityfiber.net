import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { appCheckConfig } from './app-check-config.js';

const firebaseConfig = {
  apiKey: "AIzaSyAkgQq1AziwIGCiviYuuxEwAEKunYLweeA",
  authDomain: "communityfiber-net.firebaseapp.com",
  projectId: "communityfiber-net",
  storageBucket: "communityfiber-net.firebasestorage.app",
  messagingSenderId: "162296779236",
  appId: "1:162296779236:web:daeb2d386ed023a9d3b7f1",
  measurementId: "G-RZ8QH0W95G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * App Check pulls in the reCAPTCHA v3 script (~330KB + ~2s of main-thread work),
 * but it is only required when we POST to the Cloud Functions endpoints —
 * Firestore reads do not enforce it. So load it on demand instead of at boot.
 */
let appCheckPromise = null;
function getAppCheck() {
  if (!appCheckConfig.recaptchaV3SiteKey) return Promise.resolve(null);
  if (!appCheckPromise) {
    appCheckPromise = import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js")
      .then(({ initializeAppCheck, ReCaptchaV3Provider }) => initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckConfig.recaptchaV3SiteKey),
        isTokenAutoRefreshEnabled: true
      }))
      .catch((error) => {
        console.warn('App Check unavailable.', error);
        return null;
      });
  }
  return appCheckPromise;
}

/**
 * Analytics loads gtag.js (~150KB). Nothing renders from it, so keep it off the
 * critical path and start it once the page is idle.
 */
let analytics = null;
function startAnalytics() {
  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js")
    .then(async ({ getAnalytics, isSupported }) => {
      if (await isSupported()) analytics = getAnalytics(app);
    })
    .catch((error) => {
      console.warn('Firebase Analytics unavailable in this browser.', error);
    });
}

if (typeof window !== 'undefined') {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
  if (document.readyState === 'complete') idle(startAnalytics, { timeout: 5000 });
  else window.addEventListener('load', () => idle(startAnalytics, { timeout: 5000 }), { once: true });
}

export { app, db, analytics, getAppCheck };
