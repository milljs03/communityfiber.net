import { db, app } from './config/firebase-config.js';
import { collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    // --- Collapsible Team Section Logic ---
    const teamSection = document.querySelector('.team-section');
    if (teamSection) {
        // Create Toggle Button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'team-toggle-btn';
        toggleBtn.innerHTML = 'Meet Our Team <i class="fa-solid fa-chevron-down" style="margin-left:8px;"></i>';
        
        // Remove inline styles to allow CSS to control appearance
        // toggleBtn.style.cssText = `...`; 
        
        // Insert button before the grid
        const teamGrid = teamSection.querySelector('.team-grid');
        teamSection.insertBefore(toggleBtn, teamGrid);
        
        // Initial State: Hidden
        teamGrid.style.display = 'none';
        
        // Toggle Logic
        toggleBtn.addEventListener('click', () => {
            if (teamGrid.style.display === 'none') {
                teamGrid.style.display = 'grid';
                toggleBtn.innerHTML = 'Hide Team <i class="fa-solid fa-chevron-up" style="margin-left:8px;"></i>';
                // Trigger animation for "You" card if it exists
                const mirrorCard = document.querySelector('.mirror-card');
                if(mirrorCard) mirrorCard.classList.add('is-visible');
                
                // Trigger scroll handler once to set initial position
                handleScroll();
            } else {
                teamGrid.style.display = 'none';
                toggleBtn.innerHTML = 'Meet Our Team <i class="fa-solid fa-chevron-down" style="margin-left:8px;"></i>';
            }
        });
    }

    // --- Mirror Scroll Effect ---
    function handleScroll() {
        const mirrorEffect = document.querySelector('.mirror-effect');
        if (!mirrorEffect) return;

        const rect = mirrorEffect.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Calculate progress: 0 when entering bottom, 1 when leaving top
        // We want the shine to move as it traverses the middle of the screen
        
        // Check if element is in view
        if (rect.top < windowHeight && rect.bottom > 0) {
            // Normalize position: 0 (bottom of screen) to 1 (top of screen)
            // Or better: 0 (start of shine) to 1 (end of shine)
            // Let's make it shine from -100% to 200% as it scrolls from bottom 10% to top 10%
            
            const position = 1 - (rect.top / windowHeight);
            
            // Clamp roughly between 0 and 1 for the relevant scroll area
            // We map the viewport position to a percentage for the shine
            // position 0 = bottom of screen, position 1 = top of screen
            
            // Move shine from -100% to 200%
            const shinePos = (position * 300) - 100; 
            
            mirrorEffect.style.setProperty('--shine-pos', `${shinePos}%`);
        }
    }

    window.addEventListener('scroll', handleScroll);
    // Call once to init
    handleScroll();


    // --- Fetch Employees ---
    const container = document.getElementById('employees-container');
    if (!container) return;

    try {
        const q = query(collection(db, 'artifacts', '162296779236', 'public', 'data', 'employees')); 
        const snapshot = await getDocs(q);
        
        snapshot.forEach(doc => {
            const emp = doc.data();
            const card = document.createElement('div');
            card.className = 'employee-card fade-in-section';
            
            // Handle image logic
            let imgHtml = '';
            if (emp.photoUrl) {
                imgHtml = `<img src="${emp.photoUrl}" alt="${emp.name}">`;
            } else {
                imgHtml = `<div style="width:100%; height:100%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:3rem;"><i class="fa-solid fa-user"></i></div>`;
            }

            card.innerHTML = `
                <div class="employee-photo">
                    ${imgHtml}
                </div>
                <div class="employee-info">
                    <h3>${emp.name}</h3>
                    <p class="employee-title">${emp.title}</p>
                    <div class="employee-stats">
                        <span class="years-badge">${emp.years} Years</span>
                    </div>
                    <p class="employee-fact">Fun fact about me: "${emp.fact}"</p>
                </div>
            `;
            container.appendChild(card);
        });

        // Trigger animations for new elements
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('is-visible');
            });
        }, { threshold: 0.1 });

        // Observe elements but only if container is visible (handled by toggle above implicitly when shown)
        // We attach observer anyway so when they become visible via display:grid, animation can trigger
        document.querySelectorAll('.employee-card.fade-in-section').forEach(el => observer.observe(el));

    } catch (err) {
        console.error("Error loading employees:", err);
    }
});