import { db, app } from './config/firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { bindFormSpamSignals, escapeHtml, normalizeEmailInput, normalizePhoneInput, postJson, safeUrl } from './security.js';
import { loadWhenVisible } from './services/lazy-section.js';

const pageLoadTime = Date.now(); // Track when the page loaded

const normalize = (str) => typeof str === 'string' ? str.trim() : '';

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
            return `<div class="logo-slide"><img src="${safeUrl(logo.logoUrl, 'assets/images/community-fiber-logo.png', { allowDataImage: true })}" alt="${escapeHtml(logo.name)}"></div>`;
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

    // business_logos stores partner logos as base64 data URIs (~541KB). The
    // carousel is below the fold, so defer the read off the critical path.
    loadWhenVisible('#trusted-partners', loadBusinessLogos);
});

// Form Logic
const form = document.getElementById('business-form');
const successMsg = document.getElementById('success-message');

if (form) {
    const spamSignals = bindFormSpamSignals(form);

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
            businessName: normalize(document.getElementById('business-name').value),
            contactName: normalize(document.getElementById('contact-name').value),
            phone: normalizePhoneInput(document.getElementById('contact-phone').value),
            email: normalizeEmailInput(document.getElementById('contact-email').value),
            address: normalize(document.getElementById('business-address').value),
            requirements: normalize(document.getElementById('requirements').value),
            website_check: honeypot ? honeypot.value : '',
            ...spamSignals.getPayloadFields()
        };

        try {
            await postJson('/api/submitLead', formData);

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

