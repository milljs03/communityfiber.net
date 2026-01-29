import { db, app } from './config/firebase-config.js';
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

    // --- 1. Initialize Auth for Lead Capture ---
    const auth = getAuth(app);
    signInAnonymously(auth).catch(err => console.warn("Auth warning:", err));

    // --- 2. Render Plans (Dynamic from DB) ---
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
                    name: "Standard", speed: "200 Mbps", price: 65, 
                    description: "Great for small households. Stream HD video, browse the web.",
                    features: ["Local Service", "No Contracts"], isPopular: false
                },
                { 
                    name: "Advanced", speed: "500 Mbps", price: 80, 
                    description: "Ideal for families. Support multiple streams & video calls.",
                    features: ["Local Service", "No Contracts"], isPopular: false 
                },
                { 
                    name: "Premium", speed: "1 Gbps", price: 89, 
                    description: "The ultimate experience. Perfect for 4K streaming & smart homes.",
                    features: ["Local Service", "No Contracts"], isPopular: true
                }
            ];
        }

        plans.sort((a, b) => a.price - b.price);

        loadingEl.classList.add('hidden');
        plansGrid.classList.remove('hidden');

        plansGrid.innerHTML = plans.map((plan, index) => generatePlanCard(plan, index)).join('');
        injectAddonsSection(plansGrid);

    } catch (error) {
        console.error("Error rendering plans:", error);
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
    }

    // --- 3. Render Neighborhoods ---
    const hoodList = document.getElementById('neighborhood-list');
    if(hoodList) {
        try {
            const hoodsRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'neighborhoods');
            const hoodSnap = await getDocs(hoodsRef);
            let neighborhoods = [];
            hoodSnap.forEach(doc => neighborhoods.push(doc.data()));
            
            if (neighborhoods.length === 0) {
                 neighborhoods = [ { name: "Maple Ridge", status: "Live Now" } ];
            }

            hoodList.innerHTML = ''; 
            neighborhoods.forEach(hood => {
                const card = document.createElement('div');
                card.className = 'hood-card fade-in-section';
                card.innerHTML = `
                    <div class="hood-image"><span>${hood.name}</span></div>
                    <div class="hood-info"><h4>${hood.name}</h4><p style="color: var(--cfn-mute-green); font-weight:600;">${hood.status}</p></div>
                `;
                hoodList.appendChild(card);
                observer.observe(card);
            });
        } catch(err) { console.error("Error loading neighborhoods:", err); }
    }

    // --- 4. Render Testimonials ---
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
                        <p class="quote-text">"${t.quote}"</p>
                        <div class="quote-author">
                            <strong>${t.author}</strong>
                            <span>${t.location}</span>
                        </div>
                    </div>
                `).join('');
                
                // Observe new items
                document.querySelectorAll('.testimonial-card').forEach(el => observer.observe(el));
            }
        } catch (err) { console.error("Error loading testimonials:", err); }
    }

    // --- 5. Install Process Timeline (New) ---
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
                ${step.stepNumber}
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
        if (step.imageUrl) {
            imgEl.src = step.imageUrl;
            imgEl.parentElement.style.display = 'flex';
        } else {
            // Fallback icon if no image
            imgEl.parentElement.innerHTML = '<i class="fa-solid fa-wrench" style="font-size: 4rem; color: #cbd5e1;"></i>';
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

function injectAddonsSection(targetElement) {
    if (document.querySelector('.addons-section-container')) return;
    const addonsHTML = `
    <div class="addons-section-container">
        <!-- Home Phone -->
        <div class="addon-card">
            <div class="addon-top-bar" style="background: linear-gradient(90deg, var(--cfn-green) 0%, var(--cfn-light-green) 100%);"></div>
            <div class="addon-content">
                <div class="addon-icon-title"><i class="fa-solid fa-phone-volume" style="color: var(--cfn-green);"></i><h3>Home Phone</h3></div>
                <p>Complete your home connection. Keep your current number or start fresh.</p>
                <div class="addon-price-tag"><span class="symbol">$</span><span class="val">25</span><span class="per">/mo</span></div>
                <div class="addon-features-list"><span><i class="fa-solid fa-check" style="color: var(--cfn-green);"></i> Phone Porting</span><span><i class="fa-solid fa-check" style="color: var(--cfn-green);"></i> Crystal Clear Voice</span></div>
            </div>
        </div>

        <!-- Premium WiFi -->
        <div class="addon-card">
            <div class="addon-top-bar" style="background: linear-gradient(90deg, #05a5df 0%, #6cdbf7 100%);"></div>
            <div class="addon-content">
                 <div class="addon-image-wrapper"><img src="assets/images/eero.webp" alt="eero Mesh WiFi" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\'fa-solid fa-wifi\' style=\'font-size:3rem; color:#05a5df; margin-bottom:15px;\'></i>'"></div>
                <div class="addon-icon-title"><h3 style="margin-top:0;">Premium WiFi</h3></div>
                <p>Powered by <strong>eero</strong>. Blanket your home in fast, reliable WiFi with advanced security and controls.</p>
                <div class="addon-features-list"><span><i class="fa-solid fa-shield-halved" style="color: #05a5df;"></i> Advanced Security</span><span><i class="fa-solid fa-house-signal" style="color: #05a5df;"></i> Guest Networks</span></div>
            </div>
        </div>

        <!-- Money Saving Programs (New Section) -->
        <div class="addon-card">
            <div class="addon-top-bar" style="background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);"></div>
            <div class="addon-content">
                <div class="addon-icon-title"><i class="fa-solid fa-hand-holding-dollar" style="color: #f59e0b;"></i><h3>Save More</h3></div>
                <p>We're committed to our community. Take advantage of our monthly savings programs.</p>
                <div class="addon-features-list">
                    <span><i class="fa-solid fa-calendar-check" style="color: #f59e0b;"></i> $5/mo if you sign up for autopay</span>
                    <span><i class="fa-solid fa-graduation-cap" style="color: #f59e0b;"></i> $5/mo discount for teachers*</span>
                </div>
                <p style="font-size: 0.75rem; margin-top: 15px; color: #94a3b8; font-style: italic;">*Teacher discount requires valid school ID.</p>
            </div>
        </div>
    </div>`;
    targetElement.insertAdjacentHTML('afterend', addonsHTML);
}

function generatePlanCard(plan, index) {
    const isPopular = plan.isPopular === true || plan.isPopular === "true";
    const highlightClass = isPopular ? 'popular' : '';
    const badge = isPopular ? '<div class="popular-badge">Best Value</div>' : '';
    const labelId = `bbf-${index}`;
    const features = Array.isArray(plan.features) ? plan.features : ["Local Service", "No Contracts"];
    const featuresHtml = features.map(f => `<div class="highlight-text"><i class="fa-solid fa-check"></i> ${f}</div>`).join('');

    return `
        <div class="pricing-box ${highlightClass}">
            ${badge}
            <div class="pricing-box-inner">
                <h3 class="panel-heading">${plan.name}</h3>
                <div class="price-wrapper"><span class="price">$${plan.price}<small>/mo</small></span></div>
                <div class="speed-display"><div class="speed-val">${plan.speed}</div><div class="speed-label">Download & Upload</div></div>
                <div class="plan-description">${plan.description || "Reliable fiber internet."}</div>
                <div class="core-benefits">${featuresHtml}</div>
                <div class="broadband-label-container">${generateBroadbandLabel(plan, labelId)}</div>
                 <a href="https://fiber-service-query.web.app/query.html" class="sign-up-btn" style="text-align: center; text-decoration: none; display: block;">I'm Interested</a>
            </div>
        </div>
    `;
}

function generateBroadbandLabel(plan, labelId) {
    return `<div class="broadband-facts-wrapper" id="${labelId}">
            <div class="expand-trigger" onclick="toggleLabel('${labelId}')"><button class="expand-btn">Broadband Facts <i class="fa-solid fa-chevron-down" style="margin-left:5px"></i></button></div>
            <div class="bbf-header"><h4 class="bbf-title">Broadband Facts</h4><div style="font-size:12px; margin-top:5px; font-weight:bold;">Community Fiber Network</div><div style="font-weight:bold;">${plan.name} Plan</div><div style="font-size:14px; margin-top:5px;">Fixed Broadband Consumer Disclosure</div></div>
            <div class="bbf-row strong"><span>Monthly Price</span><strong>$${plan.price}</strong></div>
            <div class="bbf-row"><span>Introductory Rate</span><strong>No</strong></div>
            <div class="bbf-row strong"><span>Contract</span><strong>None</strong></div>
            <div style="background-color: #f1f5f9; font-weight: bold; padding: 8px 15px; border-bottom: 1px solid #ccc; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Additional Charges & Terms</div>
            <div class="bbf-row"><span style="font-weight:bold">Install Fee</span><strong>$50 - $150*</strong></div>
            <div class="bbf-row"><span>Equipment Fee</span><strong>$99.00</strong></div>
            <div class="bbf-row"><span>Taxes</span><strong>Varies</strong></div>
            <div style="background-color: #f1f5f9; font-weight: bold; padding: 8px 15px; border-bottom: 1px solid #ccc; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Performance</div>
            <div class="bbf-row"><span>Download Speed</span><strong>${plan.speed}</strong></div>
            <div class="bbf-row"><span>Upload Speed</span><strong>${plan.speed}</strong></div>
            <div class="bbf-row strong"><span>Latency</span><strong>17 ms</strong></div>
             <div class="bbf-row strong"><span>Data Cap</span><strong>Unlimited</strong></div>
            <div class="bbf-footer"><p><strong>Support:</strong> (574) 533-4237</p><a href="https://fcc.gov/consumer" target="_blank" style="color:var(--npt-black)">fcc.gov/consumer</a></div>
        </div>`;
}

window.toggleLabel = function(id) {
    const el = document.getElementById(id);
    if(el) {
        el.classList.toggle('expanded');
        const btn = el.querySelector('.expand-btn');
        if(el.classList.contains('expanded')) { btn.innerHTML = 'Hide Facts <i class="fa-solid fa-chevron-up" style="margin-left:5px"></i>'; } 
        else { btn.innerHTML = 'Broadband Facts <i class="fa-solid fa-chevron-down" style="margin-left:5px"></i>'; }
    }
};