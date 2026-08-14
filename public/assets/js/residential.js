import { db, app } from './config/firebase-config.js';
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { escapeHtml, safeUrl } from './security.js';
import { loadWhenVisible } from './services/lazy-section.js';

const SHOW_EERO_SERVICE_FEATURE = true;

document.addEventListener('DOMContentLoaded', async () => {
    // --- 0. Shared Animation Observer ---
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in, .fade-in-section').forEach(el => observer.observe(el));

    // --- Mobile Menu Toggle ---

    // --- 1. Render Plans (Dynamic from DB) ---
    const plansGrid = document.getElementById('plans-grid');
    const loadingEl = document.getElementById('loading-indicator');
    const errorEl = document.getElementById('error-message');

    updatePageHeader();

    try {
        const plansRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'plans');
        const snapshot = await getDocs(plansRef);

        let plans = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            data.price = Number(data.price);
            plans.push(data);
        });

        if (plans.length === 0) {
            console.warn("No plans in DB, using fallback defaults.");
             plans = [
                {
                    name: "Basic", speed: "100 Mbps", price: 35,
                    description: "Reliable fiber internet for everyday browsing and streaming.",
                    features: [], isPopular: false, requiresAutopay: true, order: 1
                },
                {
                    name: "Standard", speed: "200 Mbps", price: 65,
                    description: "Great for small households. Stream HD video, browse the web.",
                    features: [], isPopular: false, order: 2
                },
                {
                    name: "Advanced", speed: "500 Mbps", price: 80,
                    description: "Ideal for families. Support multiple streams & video calls.",
                    features: [], isPopular: false, order: 3
                },
                {
                    name: "Premium", speed: "1 Gbps", price: 70, originalPrice: 89,
                    description: "The ultimate experience. Perfect for 4K streaming & smart homes.",
                    features: [], isPopular: true, requiresAutopay: true, order: 4
                }
            ];
        }

        // Sort by the admin-designated display order (price as a tiebreaker)
        plans.sort((a, b) => ((Number(a.order) || 0) - (Number(b.order) || 0))
            || ((Number(a.price) || 0) - (Number(b.price) || 0)));

        loadingEl.classList.add('hidden');
        plansGrid.classList.remove('hidden');

        plansGrid.innerHTML = plans.map((plan, index) => generatePlanCard(plan, index)).join('');

        // Enable the mobile swipe/chevron carousel now that cards exist
        setupPricingCarousel();
        injectPricingFooterDisclosure();

        // Inject dynamic addons section (after the whole pricing section)
        await injectAddonsSection(document.getElementById('plans-pricing'));

    } catch (error) {
        console.error("Error rendering plans:", error);
        loadingEl.classList.add('hidden');
        // scripts/sync-pricing.js pre-renders the current plans into the HTML.
        // If those cards are on the page there is nothing to apologise for —
        // showing "unable to load pricing" above real prices only confuses.
        const hasPrerenderedPlans = plansGrid && plansGrid.querySelector('.pricing-box');
        if (hasPrerenderedPlans) {
            plansGrid.classList.remove('hidden');
            setupPricingCarousel();
        } else {
            errorEl.classList.remove('hidden');
        }
    }

    // --- 2. Render Testimonials ---
    const testimonialContainer = document.getElementById('testimonials-grid');
    if (testimonialContainer) {
        try {
            const tRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'testimonials');
            const tSnap = await getDocs(tRef);

            if (!tSnap.empty) {
                let items = [];
                tSnap.forEach(doc => items.push(doc.data()));

                testimonialContainer.innerHTML = items.map(t => `
                    <div class="testimonial-card fade-in-section">
                        <div class="quote-icon"><svg class="cfn-icon" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M0 216C0 149.7 53.7 96 120 96h8c17.7 0 32 14.3 32 32s-14.3 32-32 32h-8c-30.9 0-56 25.1-56 56v8h64c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V320 288 216zm256 0c0-66.3 53.7-120 120-120h8c17.7 0 32 14.3 32 32s-14.3 32-32 32h-8c-30.9 0-56 25.1-56 56v8h64c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H320c-35.3 0-64-28.7-64-64V320 288 216z"/></svg></div>
                        <p class="quote-text">"${escapeHtml(t.quote || '')}"</p>
                        <div class="quote-author">
                            <strong>${escapeHtml(t.author || '')}</strong>
                            <span>${escapeHtml(t.location || '')}</span>
                        </div>
                    </div>
                `).join('');

                // Observe new items
                document.querySelectorAll('.testimonial-card').forEach(el => observer.observe(el));
            }
        } catch (err) { console.error("Error loading testimonials:", err); }
    }

    // --- 3. Install Process Timeline ---
    // install_steps carries base64 step images (~1.06MB). It lives below the
    // fold, so hold the read until the section is nearly in view rather than
    // spending the page's initial bandwidth on it.
    loadWhenVisible('#installation-process', loadTimeline);
});

let installSteps = [];
let currentStepIndex = 0;

async function loadTimeline() {
    const bubblesContainer = document.getElementById('timeline-bubbles');
    const contentArea = document.getElementById('timeline-content-area');

    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'install_steps');
        const q = query(ref, orderBy('stepNumber', 'asc'));
        const snapshot = await getDocs(q);

        installSteps = [];
        snapshot.forEach(doc => installSteps.push(doc.data()));

        if (installSteps.length === 0) {
            // Default placeholder if no data
            installSteps = [
                { stepNumber: 1, title: 'Sign Up', description: 'Choose your plan online.', imageUrl: ''},
                { stepNumber: 2, title: 'Scheduling', description: 'We contact you to schedule install.', imageUrl: ''},
                { stepNumber: 3, title: 'Installation', description: 'Our techs bring fiber into your home.', imageUrl: ''}
            ];
        }

        // Render Bubbles
        bubblesContainer.innerHTML = installSteps.map((step, idx) => `
            <div class="timeline-step-bubble ${idx === 0 ? 'active' : ''}" data-index="${idx}">
                ${escapeHtml(step.stepNumber || idx + 1)}
            </div>
        `).join('');

        // Attach Click Events to Bubbles
        document.querySelectorAll('.timeline-step-bubble').forEach(b => {
            b.addEventListener('click', () => {
                updateTimelineView(parseInt(b.dataset.index));
            });
        });

        // Attach Arrow Events
        document.getElementById('timeline-next').addEventListener('click', () => {
            if (currentStepIndex < installSteps.length - 1) updateTimelineView(currentStepIndex + 1);
        });

        document.getElementById('timeline-prev').addEventListener('click', () => {
            if (currentStepIndex > 0) updateTimelineView(currentStepIndex - 1);
        });

        // Initialize First View
        updateTimelineView(0);

    } catch (err) {
        console.error("Timeline Error:", err);
        contentArea.innerHTML = '<p style="text-align:center; padding:20px;">Could not load installation process.</p>';
    }
}

function updateTimelineView(index) {
    currentStepIndex = index;
    const step = installSteps[index];

    // Update Bubbles
    document.querySelectorAll('.timeline-step-bubble').forEach((b, idx) => {
        if (idx === index) b.classList.add('active');
        else b.classList.remove('active');
    });

    // Update Buttons State
    document.getElementById('timeline-prev').disabled = (index === 0);
    document.getElementById('timeline-next').disabled = (index === installSteps.length - 1);

    // Fade Out Content
    const innerContent = document.querySelector('.step-content-inner');
    innerContent.style.opacity = '0';
    innerContent.style.transform = 'translateY(10px)';

    setTimeout(() => {
        // Update Content
        document.getElementById('step-badge').textContent = `Step ${step.stepNumber}`;
        document.getElementById('step-title').textContent = step.title;
        document.getElementById('step-desc').textContent = step.description;

        const imgEl = document.getElementById('step-image');
        if (imgEl) {
            const wrapper = imgEl.parentElement;
            if (step.imageUrl) {
                imgEl.src = safeUrl(step.imageUrl, '', { allowDataImage: true });
                imgEl.alt = step.title ? `${step.title} — installation step illustration` : '';
                imgEl.style.display = '';
                if (wrapper) wrapper.style.display = 'flex';
            } else {
                // No image: hide it but keep the element in the DOM for later steps
                imgEl.removeAttribute('src');
                imgEl.style.display = 'none';
                if (wrapper) wrapper.style.display = 'none';
            }
        }

        // Fade In
        innerContent.style.opacity = '1';
        innerContent.style.transform = 'translateY(0)';
    }, 200);
}

// --- Helper Functions ---

function updatePageHeader() {
    const headerContent = document.querySelector('.plans-header-content');
    if (headerContent) {
        headerContent.innerHTML = `
            <h1>Simple Pricing. Gigabit Speeds.</h1>
            <p>
                Experience the difference with fiber service designed for modern mesh Wi-Fi.
                Our local team helps you get the best performance from your Community Fiber connection.
            </p>
        `;
    }
}

function injectPricingFooterDisclosure() {
    const footerContent = document.querySelector('.site-footer .footer-content');
    if (!footerContent || footerContent.querySelector('.pricing-footer-disclosure')) return;

    const disclosure = document.createElement('div');
    disclosure.className = 'pricing-footer-disclosure';
    disclosure.innerHTML = `
        <p>If ACH autopay or e-bill enrollment is removed, a $5 monthly surcharge applies.</p>
        <p>* Limited-time promotional offer; subject to change. Available to new, qualified residential customers in eligible service areas. Availability, plan options, and speeds vary by location; advertised speeds are not guaranteed and may be affected by equipment, connected devices, network conditions, and other factors. Promotional pricing requires enrollment in ACH AutoPay and e-bill; removing either may result in a $5 monthly surcharge. Paper statements may add $5 per month. Additional equipment, service, and installation charges may apply.</p>
    `;

    footerContent.insertBefore(disclosure, footerContent.firstElementChild);
}

async function injectAddonsSection(targetElement) {
    if (!SHOW_EERO_SERVICE_FEATURE) return;
    if (document.querySelector('.addons-wrapper')) return;

    // Built from the page's own section components so it reads as part of the
    // site rather than a widget dropped on top of it. The earlier version reused
    // .faq-cta-section, which made it a visual duplicate of the "Questions
    // Before You Choose?" card, and its green pill was a <span> that looked
    // clickable but wasn't.
    const check = '<svg class="cfn-icon" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>';
    const points = [
        'Fiber service ready for mesh networking',
        'Optimized for streaming, gaming, and connected devices',
        'Local support for your Community Fiber service'
    ];

    const addonsHTML = `
    <section id="mesh-wifi" class="mesh-section addons-wrapper" data-animate="fade-up">
        <div class="container mesh-inner">
            <h2 class="section-title">Built for Modern Mesh Wi-Fi</h2>
            <div class="mesh-grid">
                <figure class="mesh-visual">
                    <img src="assets/images/eerohome.webp" width="1400" height="788"
                         loading="lazy" decoding="async"
                         alt="Cutaway view of a home with overlapping eero mesh Wi-Fi coverage reaching every room">
                </figure>
                <div class="mesh-copy">
                    <p class="mesh-lede">Community Fiber service is designed to pair cleanly with modern eero mesh networking, helping your fiber connection perform well across the devices in your home.</p>
                    <ul class="mesh-points">
                        ${points.map((p) => `<li>${check}<span>${escapeHtml(p)}</span></li>`).join('')}
                    </ul>
                    <p class="mesh-attrib">Powered by <span class="eero-wordmark">eero</span></p>
                </div>
            </div>
        </div>
    </section>
    `;
    targetElement.insertAdjacentHTML('afterend', addonsHTML);

    // The section is injected after the page-load observer has already run, so
    // register it or the fade-up state would leave it permanently invisible.
    const wrapper = document.querySelector('.addons-wrapper');
    if (wrapper) {
        const revealer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            });
        }, { threshold: 0.1 });
        revealer.observe(wrapper);
    }
}

function generatePlanCard(plan, index) {
    const isPopular = plan.isPopular === true || plan.isPopular === "true";
    const highlightClass = isPopular ? 'popular' : '';
    const badge = isPopular ? '<div class="popular-badge">Best Value</div>' : '';
    const requiresAutopay = plan.requiresAutopay === true || plan.requiresAutopay === "true";
    const autopayBanner = requiresAutopay
        ? '<div class="card-autopay-banner"><svg class="cfn-icon" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg> E-Bill &amp; ACH Auto Pay Required</div>'
        : '';

    // Promotional pricing: show original price crossed out when it's higher than the current price.
    const priceNum = Number(plan.price) || 0;
    const originalNum = Number(plan.originalPrice) || 0;
    const isPromo = originalNum > priceNum;
    const wasPrice = isPromo ? `<span class="price-was">$${escapeHtml(String(plan.originalPrice))}</span>` : '';

    // Universal perks every plan includes, plus any extras defined on the plan.
    const universal = ['No annual contract', 'Unlimited data - no caps', 'Local support'];
    const skip = new Set(['local service', 'no contracts', 'no contract', 'local', 'unlimited data', 'no data caps']);
    const extras = Array.isArray(plan.features)
        ? plan.features.map(f => String(f || '').trim()).filter(f => f && !skip.has(f.toLowerCase()))
        : [];
    const features = [...universal, ...extras];
    const featuresHtml = features
        .map(f => `<li><svg class="cfn-icon" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg><span>${escapeHtml(f)}</span></li>`)
        .join('');

    return `
        <div class="pricing-box ${highlightClass}">
            ${badge}
            <div class="pricing-box-inner">
                <h3 class="panel-heading">${escapeHtml(plan.name || '')}</h3>
                <div class="price-wrapper ${isPromo ? 'is-promo' : ''}">
                    ${wasPrice}
                    <span class="price">$${escapeHtml(plan.price || '')}<small>/mo</small></span>
                </div>
                <div class="plan-speed">
                    <span class="plan-speed-val">${escapeHtml(plan.speed || '')}</span>
                    <span class="plan-speed-label">Symmetrical speeds</span>
                </div>
                <ul class="plan-features">${featuresHtml}</ul>
                <a href="https://fiber-service-query.web.app/query.html" class="sign-up-btn">Check Availability</a>
                ${autopayBanner}
            </div>
        </div>
    `;
}

// Mobile pricing carousel: native swipe + chevron buttons, with disabled-state at the ends.
function setupPricingCarousel() {
    const track = document.getElementById('plans-grid');
    const prev = document.getElementById('pricing-prev');
    const next = document.getElementById('pricing-next');
    if (!track || !prev || !next) return;

    const stepSize = () => {
        const card = track.querySelector('.pricing-box');
        if (!card) return track.clientWidth;
        const styles = window.getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || '16') || 16;
        return card.getBoundingClientRect().width + gap;
    };

    const updateButtons = () => {
        const maxScroll = track.scrollWidth - track.clientWidth - 2;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= maxScroll;
    };

    prev.addEventListener('click', () => track.scrollBy({ left: -stepSize(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: stepSize(), behavior: 'smooth' }));
    track.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    updateButtons();
}
