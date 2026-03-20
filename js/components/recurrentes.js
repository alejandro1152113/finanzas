import { api } from '../api.js';
import { AppState } from '../app.js';
import { showToast, initModal, formatCurrency } from '../utils.js';

let modalCtx = null;
let editId = null;

export async function initRecurrentes() {
    if (!modalCtx) {
        modalCtx = initModal('modal-recurrente');
        
        document.getElementById('btn-nuevo-recurrente').addEventListener('click', async () => {
            editId = null;
            document.getElementById('form-recurrente').reset();
            document.querySelector('#modal-recurrente .modal-title').textContent = 'Nuevo Item Recurrente';
            await populateCategories();
            modalCtx.open();
        });

        document.getElementById('form-recurrente').addEventListener('submit', handleSave);

        document.getElementById('lista-recurrentes').addEventListener('click', async (e) => {
            const btnDelete = e.target.closest('.btn-delete-rec');
            if (btnDelete) {
                if (confirm('¿Seguro de eliminar este item? El presupuesto futuro dejará de incluirlo.')) {
                    await deleteItem(btnDelete.dataset.id);
                }
            }
        });
    }

    await loadItems();
}

async function populateCategories() {
    const select = document.getElementById('rec-categoria');
    if (AppState.categorias.length === 0) {
        const resp = await api.getCategorias(AppState.workspaceId);
        AppState.categorias = resp.data || [];
    }
    
    select.innerHTML = '<option value="">Seleccione Categoría</option>';
    AppState.categorias.forEach(c => {
        if (c.activa) {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.nombre} (${c.tipo})`;
            select.appendChild(opt);
        }
    });
}

async function loadItems() {
    const tbody = document.getElementById('lista-recurrentes');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><span class="spinner-sm"></span> Cargando...</td></tr>';

    try {
        const resp = await api.getItemsRecurrentes(AppState.workspaceId);
        const items = resp.data || [];

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No hay items recurrentes configurados.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.nombre}</td>
                <td><span class="badge ${item.tipo}">${item.tipo}</span></td>
                <td>${item.categoriaNombre || 'N/A'}</td>
                <td class="font-bold">${formatCurrency(item.montoDefecto || 0)}</td>
                <td><span class="badge ${item.activo ? 'transaccion' : 'hidden'}">${item.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <button class="btn btn-delete-rec" data-id="${item.id}" style="padding: 6px 10px; background: transparent; color: var(--danger); border: 1px solid var(--danger);"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;" class="text-danger">Error: ${e.message}</td></tr>`;
    }
}

async function handleSave(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    
    const payload = {
        workspaceId: parseInt(AppState.workspaceId),
        nombre: document.getElementById('rec-nombre').value,
        tipo: document.getElementById('rec-tipo').value,
        categoriaId: parseInt(document.getElementById('rec-categoria').value),
        montoDefecto: parseFloat(document.getElementById('rec-monto').value) || 0,
        modoMonto: 'FIJO', // Default for simplicity in this UI
        fechaInicio: new Date().toISOString().split('T')[0]
    };

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Guardando...';

        await api.createItemRecurrente(payload);
        showToast('Item recurrente guardado');
        modalCtx.close();
        await loadItems();
    } catch (error) {
        showToast(error.message || 'Error al guardar', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Item';
    }
}

async function deleteItem(id) {
    try {
        await api.deleteItemRecurrente(id);
        showToast('Item eliminado');
        await loadItems();
    } catch (e) {
        showToast(e.message, 'error');
    }
}
