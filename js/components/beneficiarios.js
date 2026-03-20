import { api } from '../api.js';
import { AppState } from '../app.js';
import { showToast, initModal } from '../utils.js';

let modalCtx = null;

export let benEditId = null;

export async function initBeneficiarios() {
    if (!modalCtx) {
        modalCtx = initModal('modal-beneficiario');
        
        document.getElementById('btn-nuevo-beneficiario').addEventListener('click', () => {
            benEditId = null;
            document.getElementById('form-beneficiario').reset();
            document.querySelector('#modal-beneficiario .modal-title').textContent = 'Nuevo Beneficiario';
            modalCtx.open();
        });

        document.getElementById('form-beneficiario').addEventListener('submit', handleSaveBeneficiario);
        
        // Event delegation for table buttons
        document.getElementById('lista-beneficiarios').addEventListener('click', async (e) => {
            const btnDelete = e.target.closest('.btn-delete-ben');
            if (btnDelete) {
                const id = btnDelete.dataset.id;
                if (confirm('¿Seguro que deseas eliminar este beneficiario?')) {
                    await deleteBeneficiario(id);
                }
            }

            const btnEdit = e.target.closest('.btn-edit-ben');
            if (btnEdit) {
                const id = btnEdit.dataset.id;
                openEditBeneficiario(id);
            }
        });
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
                <td>
                    <button class="btn btn-edit-ben" data-id="${b.id}" style="padding: 6px 10px; background: transparent; color: var(--warning); border: 1px solid var(--warning);"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-delete-ben" data-id="${b.id}" style="padding: 6px 10px; background: transparent; color: var(--danger); border: 1px solid var(--danger);"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;" class="text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar beneficiarios', 'error');
    }
}

async function deleteBeneficiario(id) {
    try {
        await api.deleteBeneficiario(id);
        showToast('Beneficiario eliminado');
        await loadBeneficiarios();
    } catch (error) {
        showToast(error.message || 'Error al eliminar', 'error');
    }
}

function openEditBeneficiario(id) {
    const ben = AppState.beneficiarios.find(b => b.id == id);
    if (!ben) return;
    
    benEditId = ben.id;
    document.getElementById('ben-nombre').value = ben.nombre;
    document.querySelector('#modal-beneficiario .modal-title').textContent = 'Editar Beneficiario';
    modalCtx.open();
}

async function handleSaveBeneficiario(e) {
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

        if (benEditId) {
            await api.updateBeneficiario(benEditId, payload);
            showToast('Beneficiario actualizado exitosamente');
        } else {
            await api.createBeneficiario(payload);
            showToast('Beneficiario creado exitosamente');
        }
        
        modalCtx.close();
        await loadBeneficiarios();
    } catch (error) {
        showToast(error.message || 'Error al guardar el beneficiario', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Beneficiario';
    }
}
