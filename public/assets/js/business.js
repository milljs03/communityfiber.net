import { db, app } from './config/firebase-config.js';
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Animation Observer (Fade In effects)
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

    // 2. Initialize Auth
    const auth = getAuth(app);
    try {
        await signInAnonymously(auth);
    } catch (err) {
        console.warn("Auth warning:", err);
    }

    // 3. Handle Form Submission
    const form = document.getElementById('business-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = document.getElementById('submit-btn');
            const originalText = btn.innerText;
            btn.innerText = "Submitting...";
            btn.disabled = true;

            try {
                // Collect Data
                const formData = {
                    type: 'business_inquiry',
                    businessName: document.getElementById('business-name').value,
                    contactName: document.getElementById('contact-name').value,
                    phone: document.getElementById('contact-phone').value,
                    email: document.getElementById('contact-email').value,
                    address: document.getElementById('business-address').value,
                    requirements: document.getElementById('requirements').value,
                    submittedAt: new Date(),
                    status: 'new'
                };

                // Save to Firestore 'business_leads' collection
                // Note: Using public path based on rules, ideally this goes to a private collection in a real app
                await addDoc(collection(db, 'artifacts', '162296779236', 'public', 'data', 'business_leads'), formData);

                // Show Success
                form.style.display = 'none';
                document.getElementById('success-message').classList.remove('hidden');

            } catch (error) {
                console.error("Error submitting business quote:", error);
                alert("There was a problem submitting your request. Please try again later.");
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});