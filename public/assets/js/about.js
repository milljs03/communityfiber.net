import { renderTeamGrid } from './services/team-grid.js';


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


    // --- Team ---
    // Always rendered; there is no toggle. Cards come from the shared module so
    // About and the per-page sections stay identical.
    renderTeamGrid(document.getElementById('employees-container'), 'about');
});
