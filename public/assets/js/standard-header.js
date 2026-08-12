/**
 * Standard Header Loader
 * This script injects the standard navigation bar into any page.
 * Usage: Place <div id="master-header"></div> at the top of your body.
 */

const ANNOUNCEMENT_MODULE_PATH = '/assets/js/announcement.js';

function ensureAnnouncementModule() {
    const alreadyPresent = Array.from(document.scripts).some((script) => {
        const src = script.getAttribute('src') || '';
        return src === ANNOUNCEMENT_MODULE_PATH || src.endsWith('assets/js/announcement.js');
    });

    if (alreadyPresent) {
        return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src = ANNOUNCEMENT_MODULE_PATH;
    script.dataset.autoAnnouncement = 'true';
    document.head.appendChild(script);
}

// Injecting CSS directly to ensure Brand Style Guide compliance
const headerStyles = `
<style>
    /* --- Standard Header CSS Override based on CFN Brand Guide --- */
    /* Fonts are loaded via <link rel="stylesheet"> in each page's <head>.
       An @import here would re-request them from inside an injected style
       block, serialising a second round trip after the header renders. */

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
        z-index: 10001; /* Ensure logo is above mobile menu */
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
        grid-template-columns: repeat(6, 1fr);
        gap: 2rem;
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
        z-index: 10002; /* Ensure button is above everything */
        /* The glyph alone measured 26x38, well under the 44px touch minimum,
           on the one control every mobile visitor has to hit. Shown as
           inline-flex in the media query below so the icon stays centred. */
        min-width: 44px;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        padding: 0;
        line-height: 1;
        -webkit-tap-highlight-color: transparent;
    }

    /* --- Cookie Consent Styles --- */
    .cookie-consent-banner {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        max-width: 500px;
        background-color: var(--npt-black);
        color: var(--npt-white);
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        /* Slide in with a composited transform. Animating the bottom offset
           relayouts the page each frame and is scored as layout shift. */
        transform: translateY(calc(100% + 40px));
        transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
        will-change: transform;
        border-left: 5px solid var(--cfn-green);
    }
    .cookie-consent-banner.show {
        transform: translateY(0);
    }
    .cookie-content p {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.5;
        font-family: var(--font-body);
    }
    .cookie-content a {
        color: var(--cfn-green);
        text-decoration: underline;
    }
    .cookie-actions {
        display: flex;
        justify-content: flex-end;
    }
    .cookie-btn-accept {
        /* White on --cfn-green is only 3.2:1. This darker shade of the same
           hue reaches 5.5:1, clearing the 4.5:1 AA minimum for body text. */
        background-color: #0A7A31;
        color: white;
        border: none;
        padding: 0.6rem 1.5rem;
        border-radius: 50px;
        font-weight: 600;
        font-family: var(--font-heading);
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .cookie-btn-accept:hover {
        background-color: var(--cfn-dark-green);
    }

    @media (max-width: 1150px) {
        .main-header {
            height: 76px;
        }

        .nav-container {
            padding: 0 1rem;
        }

        .nav-logo img {
            height: 44px;
            max-width: min(220px, 62vw);
        }

        .mobile-toggle { display: inline-flex; }
        .nav-menu {
            position: fixed;
            top: 0;
            left: -100%; /* Hidden off-screen left */
            width: min(86vw, 360px); /* Takes up most of screen */
            height: 100vh;
            background-color: var(--npt-white);
            flex-direction: column;
            align-items: flex-start;
            padding: 92px 1.25rem 2rem; /* Top padding for header height */
            gap: 1rem;
            box-shadow: 5px 0 15px rgba(0,0,0,0.1);
            transition: left 0.3s ease-in-out;
            z-index: 10000;
            overflow-y: auto;
        }

        .nav-menu.active {
            left: 0; /* Slide in */
        }

        .nav-item {
            width: 100%;
            height: auto;
            border-bottom: 1px solid #f0f0f0;
            padding-bottom: 1rem;
        }

        .nav-link {
            width: 100%;
            min-height: 44px;
            padding: 0;
            font-size: 1.1rem;
            justify-content: flex-start;
        }

        .nav-link::after {
            display: none; /* No hover underline on mobile */
        }

        /* Hide Mega Menu on Mobile default hover */
        .mega-menu-wrapper {
            display: none;
        }

        /* Mobile Overlay */
        .mobile-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 9998;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s;
        }

        .mobile-overlay.active {
            opacity: 1;
            visibility: visible;
        }
    }
</style>
`;

const headerHTML = `
${headerStyles}
<div id="site-announcement-root" hidden></div>
<div class="mobile-overlay"></div>
<header class="main-header">
    <div class="nav-container">
        <!-- Logo -->
        <a href="/" class="nav-logo">
            <img src="/assets/images/CFN_Stripped_Logo.svg" alt="Community Fiber">
        </a>

        <!-- Top Level Nav -->
        <ul class="nav-menu">
            <li class="nav-item"><a href="/" class="nav-link">Home</a></li>
            <li class="nav-item"><a href="/residential" class="nav-link">Residential</a></li>
            <li class="nav-item"><a href="/business" class="nav-link">Business</a></li>
                <li class="nav-item"><a href="/mobile" class="nav-link">Mobile</a></li>
            <li class="nav-item"><a href="/builders" class="nav-link">Builders</a></li>
            <li class="nav-item"><a href="/support" class="nav-link">Support</a></li>
            <li class="nav-item"><a href="/about" class="nav-link">About</a></li>
            <li class="nav-item"><a href="https://nptel.smarthub.coop/Login.html" target="_blank" class="nav-link bill-pay-btn">Bill Pay</a></li>
        </ul>

        <!-- Mobile Menu Button -->
        <button class="mobile-toggle" aria-label="Toggle Menu">☰</button>

        <!-- MEGA MENU OVERLAY (Desktop Only for now) -->
        <div class="mega-menu-wrapper">
            <div class="mega-menu-content">

                <!-- Residential Column -->
                <div class="nav-column">
                    <h3><a href="/residential">Residential</a></h3>
                    <ul>
                        <li><a href="/residential#plans-pricing" class="section-link">Plans & Pricing</a></li>
                        <li><a href="/residential#installation-process" class="section-link">The Installation Process</a></li>
                        <li><a href="/residential#customer-reviews" class="section-link">Customer Reviews</a></li>
                        <li><a href="/residential#availability-check" class="section-link">Check Availability</a></li>
                    </ul>
                </div>

                <!-- Business Column -->
                <div class="nav-column">
                    <h3><a href="/business">Business</a></h3>
                    <ul>
                        <li><a href="/business#enterprise-fiber" class="section-link">Enterprise Fiber</a></li>
                        <li><a href="/business#trusted-partners" class="section-link">Trusted Partners</a></li>
                        <li><a href="/business#service-territory" class="section-link">Service Territory Map</a></li>
                        <li><a href="/business#business-quote" class="section-link">Request a Quote</a></li>
                    </ul>
                </div>

                <!-- Builders Column -->
                <div class="nav-column">
                    <h3><a href="/builders">Builders</a></h3>
                    <ul>
                        <li><a href="/builders#development-benefits" class="section-link">Development Benefits</a></li>
                        <li><a href="/builders#builder-partners" class="section-link">Our Partners</a></li>
                        <li><a href="/builders#builder-inquiry" class="section-link">Submit Inquiry</a></li>
                    </ul>
                </div>

                <!-- Support Column -->
                <div class="nav-column">
                    <h3><a href="/support">Support</a></h3>
                    <ul>
                        <li><a href="/support#support-contact" class="section-link">Contact Us</a></li>
                        <li><a href="/support#fiber-comparison" class="section-link">Why Move to Fiber?</a></li>
                        <li><a href="/support#support-faq" class="section-link">FAQ</a></li>
                        <li><a href="https://nptel.smarthub.coop/Login.html" target="_blank" class="section-link">SmartHub Login</a></li>
                    </ul>
                </div>

                <!-- About Column -->
                <div class="nav-column">
                    <h3><a href="/about">About Us</a></h3>
                    <ul>
                        <li><a href="/about#our-mission" class="section-link">Our Mission</a></li>
                        <li><a href="/about#heritage-future" class="section-link">Heritage & Future</a></li>
                        <li><a href="/about#heritage-gallery" class="section-link">Heritage Gallery</a></li>
                        <!-- TEMPORARY: hidden until the team photos are uploaded.
                             Restore alongside SHOW_TEAM_SECTION in assets/js/about.js.
                        <li><a href="/about#team-section" class="section-link">Meet the Team</a></li>
                        -->
                        <li><a href="/blog" class="section-link">Latest News</a></li>
                    </ul>
                </div>

                <!-- Service Areas Column -->
                <div class="nav-column">
                    <h3><a href="/#service-areas">Service Areas</a></h3>
                    <ul>
                        <li><a href="/goshen" class="section-link">Goshen</a></li>
                        <li><a href="/bristol" class="section-link">Bristol</a></li>
                        <li><a href="/middlebury" class="section-link">Middlebury</a></li>
                        <li><a href="/new-paris" class="section-link">New Paris</a></li>
                        <li><a href="/syracuse" class="section-link">Syracuse</a></li>
                        <li><a href="/nappanee" class="section-link">Nappanee</a></li>
                        <li><a href="/wakarusa" class="section-link">Wakarusa</a></li>
                        <li><a href="/milford" class="section-link">Milford</a></li>
                    </ul>
                </div>

            </div>
        </div>
    </div>
</header>
`;

function initializeStandardHeader() {
    if (!document.body || document.body.dataset.cfnHeaderInitialized === 'true') {
        return;
    }

    document.body.dataset.cfnHeaderInitialized = 'true';
    ensureAnnouncementModule();

    // 1. Inject the HTML into the placeholder
    const headerPlaceholder = document.getElementById("master-header");
    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = headerHTML;
    }

    // 2. Inject Favicon Global (Standardized)
    const existingFavicon = document.querySelector('link[rel="icon"]');
    if (!existingFavicon) {
        const faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        faviconLink.href = '/assets/images/favicon.png';
        faviconLink.type = 'image/png';
        document.head.appendChild(faviconLink);
    }

    // 3. Initialize Mobile Menu Logic
    const toggleBtn = document.querySelector('.mobile-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const mobileOverlay = document.querySelector('.mobile-overlay');

    if (toggleBtn && navMenu) {
        toggleBtn.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            mobileOverlay.classList.toggle('active');
            toggleBtn.innerHTML = navMenu.classList.contains('active') ? '✕' : '☰';

            // Prevent scrolling when menu is open
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
        });

        // Close menu when clicking overlay
        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', () => {
                navMenu.classList.remove('active');
                mobileOverlay.classList.remove('active');
                toggleBtn.innerHTML = '☰';
                document.body.style.overflow = '';
            });
        }
    }

    // 4. Highlight Active Page
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll('.nav-link, .section-link');

    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '/' && href === '/index.html')) {
            link.style.color = '#03A63C'; // CFN Green
            link.style.fontWeight = '700';
        }
    });

    // 5. Cookie Consent Logic
    const cookieConsentKey = 'cfn_cookie_consent';
    if (!localStorage.getItem(cookieConsentKey)) {
        const banner = document.createElement('div');
        banner.className = 'cookie-consent-banner';
        banner.innerHTML = `
            <div class="cookie-content">
                <p>We use cookies to ensure you get the best experience on our website. By continuing to use this site, you agree to our <a href="/footer/privacy-policy">Privacy Policy</a>.</p>
            </div>
            <div class="cookie-actions">
                <button class="cookie-btn-accept">Got it</button>
            </div>
        `;
        document.body.appendChild(banner);

        // Slight delay for animation
        setTimeout(() => {
            banner.classList.add('show');
        }, 500);

        banner.querySelector('.cookie-btn-accept').addEventListener('click', () => {
            localStorage.setItem(cookieConsentKey, 'true');
            banner.classList.remove('show');
            setTimeout(() => {
                banner.remove();
            }, 500);
        });
    }
}

if (document.body) {
    initializeStandardHeader();
} else {
    document.addEventListener("DOMContentLoaded", initializeStandardHeader, { once: true });
}
