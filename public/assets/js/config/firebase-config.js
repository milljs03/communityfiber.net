import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

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
const analytics = getAnalytics(app);

export { app, db, analytics };