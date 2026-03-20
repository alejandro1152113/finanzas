import { api } from './api.js';
import { showToast, initModal, formatDate } from './utils.js';
import { initCategorias } from './components/categorias.js';
// We will import others as we build them

// Global App State
export const AppState = {
    workspaceId: null,
    workspaces: [],
    categorias: [],
    beneficiarios: []
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Setup UI Basic info
    const userName = localStorage.getItem('userName') || 'Usuario';
    document.getElementById('user-avatar-text').textContent = userName.charAt(0).toUpperCase();

    // 3. Setup Workspaces
    setupWorkspaces();

    // 4. Setup Navigation & Routing
    setupNavigation();

    // 5. Global Handlers
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('sidebar');
    if(mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Initialize first view
    if (AppState.workspaceId) {
        loadView('dashboard');
    }
});

function setupWorkspaces() {
    const select = document.getElementById('workspace-select');
    const storedWS = localStorage.getItem('workspaces');
    
    if (storedWS) {
        try {
            AppState.workspaces = JSON.parse(storedWS);
        } catch(e) { console.error('Error parsing workspaces'); }
    }

    if (AppState.workspaces.length > 0) {
        select.innerHTML = '';
        AppState.workspaces.forEach(ws => {
            const opt = document.createElement('option');
            opt.value = ws.id;
            opt.textContent = ws.nombre;
            select.appendChild(opt);
        });

        const activeWS = localStorage.getItem('activeWorkspace');
        if (activeWS && AppState.workspaces.find(w => w.id == activeWS)) {
            AppState.workspaceId = activeWS;
            select.value = activeWS;
        } else {
            AppState.workspaceId = AppState.workspaces[0].id;
            localStorage.setItem('activeWorkspace', AppState.workspaceId);
        }
    } else {
        select.innerHTML = '<option value="">Sin Workspaces</option>';
        showToast('No tienes workspaces disponibles.', 'error');
    }

    select.addEventListener('change', (e) => {
        AppState.workspaceId = e.target.value;
        localStorage.setItem('activeWorkspace', AppState.workspaceId);
        showToast('Workspace cambiado.');
        // Reload current view
        const currentView = document.querySelector('.nav-item.active').dataset.view;
        loadView(currentView);
    });
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // UI Update
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Mobile close sidebar
            document.getElementById('sidebar').classList.remove('open');
            
            const viewName = item.dataset.view;
            document.getElementById('page-title').textContent = item.querySelector('span').textContent;
            
            // Switch view
            document.querySelectorAll('.view-section').forEach(view => {
                view.classList.add('hidden');
            });
            document.getElementById(`view-${viewName}`).classList.remove('hidden');
            
            loadView(viewName);
        });
    });
}

// Emulate a router
export async function loadView(viewName) {
    if (!AppState.workspaceId) return;

    try {
        switch(viewName) {
            case 'dashboard':
                // Dynamically import to avoid circular dependency issues at boot
                const { initDashboard } = await import('./components/dashboard.js');
                initDashboard();
                break;
            case 'categorias':
                // already imported above
                initCategorias();
                break;
            case 'beneficiarios':
                const { initBeneficiarios } = await import('./components/beneficiarios.js');
                initBeneficiarios();
                break;
            case 'transacciones':
                const { initTransacciones } = await import('./components/transacciones.js');
                initTransacciones();
                break;
        }
    } catch (e) {
        console.error(`Error loading view ${viewName}:`, e);
        showToast(`Error al cargar la sección.`, 'error');
    }
}
