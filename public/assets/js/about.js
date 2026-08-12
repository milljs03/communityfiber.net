import { db, app } from './config/firebase-config.js';
import { collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { escapeHtml, safeUrl } from './security.js';

/**
 * TEMPORARY: team section is hidden until every employee photo is uploaded.
 *
 * Flip this back to `true` to restore the "Meet Our Team" button and the
 * employee grid. Two other places were changed alongside it and should be
 * reverted at the same time — both are marked with the same note:
 *   - assets/js/standard-header.js  (the "Meet the Team" nav link)
 *   - index.html                    (the About Us card's link label)
 */
const SHOW_TEAM_SECTION = false;

document.addEventListener('DOMContentLoaded', async () => {

    // --- Slideshow Logic ---
    const slideshowContainer = document.querySelector('.slideshow-container');
    if (slideshowContainer) {
        let slideIndex = 1;
        let slideInterval;

        const showSlides = (n) => {
            let i;
            let slides = document.getElementsByClassName("mySlides");
            let dots = document.getElementsByClassName("dot");

            if (n > slides.length) {slideIndex = 1}
            if (n < 1) {slideIndex = slides.length}

            for (i = 0; i < slides.length; i++) {
                slides[i].style.display = "none";
            }
            for (i = 0; i < dots.length; i++) {
                dots[i].className = dots[i].className.replace(" active", "");
            }

            if (slides[slideIndex-1]) {
                slides[slideIndex-1].style.display = "block";
            }
            if (dots[slideIndex-1]) {
                dots[slideIndex-1].classList.add("active");
            }
        };

        const plusSlides = (n) => {
            clearInterval(slideInterval);
            showSlides(slideIndex += n);
            startAutoSlide();
        };

        const currentSlide = (n) => {
            clearInterval(slideInterval);
            showSlides(slideIndex = n);
            startAutoSlide();
        };

        const startAutoSlide = () => {
            clearInterval(slideInterval); // Clear existing to avoid multiples
            slideInterval = setInterval(() => {
                slideIndex++;
                showSlides(slideIndex);
            }, 5000); // 5 seconds
        };

        // Event Listeners for controls
        const prevBtn = document.getElementById('prevSlide');
        const nextBtn = document.getElementById('nextSlide');

        if(prevBtn) prevBtn.addEventListener('click', (e) => { e.preventDefault(); plusSlides(-1); });
        if(nextBtn) nextBtn.addEventListener('click', (e) => { e.preventDefault(); plusSlides(1); });

        // Event Listeners for dots
        document.querySelectorAll('.dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const n = parseInt(dot.getAttribute('data-slide'));
                currentSlide(n);
            });
        });

        // Init
        showSlides(slideIndex);
        startAutoSlide();
    }


    // --- Collapsible Team Section Logic ---
    const teamSection = document.querySelector('.team-section');
    if (teamSection && !SHOW_TEAM_SECTION) {
        // Hidden until the team photos are ready. Removing it from the layout
        // (rather than just skipping the button) keeps the empty grid and the
        // "You" placeholder card from rendering on their own.
        teamSection.style.display = 'none';
        teamSection.setAttribute('aria-hidden', 'true');
    } else if (teamSection) {
        // Create Toggle Button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'team-toggle-btn';
        toggleBtn.innerHTML = 'Meet Our Team <svg class="cfn-icon" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" style="margin-left:8px;"><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>';

        // Insert button before the grid
        const teamGrid = teamSection.querySelector('.team-grid');
        teamSection.insertBefore(toggleBtn, teamGrid);

        // Initial State: Hidden
        teamGrid.style.display = 'none';

        const showTeamGrid = () => {
            teamGrid.style.display = 'grid';
            toggleBtn.innerHTML = 'Hide Team <svg class="cfn-icon" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" style="margin-left:8px;"><path d="M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z"/></svg>';
            const mirrorCard = document.querySelector('.mirror-card');
            if (mirrorCard) mirrorCard.classList.add('is-visible');
            handleScroll();
        };

        const hideTeamGrid = () => {
            teamGrid.style.display = 'none';
            toggleBtn.innerHTML = 'Meet Our Team <svg class="cfn-icon" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" style="margin-left:8px;"><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>';
        };

        // Toggle Logic
        toggleBtn.addEventListener('click', () => {
            if (teamGrid.style.display === 'none') {
                showTeamGrid();
            } else {
                hideTeamGrid();
            }
        });

        // Open the section when arriving via anchor links.
        const shouldOpenTeamFromHash = () => {
            return window.location.hash === '#team-section' || window.location.hash === '#employees-container';
        };

        if (shouldOpenTeamFromHash()) {
            showTeamGrid();
        }

        window.addEventListener('hashchange', () => {
            if (shouldOpenTeamFromHash() && teamGrid.style.display === 'none') {
                showTeamGrid();
            }
        });
    }

    // --- Mirror Scroll Effect ---
    function handleScroll() {
        const mirrorEffect = document.querySelector('.mirror-effect');
        if (!mirrorEffect) return;

        const rect = mirrorEffect.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Check if element is in view
        if (rect.top < windowHeight && rect.bottom > 0) {
            // Position normalized
            const position = 1 - (rect.top / windowHeight);

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
    // Nothing is rendered while the section is hidden, so skip the read.
    if (!SHOW_TEAM_SECTION) return;

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
                imgHtml = `<img src="${safeUrl(emp.photoUrl, 'assets/images/community-fiber-logo.png', { allowDataImage: true })}" alt="${escapeHtml(emp.name || 'Team member')}">`;
            } else {
                imgHtml = `<div style="width:100%; height:100%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:3rem;"><svg class="cfn-icon" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg></div>`;
            }

            card.innerHTML = `
                <div class="employee-photo">
                    ${imgHtml}
                </div>
                <div class="employee-info">
                    <h3>${escapeHtml(emp.name || '')}</h3>
                    <p class="employee-title">${escapeHtml(emp.title || '')}</p>
                    <div class="employee-stats">
                        <span class="years-badge">Team member for ${escapeHtml(emp.years || '')} Years</span>
                    </div>
                    <p class="employee-fact">Fun fact about me: "${escapeHtml(emp.fact || '')}"</p>
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
        document.querySelectorAll('.employee-card.fade-in-section').forEach(el => observer.observe(el));

    } catch (err) {
        console.error("Error loading employees:", err);
    }
});
