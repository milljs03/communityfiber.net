import { postJson } from './security.js';

const pageLoadTime = Date.now(); // Track when the page loaded

const normalize = (str) => typeof str === 'string' ? str.trim() : '';

// Animation Logic
document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in-section').forEach(el => observer.observe(el));

});

// Form Handling
const form = document.getElementById('builder-form');
const submitBtn = document.getElementById('submit-btn');
const successMsg = document.getElementById('success-message');

if(form) {
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

        // UI Feedback
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        // Gather Data
        const formData = {
            type: 'builder_inquiry',
            company: normalize(document.getElementById('company-name').value),
            contactName: normalize(document.getElementById('contact-name').value),
            phone: normalize(document.getElementById('contact-phone').value),
            email: normalize(document.getElementById('contact-email').value),
            projectType: normalize(document.getElementById('project-type').value),
            details: normalize(document.getElementById('project-details').value),
            website_check: honeypot ? honeypot.value : ''
        };

        try {
            await postJson('/api/submitLead', formData);

            // Success State
            form.style.display = 'none';
            successMsg.classList.remove('hidden');
            successMsg.style.display = 'block'; // Ensure visibility

        } catch (error) {
            console.error("Error submitting builder inquiry:", error);
            alert("There was an error submitting your request. Please try again later.");
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}
