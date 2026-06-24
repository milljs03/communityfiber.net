import { postJson } from './security.js';

document.addEventListener('DOMContentLoaded', () => {
    const pageLoadTime = Date.now(); // Track when the page loaded

    const normalize = (str) => typeof str === 'string' ? str.trim() : '';

    // 1. Animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
    });
    document.querySelectorAll('.fade-in-section').forEach(el => observer.observe(el));

    // 2. Form Topic Logic
    const topicSelect = document.getElementById('topic-select');
    const dynamicFields = document.querySelectorAll('.dynamic-field');
    
    if (topicSelect) {
        topicSelect.addEventListener('change', () => {
            const topic = topicSelect.value;
    
            // Hide all dynamic fields first
            dynamicFields.forEach(field => field.classList.add('hidden'));
    
            // Show fields based on selected topic
            if (topic === 'billing') {
                document.getElementById('field-billing')?.classList.remove('hidden');
            } else if (topic === 'availability' || topic === 'outage') {
                document.getElementById('field-address')?.classList.remove('hidden');
            } else if (topic === 'service') {
                document.getElementById('field-service-type')?.classList.remove('hidden');
            }
        });
    }

    // 3. Form Submit Logic
    const form = document.getElementById('support-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // --- SPAM PROTECTION ---
            const honeypot = document.getElementById('website-check');
            const isTooFast = (Date.now() - pageLoadTime) < 2000; // Block if submitted in < 2 seconds

            if ((honeypot && honeypot.value) || isTooFast) {
                console.warn("Spam detected. Submission blocked.");
                // Fake success to discourage retries
                document.querySelector('.form-container').style.display = 'none';
                const successMsg = document.getElementById('success-message');
                if (successMsg) {
                    successMsg.classList.remove('hidden');
                    successMsg.style.display = 'block';
                }
                return; // Stop execution
            }
            // -----------------------

            const btn = document.getElementById('submit-btn');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Submitting...";

            const formData = {
                type: 'support_ticket',
                topic: topicSelect ? normalize(topicSelect.value) : 'general',
                name: normalize(document.getElementById('name').value),
                email: normalize(document.getElementById('email').value),
                phone: normalize(document.getElementById('phone').value),
                message: normalize(document.getElementById('message').value),
                website_check: honeypot ? honeypot.value : ''
            };

            // Add dynamic fields if visible
            const accNum = document.getElementById('account-number');
            if(accNum && !accNum.closest('.hidden')) formData.accountNumber = normalize(accNum.value);

            const addr = document.getElementById('address');
            if(addr && !addr.closest('.hidden')) formData.address = normalize(addr.value);

            const issue = document.getElementById('issue-type');
            if(issue && !issue.closest('.hidden')) formData.issueType = normalize(issue.value);

            try {
                await postJson('/api/submitLead', formData);
                
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

    // 4. FAQ Accordion Logic
    const faqItems = document.querySelectorAll('.faq-item');
    if (faqItems.length > 0) {
        faqItems.forEach(item => {
            item.addEventListener('toggle', (event) => {
                if (item.open) {
                    // Close all other items
                    faqItems.forEach(otherItem => {
                        if (otherItem !== item && otherItem.open) {
                            otherItem.open = false;
                        }
                    });
                }
            });
        });
    }
});
