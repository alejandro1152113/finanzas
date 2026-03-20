import { api } from '../api.js';
import { AppState } from '../app.js';
import { showToast, initModal } from '../utils.js';

let modalCtx = null;

export async function initBeneficiarios() {
    if (!modalCtx) {
        modalCtx = initModal('modal-beneficiario');
        
        document.getElementById('btn-nuevo-beneficiario').addEventListener('click', () => {
            document.getElementById('form-beneficiario').reset();
            modalCtx.open();
        });

        document.getElementById('form-beneficiario').addEventListener('submit', handleCreateBeneficiario);
    }

    await loadBeneficiarios();
}

async function loadBeneficiarios() {
    const tbody = document.getElementById('lista-beneficiarios');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;"><span class="spinner-sm"></span> Cargando...</td></tr>';
    
    try {
        const response = await api.getBeneficiarios(AppState.workspaceId);
        AppState.beneficiarios = response.data || [];
        
        if (AppState.beneficiarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--text-muted);">No hay beneficiarios registrados.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        AppState.beneficiarios.forEach(b => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${b.id}</td>
                <td style="font-weight: 500;">${b.nombre}</td>
                <td>${b.activo ? '<span class="text-success"><i class="fa-solid fa-check"></i> Activo</span>' : '<span class="text-danger"><i class="fa-solid fa-xmark"></i> Inactivo</span>'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;" class="text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar beneficiarios', 'error');
    }
}

async function handleCreateBeneficiario(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const nombre = document.getElementById('ben-nombre').value;

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Guardando...';

        const payload = {
            workspaceId: parseInt(AppState.workspaceId),
            nombre: nombre
        };

        await api.createBeneficiario(payload);
        showToast('Beneficiario creado exitosamente');
        modalCtx.close();
        
        await loadBeneficiarios();
    } catch (error) {
        showToast(error.message || 'Error al crear el beneficiario', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Beneficiario';
    }
}
