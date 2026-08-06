import { db, app } from './config/firebase-config.js';
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { escapeHtml, safeUrl } from './security.js';

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
                    name: "Basic", speed: "100 Mbps", price: 45,
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
        errorEl.classList.remove('hidden');
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
                        <div class="quote-icon"><i class="fa-solid fa-quote-left"></i></div>
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
    loadTimeline();
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
                Experience the difference with <strong>new premium WiFi equipment included</strong> in every plan.
                We provide the hardware you need to ensure the best coverage and fastest service possible.
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

    const addonsHTML = `
    <style>
        .addons-wrapper {
            max-width: 760px;
            margin: 60px auto;
            padding: 0 20px;
            display: block;
            font-family: 'Open Sans', sans-serif;
        }

        /* Card Styles */
        .addons-card {
            background: linear-gradient(155deg, #ffffff 0%, #f8fafc 100%);
            border-radius: 18px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
            overflow: hidden;
            border: 1px solid rgba(148, 163, 184, 0.28);
            display: flex;
            flex-direction: column;
            position: relative;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .addons-card::before {
            content: "";
            position: absolute;
            inset: 0;
            background-image:
                radial-gradient(circle at top right, rgba(3, 166, 60, 0.12), transparent 32%),
                linear-gradient(rgba(3, 166, 60, 0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(3, 166, 60, 0.04) 1px, transparent 1px);
            background-size: auto, 32px 32px, 32px 32px;
            pointer-events: none;
        }
        .addons-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 24px 48px rgba(3, 166, 60, 0.14);
        }

        /* Header */
        .card-header {
            background: rgba(255,255,255,0.84);
            padding: 26px 30px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.2);
            display: flex;
            align-items: center;
            gap: 12px;
            position: relative;
            z-index: 1;
        }
        .card-header h2 {
            margin: 0;
            font-family: 'Montserrat', sans-serif;
            font-size: 1.55rem;
            color: #1e293b;
            font-weight: 800;
        }
        .card-header i {
            color: #03A63C;
            font-size: 1.3rem;
        }

        /* Content Sections */
        .card-body {
            padding: 0;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            position: relative;
            z-index: 1;
        }

        .feature-block {
            padding: 30px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }
        .feature-block:last-child { border-bottom: none; }

        .feature-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
        }

        .feature-title-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .feature-icon {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            background: linear-gradient(135deg, #052e16 0%, #067a35 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 1.15rem;
            box-shadow: 0 12px 22px rgba(3, 166, 60, 0.22);
        }
        .feature-title {
            font-family: 'Montserrat', sans-serif;
            font-weight: 700;
            font-size: 1.1rem;
            color: #0f172a;
            margin: 0;
        }

        .price-tag {
            text-align: right;
        }
        .price-amount {
            font-family: 'Montserrat', sans-serif;
            font-weight: 800;
            font-size: 1.7rem;
            color: #03A63C;
            line-height: 1;
        }
        .price-period {
            font-size: 0.8rem;
            color: #64748b;
            font-weight: 600;
        }

        .feature-desc {
            color: #475569;
            font-size: 0.95rem;
            line-height: 1.6;
            margin-bottom: 15px;
        }

        .pill-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .pill {
            padding: 6px 12px;
            border-radius: 50px;
            font-size: 0.8rem;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .pill-blue { background: #e0f2fe; color: #0284c7; }
        .pill-green { background: #dcfce7; color: #166534; }
        .pill-gray { background: #f1f5f9; color: #475569; }

        /* Eero Special Styling */
        .eero-integration {
            background: #ffffff;
            border-radius: 14px;
            padding: 18px;
            margin-top: 15px;
            display: flex;
            align-items: center;
            gap: 20px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        }
        .eero-logo {
            width: 90px;
            height: auto;
            object-fit: contain;
        }
        .eero-text {
            font-size: 0.9rem;
            color: #475569;
            font-weight: 500;
            border-left: 2px solid #e2e8f0;
            padding-left: 20px;
        }

        .network-badge {
            background: #22c55e;
            color: white;
            font-weight: 800;
            font-size: 0.7rem;
            padding: 4px 8px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .feature-metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 18px;
        }
        .feature-metric {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px;
        }
        .feature-metric strong {
            display: block;
            color: #0f172a;
            font-family: 'Montserrat', sans-serif;
            font-size: 0.95rem;
            margin-bottom: 4px;
        }
        .feature-metric span {
            color: #64748b;
            font-size: 0.78rem;
            font-weight: 700;
            text-transform: uppercase;
        }

        /* Premium WiFi card (eero) */
        .wifi-card { overflow: hidden; }
        .wifi-image {
            height: 340px;
            width: 100%;
            object-fit: cover;
            display: block;
        }
        .wifi-content {
            position: relative;
            z-index: 1;
            background: #ffffff;
            padding: 30px;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
        }
        .wifi-content .network-badge {
            align-self: flex-start;
            margin-bottom: 14px;
        }
        .wifi-title {
            font-family: 'Montserrat', sans-serif;
            font-size: 1.8rem;
            font-weight: 800;
            color: #1e293b;
            line-height: 1.2;
            margin: 0 0 12px;
        }
        .wifi-text {
            color: #475569;
            font-size: 1rem;
            line-height: 1.6;
            margin: 0 0 22px;
        }
        .wifi-features {
            list-style: none;
            padding: 0;
            margin: 0 0 24px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .wifi-features li {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.95rem;
            font-weight: 600;
            color: #334155;
        }
        .wifi-features i {
            color: #03A63C;
            font-size: 0.9rem;
            flex-shrink: 0;
        }
        .wifi-eero {
            margin-top: auto;
            display: flex;
            align-items: center;
            gap: 12px;
            padding-top: 18px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 0.85rem;
            font-weight: 700;
        }
        .wifi-eero .eero-logo {
            width: 70px;
            height: auto;
            object-fit: contain;
        }

    </style>

    <div class="addons-wrapper fade-in-section">

        <div class="addons-card wifi-card">
            <img src="assets/images/eerohome.jpg" alt="eero mesh WiFi set up in a modern home" class="wifi-image">
            <div class="wifi-content">
                <span class="included-badge">Included with every plan</span>
                <h2 class="wifi-title">Whole-Home WiFi, Included</h2>
                <p class="wifi-text">Every Community Fiber plan comes with managed eero mesh WiFi — strong, reliable coverage in every room, set up and supported by your local team.</p>
                <ul class="wifi-features">
                    <li><i class="fa-solid fa-check"></i> Whole-home mesh coverage</li>
                    <li><i class="fa-solid fa-check"></i> App control with guest &amp; parental controls</li>
                    <li><i class="fa-solid fa-check"></i> Local installation &amp; ongoing support</li>
                </ul>
                <div class="wifi-eero">
                    <img src="assets/images/eero.webp" alt="eero" class="eero-logo">
                    <span>Powered by eero</span>
                </div>
            </div>
        </div>

    </div>
    `;
    targetElement.insertAdjacentHTML('afterend', addonsHTML);

    // Animate newly injected elements
    // Note: The observer logic at the top only runs once on load. We need to observe the new elements.
    const newObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            }
        });
    }, { root: null, rootMargin: '0px', threshold: 0.1 });

    const wrapper = document.querySelector('.addons-wrapper');
    if(wrapper) newObserver.observe(wrapper);
}

function generatePlanCard(plan, index) {
    const isPopular = plan.isPopular === true || plan.isPopular === "true";
    const highlightClass = isPopular ? 'popular' : '';
    const badge = isPopular ? '<div class="popular-badge">Best Value</div>' : '';
    const requiresAutopay = plan.requiresAutopay === true || plan.requiresAutopay === "true";
    const autopayBanner = requiresAutopay
        ? '<div class="card-autopay-banner"><i class="fa-solid fa-circle-info"></i> E-Bill &amp; ACH Auto Pay Required</div>'
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
        .map(f => `<li><i class="fa-solid fa-check"></i><span>${escapeHtml(f)}</span></li>`)
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
