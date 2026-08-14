import { db, app } from './config/firebase-config.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, orderBy, where, getDoc, setDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { escapeHtml, safeUrl } from './security.js';

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = 'jmiller@nptel.com';
const ALLOWED_DOMAIN = 'nptel.com';

// Pages that can host a team grid. Keep in sync with the data-team-page values
// in the markup and with team-grid.js.
const TEAM_PAGES = [
    { key: 'about', label: 'About' },
    { key: 'business', label: 'Business' },
    { key: 'residential', label: 'Residential' },
    { key: 'builders', label: 'Builders' },
];

// Records created before page targeting existed have no `pages` field at all.
// They are treated as About-only, which is where they already appeared — the
// alternative defaults would either hide everyone or put everyone everywhere.
/** "No order" sorts last, so it cannot be 0 — see the note in team-grid.js.
    0 counts as unset because the form used to save a blank field as 0. */
function employeeOrderRank(emp) {
    const n = Number(emp?.order);
    return Number.isFinite(n) && n > 0 ? n : Infinity;
}

function employeeShowsOn(data, key) {
    const pages = Array.isArray(data?.pages) ? data.pages : null;
    if (!pages) return key === 'about';
    return pages.includes(key);
}

let currentUser = null;
let isAdmin = false;
let loadedLeads = [];

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const adminApp = document.getElementById('admin-app');
const loginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');
const imageFallback = 'assets/images/community-fiber-logo.png';

// --- Auth Handling ---

// Enable Persistence
setPersistence(auth, browserLocalPersistence)
    .then(() => {
        // Persistence is set. Auth state will be checked by onAuthStateChanged
    })
    .catch((error) => {
        console.error("Auth Persistence Error:", error);
    });

loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => {
        console.error("Auth Error:", error);
        if (error.code === 'auth/popup-closed-by-user') {
            showLoginError("Login cancelled.");
        } else {
            showLoginError("Login failed. Browser may be blocking the popup.");
        }
    });
});

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.reload();
    });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email && user.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
            checkAccess(user);
        } else {
            console.warn(`Unauthorized login attempt: ${user.email}`);
            signOut(auth).then(() => {
                const emailMsg = user.email ? `(${user.email})` : '';
                showLoginError(`Access restricted to @${ALLOWED_DOMAIN} accounts only. ${emailMsg}`);
            });
        }
    } else {
        loginOverlay.classList.remove('hidden');
        adminApp.classList.add('hidden');
    }
});

function checkAccess(user) {
    currentUser = user;
    isAdmin = (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    document.getElementById('user-name').textContent = user.displayName || user.email || 'User';
    document.getElementById('user-avatar').src = safeUrl(user.photoURL, imageFallback);
    document.getElementById('user-role').textContent = isAdmin ? 'Admin' : 'Viewer';
    document.getElementById('user-role').className = `badge ${isAdmin ? 'bg-green' : 'bg-gray'}`;

    document.querySelectorAll('.user-name-display').forEach(el => el.textContent = user.displayName ? user.displayName.split(' ')[0] : 'User');

    if (isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }

    loginOverlay.classList.add('hidden');
    adminApp.classList.remove('hidden');

    loadDashboard();
}

function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
}

// --- Navigation ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        const tab = btn.dataset.tab;
        document.getElementById(`view-${tab}`).classList.add('active');

        if (tab === 'leads') loadLeads();
        if (tab === 'promotions') loadPromotions(); // NEW
        if (tab === 'plans') loadPlans();
        if (tab === 'mobile-plans') loadMobilePlans();
        if (tab === 'install') loadInstallSteps();
        if (tab === 'neighborhoods') loadNeighborhoods();
        if (tab === 'business') loadBusinessLogos();
        if (tab === 'employees') loadEmployees();
        if (tab === 'announcements') loadAnnouncementSettings();
        if (tab === 'testimonials') loadTestimonials();
        if (tab === 'news') loadNews();
    });
});

// Event Delegation for Leads Table (View Details)
const leadsTableBody = document.getElementById('leads-table-body');
if (leadsTableBody) {
    leadsTableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row && row.dataset.id) {
            const id = row.dataset.id;
            const lead = loadedLeads.find(l => l.id === id);
            if (lead) openViewLeadModal(lead);
        }
    });
}

// --- Data Loading Functions ---

async function loadDashboard() {
    try {
        // Load core stats
        const leadsSnap = await getDocs(collection(db, 'artifacts', '162296779236', 'public', 'data', 'leads'));
        document.getElementById('stat-leads').textContent = leadsSnap.size;

        const hoodsSnap = await getDocs(collection(db, 'artifacts', '162296779236', 'public', 'data', 'neighborhoods'));
        document.getElementById('stat-hoods').textContent = hoodsSnap.size;

        // Load and process analytics data
        const analyticsRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'analytics_pageviews');
        const analyticsSnap = await getDocs(query(analyticsRef, orderBy('timestamp', 'desc'), limit(500))); // Increased limit for better data

        let totalViews = analyticsSnap.size;
        let deviceStats = { mobile: 0, desktop: 0, tablet: 0 };
        let pageStats = {};
        let referrerStats = { Direct: 0, Google: 0, Facebook: 0, Other: 0 };
        const uniqueSessions = new Set();

        analyticsSnap.forEach(doc => {
            const data = doc.data();

            // Device stats
            deviceStats[data.deviceType || 'desktop']++;

            // Page stats
            const p = data.page || 'unknown';
            pageStats[p] = (pageStats[p] || 0) + 1;

            // Session stats
            if(data.sessionId) uniqueSessions.add(data.sessionId);

            // Referrer stats
            const ref = data.referrer || 'direct';
            if (ref === 'direct' || ref === '') {
                referrerStats.Direct++;
            } else if (ref.includes('google.com')) {
                referrerStats.Google++;
            } else if (ref.includes('facebook.com') || ref.includes('fb.com')) {
                referrerStats.Facebook++;
            } else {
                referrerStats.Other++;
            }
        });

        // Update stat cards
        document.getElementById('stat-views').textContent = totalViews;
        document.getElementById('stat-sessions').textContent = uniqueSessions.size;

        // Render Charts
        renderDeviceChart(deviceStats);
        renderTrafficSourceChart(referrerStats);

        // Render Top Pages List
        let topPagesContainer = document.querySelector('.analytics-grid'); // Place it within the new grid
        let topPagesCard = document.getElementById('top-pages-card');
        if (!topPagesCard) {
            topPagesCard = document.createElement('div');
            topPagesCard.id = 'top-pages-card';
            topPagesCard.className = 'admin-card';
            topPagesCard.innerHTML = `<h3>Top Pages Visited</h3><div id="top-pages-list"></div>`;
            topPagesContainer.appendChild(topPagesCard);
        }

        const sortedPages = Object.entries(pageStats).sort((a, b) => b[1] - a[1]).slice(0, 7);
        const listHtml = sortedPages.map(([page, count]) => `
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
                <span style="font-weight:600; color:#334155;">${escapeHtml(page)}</span>
                <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-size:0.85rem; font-weight:700;">${escapeHtml(count)}</span>
            </div>
        `).join('');

        document.getElementById('top-pages-list').innerHTML = listHtml || '<p>No data yet.</p>';

    } catch (err) {
        console.error("Dashboard Load Error:", err);
    }
}

function renderDeviceChart(deviceData) {
    const chart = prepareCanvas('device-type-chart');
    if (!chart) return;

    const rows = [
        { label: 'Desktop', value: Number(deviceData.desktop || 0), color: '#2563eb' },
        { label: 'Mobile', value: Number(deviceData.mobile || 0), color: '#0f766e' },
        { label: 'Tablet', value: Number(deviceData.tablet || 0), color: '#d97706' }
    ];

    drawDoughnutChart(chart, rows);
}

function renderTrafficSourceChart(referrerData) {
    const chart = prepareCanvas('traffic-source-chart');
    if (!chart) return;

    const colors = ['#7c3aed', '#dc2626', '#2563eb', '#64748b'];
    const rows = Object.entries(referrerData).map(([label, value], index) => ({
        label,
        value: Number(value || 0),
        color: colors[index % colors.length]
    }));

    drawBarChart(chart, rows);
}

function prepareCanvas(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round((rect.width || canvas.clientWidth || 320) * ratio));
    const height = Math.max(1, Math.round((rect.height || canvas.clientHeight || 240) * ratio));

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const cssWidth = width / ratio;
    const cssHeight = height / ratio;
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    return { ctx, width: cssWidth, height: cssHeight };
}

function drawNoChartData(ctx, width, height) {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data yet', width / 2, height / 2);
}

function drawDoughnutChart({ ctx, width, height }, rows) {
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    if (!total) {
        drawNoChartData(ctx, width, height);
        return;
    }

    const radius = Math.max(42, Math.min(width, height - 40) * 0.32);
    const centerX = width / 2;
    const centerY = Math.max(radius + 8, height * 0.43);
    let angle = -Math.PI / 2;

    rows.forEach((row) => {
        const slice = (row.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, angle, angle + slice);
        ctx.closePath();
        ctx.fillStyle = row.color;
        ctx.fill();
        angle += slice;
    });

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    drawLegend(ctx, rows, 18, height - 30);
}

function drawBarChart({ ctx, width, height }, rows) {
    const maxValue = Math.max(...rows.map((row) => row.value), 0);
    if (!maxValue) {
        drawNoChartData(ctx, width, height);
        return;
    }

    const chartTop = 18;
    const chartLeft = 32;
    const chartRight = width - 16;
    const chartBottom = height - 42;
    const chartWidth = Math.max(1, chartRight - chartLeft);
    const chartHeight = Math.max(1, chartBottom - chartTop);
    const gap = 12;
    const barWidth = Math.max(12, (chartWidth - gap * (rows.length - 1)) / rows.length);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartLeft, chartBottom);
    ctx.lineTo(chartRight, chartBottom);
    ctx.stroke();

    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    rows.forEach((row, index) => {
        const x = chartLeft + index * (barWidth + gap);
        const barHeight = Math.max(2, (row.value / maxValue) * chartHeight);
        const y = chartBottom - barHeight;

        ctx.fillStyle = row.color;
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = '#334155';
        ctx.fillText(String(row.value), x + barWidth / 2, Math.max(chartTop, y - 16));
        ctx.fillStyle = '#64748b';
        ctx.fillText(row.label.slice(0, 12), x + barWidth / 2, chartBottom + 10);
    });
}

function drawLegend(ctx, rows, x, y) {
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let cursor = x;
    rows.forEach((row) => {
        const label = `${row.label} ${row.value}`;
        ctx.fillStyle = row.color;
        ctx.fillRect(cursor, y - 5, 10, 10);
        ctx.fillStyle = '#334155';
        ctx.fillText(label, cursor + 16, y);
        cursor += ctx.measureText(label).width + 36;
    });
}

/**
 * Delivery status for a lead's notification email.
 *
 * The lead is written to Firestore before any email is attempted, so a
 * failure here never means a lost submission — it means someone has to
 * follow up by hand. The table is the only place that failure surfaces;
 * nothing else in the UI reports it.
 */
function renderEmailStatus(lead) {
    const note = lead.emailNotification;
    if (!note || !note.status) {
        return '<span class="badge-email badge-email--unknown" title="No delivery record — predates email tracking, or the function never reported back.">&mdash;</span>';
    }

    const confirmation = note.confirmation || {};
    const detail = [note.reason, note.message].filter(Boolean).join(': ');

    if (note.status === 'sent') {
        if (confirmation.status === 'failed') {
            const why = [confirmation.reason, confirmation.message].filter(Boolean).join(': ');
            return `<span class="badge-email badge-email--warn" title="Staff were notified. The customer receipt failed: ${escapeHtml(why || 'unknown')}">Sent, no receipt</span>`;
        }
        return '<span class="badge-email badge-email--sent" title="Staff notification delivered">Sent</span>';
    }

    if (note.status === 'skipped') {
        return `<span class="badge-email badge-email--skipped" title="No email attempted: ${escapeHtml(note.reason || 'unknown')}">Skipped</span>`;
    }

    return `<span class="badge-email badge-email--failed" title="${escapeHtml(detail || 'Delivery failed')}">Failed &mdash; follow up</span>`;
}

async function loadLeads() {
    const tbody = document.getElementById('leads-table-body');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading...</td></tr>';

    const filter = document.getElementById('lead-filter').value;
    let q = collection(db, 'artifacts', '162296779236', 'public', 'data', 'leads');

    if (filter !== 'all') {
        q = query(q, where('type', '==', filter));
    }

    try {
        const snapshot = await getDocs(q);
        const leads = [];
        snapshot.forEach(doc => leads.push({ id: doc.id, ...doc.data() }));
        loadedLeads = leads; // Store for View JSON

        leads.sort((a, b) => {
            const dateA = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(0);
            const dateB = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(0);
            return dateB - dateA;
        });

        tbody.innerHTML = '';
        if (leads.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No records found</td></tr>';
            return;
        }

        leads.forEach(lead => {
            const date = lead.submittedAt?.toDate ? lead.submittedAt.toDate().toLocaleDateString() : 'N/A';
            // Handle different name fields across forms (Support vs Business vs Builder)
            const displayName = lead.name || lead.contactName || lead.businessName || lead.company || 'Unknown';
            const row = `
                <tr class="lead-row" data-id="${lead.id}" style="cursor: pointer;">
                    <td>${escapeHtml(date)}</td>
                    <td><span class="badge">${escapeHtml(lead.type || 'General')}</span></td>
                    <td>${escapeHtml(displayName)}</td>
                    <td>${escapeHtml(lead.email || '-')}</td>
                    <td>${escapeHtml(lead.status || 'New')}</td>
                    <td>${renderEmailStatus(lead)}</td>
                    <td><button class="btn-sm btn-edit">View</button></td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });

    } catch (err) {
        console.error("Error loading leads:", err);
        tbody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error loading data. Check Firestore Rules.</td></tr>';
    }
}

document.getElementById('lead-filter').addEventListener('change', loadLeads);

// --- PROMOTIONS / SAVE MORE ---
const promotionsForm = document.getElementById('promotions-form');

async function loadPromotions() {
    try {
        const docRef = doc(db, 'artifacts', '162296779236', 'public', 'data', 'site_content', 'promotions');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('promo-title').value = data.title || '';
            document.getElementById('promo-description').value = data.description || '';
            document.getElementById('promo-finePrint').value = data.finePrint || '';

            // Convert array back to newline separated string for textarea
            if (data.items && Array.isArray(data.items)) {
                document.getElementById('promo-items').value = data.items.join('\n');
            } else {
                document.getElementById('promo-items').value = '';
            }
        }
    } catch (err) {
        console.error("Error loading promotions:", err);
    }
}

if(promotionsForm) {
    promotionsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isAdmin) {
            alert("You must be an admin to save changes.");
            return;
        }

        const itemsText = document.getElementById('promo-items').value;
        const itemsArray = itemsText.split('\n').map(item => item.trim()).filter(item => item !== '');

        const data = {
            title: document.getElementById('promo-title').value,
            description: document.getElementById('promo-description').value,
            items: itemsArray,
            finePrint: document.getElementById('promo-finePrint').value,
            updatedAt: new Date()
        };

        try {
            const docRef = doc(db, 'artifacts', '162296779236', 'public', 'data', 'site_content', 'promotions');
            // Use setDoc with merge:true so we don't overwrite other fields if we add them later
            await setDoc(docRef, data, { merge: true });
            alert("Promotions content updated successfully!");
        } catch (err) {
            console.error(err);
            alert("Error updating promotions content.");
        }
    });
}
// --- END PROMOTIONS ---

async function loadPlans() {
    const container = document.getElementById('plans-list');
    container.innerHTML = '<p>Loading...</p>';

    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'plans');
        const snapshot = await getDocs(ref);

        container.innerHTML = '';

        const plans = [];
        snapshot.forEach(doc => plans.push({ id: doc.id, data: doc.data() }));
        plans.sort((a, b) => ((Number(a.data.order) || 0) - (Number(b.data.order) || 0))
            || ((Number(a.data.price) || 0) - (Number(b.data.price) || 0)));

        plans.forEach(({ id, data: plan }) => {
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <h3>${escapeHtml(String(plan.order ?? '–'))}. ${escapeHtml(plan.name || '')} <span style="font-size:0.8rem; color:green;">$${escapeHtml(plan.price || '')}</span></h3>
                <p>${escapeHtml(plan.speed || '')} - ${escapeHtml(plan.description?.substring(0, 50) || '')}...</p>
                <div class="card-actions">
                    ${isAdmin ? `<button class="btn-sm btn-edit" data-id="${id}" data-type="plan">Edit</button>` : ''}
                    ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${id}" data-type="plan">Delete</button>` : ''}
                </div>
            `;
            container.appendChild(card);

            if(isAdmin) {
                card.querySelector('.btn-edit').addEventListener('click', () => openEditModal('plan', id, plan));
                card.querySelector('.btn-delete').addEventListener('click', () => deleteItem('plan', id));
            }
        });

        if (snapshot.empty) container.innerHTML = '<p>No plans found. Add one!</p>';

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Error loading plans.</p>';
    }
}

/* Mobile plans live in their own collection rather than sharing `plans`, because
   the two card shapes have nothing in common — broadband plans key off a speed
   and a monthly price, mobile plans off a data allowance and a per-line price
   that may not be published yet. */
async function loadMobilePlans() {
    const container = document.getElementById('mobile-plans-list');
    container.innerHTML = '<p>Loading...</p>';

    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'mobile_plans');
        const snapshot = await getDocs(ref);

        container.innerHTML = '';

        const plans = [];
        snapshot.forEach(doc => plans.push({ id: doc.id, data: doc.data() }));
        plans.sort((a, b) => (Number(a.data.order) || 0) - (Number(b.data.order) || 0));

        plans.forEach(({ id, data: plan }) => {
            const priceText = plan.price ? `$${plan.price}` : 'Call for pricing';
            const featureCount = String(plan.features || '').split('\n').filter(l => l.trim()).length;
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <h3>${escapeHtml(String(plan.order ?? '–'))}. ${escapeHtml(plan.name || '')} <span style="font-size:0.8rem; color:${plan.price ? 'green' : '#b45309'};">${escapeHtml(priceText)}</span></h3>
                <p>${escapeHtml(plan.dataNote || '')}<br>
                   <span style="color:#64748b;">${featureCount} feature${featureCount === 1 ? '' : 's'}${plan.isPopular ? ' · Most popular' : ''}</span></p>
                <div class="card-actions">
                    ${isAdmin ? `<button class="btn-sm btn-edit" data-id="${id}" data-type="mobile_plan">Edit</button>` : ''}
                    ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${id}" data-type="mobile_plan">Delete</button>` : ''}
                </div>
            `;
            container.appendChild(card);

            if (isAdmin) {
                card.querySelector('.btn-edit').addEventListener('click', () => openEditModal('mobile_plan', id, plan));
                card.querySelector('.btn-delete').addEventListener('click', () => deleteItem('mobile_plan', id));
            }
        });

        if (snapshot.empty) container.innerHTML = '<p>No mobile plans found. Add one!</p>';

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Error loading mobile plans.</p>';
    }
}

async function loadInstallSteps() {
    const container = document.getElementById('install-steps-list');
    container.innerHTML = '<p>Loading...</p>';

    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'install_steps');
        // Sort by stepNumber
        const q = query(ref, orderBy('stepNumber', 'asc'));
        const snapshot = await getDocs(q);

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const step = doc.data();
            const stepImageUrl = safeUrl(step.imageUrl, '', { allowDataImage: true });
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <div style="display:flex; gap:15px; align-items:center;">
                    <div style="background:var(--cfn-green); color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                        ${escapeHtml(step.stepNumber || '')}
                    </div>
                    <div>
                        <h3 style="margin:0;">${escapeHtml(step.title || '')}</h3>
                    </div>
                </div>
                <div style="margin-top:10px; color:#64748b; font-size:0.9rem;">
                    <p>${escapeHtml(step.description || '')}</p>
                </div>
                ${stepImageUrl ? `<img src="${stepImageUrl}" alt="" style="width:100%; height:120px; object-fit:cover; border-radius:8px; margin-top:10px;">` : ''}
                <div class="card-actions">
                    ${isAdmin ? `<button class="btn-sm btn-edit" data-id="${doc.id}" data-type="install_step">Edit</button>` : ''}
                    ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${doc.id}" data-type="install_step">Delete</button>` : ''}
                </div>
            `;
            container.appendChild(card);

            if(isAdmin) {
                card.querySelector('.btn-edit').addEventListener('click', () => openEditModal('install_step', doc.id, step));
                card.querySelector('.btn-delete').addEventListener('click', () => deleteItem('install_step', doc.id));
            }
        });

        if (snapshot.empty) container.innerHTML = '<p>No steps found. Add your first installation step!</p>';

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Error loading steps.</p>';
    }
}

async function loadNeighborhoods() {
    const container = document.getElementById('hoods-list');
    container.innerHTML = '<p>Loading...</p>';

    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'neighborhoods');
        const snapshot = await getDocs(ref);

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const hood = doc.data();
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <h3>${escapeHtml(hood.name || '')}</h3>
                <p>Status: <strong>${escapeHtml(hood.status || '')}</strong></p>
                <div class="card-actions">
                    ${isAdmin ? `<button class="btn-sm btn-edit" data-id="${doc.id}" data-type="hood">Edit</button>` : ''}
                    ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${doc.id}" data-type="hood">Delete</button>` : ''}
                </div>
            `;
            container.appendChild(card);

             if(isAdmin) {
                card.querySelector('.btn-edit').addEventListener('click', () => openEditModal('hood', doc.id, hood));
                card.querySelector('.btn-delete').addEventListener('click', () => deleteItem('neighborhoods', doc.id));
            }
        });

         if (snapshot.empty) container.innerHTML = '<p>No neighborhoods found. Add one!</p>';

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Error loading neighborhoods.</p>';
    }
}

async function loadEmployees() {
    const container = document.getElementById('employees-list');
    container.innerHTML = '<p>Loading...</p>';

    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'employees');
        const snapshot = await getDocs(ref);

        container.innerHTML = '';
        const rows = [];
        snapshot.forEach(doc => rows.push(doc));
        rows.sort((a, b) => {
            const ra = employeeOrderRank(a.data());
            const rb = employeeOrderRank(b.data());
            if (ra !== rb) return ra - rb;
            return String(a.data().name || '').localeCompare(String(b.data().name || ''));
        });
        rows.forEach(doc => {
            const emp = doc.data();
            const photoUrl = safeUrl(emp.photoUrl, '', { allowDataImage: true });
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <div style="display:flex; gap:15px; align-items:center;">
                    <div style="width:50px; height:50px; border-radius:50%; background:#eee; overflow:hidden; flex-shrink:0;">
                        ${photoUrl ? `<img src="${photoUrl}" alt="" style="width:100%; height:100%; object-fit:cover;">` : '<svg class="cfn-icon" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true" style="line-height:50px; text-align:center; display:block; color:#ccc;"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>'}
                    </div>
                    <div>
                        <h3 style="margin:0; font-size:1.1rem;">${escapeHtml(emp.name || '')}</h3>
                        <p style="margin:0; font-size:0.9rem; color:#64748b;">${escapeHtml(emp.title || '')}</p>
                    </div>
                </div>
                <div style="margin-top:15px; font-size:0.9rem; color:#475569;">
                    <p style="margin-bottom:5px;"><strong>${escapeHtml(emp.years || '')}</strong> years at CFN/NPT</p>
                    <p class="page-tags">${
                        TEAM_PAGES.filter((p) => employeeShowsOn(emp, p.key)).length
                            ? TEAM_PAGES.filter((p) => employeeShowsOn(emp, p.key))
                                .map((p) => `<span class="page-tag">${escapeHtml(p.label)}</span>`).join('')
                            : '<span class="page-tag page-tag--none">Hidden everywhere</span>'
                    }</p>
                </div>
                <div class="card-actions">
                    ${isAdmin ? `<button class="btn-sm btn-edit" data-id="${doc.id}" data-type="employee">Edit</button>` : ''}
                    ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${doc.id}" data-type="employee">Delete</button>` : ''}
                </div>
            `;
            container.appendChild(card);

             if(isAdmin) {
                card.querySelector('.btn-edit').addEventListener('click', () => openEditModal('employee', doc.id, emp));
                card.querySelector('.btn-delete').addEventListener('click', () => deleteItem('employees', doc.id));
            }
        });

         if (snapshot.empty) container.innerHTML = '<p>No employees found. Add one!</p>';

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Error loading employees.</p>';
    }
}

const bannerForm = document.getElementById('announcement-form');

async function loadAnnouncementSettings() {
    try {
        const docRef = doc(db, 'artifacts', '162296779236', 'public', 'data', 'settings', 'banner');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('banner-active').checked = data.active || false;
            document.getElementById('banner-message').value = data.message || '';
            document.getElementById('banner-type').value = data.type || 'info';
        }
    } catch (err) {
        console.error("Error loading banner settings:", err);
    }
}

if(bannerForm) {
    bannerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isAdmin) return;

        const data = {
            active: document.getElementById('banner-active').checked,
            message: document.getElementById('banner-message').value,
            type: document.getElementById('banner-type').value,
            updatedAt: new Date()
        };

        try {
            const docRef = doc(db, 'artifacts', '162296779236', 'public', 'data', 'settings', 'banner');
            await setDoc(docRef, data);
            alert("Banner updated successfully!");
        } catch (err) {
            console.error(err);
            alert("Error updating banner.");
        }
    });
}

async function loadTestimonials() {
    const container = document.getElementById('testimonials-list');
    container.innerHTML = '<p>Loading...</p>';

    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'testimonials');
        const snapshot = await getDocs(ref);

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const t = doc.data();
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <h3>${escapeHtml(t.author || '')} <small style="font-weight:400; color:#64748b;">(${escapeHtml(t.location || '')})</small></h3>
                <p><em>"${escapeHtml(t.quote || '')}"</em></p>
                <div class="card-actions">
                    ${isAdmin ? `<button class="btn-sm btn-edit" data-id="${doc.id}" data-type="testimonial">Edit</button>` : ''}
                    ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${doc.id}" data-type="testimonial">Delete</button>` : ''}
                </div>
            `;
            container.appendChild(card);

             if(isAdmin) {
                card.querySelector('.btn-edit').addEventListener('click', () => openEditModal('testimonial', doc.id, t));
                card.querySelector('.btn-delete').addEventListener('click', () => deleteItem('testimonials', doc.id));
            }
        });

         if (snapshot.empty) container.innerHTML = '<p>No testimonials found. Add one!</p>';

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Error loading testimonials.</p>';
    }
}

// NEW: Load News Function
async function loadNews() {
    const container = document.getElementById('news-list');
    container.innerHTML = '<p>Loading...</p>';

    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'news');
        const q = query(ref, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const item = doc.data();
            const date = item.date ? (item.date.toDate ? item.date.toDate().toLocaleDateString() : new Date(item.date).toLocaleDateString()) : 'No Date';
            const itemImageUrl = safeUrl(item.imageUrl, '', { allowDataImage: true });

            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <div style="margin-bottom:10px;">
                    <span style="font-size:0.8rem; color:#64748b; font-weight:bold;">${escapeHtml(date)}</span>
                    <h3 style="margin:5px 0;">${escapeHtml(item.title || '')}</h3>
                </div>
                <p style="font-size:0.9rem; color:#475569; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(item.excerpt || '')}</p>
                ${itemImageUrl ? `<img src="${itemImageUrl}" alt="" style="width:100%; height:120px; object-fit:cover; border-radius:8px; margin:10px 0;">` : ''}
                <p style="font-size:0.8rem; color:#0369a1;">Link: ${escapeHtml(item.linkText || '')} (${escapeHtml(safeUrl(item.linkUrl, '#'))})</p>

                <div class="card-actions">
                    ${isAdmin ? `<button class="btn-sm btn-edit" data-id="${doc.id}" data-type="news">Edit</button>` : ''}
                    ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${doc.id}" data-type="news">Delete</button>` : ''}
                </div>
            `;
            container.appendChild(card);

             if(isAdmin) {
                card.querySelector('.btn-edit').addEventListener('click', () => openEditModal('news', doc.id, item));
                card.querySelector('.btn-delete').addEventListener('click', () => deleteItem('news', doc.id));
            }
        });

         if (snapshot.empty) container.innerHTML = '<p>No news posts found. Add one!</p>';

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Error loading news.</p>';
    }
}

// NEW: Load Business Logos
async function loadBusinessLogos() {
    const container = document.getElementById('business-logos-list');
    container.innerHTML = '<p>Loading...</p>';

    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'business_logos');
        const q = query(ref, orderBy('name', 'asc'));
        const snapshot = await getDocs(q);

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const item = doc.data();
            const logoUrl = safeUrl(item.logoUrl, imageFallback, { allowDataImage: true });
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <img src="${logoUrl}" alt="${escapeHtml(item.name || '')}" class="business-logo-preview">
                <h3 style="text-align:center; font-size: 1rem;">${escapeHtml(item.name || '')}</h3>
                <div class="card-actions">
                    ${isAdmin ? `<button class="btn-sm btn-edit" data-id="${doc.id}" data-type="business_logo">Edit</button>` : ''}
                    ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${doc.id}" data-type="business_logo">Delete</button>` : ''}
                </div>
            `;
            container.appendChild(card);

             if(isAdmin) {
                card.querySelector('.btn-edit').addEventListener('click', () => openEditModal('business_logo', doc.id, item));
                card.querySelector('.btn-delete').addEventListener('click', () => deleteItem('business_logo', doc.id));
            }
        });

         if (snapshot.empty) container.innerHTML = '<p>No business logos found. Add one!</p>';

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Error loading business logos.</p>';
    }
}

const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const modalFields = document.getElementById('modal-fields');

function openEditModal(type, id, data = null) {
    if (!isAdmin) return;
    const field = (value) => escapeHtml(value || '');

    document.getElementById('edit-id').value = id || '';
    document.getElementById('edit-type').value = type;
    document.getElementById('modal-title').textContent = id ? `Edit ${type}` : `Add ${type}`;

    modalFields.innerHTML = '';

    if (type === 'plan') {
        modalFields.innerHTML = `
            <div>
                <label class="form-label">Plan Name</label>
                <input type="text" name="name" class="form-control" value="${field(data?.name)}" required>
            </div>
            <div>
                <label class="form-label">Display Order</label>
                <input type="number" name="order" class="form-control" value="${field(data?.order)}" placeholder="1 = first, 2 = second, ...">
            </div>
            <div>
                <label class="form-label">Price</label>
                <input type="number" name="price" class="form-control" value="${field(data?.price)}" required>
            </div>
            <div>
                <label class="form-label">Promo: Original Price (optional)</label>
                <input type="number" name="originalPrice" class="form-control" value="${field(data?.originalPrice)}" placeholder="Crossed-out 'was' price — leave blank for none">
            </div>
            <div>
                <label class="form-label">Promo Label (optional)</label>
                <input type="text" name="promoLabel" class="form-control" value="${field(data?.promoLabel)}" placeholder="e.g. Promotional price">
            </div>
            <div>
                <label class="form-label">Speed</label>
                <input type="text" name="speed" class="form-control" value="${field(data?.speed)}" required>
            </div>
            <div>
                <label class="form-label">Description</label>
                <textarea name="description" class="form-control" rows="3">${field(data?.description)}</textarea>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                <input type="checkbox" id="plan-popular" name="isPopular" ${data?.isPopular ? 'checked' : ''} style="width: auto;">
                <label for="plan-popular" class="form-label" style="margin-bottom: 0; cursor: pointer;">Best Value (Gold Highlight)</label>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                <input type="checkbox" id="plan-autopay" name="requiresAutopay" ${data?.requiresAutopay ? 'checked' : ''} style="width: auto;">
                <label for="plan-autopay" class="form-label" style="margin-bottom: 0; cursor: pointer;">Requires E-Bill &amp; Auto Pay</label>
            </div>
        `;
    } else if (type === 'mobile_plan') {
        modalFields.innerHTML = `
            <div>
                <label class="form-label">Plan Name &mdash; the large text on the card</label>
                <input type="text" name="name" class="form-control" value="${field(data?.name)}" placeholder="e.g. Unlimited Max" required>
            </div>
            <div>
                <label class="form-label">Display Order</label>
                <input type="number" name="order" class="form-control" value="${field(data?.order)}" placeholder="1 = first, 2 = second, ...">
            </div>
            <div>
                <label class="form-label">Caption &mdash; small text under the name</label>
                <input type="text" name="dataNote" class="form-control" value="${field(data?.dataNote)}" placeholder="e.g. High-speed data included">
            </div>
            <div>
                <label class="form-label">Price per line (leave blank for &ldquo;Call for pricing&rdquo;)</label>
                <input type="number" name="price" class="form-control" value="${field(data?.price)}" placeholder="e.g. 30">
            </div>
            <div>
                <label class="form-label">Price Caption</label>
                <input type="text" name="priceNote" class="form-control" value="${field(data?.priceNote)}" placeholder="e.g. /mo per line">
            </div>
            <div>
                <label class="form-label">Features &mdash; one per line</label>
                <textarea name="features" class="form-control" rows="5" placeholder="Mobile hotspot included&#10;Keep your current number">${field(data?.features)}</textarea>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                <input type="checkbox" id="mobile-plan-popular" name="isPopular" ${data?.isPopular ? 'checked' : ''} style="width: auto;">
                <label for="mobile-plan-popular" class="form-label" style="margin-bottom: 0; cursor: pointer;">Show &ldquo;Most popular&rdquo; badge</label>
            </div>
        `;
    } else if (type === 'hood') {
         modalFields.innerHTML = `
            <div>
                <label class="form-label">Neighborhood Name</label>
                <input type="text" name="name" class="form-control" value="${field(data?.name)}" required>
            </div>
            <div>
                <label class="form-label">Status</label>
                <select name="status" class="form-control">
                    <option value="Live Now" ${data?.status === 'Live Now' ? 'selected' : ''}>Live Now</option>
                    <option value="Construction Phase" ${data?.status === 'Construction Phase' ? 'selected' : ''}>Construction Phase</option>
                    <option value="Pre-Order" ${data?.status === 'Pre-Order' ? 'selected' : ''}>Pre-Order</option>
                    <option value="Planned" ${data?.status === 'Planned' ? 'selected' : ''}>Planned</option>
                </select>
            </div>
        `;
    } else if (type === 'testimonial') {
        modalFields.innerHTML = `
            <div>
                <label class="form-label">Author Name</label>
                <input type="text" name="author" class="form-control" value="${field(data?.author)}" required>
            </div>
            <div>
                <label class="form-label">Location / Neighborhood</label>
                <input type="text" name="location" class="form-control" value="${field(data?.location)}" required placeholder="e.g. Maple Ridge">
            </div>
            <div>
                <label class="form-label">Quote</label>
                <textarea name="quote" class="form-control" rows="3" required>${field(data?.quote)}</textarea>
            </div>
        `;
    } else if (type === 'install_step') {
        modalFields.innerHTML = `
            <div>
                <label class="form-label">Step Number (Order)</label>
                <input type="number" name="stepNumber" class="form-control" value="${field(data?.stepNumber)}" required placeholder="e.g. 1">
            </div>
            <div>
                <label class="form-label">Title</label>
                <input type="text" name="title" class="form-control" value="${field(data?.title)}" required placeholder="e.g. Site Survey">
            </div>
            <div>
                <label class="form-label">Description</label>
                <textarea name="description" class="form-control" rows="3" required>${field(data?.description)}</textarea>
            </div>
             <div>
                <label class="form-label">Step Photo Upload</label>
                <input type="file" id="photo-upload" class="form-control" accept="image/*">
                <input type="hidden" name="imageUrl" id="photo-url-input" value="${field(data?.imageUrl)}">
                <p id="upload-status" style="font-size:0.8rem; color:#64748b;">${data?.imageUrl ? 'Current photo loaded' : 'No photo selected'}</p>
            </div>
        `;
        setupFileUploadListener();
    } else if (type === 'employee') {
        modalFields.innerHTML = `
            <div>
                <label class="form-label">Name</label>
                <input type="text" name="name" class="form-control" value="${field(data?.name)}" required>
            </div>
            <div>
                <label class="form-label">Title</label>
                <input type="text" name="title" class="form-control" value="${field(data?.title)}" required>
            </div>
            <div>
                <label class="form-label">Years at Company</label>
                <input type="number" name="years" class="form-control" value="${field(data?.years)}" required>
            </div>
            <div>
                <label class="form-label">Photo Upload</label>
                <input type="file" id="photo-upload" class="form-control" accept="image/*">
                <input type="hidden" name="photoUrl" id="photo-url-input" value="${field(data?.photoUrl)}">
                <p id="upload-status" style="font-size:0.8rem; color:#64748b;">${data?.photoUrl ? 'Current photo loaded' : 'No photo selected'}</p>
            </div>
            <div>
                <label class="form-label">Display Order</label>
                <input type="number" name="order" class="form-control" value="${field(data?.order)}" placeholder="1 = first, 2 = second, ...">
            </div>
            <div>
                <label class="form-label">Show this person on</label>
                <div class="page-checks">
                    ${TEAM_PAGES.map((p) => `
                        <label class="page-check">
                            <input type="checkbox" name="pages" value="${p.key}" ${employeeShowsOn(data, p.key) ? 'checked' : ''}>
                            <span>${p.label}</span>
                        </label>`).join('')}
                </div>
                <p class="help-text">Leave every box unticked and this person is hidden everywhere.</p>
            </div>
        `;
        setupFileUploadListener();
    } else if (type === 'news') {
        // NEW: News Fields
        const today = new Date().toISOString().split('T')[0];
        let postDate = today;
        if(data?.date) {
             const d = data.date.toDate ? data.date.toDate() : new Date(data.date);
             postDate = d.toISOString().split('T')[0];
        }

        modalFields.innerHTML = `
            <div>
                <label class="form-label">Post Title</label>
                <input type="text" name="title" class="form-control" value="${field(data?.title)}" required>
            </div>
            <div>
                <label class="form-label">Publish Date</label>
                <input type="date" name="date" class="form-control" value="${postDate}" required>
            </div>
            <div>
                <label class="form-label">Short Excerpt (Teaser text)</label>
                <textarea name="excerpt" class="form-control" rows="3" required>${field(data?.excerpt)}</textarea>
            </div>
            <div>
                <label class="form-label">Link URL (e.g., https://facebook.com/... or blog-post.html)</label>
                <input type="text" name="linkUrl" class="form-control" value="${field(data?.linkUrl)}" required>
            </div>
            <div>
                <label class="form-label">Link Button Text</label>
                <input type="text" name="linkText" class="form-control" value="${field(data?.linkText || 'Read More')}" required>
            </div>
            <div>
                <label class="form-label">Featured Image</label>
                <input type="file" id="photo-upload" class="form-control" accept="image/*">
                <input type="hidden" name="imageUrl" id="photo-url-input" value="${field(data?.imageUrl)}">
                <p id="upload-status" style="font-size:0.8rem; color:#64748b;">${data?.imageUrl ? 'Current photo loaded' : 'No photo selected'}</p>
            </div>
        `;
        setupFileUploadListener();
    } else if (type === 'business_logo') {
        modalFields.innerHTML = `
            <div>
                <label class="form-label">Business Name</label>
                <input type="text" name="name" class="form-control" value="${field(data?.name)}" required placeholder="e.g. Local Company Inc.">
            </div>
            <div>
                <label class="form-label">Logo Upload (.png recommended)</label>
                <input type="file" id="photo-upload" class="form-control" accept="image/png, image/jpeg, image/webp">
                <input type="hidden" name="logoUrl" id="photo-url-input" value="${field(data?.logoUrl)}">
                <p id="upload-status" style="font-size:0.8rem; color:#64748b;">${data?.logoUrl ? 'Current logo loaded' : 'No logo selected'}</p>
            </div>
        `;
        setupFileUploadListener();
    }

    editModal.style.display = 'flex';
}

// --- View Lead Modal Logic ---
const viewLeadModal = document.getElementById('view-lead-modal');

function openViewLeadModal(lead) {
    const content = document.getElementById('view-lead-content');
    if (!viewLeadModal || !content) return;

    let html = '<div class="detail-grid">';

    // Define field priority for display order
    const priority = ['type', 'status', 'submittedAt', 'name', 'businessName', 'company', 'contactName', 'email', 'phone', 'address', 'message', 'details', 'requirements', 'topic', 'projectType'];

    const formatVal = (key, val) => {
        if (key === 'submittedAt' && val && val.toDate) return val.toDate().toLocaleString();
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
    };

    // 1. Add Priority Fields
    priority.forEach(key => {
        if (lead[key]) {
            const isLongText = ['message', 'details', 'requirements'].includes(key);
            html += `
                <div class="detail-item ${isLongText ? 'full-width' : ''}">
                    <label>${escapeHtml(key.replace(/([A-Z])/g, ' $1').trim())}</label>
                    <p>${escapeHtml(formatVal(key, lead[key]))}</p>
                </div>
            `;
        }
    });

    // 2. Add Remaining Fields
    Object.keys(lead).forEach(key => {
        if (!priority.includes(key) && key !== 'id') {
             html += `
                <div class="detail-item">
                    <label>${escapeHtml(key)}</label>
                    <p>${escapeHtml(formatVal(key, lead[key]))}</p>
                </div>
            `;
        }
    });

    html += '</div>';
    content.innerHTML = html;
    viewLeadModal.style.display = 'flex';
}

// Close handlers for View Modal
document.querySelectorAll('.view-lead-close').forEach(btn => {
    btn.addEventListener('click', () => {
        if(viewLeadModal) viewLeadModal.style.display = 'none';
    });
});


// Downscale + compress an image file into a small data URL so the Firestore
// document stays well under the size limit. Prefers WebP (keeps transparency
// for logos and compresses photos well), falling back to JPEG.
function compressImageFile(file, { maxDim = 1280, quality = 0.85, maxBytes = 900 * 1024 } = {}) {
    return new Promise((resolve, reject) => {
        // Read as a data: URL (allowed by the admin page CSP; blob: URLs are not).
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (Math.max(width, height) > maxDim) {
                    const scale = maxDim / Math.max(width, height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                let type = 'image/webp';
                let out = canvas.toDataURL(type, quality);
                if (!out.startsWith('data:image/webp')) {
                    type = 'image/jpeg'; // browser doesn't support WebP export
                    out = canvas.toDataURL(type, quality);
                }

                // Estimate bytes from base64 length; step quality down until it fits.
                let q = quality;
                while (out.length * 0.75 > maxBytes && q > 0.4) {
                    q -= 0.15;
                    out = canvas.toDataURL(type, q);
                }
                resolve(out);
            };
            img.onerror = () => reject(new Error('Could not read image'));
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function setupFileUploadListener() {
    setTimeout(() => {
        const fileInput = document.getElementById('photo-upload');
        if (fileInput) {
            fileInput.addEventListener('change', async function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const status = document.getElementById('upload-status');
                const urlInput = document.getElementById('photo-url-input');
                if (status) { status.textContent = "Optimizing photo…"; status.style.color = "#64748b"; }
                try {
                    const dataUrl = await compressImageFile(file);
                    urlInput.value = dataUrl;
                    if (status) {
                        const kb = Math.round((dataUrl.length * 0.75) / 1024);
                        status.textContent = `Photo ready to save (${kb} KB)`;
                        status.style.color = "green";
                    }
                } catch (err) {
                    console.error("Image processing failed", err);
                    if (status) {
                        status.textContent = "Could not process this image. Try a different file.";
                        status.style.color = "red";
                    }
                }
            });
        }
    }, 100);
}

document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => editModal.style.display = 'none');
});

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const id = document.getElementById('edit-id').value;
    const type = document.getElementById('edit-type').value;
    const formData = new FormData(editForm);
    const data = Object.fromEntries(formData.entries());

    if (data.price) data.price = Number(data.price);
    if (data.stepNumber) data.stepNumber = Number(data.stepNumber);
    if (data.date) data.date = new Date(data.date); // Convert date string to Date object
    if (data.imageUrl) data.imageUrl = safeUrl(data.imageUrl, '', { allowDataImage: true });
    if (data.photoUrl) data.photoUrl = safeUrl(data.photoUrl, '', { allowDataImage: true });
    if (data.logoUrl) data.logoUrl = safeUrl(data.logoUrl, '', { allowDataImage: true });
    if (data.linkUrl) data.linkUrl = safeUrl(data.linkUrl, '#');

    if (type === 'plan') {
        data.isPopular = !!editForm.querySelector('[name="isPopular"]').checked;
        data.requiresAutopay = !!editForm.querySelector('[name="requiresAutopay"]').checked;
        data.order = data.order ? Number(data.order) : 0;
        // Promo: original (crossed-out) price + label. Blank original = no promo.
        data.originalPrice = data.originalPrice ? Number(data.originalPrice) : null;
        data.promoLabel = (data.promoLabel || '').trim();
    }

    if (type === 'employee') {
        // FormData keeps only the last value for a repeated name, so the ticked
        // boxes have to be read from the DOM rather than from the form entries.
        data.pages = [...editForm.querySelectorAll('[name="pages"]:checked')].map((el) => el.value);
        // null, not 0: a blank order means "unranked, show last", and 0 would
        // sort to the front instead.
        const rawOrder = String(data.order ?? '').trim();
        data.order = rawOrder === '' ? null : Number(rawOrder);
    }

    if (type === 'mobile_plan') {
        data.isPopular = !!editForm.querySelector('[name="isPopular"]').checked;
        data.order = data.order ? Number(data.order) : 0;
        // Blank price is meaningful here: it renders "Call for pricing" rather
        // than $0, which is what we want while the rate card is unpublished.
        data.price = data.price === '' || data.price == null ? null : Number(data.price);
        data.features = String(data.features || '')
            .split('\n').map(s => s.trim()).filter(Boolean).join('\n');
    }

    let collectionName;
    if (type === 'plan') collectionName = 'plans';
    else if (type === 'mobile_plan') collectionName = 'mobile_plans';
    else if (type === 'hood') collectionName = 'neighborhoods';
    else if (type === 'testimonial') collectionName = 'testimonials';
    else if (type === 'employee') collectionName = 'employees';
    else if (type === 'install_step') collectionName = 'install_steps';
    else if (type === 'news') collectionName = 'news'; // NEW
    else if (type === 'business_logo') collectionName = 'business_logos';

    const collRef = collection(db, 'artifacts', '162296779236', 'public', 'data', collectionName);

    try {
        if (id) {
            await updateDoc(doc(collRef, id), data);
        } else {
            await addDoc(collRef, data);
        }

        editModal.style.display = 'none';

        if (type === 'plan') loadPlans();
        if (type === 'hood') loadNeighborhoods();
        if (type === 'testimonial') loadTestimonials();
        if (type === 'employee') loadEmployees();
        if (type === 'install_step') loadInstallSteps();
        if (type === 'news') loadNews(); // NEW
        if (type === 'business_logo') loadBusinessLogos();

    } catch (err) {
        console.error("Save failed", err);
        alert("Error saving data: " + err.message);
    }
});

async function deleteItem(type, id) {
    if (!isAdmin) return;
    if (!confirm("Are you sure you want to delete this item?")) return;

    let collectionName;
    if (type === 'plan') collectionName = 'plans';
    else if (type === 'neighborhoods') collectionName = 'neighborhoods';
    else if (type === 'hood') collectionName = 'neighborhoods';
    else if (type === 'testimonial') collectionName = 'testimonials';
    else if (type === 'testimonials') collectionName = 'testimonials';
    else if (type === 'employee' || type === 'employees') collectionName = 'employees';
    else if (type === 'install_step') collectionName = 'install_steps';
    else if (type === 'news') collectionName = 'news'; // NEW
    else if (type === 'business_logo') collectionName = 'business_logos';

    try {
        await deleteDoc(doc(db, 'artifacts', '162296779236', 'public', 'data', collectionName, id));

        if (type === 'plan') loadPlans();
        if (type === 'neighborhoods' || type === 'hood') loadNeighborhoods();
        if (type === 'testimonial' || type === 'testimonials') loadTestimonials();
        if (type === 'employee' || type === 'employees') loadEmployees();
        if (type === 'install_step') loadInstallSteps();
        if (type === 'news') loadNews(); // NEW
        if (type === 'business_logo') loadBusinessLogos();
    } catch (err) {
        console.error("Delete failed", err);
        alert("Error deleting item.");
    }
}

document.getElementById('add-plan-btn').addEventListener('click', () => openEditModal('plan'));
document.getElementById('add-mobile-plan-btn').addEventListener('click', () => openEditModal('mobile_plan'));
document.getElementById('add-hood-btn').addEventListener('click', () => openEditModal('hood'));
document.getElementById('add-step-btn').addEventListener('click', () => openEditModal('install_step'));

if(document.getElementById('add-testimonial-btn')) {
    document.getElementById('add-testimonial-btn').addEventListener('click', () => openEditModal('testimonial'));
}
if(document.getElementById('add-employee-btn')) {
    document.getElementById('add-employee-btn').addEventListener('click', () => openEditModal('employee'));
}
if(document.getElementById('add-news-btn')) {
    document.getElementById('add-news-btn').addEventListener('click', () => openEditModal('news')); // NEW
}
if(document.getElementById('add-business-logo-btn')) {
    document.getElementById('add-business-logo-btn').addEventListener('click', () => openEditModal('business_logo'));
}
