import { db, app } from './config/firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { bindFormSpamSignals, escapeHtml, normalizeEmailInput, normalizePhoneInput, postJson, safeUrl } from './security.js';
import { loadWhenVisible } from './services/lazy-section.js';

const pageLoadTime = Date.now(); // Track when the page loaded

const normalize = (str) => typeof str === 'string' ? str.trim() : '';

/* loadBusinessLogos() removed with the customer logo ribbon: using a
 * customer mark implies their endorsement and needs written permission we do
 * not have. The business_logos collection and its admin tab are untouched, so
 * this can come back once permissions are on file.
 */

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

