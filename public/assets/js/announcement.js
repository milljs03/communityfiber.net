import { db, app } from './config/firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const docRef = doc(db, 'artifacts', '162296779236', 'public', 'data', 'settings', 'banner');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.active && data.message) {
                showBanner(data.message, data.type);
            }
        }
    } catch (err) {
        console.warn("Could not load banner settings", err);
    }
});

function showBanner(message, type = 'info') {
    // Determine colors
    let bg = '#3b82f6'; // info blue
    let icon = 'fa-circle-info';
    
    if (type === 'warning') { bg = '#f97316'; icon = 'fa-triangle-exclamation'; }
    if (type === 'alert') { bg = '#ef4444'; icon = 'fa-bell'; }
    if (type === 'success') { bg = '#22c55e'; icon = 'fa-check-circle'; }

    const bannerHtml = `
        <div id="site-announcement" style="background-color: ${bg}; color: white; padding: 12px; text-align: center; font-weight: 600; font-family: var(--font-body); position: relative; z-index: 10000; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: center; align-items: center; gap: 10px;">
                <i class="fa-solid ${icon}"></i>
                <span>${message}</span>
            </div>
            <button onclick="document.getElementById('site-announcement').remove()" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem;">&times;</button>
        </div>
    `;

    // Insert at the very top of body
    document.body.insertAdjacentHTML('afterbegin', bannerHtml);
}