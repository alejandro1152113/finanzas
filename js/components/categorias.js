import { api } from '../api.js';
import { AppState } from '../app.js';
import { showToast, initModal } from '../utils.js';

let modalCtx = null;

export let catEditId = null;

export async function initCategorias() {
    // Setup Modal only once
    if (!modalCtx) {
        modalCtx = initModal('modal-categoria');
        
        document.getElementById('btn-nueva-categoria').addEventListener('click', () => {
            catEditId = null;
            document.getElementById('form-categoria').reset();
            document.querySelector('#modal-categoria .modal-title').textContent = 'Nueva Categoría';
            modalCtx.open();
        });

        document.getElementById('form-categoria').addEventListener('submit', handleSaveCategoria);
        
        // Event delegation for table buttons
        document.getElementById('lista-categorias').addEventListener('click', async (e) => {
            const btnDelete = e.target.closest('.btn-delete-cat');
            if (btnDelete) {
                const id = btnDelete.dataset.id;
                if (confirm('¿Seguro que deseas eliminar esta categoría?')) {
                    await deleteCategoria(id);
                }
            }

            const btnEdit = e.target.closest('.btn-edit-cat');
            if (btnEdit) {
                const id = btnEdit.dataset.id;
                openEditCategoria(id);
            }
        });
    }

    await loadCategorias();
}

async function loadCategorias() {
    const tbody = document.getElementById('lista-categorias');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><span class="spinner-sm"></span> Cargando...</td></tr>';
    
    try {
        const response = await api.getCategorias(AppState.workspaceId);
        AppState.categorias = response.data || [];
        
        if (AppState.categorias.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No hay categorías registradas. Crea tu primera categoría.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        AppState.categorias.forEach(cat => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${cat.id}</td>
                <td style="font-weight: 500;">${cat.nombre}</td>
                <td><span class="badge ${cat.tipo}">${cat.tipo}</span></td>
                <td>${cat.activa ? '<span class="text-success"><i class="fa-solid fa-check"></i> Activa</span>' : '<span class="text-danger"><i class="fa-solid fa-xmark"></i> Inactiva</span>'}</td>
                <td>
                    <button class="btn btn-edit-cat" data-id="${cat.id}" style="padding: 6px 10px; background: transparent; color: var(--warning); border: 1px solid var(--warning);"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-delete-cat" data-id="${cat.id}" style="padding: 6px 10px; background: transparent; color: var(--danger); border: 1px solid var(--danger);"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;" class="text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar categorías', 'error');
    }
}

async function deleteCategoria(id) {
    try {
        await api.deleteCategoria(id);
        showToast('Categoría eliminada');
        await loadCategorias();
    } catch (error) {
        showToast(error.message || 'Error al eliminar', 'error');
    }
}

function openEditCategoria(id) {
    const cat = AppState.categorias.find(c => c.id == id);
    if (!cat) return;
    
    catEditId = cat.id;
    document.getElementById('cat-nombre').value = cat.nombre;
    document.getElementById('cat-tipo').value = cat.tipo;
    document.querySelector('#modal-categoria .modal-title').textContent = 'Editar Categoría';
    modalCtx.open();
}

async function handleSaveCategoria(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const nombre = document.getElementById('cat-nombre').value;
    const tipo = document.getElementById('cat-tipo').value;

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Guardando...';

        const payload = {
            workspaceId: parseInt(AppState.workspaceId),
            nombre: nombre,
            tipo: tipo
        };

        if (catEditId) {
            await api.updateCategoria(catEditId, payload);
            showToast('Categoría actualizada exitosamente');
        } else {
            await api.createCategoria(payload);
            showToast('Categoría creada exitosamente');
        }
        
        modalCtx.close();
        await loadCategorias();

    } catch (error) {
        showToast(error.message || 'Error al guardar la categoría', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Categoría';
    }
}
