import { db, app } from './config/firebase-config.js';
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    // --- 0. Animation Observer ---
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in, .fade-in-section').forEach(el => observer.observe(el));

    // 1. Initialize Auth
    const auth = getAuth(app);
    try {
        await signInAnonymously(auth);
    } catch (err) {
        console.warn("Auth initialization warning:", err);
    }

    const topicCards = document.querySelectorAll('.topic-card');
    const formSection = document.getElementById('form-section');
    const formTitle = document.getElementById('form-title');
    const topicInput = document.getElementById('topic-input');
    const supportForm = document.getElementById('support-form');
    
    // 2. Topic Selection Logic
    topicCards.forEach(card => {
        card.addEventListener('click', () => {
            // UI Toggle
            topicCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            // Show Form
            formSection.classList.remove('hidden');
            
            // Trigger Animation with slight delay for smooth transition
            setTimeout(() => {
                formSection.classList.add('is-visible');
            }, 50);
            
            // Update Data
            const topic = card.dataset.topic;
            const title = card.querySelector('.topic-title').innerText;
            
            topicInput.value = topic;
            formTitle.innerText = `${title} Request`;
            
            updateFormFields(topic);

            // Smooth Scroll
            formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // 3. Form Submission
    supportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('submit-btn');
        const originalBtnText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Sending...";

        try {
            const formData = {
                topic: topicInput.value,
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                message: document.getElementById('message').value,
                status: 'new',
                createdAt: new Date()
            };

            // Optional Fields
            const address = document.getElementById('address');
            if(address && address.offsetParent !== null) formData.address = address.value;

            const acctNum = document.getElementById('account-number');
            if(acctNum && acctNum.offsetParent !== null) formData.accountNumber = acctNum.value;

            const issueType = document.getElementById('issue-type');
            if(issueType && issueType.offsetParent !== null) formData.issueType = issueType.value;

            // Submit
            await addDoc(collection(db, 'artifacts', '162296779236', 'public', 'data', 'support_tickets'), formData);

            // UI Success
            formSection.classList.add('hidden'); // Hide form
            document.getElementById('success-message').classList.remove('hidden'); // Show success
            
            // Scroll to top of main content
            document.querySelector('.main-content').scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error("Submission error:", error);
            alert("There was an error submitting your request. Please try again.");
            btn.disabled = false;
            btn.innerText = originalBtnText;
        }
    });
});

function updateFormFields(topic) {
    // Reset
    document.querySelectorAll('.dynamic-field').forEach(el => el.classList.add('hidden'));
    const addr = document.getElementById('address');
    if(addr) addr.required = false;

    // Logic
    if (topic === 'billing') {
        document.getElementById('field-billing').classList.remove('hidden');
    } 
    else if (topic === 'service') {
        document.getElementById('field-address').classList.remove('hidden');
        document.getElementById('field-service-type').classList.remove('hidden');
        if(addr) addr.required = true;
    } 
    else if (topic === 'outage' || topic === 'availability') {
        document.getElementById('field-address').classList.remove('hidden');
        if(addr) addr.required = true;
    }
}