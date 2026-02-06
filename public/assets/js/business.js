import { db, app } from './config/firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const pageLoadTime = Date.now(); // Track when the page loaded

// Helper: Sanitize Input to prevent XSS
const sanitize = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').trim();
};

// Load business logos into carousel
async function loadBusinessLogos() {
    const track = document.getElementById('logo-track');
    if (!track) return;

    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'business_logos');
        const q = query(ref, orderBy('name', 'asc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return; // No new logos, do nothing.
        }

        // Get HTML of hardcoded logos from the first set
        const originalSlides = Array.from(track.querySelectorAll('.logo-slide'));
        const halfwayPoint = originalSlides.length / 2;
        const hardcodedLogosHtml = originalSlides.slice(0, halfwayPoint).map(slide => slide.outerHTML).join('');

        const dynamicLogosHtml = snapshot.docs.map(doc => {
            const logo = doc.data();
            return `<div class="logo-slide"><img src="${logo.logoUrl}" alt="${sanitize(logo.name)}"></div>`;
        }).join('');

        // Combine and rebuild
        const combinedSetHtml = hardcodedLogosHtml + dynamicLogosHtml;
        track.innerHTML = combinedSetHtml + combinedSetHtml;

        // Recalculate animation
        const singleSetCount = halfwayPoint + snapshot.size;
        const totalSlides = singleSetCount * 2;
        
        track.style.width = `${totalSlides * 200}px`;

        const styleElement = document.createElement('style');
        styleElement.innerHTML = `@keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-${singleSetCount * 200}px); } }`;
        document.head.appendChild(styleElement);

    } catch (err) {
        console.error("Error loading dynamic business logos:", err);
    }
}

// Animation Logic
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in-section').forEach(el => observer.observe(el));

    // Auth Init
    const auth = getAuth(app);
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));

    loadBusinessLogos();
});

// Form Logic
const form = document.getElementById('business-form');
const successMsg = document.getElementById('success-message');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // --- SPAM PROTECTION ---
        const honeypot = document.getElementById('website-check');
        const isTooFast = (Date.now() - pageLoadTime) < 2000; // Block if submitted in < 2 seconds

        if ((honeypot && honeypot.value) || isTooFast) {
            console.warn("Spam detected. Submission blocked.");
            // Fake success to discourage retries
            form.style.display = 'none';
            successMsg.classList.remove('hidden');
            successMsg.style.display = 'block';
            return; // Stop execution
        }
        // -----------------------

        const btn = document.getElementById('submit-btn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Sending...";

        const formData = {
            type: 'business_quote',
            businessName: sanitize(document.getElementById('business-name').value),
            contactName: sanitize(document.getElementById('contact-name').value),
            phone: sanitize(document.getElementById('contact-phone').value),
            email: sanitize(document.getElementById('contact-email').value),
            address: sanitize(document.getElementById('business-address').value),
            requirements: sanitize(document.getElementById('requirements').value),
            submittedAt: new Date(),
            status: 'new'
        };

        try {
            // Ensure auth
            const auth = getAuth(app);
            if (!auth.currentUser) {
                await signInAnonymously(auth);
            }

            await addDoc(collection(db, 'artifacts', '162296779236', 'public', 'data', 'leads'), formData);
            
            form.style.display = 'none';
            successMsg.classList.remove('hidden');
            successMsg.style.display = 'block';

        } catch (err) {
            console.error("Submission Error:", err);
            alert("Error sending request. Please call us directly.");
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}