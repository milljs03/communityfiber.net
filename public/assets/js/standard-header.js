/**
 * Standard Header Loader
 * This script injects the standard navigation bar into any page.
 * Usage: Place <div id="master-header"></div> at the top of your body.
 */

// Injecting CSS directly to ensure Brand Style Guide compliance
const headerStyles = `
<style>
    /* --- Standard Header CSS Override based on CFN Brand Guide --- */
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Open+Sans:wght@400;600&display=swap');

    :root {
        --cfn-green: #03A63C;
        --cfn-dark-green: #0B8C38;
        --cfn-mute-green: #46A66F;
        --cfn-light-green: #8BD9AD;
        --npt-black: #141414;
        --npt-white: #FFFFFF;
        --font-heading: 'Montserrat', sans-serif;
        --font-body: 'Open Sans', sans-serif;
    }

    .main-header {
        background-color: var(--npt-white);
        box-shadow: 0 4px 20px rgba(0,0,0,0.05);
        position: sticky;
        top: 0;
        z-index: 9999;
        font-family: var(--font-body);
        height: 90px; /* Fixed height for stability */
        display: flex;
        align-items: center;
    }

    .nav-container {
        width: 100%;
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 100%;
    }

    /* Logo */
    .nav-logo {
        display: flex;
        align-items: center;
        text-decoration: none;
        height: 100%;
    }

    .nav-logo img {
        height: 55px; /* Adjust based on logo aspect ratio */
        width: auto;
        display: block;
    }

    /* Top Level Links */
    .nav-menu {
        display: flex;
        list-style: none;
        gap: 2.5rem;
        margin: 0;
        padding: 0;
        height: 100%;
        align-items: center;
    }

    .nav-item {
        height: 100%;
        display: flex;
        align-items: center;
    }

    .nav-link {
        text-decoration: none;
        color: var(--npt-black);
        font-family: var(--font-heading);
        font-weight: 600;
        font-size: 1rem; /* Slightly larger for readability */
        text-transform: none; /* CHANGED: Removed uppercase */
        letter-spacing: 0; /* CHANGED: Removed wide spacing */
        position: relative;
        transition: color 0.2s;
        height: 100%;
        display: flex;
        align-items: center;
    }

    .nav-link:hover {
        color: var(--cfn-green);
    }

    /* Green underlining on hover */
    .nav-link::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 0;
        height: 4px;
        background-color: var(--cfn-green);
        transition: width 0.3s;
    }

    .nav-item:hover .nav-link::after {
        width: 100%;
    }

    /* --- Mega Menu Styles --- */
    .mega-menu-wrapper {
        position: absolute;
        top: 90px; /* Matches header height */
        left: 0;
        width: 100%;
        background-color: var(--npt-white);
        border-top: 4px solid var(--cfn-green); 
        box-shadow: 0 15px 40px rgba(0,0,0,0.1);
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px);
        transition: all 0.25s ease-in-out;
        padding: 3rem 0;
        pointer-events: none;
    }

    /* Reveal Mega Menu on Hover */
    .nav-container:hover .mega-menu-wrapper,
    .mega-menu-wrapper:hover {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
        pointer-events: auto;
    }

    .mega-menu-content {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 2rem;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 2.5rem;
    }

    .nav-column h3 {
        font-family: var(--font-heading);
        font-size: 1rem;
        font-weight: 700;
        color: var(--cfn-green);
        text-transform: none; /* CHANGED: Removed uppercase */
        margin-bottom: 1.25rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #f0f0f0;
        display: inline-block;
    }
    
    .nav-column h3 a {
        text-decoration: none;
        color: inherit;
    }

    .nav-column ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .nav-column li {
        margin-bottom: 0.75rem;
    }

    .nav-column a.section-link {
        text-decoration: none;
        color: #444;
        font-family: var(--font-body);
        font-size: 0.95rem;
        font-weight: 500;
        transition: all 0.2s;
        display: block;
    }

    .nav-column a.section-link:hover {
        color: var(--cfn-green);
        transform: translateX(4px);
    }

    /* Bill Pay Dropdown (Simple) */
    .bill-pay-btn {
        background-color: var(--npt-black);
        color: white !important;
        padding: 0.6rem 1.2rem !important;
        border-radius: 4px;
        font-size: 0.95rem !important;
        height: auto !important;
        display: inline-flex !important;
        transition: background-color 0.2s;
        font-weight: 600;
    }
    .bill-pay-btn:hover {
        background-color: var(--cfn-green);
    }
    .bill-pay-btn::after { display: none; }

    /* Mobile Toggle */
    .mobile-toggle {
        display: none;
        font-size: 1.8rem;
        cursor: pointer;
        background: none;
        border: none;
        color: var(--npt-black);
    }

    @media (max-width: 1150px) {
        .mobile-toggle { display: block; }
        .nav-menu { display: none; } 
        /* Mobile menu implementation would go here */
    }
</style>
`;

const headerHTML = `
${headerStyles}
<header class="main-header">
    <div class="nav-container">
        <!-- Logo -->
        <a href="/index.html" class="nav-logo">
            <img src="/assets/images/community-fiber-logo.png" alt="Community Fiber">
        </a>

        <!-- Top Level Nav -->
        <ul class="nav-menu">
            <li class="nav-item"><a href="/index.html" class="nav-link">Home</a></li>
            <li class="nav-item"><a href="/residential.html" class="nav-link">Residential</a></li>
            <li class="nav-item"><a href="/business.html" class="nav-link">Business</a></li>
            <li class="nav-item"><a href="/builders.html" class="nav-link">Builders</a></li>
            <li class="nav-item"><a href="/support.html" class="nav-link">Support</a></li>
            <li class="nav-item"><a href="/about.html" class="nav-link">About</a></li>
            <li class="nav-item"><a href="https://nptel.smarthub.coop/Login.html" target="_blank" class="nav-link bill-pay-btn">Bill Pay</a></li>
        </ul>

        <!-- Mobile Menu Button -->
        <button class="mobile-toggle" aria-label="Toggle Menu">☰</button>

        <!-- MEGA MENU OVERLAY -->
        <div class="mega-menu-wrapper">
            <div class="mega-menu-content">
                
                <!-- Residential Column -->
                <div class="nav-column">
                    <h3><a href="/residential.html">Residential</a></h3>
                    <ul>
                        <li><a href="/residential.html#plans-grid" class="section-link">Plans & Pricing</a></li>
                        <li><a href="/residential.html" class="section-link">The Installation Process</a></li>
                        <li><a href="/residential.html#testimonials-grid" class="section-link">Customer Reviews</a></li>
                        <li><a href="/residential.html#neighborhood-list" class="section-link">Neighborhood Highlights</a></li>
                    </ul>
                </div>

                <!-- Business Column -->
                <div class="nav-column">
                    <h3><a href="/business.html">Business</a></h3>
                    <ul>
                        <li><a href="/business.html" class="section-link">Enterprise Fiber</a></li>
                        <li><a href="/business.html" class="section-link">Trusted Partners</a></li>
                        <li><a href="/business.html" class="section-link">Service Territory Map</a></li>
                        <li><a href="/business.html#business-form" class="section-link">Request a Quote</a></li>
                    </ul>
                </div>

                <!-- Builders Column -->
                <div class="nav-column">
                    <h3><a href="/builders.html">Builders</a></h3>
                    <ul>
                        <li><a href="/builders.html" class="section-link">Development Benefits</a></li>
                        <li><a href="/builders.html" class="section-link">Our Partners</a></li>
                        <li><a href="/builders.html#builder-form" class="section-link">Submit Inquiry</a></li>
                    </ul>
                </div>

                <!-- Support Column -->
                <div class="nav-column">
                    <h3><a href="/support.html">Support</a></h3>
                    <ul>
                        <li><a href="/support.html#support-form" class="section-link">Contact Us</a></li>
                        <li><a href="/support.html" class="section-link">Why Move to Fiber?</a></li>
                        <li><a href="/support.html" class="section-link">FAQ</a></li>
                        <li><a href="https://nptel.smarthub.coop/Login.html" target="_blank" class="section-link">SmartHub Login</a></li>
                    </ul>
                </div>

                <!-- About Column -->
                <div class="nav-column">
                    <h3><a href="/about.html">About Us</a></h3>
                    <ul>
                        <li><a href="/about.html" class="section-link">Our Mission</a></li>
                        <li><a href="/about.html" class="section-link">Heritage & Future</a></li>
                        <li><a href="/about.html" class="section-link">Heritage Gallery</a></li>
                        <li><a href="/about.html#employees-container" class="section-link">Meet the Team</a></li>
                        <li><a href="/blog.html" class="section-link">Latest News</a></li>
                    </ul>
                </div>

            </div>
        </div>
    </div>
</header>
`;

document.addEventListener("DOMContentLoaded", function() {
    // 1. Inject the HTML into the placeholder
    const headerPlaceholder = document.getElementById("master-header");
    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = headerHTML;
    }

    // 2. Initialize Mobile Menu Logic
    const toggleBtn = document.querySelector('.mobile-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (toggleBtn && navMenu) {
        toggleBtn.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            toggleBtn.innerHTML = navMenu.classList.contains('active') ? '✕' : '☰';
            
            // Basic mobile fallback styles inline for immediate effect
            if (navMenu.classList.contains('active')) {
                Object.assign(navMenu.style, {
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'absolute',
                    top: '90px',
                    left: '0',
                    width: '100%',
                    backgroundColor: 'white',
                    padding: '1rem',
                    boxShadow: '0 5px 10px rgba(0,0,0,0.1)',
                    gap: '1rem',
                    alignItems: 'flex-start'
                });
            } else {
                navMenu.style = ''; // Revert to stylesheet
            }
        });
    }

    // 3. Highlight Active Page
    const currentPath = window.location.pathname; 
    const links = document.querySelectorAll('.nav-link, .section-link');
    
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '/' && href === '/index.html')) {
            link.style.color = '#03A63C'; // CFN Green
            link.style.fontWeight = '700';
        }
    });
});