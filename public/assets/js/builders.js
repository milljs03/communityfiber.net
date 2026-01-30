import { db, app } from './config/firebase-config.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const pageLoadTime = Date.now(); // Track when the page loaded

// Helper: Sanitize Input to prevent XSS
const sanitize = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').trim();
};

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
    
    // Auth Init
    const auth = getAuth(app);
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
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
            company: sanitize(document.getElementById('company-name').value),
            contactName: sanitize(document.getElementById('contact-name').value),
            phone: sanitize(document.getElementById('contact-phone').value),
            email: sanitize(document.getElementById('contact-email').value),
            projectType: sanitize(document.getElementById('project-type').value),
            details: sanitize(document.getElementById('project-details').value),
            submittedAt: new Date(),
            status: 'new'
        };

        try {
            // Ensure auth before write
            const auth = getAuth(app);
            if (!auth.currentUser) {
                await signInAnonymously(auth);
            }

            // Write to Firestore (Use correct path)
            const colRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'leads');
            await addDoc(colRef, formData);

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