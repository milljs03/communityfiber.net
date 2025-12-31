import { getPlans } from './services/db.js';
import { db, app } from './config/firebase-config.js';
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Auth for Lead Capture
    const auth = getAuth(app);
    signInAnonymously(auth).catch(err => console.warn("Auth warning:", err));

    const plansGrid = document.getElementById('plans-grid');
    const loadingEl = document.getElementById('loading-indicator');
    const errorEl = document.getElementById('error-message');

    // Default Data
    const defaultPlans = [
        { 
            name: "Standard", 
            speed: "200 Mbps", 
            price: 65, 
            description: "Great for small households. Stream HD video, browse the web, and check email on a few devices.",
            features: ["Local Service", "No Contracts", "No Data Caps"],
            isPopular: false
        },
        { 
            name: "Advanced", 
            speed: "500 Mbps", 
            price: 80, 
            description: "Ideal for families. Support multiple simultaneous streams, work-from-home video calls, and online learning.",
            features: ["Local Service", "No Contracts", "No Data Caps"],
            isPopular: false 
        },
        { 
            name: "Premium", 
            speed: "1 Gbps", 
            price: 89, 
            description: "The ultimate experience. Perfect for multiplayer gaming, 4K streaming, and smart homes devices.",
            features: ["Local Service", "No Contracts", "No Data Caps"],
            isPopular: true // Highlighted as BEST VALUE
        }
    ];
    
    // --- 2. Update Header Content ---
    updatePageHeader();

    try {
        let plans = [];
        try {
            plans = await getPlans();
        } catch (dbError) {
            console.warn("Using default plans config.");
        }

        if (!plans || plans.length === 0) plans = defaultPlans;

        loadingEl.classList.add('hidden');
        plansGrid.classList.remove('hidden');

        // Render Plans using DRY functions
        plansGrid.innerHTML = plans.map((plan, index) => generatePlanCard(plan, index)).join('');
        
        // --- 3. Inject Add-ons Section (Phone + Eero) ---
        injectAddonsSection(plansGrid);
        
        // Inject Modal HTML
        injectSaveModal();

    } catch (error) {
        console.error("Error rendering plans:", error);
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
    }
});

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
    const addonsHTML = `
    <div class="addons-section-container">
        <!-- Phone Service -->
        <div class="addon-card">
            <div class="addon-top-bar" style="background: linear-gradient(90deg, var(--cfn-green) 0%, var(--cfn-light-green) 100%);"></div>
            <div class="addon-content">
                <div class="addon-icon-title">
                    <i class="fa-solid fa-phone-volume" style="color: var(--cfn-green);"></i>
                    <h3>Home Phone</h3>
                </div>
                <p>Complete your home connection. Keep your current number or start fresh.</p>
                <div class="addon-price-tag">
                    <span class="symbol">$</span><span class="val">25</span><span class="per">/mo</span>
                </div>
                <div class="addon-features-list">
                    <span><i class="fa-solid fa-check" style="color: var(--cfn-green);"></i> Unlimited Long Distance</span>
                    <span><i class="fa-solid fa-check" style="color: var(--cfn-green);"></i> Crystal Clear Voice</span>
                </div>
            </div>
        </div>

        <!-- Eero / WiFi -->
        <div class="addon-card">
            <div class="addon-top-bar" style="background: linear-gradient(90deg, #05a5df 0%, #6cdbf7 100%);"></div>
            <div class="addon-content">
                 <div class="addon-image-wrapper">
                    <img src="assets/images/eero.webp" alt="eero Mesh WiFi" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\'fa-solid fa-wifi\' style=\'font-size:3rem; color:#05a5df; margin-bottom:15px;\'></i>'">
                 </div>
                <div class="addon-icon-title">
                    <h3 style="margin-top:0;">Premium WiFi</h3>
                </div>
                <p>Powered by <strong>eero</strong>. Blanket your home in fast, reliable WiFi with advanced security and controls.</p>
                <div class="addon-features-list">
                    <span><i class="fa-solid fa-shield-halved" style="color: #05a5df;"></i> Advanced Security</span>
                    <span><i class="fa-solid fa-house-signal" style="color: #05a5df;"></i> Guest Networks</span>
                </div>
            </div>
        </div>
    </div>
    `;
    targetElement.insertAdjacentHTML('afterend', addonsHTML);
}

function generatePlanCard(plan, index) {
    const highlightClass = plan.isPopular ? 'popular' : '';
    const badge = plan.isPopular ? '<div class="popular-badge">Best Value</div>' : '';
    const labelId = `bbf-${index}`;

    const featuresHtml = plan.features ? plan.features.map(f => 
        `<div class="highlight-text"><i class="fa-solid fa-check"></i> ${f}</div>`
    ).join('') : '';

    return `
        <div class="pricing-box ${highlightClass}">
            ${badge}
            <div class="pricing-box-inner">
                <h3 class="panel-heading">${plan.name}</h3>
                
                <div class="price-wrapper">
                    <span class="price">$${plan.price}<small>/mo</small></span>
                </div>

                <div class="speed-display">
                    <div class="speed-val">${plan.speed}</div>
                    <div class="speed-label">Download & Upload</div>
                </div>

                <div class="plan-description">
                    ${plan.description || "Reliable fiber internet."}
                </div>

                <div class="core-benefits">
                    ${featuresHtml}
                </div>

                <button class="sign-up-btn" onclick="openSaveModal('${plan.name}')">Select Plan</button>

                <div class="broadband-label-container">
                    ${generateBroadbandLabel(plan, labelId)}
                </div>
            </div>
        </div>
    `;
}

function generateBroadbandLabel(plan, labelId) {
    return `
        <div class="broadband-facts-wrapper" id="${labelId}">
            <!-- Toggle Trigger sits on top when collapsed -->
            <div class="expand-trigger" onclick="toggleLabel('${labelId}')">
                <button class="expand-btn">Broadband Facts <i class="fa-solid fa-chevron-down" style="margin-left:5px"></i></button>
            </div>

            <div class="bbf-header">
                <h4 class="bbf-title">Broadband Facts</h4>
                <div style="font-size:12px; margin-top:5px; font-weight:bold;">Community Fiber Network</div>
                <div style="font-weight:bold;">${plan.name} Plan</div>
                <div style="font-size:14px; margin-top:5px;">Fixed Broadband Consumer Disclosure</div>
            </div>
            
            <div class="bbf-row strong">
                <span>Monthly Price</span>
                <strong>$${plan.price}</strong>
            </div>
            <div class="bbf-row">
                <span>Introductory Rate</span>
                <strong>No</strong>
            </div>
            <div class="bbf-row strong">
                <span>Contract</span>
                <strong>None</strong>
            </div>

            <div style="background-color: #f1f5f9; font-weight: bold; padding: 8px 15px; border-bottom: 1px solid #ccc; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Additional Charges & Terms</div>
            
            <div class="bbf-row">
                <span style="font-weight:bold">Install Fee</span>
                <strong>$50 - $150*</strong>
            </div>
            <div class="bbf-row">
                <span>Equipment Fee</span>
                <strong>$99.00</strong>
            </div>
            <div class="bbf-row">
                <span>Taxes</span>
                <strong>Varies</strong>
            </div>

            <div style="background-color: #f1f5f9; font-weight: bold; padding: 8px 15px; border-bottom: 1px solid #ccc; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Performance</div>

            <div class="bbf-row">
                <span>Download Speed</span>
                <strong>${plan.speed}</strong>
            </div>
            <div class="bbf-row">
                <span>Upload Speed</span>
                <strong>${plan.speed}</strong>
            </div>
            <div class="bbf-row strong">
                <span>Latency</span>
                <strong>17 ms</strong>
            </div>
             <div class="bbf-row strong">
                <span>Data Cap</span>
                <strong>Unlimited</strong>
            </div>

            <div class="bbf-footer">
                <p><strong>Support:</strong> (574) 533-4237</p>
                <a href="https://fcc.gov/consumer" target="_blank" style="color:var(--npt-black)">fcc.gov/consumer</a>
            </div>
        </div>
    `;
}

window.toggleLabel = function(id) {
    const el = document.getElementById(id);
    if(el) {
        el.classList.toggle('expanded');
        const btn = el.querySelector('.expand-btn');
        if(el.classList.contains('expanded')) {
            btn.innerHTML = 'Hide Facts <i class="fa-solid fa-chevron-up" style="margin-left:5px"></i>';
        } else {
            btn.innerHTML = 'Broadband Facts <i class="fa-solid fa-chevron-down" style="margin-left:5px"></i>';
        }
    }
};

window.openSaveModal = function(planName) {
    const modal = document.getElementById('save-modal');
    if(modal) {
        modal.style.display = 'flex';
        modal.dataset.selectedPlan = planName;
    }
};

function injectSaveModal() {
    if(document.getElementById('save-modal')) return;

    const modalHtml = `
    <div id="save-modal" class="modal-overlay">
        <div class="modal-content">
            <button class="close-modal-btn" onclick="document.getElementById('save-modal').style.display='none'">&times;</button>
            <h2 style="margin-top:0; color:var(--npt-black); font-family:var(--font-heading); font-size:1.5rem;">
                <i class="fa-solid fa-bookmark" style="color:var(--cfn-green); margin-right:10px;"></i> Save Quote
            </h2>
            <p style="color:#64748b; font-size:0.95rem; margin-bottom:25px;">
                Not ready to commit? Enter your details and we'll save your quote for later.
            </p>
            <form id="save-quote-form">
                <div style="margin-bottom:15px;">
                    <label style="display:block; font-weight:700; margin-bottom:5px; color:#334155; font-size:0.85rem;">Name</label>
                    <input type="text" id="save-name" required class="form-input" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="Your Name">
                </div>
                <div style="margin-bottom:15px;">
                    <label style="display:block; font-weight:700; margin-bottom:5px; color:#334155; font-size:0.85rem;">Email</label>
                    <input type="email" id="save-email" required class="form-input" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="you@example.com">
                </div>
                <div style="margin-bottom:25px;">
                    <label style="display:block; font-weight:700; margin-bottom:5px; color:#334155; font-size:0.85rem;">Phone (Optional)</label>
                    <input type="tel" id="save-phone" class="form-input" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="(555) 123-4567">
                </div>
                <button type="submit" class="sign-up-btn" style="margin:0;">Save & Notify Me</button>
            </form>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Modal Events
    const modal = document.getElementById('save-modal');
    const form = document.getElementById('save-quote-form');
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Saving...";

        const name = document.getElementById('save-name').value;
        const email = document.getElementById('save-email').value;
        const phone = document.getElementById('save-phone').value;
        const selectedPlan = modal.dataset.selectedPlan || "Unknown";

        try {
            await addDoc(collection(db, 'artifacts', '162296779236', 'public', 'data', 'leads'), {
                name, email, phone,
                plan: selectedPlan,
                type: 'saved_quote',
                submittedAt: new Date()
            });
            
            alert("Success! We've saved your quote.");
            modal.style.display = 'none';
            form.reset();
        } catch (err) {
            console.error("Save failed:", err);
            alert("Could not save quote. Please try again.");
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}