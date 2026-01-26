import { db, app } from './config/firebase-config.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, orderBy, where, getDoc, setDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = 'jmiller@nptel.com';
const ALLOWED_DOMAIN = 'nptel.com';

let currentUser = null;
let isAdmin = false;

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const adminApp = document.getElementById('admin-app');
const loginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');

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
    document.getElementById('user-avatar').src = user.photoURL || 'assets/images/community-fiber-logo.png';
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
        if (tab === 'plans') loadPlans();
        if (tab === 'install') loadInstallSteps(); // New Listener
        if (tab === 'neighborhoods') loadNeighborhoods();
        if (tab === 'employees') loadEmployees();
        if (tab === 'announcements') loadAnnouncementSettings();
        if (tab === 'testimonials') loadTestimonials();
    });
});

// --- Data Loading Functions ---

async function loadDashboard() {
    try {
        const leadsRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'leads');
        const leadsSnap = await getDocs(leadsRef);
        document.getElementById('stat-leads').textContent = leadsSnap.size;

        const plansRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'plans');
        const plansSnap = await getDocs(plansRef);
        document.getElementById('stat-plans').textContent = plansSnap.size;

        const hoodsRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'neighborhoods');
        const hoodsSnap = await getDocs(hoodsRef);
        document.getElementById('stat-hoods').textContent = hoodsSnap.size;

        // Enhanced Analytics Visualization
        const analyticsRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'analytics_pageviews');
        const analyticsSnap = await getDocs(query(analyticsRef, limit(200)));
        
        let totalViews = analyticsSnap.size;
        let deviceStats = { mobile: 0, desktop: 0, tablet: 0 };
        let pageStats = {};

        analyticsSnap.forEach(doc => {
            const data = doc.data();
            if (data.deviceType) {
                deviceStats[data.deviceType] = (deviceStats[data.deviceType] || 0) + 1;
            } else {
                deviceStats.desktop++; 
            }
            const p = data.page || 'unknown';
            pageStats[p] = (pageStats[p] || 0) + 1;
        });

        let viewsCard = document.getElementById('stat-views-card');
        if (!viewsCard) {
            const statsGrid = document.querySelector('.stats-grid');
            viewsCard = document.createElement('div');
            viewsCard.id = 'stat-views-card';
            viewsCard.className = 'stat-card';
            viewsCard.innerHTML = `<h3>Page Views (Last 200)</h3><p class="stat-value">${totalViews}</p><p style="font-size:0.8rem; color:#64748b;">${deviceStats.mobile} Mobile / ${deviceStats.desktop} Desktop</p>`;
            statsGrid.appendChild(viewsCard);
        } else {
            viewsCard.innerHTML = `<h3>Page Views (Last 200)</h3><p class="stat-value">${totalViews}</p><p style="font-size:0.8rem; color:#64748b;">${deviceStats.mobile} Mobile / ${deviceStats.desktop} Desktop</p>`;
        }

        let topPagesContainer = document.getElementById('top-pages-container');
        if (!topPagesContainer) {
            topPagesContainer = document.createElement('div');
            topPagesContainer.id = 'top-pages-container';
            topPagesContainer.className = 'admin-card';
            topPagesContainer.style.marginTop = '30px';
            topPagesContainer.innerHTML = `<h3>Top Pages Visited</h3><div id="top-pages-list"></div>`;
            document.querySelector('#view-dashboard').appendChild(topPagesContainer);
        }

        const sortedPages = Object.entries(pageStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const listHtml = sortedPages.map(([page, count]) => `
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
                <span style="font-weight:600; color:#334155;">${page}</span>
                <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-size:0.85rem; font-weight:700;">${count}</span>
            </div>
        `).join('');
        
        document.getElementById('top-pages-list').innerHTML = listHtml || '<p>No data yet.</p>';

    } catch (err) {
        console.error("Dashboard Load Error:", err);
    }
}

async function loadLeads() {
    const tbody = document.getElementById('leads-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';
    
    const filter = document.getElementById('lead-filter').value;
    let q = collection(db, 'artifacts', '162296779236', 'public', 'data', 'leads');
    
    if (filter !== 'all') {
        q = query(q, where('type', '==', filter));
    }
    
    try {
        const snapshot = await getDocs(q);
        const leads = [];
        snapshot.forEach(doc => leads.push({ id: doc.id, ...doc.data() }));

        leads.sort((a, b) => {
            const dateA = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(0);
            const dateB = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(0);
            return dateB - dateA;
        });

        tbody.innerHTML = '';
        if (leads.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No records found</td></tr>';
            return;
        }

        leads.forEach(lead => {
            const date = lead.submittedAt?.toDate ? lead.submittedAt.toDate().toLocaleDateString() : 'N/A';
            const row = `
                <tr>
                    <td>${date}</td>
                    <td><span class="badge">${lead.type || 'General'}</span></td>
                    <td>${lead.name || 'Unknown'}</td>
                    <td>${lead.email || '-'}</td>
                    <td>${lead.status || 'New'}</td>
                    <td><button class="btn-sm btn-edit" onclick="alert('${JSON.stringify(lead, null, 2).replace(/"/g, '&quot;')}')">View JSON</button></td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });

    } catch (err) {
        console.error("Error loading leads:", err);
        tbody.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center;">Error loading data. Check Firestore Rules.</td></tr>';
    }
}

document.getElementById('lead-filter').addEventListener('change', loadLeads);

async function loadPlans() {
    const container = document.getElementById('plans-list');
    container.innerHTML = '<p>Loading...</p>';
    
    try {
        const ref = collection(db, 'artifacts', '162296779236', 'public', 'data', 'plans');
        const snapshot = await getDocs(ref);
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const plan = doc.data();
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <h3>${plan.name} <span style="font-size:0.8rem; color:green;">$${plan.price}</span></h3>
                <p>${plan.speed} - ${plan.description?.substring(0, 50)}...</p>
                <div class="card-actions">
                    ${isAdmin ? `<button class="btn-sm btn-edit" data-id="${doc.id}" data-type="plan">Edit</button>` : ''}
                    ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${doc.id}" data-type="plan">Delete</button>` : ''}
                </div>
            `;
            container.appendChild(card);
            
            if(isAdmin) {
                card.querySelector('.btn-edit').addEventListener('click', () => openEditModal('plan', doc.id, plan));
                card.querySelector('.btn-delete').addEventListener('click', () => deleteItem('plan', doc.id));
            }
        });

        if (snapshot.empty) container.innerHTML = '<p>No plans found. Add one!</p>';

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Error loading plans.</p>';
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
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <div style="display:flex; gap:15px; align-items:center;">
                    <div style="background:var(--cfn-green); color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                        ${step.stepNumber}
                    </div>
                    <div>
                        <h3 style="margin:0;">${step.title}</h3>
                    </div>
                </div>
                <div style="margin-top:10px; color:#64748b; font-size:0.9rem;">
                    <p>${step.description}</p>
                </div>
                ${step.imageUrl ? `<img src="${step.imageUrl}" style="width:100%; height:120px; object-fit:cover; border-radius:8px; margin-top:10px;">` : ''}
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
                <h3>${hood.name}</h3>
                <p>Status: <strong>${hood.status}</strong></p>
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
        snapshot.forEach(doc => {
            const emp = doc.data();
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <div style="display:flex; gap:15px; align-items:center;">
                    <div style="width:50px; height:50px; border-radius:50%; background:#eee; overflow:hidden; flex-shrink:0;">
                        ${emp.photoUrl ? `<img src="${emp.photoUrl}" style="width:100%; height:100%; object-fit:cover;">` : '<i class="fa-solid fa-user" style="line-height:50px; text-align:center; display:block; color:#ccc;"></i>'}
                    </div>
                    <div>
                        <h3 style="margin:0; font-size:1.1rem;">${emp.name}</h3>
                        <p style="margin:0; font-size:0.9rem; color:#64748b;">${emp.title}</p>
                    </div>
                </div>
                <div style="margin-top:15px; font-size:0.9rem; color:#475569;">
                    <p style="margin-bottom:5px;"><strong>${emp.years}</strong> years at CFN/NPT</p>
                    <p style="font-style:italic;">"${emp.fact}"</p>
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
                <h3>${t.author} <small style="font-weight:400; color:#64748b;">(${t.location})</small></h3>
                <p><em>"${t.quote}"</em></p>
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

const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const modalFields = document.getElementById('modal-fields');

function openEditModal(type, id, data = null) {
    if (!isAdmin) return;
    
    document.getElementById('edit-id').value = id || '';
    document.getElementById('edit-type').value = type;
    document.getElementById('modal-title').textContent = id ? `Edit ${type}` : `Add ${type}`;
    
    modalFields.innerHTML = ''; 

    if (type === 'plan') {
        modalFields.innerHTML = `
            <div>
                <label class="form-label">Plan Name</label>
                <input type="text" name="name" class="form-control" value="${data?.name || ''}" required>
            </div>
            <div>
                <label class="form-label">Price</label>
                <input type="number" name="price" class="form-control" value="${data?.price || ''}" required>
            </div>
            <div>
                <label class="form-label">Speed</label>
                <input type="text" name="speed" class="form-control" value="${data?.speed || ''}" required>
            </div>
            <div>
                <label class="form-label">Description</label>
                <textarea name="description" class="form-control" rows="3">${data?.description || ''}</textarea>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                <input type="checkbox" id="plan-popular" name="isPopular" ${data?.isPopular ? 'checked' : ''} style="width: auto;">
                <label for="plan-popular" class="form-label" style="margin-bottom: 0; cursor: pointer;">Best Value (Gold Highlight)</label>
            </div>
        `;
    } else if (type === 'hood') {
         modalFields.innerHTML = `
            <div>
                <label class="form-label">Neighborhood Name</label>
                <input type="text" name="name" class="form-control" value="${data?.name || ''}" required>
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
                <input type="text" name="author" class="form-control" value="${data?.author || ''}" required>
            </div>
            <div>
                <label class="form-label">Location / Neighborhood</label>
                <input type="text" name="location" class="form-control" value="${data?.location || ''}" required placeholder="e.g. Maple Ridge">
            </div>
            <div>
                <label class="form-label">Quote</label>
                <textarea name="quote" class="form-control" rows="3" required>${data?.quote || ''}</textarea>
            </div>
        `;
    } else if (type === 'install_step') {
        modalFields.innerHTML = `
            <div>
                <label class="form-label">Step Number (Order)</label>
                <input type="number" name="stepNumber" class="form-control" value="${data?.stepNumber || ''}" required placeholder="e.g. 1">
            </div>
            <div>
                <label class="form-label">Title</label>
                <input type="text" name="title" class="form-control" value="${data?.title || ''}" required placeholder="e.g. Site Survey">
            </div>
            <div>
                <label class="form-label">Description</label>
                <textarea name="description" class="form-control" rows="3" required>${data?.description || ''}</textarea>
            </div>
             <div>
                <label class="form-label">Step Photo Upload</label>
                <input type="file" id="photo-upload" class="form-control" accept="image/*">
                <input type="hidden" name="imageUrl" id="photo-url-input" value="${data?.imageUrl || ''}">
                <p id="upload-status" style="font-size:0.8rem; color:#64748b;">${data?.imageUrl ? 'Current photo loaded' : 'No photo selected'}</p>
            </div>
        `;
        setupFileUploadListener();
    } else if (type === 'employee') {
        modalFields.innerHTML = `
            <div>
                <label class="form-label">Name</label>
                <input type="text" name="name" class="form-control" value="${data?.name || ''}" required>
            </div>
            <div>
                <label class="form-label">Title</label>
                <input type="text" name="title" class="form-control" value="${data?.title || ''}" required>
            </div>
            <div>
                <label class="form-label">Years at Company</label>
                <input type="number" name="years" class="form-control" value="${data?.years || ''}" required>
            </div>
            <div>
                <label class="form-label">Fun Fact</label>
                <textarea name="fact" class="form-control" rows="2" required>${data?.fact || ''}</textarea>
            </div>
            <div>
                <label class="form-label">Photo Upload</label>
                <input type="file" id="photo-upload" class="form-control" accept="image/*">
                <input type="hidden" name="photoUrl" id="photo-url-input" value="${data?.photoUrl || ''}">
                <p id="upload-status" style="font-size:0.8rem; color:#64748b;">${data?.photoUrl ? 'Current photo loaded' : 'No photo selected'}</p>
            </div>
        `;
        setupFileUploadListener();
    }

    editModal.style.display = 'flex';
}

function setupFileUploadListener() {
    setTimeout(() => {
        const fileInput = document.getElementById('photo-upload');
        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onloadend = function() {
                        document.getElementById('photo-url-input').value = reader.result;
                        document.getElementById('upload-status').textContent = "Photo ready to save!";
                        document.getElementById('upload-status').style.color = "green";
                    }
                    reader.readAsDataURL(file);
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

    if (type === 'plan') {
        data.isPopular = !!editForm.querySelector('[name="isPopular"]').checked;
    }

    let collectionName;
    if (type === 'plan') collectionName = 'plans';
    else if (type === 'hood') collectionName = 'neighborhoods';
    else if (type === 'testimonial') collectionName = 'testimonials';
    else if (type === 'employee') collectionName = 'employees';
    else if (type === 'install_step') collectionName = 'install_steps';

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
    
    try {
        await deleteDoc(doc(db, 'artifacts', '162296779236', 'public', 'data', collectionName, id));
        
        if (type === 'plan') loadPlans();
        if (type === 'neighborhoods' || type === 'hood') loadNeighborhoods();
        if (type === 'testimonial' || type === 'testimonials') loadTestimonials();
        if (type === 'employee' || type === 'employees') loadEmployees();
        if (type === 'install_step') loadInstallSteps();
    } catch (err) {
        console.error("Delete failed", err);
        alert("Error deleting item.");
    }
}

document.getElementById('add-plan-btn').addEventListener('click', () => openEditModal('plan'));
document.getElementById('add-hood-btn').addEventListener('click', () => openEditModal('hood'));
document.getElementById('add-step-btn').addEventListener('click', () => openEditModal('install_step'));

if(document.getElementById('add-testimonial-btn')) {
    document.getElementById('add-testimonial-btn').addEventListener('click', () => openEditModal('testimonial'));
}
if(document.getElementById('add-employee-btn')) {
    document.getElementById('add-employee-btn').addEventListener('click', () => openEditModal('employee'));
}