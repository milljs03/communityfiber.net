/**
 * Standard Header Loader
 * This script injects the standard navigation bar into any page.
 * Usage: Place <div id="master-header"></div> at the top of your body.
 */

const headerHTML = `
<header class="main-header">
    <div class="nav-container">
        <!-- Logo -->
        <a href="/index.html" class="nav-logo">
            <img src="/assets/images/community-fiber-logo.png" alt="Community Fiber">
        </a>

        <!-- Mobile Menu Button -->
        <button class="mobile-toggle" aria-label="Toggle Menu">
            ☰
        </button>

        <!-- Navigation Links -->
        <ul class="nav-menu">
            
            <!-- Residential Dropdown -->
            <li class="nav-item">
                <a href="/residential.html" class="nav-link">Residential ▾</a>
                <div class="dropdown-menu">
                    <a href="/residential.html#internet" class="dropdown-link">High-Speed Internet</a>
                    <a href="/residential.html#wifi" class="dropdown-link">Whole-Home WiFi</a>
                    <a href="/residential.html#voice" class="dropdown-link">Digital Voice</a>
                    <a href="/residential.html#pricing" class="dropdown-link">Plans & Pricing</a>
                </div>
            </li>

            <!-- Business Dropdown -->
            <li class="nav-item">
                <a href="/business.html" class="nav-link">Business ▾</a>
                <div class="dropdown-menu">
                    <a href="/business.html#connectivity" class="dropdown-link">Fiber Connectivity</a>
                    <a href="/business.html#voice" class="dropdown-link">Business Voice</a>
                    <a href="/business.html#enterprise" class="dropdown-link">Enterprise Solutions</a>
                    <a href="/business.html#quote" class="dropdown-link">Get a Quote</a>
                </div>
            </li>

            <!-- Builders Dropdown -->
            <li class="nav-item">
                <a href="/builders.html" class="nav-link">Builders ▾</a>
                <div class="dropdown-menu">
                    <a href="/builders.html#partners" class="dropdown-link">Partnership Program</a>
                    <a href="/builders.html#process" class="dropdown-link">Development Process</a>
                    <a href="/builders.html#projects" class="dropdown-link">Past Projects</a>
                </div>
            </li>

            <!-- Support/About Dropdown -->
            <li class="nav-item">
                <a href="/support.html" class="nav-link">Support ▾</a>
                <div class="dropdown-menu">
                    <a href="/support.html#help-center" class="dropdown-link">Help Center</a>
                    <a href="/support.html#contact" class="dropdown-link">Contact Us</a>
                    <a href="/speedtest.html" class="dropdown-link">Speed Test</a>
                    <a href="/about.html" class="dropdown-link">About Us</a>
                </div>
            </li>

            <!-- Blog Link (No Dropdown) -->
            <li class="nav-item">
                <a href="/blog.html" class="nav-link">Blog</a>
            </li>

            <!-- Admin (Hidden from public mostly, but included in nav for now) -->
             <li class="nav-item">
                <a href="https://portal.communityfiber.net" class="nav-link" style="color: #007bff;">My Account</a>
            </li>
        </ul>
    </div>
</header>
`;

document.addEventListener("DOMContentLoaded", function() {
    // 1. Inject the HTML
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
        });
    }

    // 3. Highlight Active Page
    // We remove the '/' from the path to match hrefs more easily, or check if href ends with it
    const currentPath = window.location.pathname; 
    const links = document.querySelectorAll('.nav-link, .dropdown-link');
    
    links.forEach(link => {
        const href = link.getAttribute('href');
        // Check if the current path (e.g. /residential.html) matches the link
        if (href === currentPath || (currentPath === '/' && href === '/index.html')) {
            link.style.color = '#007bff'; // Highlight active link
            link.style.fontWeight = '700';
        }
    });
});