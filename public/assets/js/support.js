import { db, app } from './config/firebase-config.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    // 1. Animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
    });
    document.querySelectorAll('.fade-in-section').forEach(el => observer.observe(el));

    // 2. Auth Init
    const auth = getAuth(app);
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));

    // 3. Topic Selection Logic (Moved inside DOMContentLoaded)
    const topicButtons = document.querySelectorAll('.topic-card');
    const formSection = document.getElementById('form-section');
    const topicInput = document.getElementById('topic-input');
    const formTitle = document.getElementById('form-title');
    const dynamicFields = document.querySelectorAll('.dynamic-field');

    if (topicButtons.length === 0) {
        console.warn("No topic buttons found!");
    }

    topicButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const topic = btn.dataset.topic;
            
            // Show Form
            if (formSection) {
                formSection.classList.remove('hidden');
                // Small timeout to allow display:block to apply before scrolling
                setTimeout(() => {
                    formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 10);
            }
            
            // Set Topic
            if (topicInput) topicInput.value = topic;
            if (formTitle) formTitle.textContent = `Submit Request: ${btn.querySelector('.topic-title').textContent}`;

            // Reset & Show relevant fields
            dynamicFields.forEach(field => field.classList.add('hidden'));
            
            if (topic === 'billing') document.getElementById('field-billing')?.classList.remove('hidden');
            if (topic === 'availability') document.getElementById('field-address')?.classList.remove('hidden');
            if (topic === 'service') document.getElementById('field-service-type')?.classList.remove('hidden');
            if (topic === 'outage') document.getElementById('field-address')?.classList.remove('hidden');
        });
    });

    // 4. Form Submit Logic
    const form = document.getElementById('support-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('submit-btn');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Submitting...";

            const formData = {
                type: 'support_ticket',
                topic: topicInput ? topicInput.value : 'general',
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                message: document.getElementById('message').value,
                submittedAt: new Date(),
                status: 'new'
            };

            // Add dynamic fields if visible
            const accNum = document.getElementById('account-number');
            if(accNum && !accNum.closest('.hidden')) formData.accountNumber = accNum.value;

            const addr = document.getElementById('address');
            if(addr && !addr.closest('.hidden')) formData.address = addr.value;

            const issue = document.getElementById('issue-type');
            if(issue && !issue.closest('.hidden')) formData.issueType = issue.value;

            try {
                // Ensure auth
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }

                await addDoc(collection(db, 'artifacts', '162296779236', 'public', 'data', 'leads'), formData);
                
                document.querySelector('.form-container').style.display = 'none';
                const successMsg = document.getElementById('success-message');
                if (successMsg) {
                    successMsg.classList.remove('hidden');
                    successMsg.style.display = 'block';
                }

            } catch (err) {
                console.error("Support Submit Error:", err);
                alert("Error submitting ticket. Please try again. " + err.message);
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }
});