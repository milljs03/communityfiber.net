import { db, app } from './config/firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { escapeHtml, safeUrl } from './security.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadNews();
});

async function loadNews() {
    const grid = document.getElementById('news-grid');

    try {
        const newsRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'news');
        const q = query(newsRef, orderBy('date', 'desc'), limit(20)); // Limit to last 20 posts
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <svg class="cfn-icon" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 20px;"><path d="M168 80c-13.3 0-24 10.7-24 24V408c0 8.4-1.4 16.5-4.1 24H440c13.3 0 24-10.7 24-24V104c0-13.3-10.7-24-24-24H168zM72 480c-39.8 0-72-32.2-72-72V112C0 98.7 10.7 88 24 88s24 10.7 24 24V408c0 13.3 10.7 24 24 24s24-10.7 24-24V104c0-39.8 32.2-72 72-72H440c39.8 0 72 32.2 72 72V408c0 39.8-32.2 72-72 72H72zM176 136c0-13.3 10.7-24 24-24h96c13.3 0 24 10.7 24 24v80c0 13.3-10.7 24-24 24H200c-13.3 0-24-10.7-24-24V136zm200-24h32c13.3 0 24 10.7 24 24s-10.7 24-24 24H376c-13.3 0-24-10.7-24-24s10.7-24 24-24zm0 80h32c13.3 0 24 10.7 24 24s-10.7 24-24 24H376c-13.3 0-24-10.7-24-24s10.7-24 24-24zM200 272H408c13.3 0 24 10.7 24 24s-10.7 24-24 24H200c-13.3 0-24-10.7-24-24s10.7-24 24-24zm0 80H408c13.3 0 24 10.7 24 24s-10.7 24-24 24H200c-13.3 0-24-10.7-24-24s10.7-24 24-24z"/></svg>
                    <p>No news updates yet. Check back soon!</p>
                </div>
            `;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const post = doc.data();
            // Format date safely
            let dateStr = "Recent";
            if (post.date) {
                // Handle both Firestore Timestamp and string dates
                const d = post.date.toDate ? post.date.toDate() : new Date(post.date);
                dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            }

            // Determine link target
            const linkUrl = safeUrl(post.linkUrl || '#', '#');
            const linkText = escapeHtml(post.linkText || 'Read More');
            const target = /^https?:\/\//i.test(linkUrl) ? '_blank' : '_self';
            const image = safeUrl(post.imageUrl || 'assets/images/community-fiber-logo.png', 'assets/images/community-fiber-logo.png', { allowDataImage: true });
            const title = escapeHtml(post.title || 'Community Fiber update');

            html += `
                <article class="news-card fade-in">
                    <div class="news-image">
                        <img src="${image}" alt="${title}" loading="lazy" onerror="this.src='assets/images/community-fiber-logo.png'">
                    </div>
                    <div class="news-content">
                        <span class="news-date">${escapeHtml(dateStr)}</span>
                        <h3 class="news-title">${title}</h3>
                        <p class="news-excerpt">${escapeHtml(post.excerpt || '')}</p>
                        <a href="${linkUrl}" class="news-link" target="${target}" rel="noopener noreferrer">
                            ${linkText} <svg class="cfn-icon cfn-icon--chevron" viewBox="0 0 320 512" fill="currentColor" aria-hidden="true"><path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>
                        </a>
                    </div>
                </article>
            `;
        });

        grid.innerHTML = html;

        // Trigger animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                }
            });
        });

        document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    } catch (err) {
        console.error("Error loading news:", err);
        grid.innerHTML = '<p style="color:red; text-align:center;">Unable to load news updates.</p>';
    }
}
