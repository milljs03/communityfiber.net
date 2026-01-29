import { db, app } from './config/firebase-config.js';
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, orderBy, query, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
        
        // Inject dynamic addons section
        await injectAddonsSection(plansGrid);

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

async function injectAddonsSection(targetElement) {
    if (document.querySelector('.addons-wrapper')) return;

    // Fetch dynamic content for "Save More"
    let promoData = {
        title: "Save More",
        description: "We're committed to our community. Take advantage of our monthly savings programs.",
        items: [
            "$5/mo if you sign up for autopay",
            "$5/mo discount for teachers*"
        ],
        finePrint: "*Teacher discount requires valid school ID."
    };

    try {
        const docRef = doc(db, 'artifacts', '162296779236', 'public', 'data', 'site_content', 'promotions');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const fetched = docSnap.data();
            promoData = { ...promoData, ...fetched };
        }
    } catch(e) {
        console.warn("Could not load dynamic promotions, using defaults.", e);
    }

    const addonsHTML = `
    <style>
        .addons-wrapper {
            max-width: 1200px;
            margin: 60px auto;
            padding: 0 20px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            align-items: stretch;
            font-family: 'Open Sans', sans-serif;
        }
        @media (max-width: 900px) {
            .addons-wrapper { grid-template-columns: 1fr; }
        }

        /* Card Styles */
        .addons-card {
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            overflow: hidden;
            border: 1px solid #f1f5f9;
            display: flex;
            flex-direction: column;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .addons-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0,0,0,0.12);
        }

        /* Header */
        .card-header {
            background: #fff;
            padding: 25px 30px;
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .card-header h2 {
            margin: 0;
            font-family: 'Montserrat', sans-serif;
            font-size: 1.25rem;
            color: #1e293b;
            font-weight: 700;
        }
        .card-header i {
            color: #64748b;
            font-size: 1.2rem;
        }

        /* Content Sections */
        .card-body {
            padding: 0;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
        }

        .feature-block {
            padding: 30px;
            border-bottom: 1px solid #f1f5f9;
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
            width: 40px;
            height: 40px;
            border-radius: 8px;
            background: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #334155;
            font-size: 1.1rem;
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
            font-size: 1.5rem;
            color: #0ea5e9; /* Light blue brand color */
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
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .pill-blue { background: #e0f2fe; color: #0284c7; }
        .pill-green { background: #dcfce7; color: #166534; }
        .pill-gray { background: #f1f5f9; color: #475569; }

        /* Eero Special Styling */
        .eero-integration {
            background: #fff;
            border-radius: 12px;
            padding: 20px;
            margin-top: 15px;
            display: flex;
            align-items: center;
            gap: 20px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.02);
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

        /* Promo Side */
        .promo-image {
            height: 240px;
            width: 100%;
            object-fit: cover;
            display: block;
        }
        .promo-content {
            padding: 30px;
            background: linear-gradient(180deg, #fff 0%, #fffbf0 100%);
            flex-grow: 1;
        }
        .promo-title {
            font-family: 'Montserrat', sans-serif;
            font-size: 1.8rem;
            font-weight: 800;
            color: #1e293b;
            margin-bottom: 12px;
            line-height: 1.2;
        }
        .promo-text {
            color: #475569;
            font-size: 1rem;
            line-height: 1.6;
            margin-bottom: 25px;
        }
        
        .check-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .check-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px 16px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            border: 1px solid #e2e8f0;
            transition: transform 0.2s;
        }
        .check-item:hover { transform: translateX(5px); }
        .check-icon {
            color: #f59e0b; /* Amber/Gold */
            font-size: 1.1rem;
            margin-top: 2px;
        }
        .check-text {
            font-weight: 600;
            color: #334155;
            font-size: 0.95rem;
        }
        
        .fine-print {
            margin-top: 20px;
            font-size: 0.75rem;
            color: #94a3b8;
            font-style: italic;
        }

        .included-badge {
            background: #22c55e;
            color: white;
            font-weight: 800;
            font-size: 0.7rem;
            padding: 4px 8px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

    </style>
    
    <div class="addons-wrapper fade-in-section">
        
        <!-- Left Column: Addons -->
        <div class="addons-card">
            <div class="card-header">
                <i class="fa-solid fa-layer-group"></i>
                <h2>Connectivity Features</h2>
            </div>
            <div class="card-body">
                
                <!-- Home Phone -->
                <div class="feature-block">
                    <div class="feature-top">
                        <div class="feature-title-group">
                            <div class="feature-icon"><i class="fa-solid fa-phone"></i></div>
                            <h3 class="feature-title">Home Phone</h3>
                        </div>
                        <div class="price-tag">
                            <div class="price-amount">$25</div>
                            <div class="price-period">/mo</div>
                        </div>
                    </div>
                    <p class="feature-desc">Keep your current number or start fresh. Enjoy crystal clear voice quality integrated with your fiber connection.</p>
                    <div class="pill-container">
                        <span class="pill pill-gray"><i class="fa-solid fa-arrow-right-arrow-left"></i> Number Porting</span>
                        <span class="pill pill-gray"><i class="fa-solid fa-check"></i> Unlimited Local</span>
                    </div>
                </div>

                <!-- Premium WiFi -->
                <div class="feature-block" style="background:#f8fafc; flex-grow:1;">
                    <div class="feature-top">
                        <div class="feature-title-group">
                            <div class="feature-icon" style="background:#e0f2fe; color:#0284c7;"><i class="fa-solid fa-wifi"></i></div>
                            <h3 class="feature-title">Premium WiFi</h3>
                            <span class="included-badge">Included</span>
                        </div>
                    </div>
                    
                    <p class="feature-desc">Experience wall-to-wall coverage. We include advanced mesh hardware to ensure every corner of your home is connected.</p>

                    <!-- Eero Integration -->
                    <div class="eero-integration">
                        <img src="assets/images/eero.webp" alt="eero" class="eero-logo">
                        <div class="eero-text">
                            <strong>Powered by eero.</strong> Advanced security, parental controls, and guest networks built-in.
                        </div>
                    </div>
                </div>

            </div>
        </div>

        <!-- Right Column: Promotions -->
        <div class="addons-card">
            <img src="assets/images/teacher.jpg" alt="Community Support" class="promo-image">
            <div class="promo-content">
                <h2 class="promo-title">${promoData.title}</h2>
                <p class="promo-text">${promoData.description}</p>
                
                <div class="check-list">
                    ${(promoData.items || []).map(item => `
                        <div class="check-item">
                            <i class="fa-solid fa-circle-check check-icon"></i>
                            <span class="check-text">${item}</span>
                        </div>
                    `).join('')}
                </div>

                ${promoData.finePrint ? `<div class="fine-print">${promoData.finePrint}</div>` : ''}
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