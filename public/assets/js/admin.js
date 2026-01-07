import { db, app } from './config/firebase-config.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = 'jmiller@nptel.com'; // The only user with edit/delete rights
const ALLOWED_DOMAIN = 'nptel.com'; // Only emails from this domain can login

let currentUser = null;
let isAdmin = false;

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const adminApp = document.getElementById('admin-app');
const loginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');

// --- Auth Handling ---

// 2. Login Button Trigger
loginBtn.addEventListener('click', () => {
    // Use Popup. In some iframe environments this triggers COOP warnings, 
    // but onAuthStateChanged usually catches the success.
    signInWithPopup(auth, provider).catch((error) => {
        console.error("Auth Error:", error);
        // Handle popup closed by user or blocked
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

// This is the source of truth. If the popup succeeds (even with console errors), this fires.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Fix: safe check for email existence
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
        // No user logged in, show login overlay
        loginOverlay.classList.remove('hidden');
        adminApp.classList.add('hidden');
    }
});

function checkAccess(user) {
    currentUser = user;
    // Fix: Safe check for email existence for admin check
    isAdmin = (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    
    // UI Updates
    document.getElementById('user-name').textContent = user.displayName || user.email || 'User';
    document.getElementById('user-avatar').src = user.photoURL || 'assets/images/community-fiber-logo.png'; // Fallback image
    document.getElementById('user-role').textContent = isAdmin ? 'Admin' : 'Viewer';
    document.getElementById('user-role').className = `badge ${isAdmin ? 'bg-green' : 'bg-gray'}`;
    
    document.querySelectorAll('.user-name-display').forEach(el => el.textContent = user.displayName ? user.displayName.split(' ')[0] : 'User');

    // Show/Hide Admin Buttons
    if (isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }

    loginOverlay.classList.add('hidden');
    adminApp.classList.remove('hidden');

    // Load Initial Data
    loadDashboard();
}

function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
}

// --- Navigation ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        // Active State
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // View Switching
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        const tab = btn.dataset.tab;
        document.getElementById(`view-${tab}`).classList.add('active');

        // Load Data on switch
        if (tab === 'leads') loadLeads();
        if (tab === 'plans') loadPlans();
        if (tab === 'neighborhoods') loadNeighborhoods();
    });
});

// --- Data Loading Functions ---

async function loadDashboard() {
    try {
        // Basic stats count
        const leadsRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'leads');
        const leadsSnap = await getDocs(leadsRef);
        document.getElementById('stat-leads').textContent = leadsSnap.size;

        const plansRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'plans');
        const plansSnap = await getDocs(plansRef);
        document.getElementById('stat-plans').textContent = plansSnap.size;

        const hoodsRef = collection(db, 'artifacts', '162296779236', 'public', 'data', 'neighborhoods');
        const hoodsSnap = await getDocs(hoodsRef);
        document.getElementById('stat-hoods').textContent = hoodsSnap.size;
    } catch (err) {
        console.error("Dashboard Load Error (likely permission issues):", err);
        // Don't alert here, just log, as dashboard is the first thing to load
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

        // Memory Sort (Newest First)
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
                    <td>New</td>
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

// Add event listener for filter
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
            
            // Attach Events
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

// --- Edit/Add Logic (Admin Only) ---

const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const modalFields = document.getElementById('modal-fields');

function openEditModal(type, id, data = null) {
    if (!isAdmin) return;
    
    document.getElementById('edit-id').value = id || '';
    document.getElementById('edit-type').value = type;
    document.getElementById('modal-title').textContent = id ? `Edit ${type}` : `Add ${type}`;
    
    modalFields.innerHTML = ''; // Clear prev fields

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
    }

    editModal.style.display = 'flex';
}

// Close Modal logic
document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => editModal.style.display = 'none');
});

// Handle Form Submit
editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const id = document.getElementById('edit-id').value;
    const type = document.getElementById('edit-type').value;
    const formData = new FormData(editForm);
    const data = Object.fromEntries(formData.entries());
    
    // Convert price to number if plan
    if (data.price) data.price = Number(data.price);

    // Handle Checkbox for isPopular
    if (type === 'plan') {
        data.isPopular = !!editForm.querySelector('[name="isPopular"]').checked;
    }

    const collectionName = type === 'plan' ? 'plans' : 'neighborhoods';
    const collRef = collection(db, 'artifacts', '162296779236', 'public', 'data', collectionName);

    try {
        if (id) {
            // Update
            await updateDoc(doc(collRef, id), data);
        } else {
            // Create
            await addDoc(collRef, data);
        }
        
        editModal.style.display = 'none';
        
        // Refresh View
        if (type === 'plan') loadPlans();
        if (type === 'hood') loadNeighborhoods();
        
    } catch (err) {
        console.error("Save failed", err);
        alert("Error saving data: " + err.message);
    }
});

async function deleteItem(type, id) {
    if (!isAdmin) return;
    if (!confirm("Are you sure you want to delete this item?")) return;

    const collectionName = type === 'plan' ? 'plans' : 'neighborhoods';
    
    try {
        await deleteDoc(doc(db, 'artifacts', '162296779236', 'public', 'data', collectionName, id));
        
        // Refresh View
        if (type === 'plan') loadPlans();
        if (type === 'neighborhoods') loadNeighborhoods();
    } catch (err) {
        console.error("Delete failed", err);
        alert("Error deleting item.");
    }
}

// Wire up "Add" buttons
document.getElementById('add-plan-btn').addEventListener('click', () => openEditModal('plan'));
document.getElementById('add-hood-btn').addEventListener('click', () => openEditModal('hood'));