import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics, isSupported as isAnalyticsSupported } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";
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
let analytics = null;
const appCheck = appCheckConfig.recaptchaV3SiteKey
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckConfig.recaptchaV3SiteKey),
      isTokenAutoRefreshEnabled: true
    })
  : null;

isAnalyticsSupported()
  .then((supported) => {
    if (supported) analytics = getAnalytics(app);
  })
  .catch((error) => {
    console.warn('Firebase Analytics unavailable in this browser.', error);
  });

export { app, db, analytics, appCheck };
