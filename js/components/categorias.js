import { api } from '../api.js';
import { AppState } from '../app.js';
import { showToast, initModal } from '../utils.js';

let modalCtx = null;

export async function initCategorias() {
    // Setup Modal only once
    if (!modalCtx) {
        modalCtx = initModal('modal-categoria');
        
        document.getElementById('btn-nueva-categoria').addEventListener('click', () => {
            document.getElementById('form-categoria').reset();
            modalCtx.open();
        });

        document.getElementById('form-categoria').addEventListener('submit', handleCreateCategoria);
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
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;" class="text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar categorías', 'error');
    }
}

async function handleCreateCategoria(e) {
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

        await api.createCategoria(payload);
        showToast('Categoría creada exitosamente');
        modalCtx.close();
        
        // Reload list
        await loadCategorias();

    } catch (error) {
        showToast(error.message || 'Error al crear la categoría', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Categoría';
    }
}
