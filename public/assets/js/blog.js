import { db, app } from './config/firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
                    <i class="fa-regular fa-newspaper" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 20px;"></i>
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
            const linkUrl = post.linkUrl || '#';
            const linkText = post.linkText || 'Read More';
            const target = linkUrl.startsWith('http') ? '_blank' : '_self';
            const image = post.imageUrl || 'assets/images/community-fiber-logo.png'; // Fallback image

            html += `
                <article class="news-card fade-in">
                    <div class="news-image">
                        <img src="${image}" alt="${post.title}" loading="lazy" onerror="this.src='assets/images/community-fiber-logo.png'">
                    </div>
                    <div class="news-content">
                        <span class="news-date">${dateStr}</span>
                        <h3 class="news-title">${post.title}</h3>
                        <p class="news-excerpt">${post.excerpt}</p>
                        <a href="${linkUrl}" class="news-link" target="${target}">
                            ${linkText} <i class="fa-solid fa-arrow-right-long"></i>
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