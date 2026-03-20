import { api } from '../api.js';
import { AppState } from '../app.js';
import { showToast, initModal, formatCurrency } from '../utils.js';

let modalItemCtx = null;
let currentBudgetData = null;
let editItemId = null;

export async function initPresupuesto() {
    if (!modalItemCtx) {
        modalItemCtx = initModal('modal-presupuesto-item');
        
        document.getElementById('btn-generar-presupuesto').addEventListener('click', async () => {
            if (confirm('Esto generará o sincronizará el presupuesto con los items recurrentes configurados. ¿Deseas continuar?')) {
                await generarPresupuesto();
            }
        });

        document.getElementById('form-presupuesto-item').addEventListener('submit', handleUpdateItem);

        document.getElementById('lista-presupuesto').addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit-pre');
            if (btnEdit) {
                openEditItem(btnEdit.dataset.id);
            }
        });
    }

    const today = new Date();
    document.getElementById('presupuesto-periodo').textContent = `${today.toLocaleString('es-ES', { month: 'long' })} ${today.getFullYear()}`;
    
    await loadPresupuesto();
}

async function loadPresupuesto() {
    const tbody = document.getElementById('lista-presupuesto');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><span class="spinner-sm"></span> Cargando...</td></tr>';

    const today = new Date();
    const anio = today.getFullYear();
    const mes = today.getMonth() + 1;
    const mesStr = mes < 10 ? `0${mes}` : `${mes}`;

    try {
        let resp;
        try {
            resp = await api.getPresupuesto(AppState.workspaceId, anio, mesStr);
        } catch (initialError) {
            // Fallback to resumen endpoint if main one fails
            resp = await api.getPresupuestoResumen(AppState.workspaceId, anio, mesStr);
        }
        currentBudgetData = resp.data;

        if (!currentBudgetData || !currentBudgetData.items || currentBudgetData.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay presupuesto para este mes. <br> Presiona el botón "Generar" para comenzar.</td></tr>';
            updateSummaries(null);
            return;
        }

        tbody.innerHTML = '';
        currentBudgetData.items.forEach(item => {
            const tr = document.createElement('tr');
            const perc = item.montoPlaneado > 0 ? Math.round((item.montoEjecutado / item.montoPlaneado) * 100) : 0;
            const barColor = item.tipo === 'INGRESO' ? 'var(--info)' : (perc > 100 ? 'var(--danger)' : 'var(--success)');

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 500;">${item.itemRecurrenteNombre || item.categoriaNombre}</div>
                    <small class="text-muted">${item.tipo}</small>
                </td>
                <td class="font-bold">${formatCurrency(item.montoPlaneado)}</td>
                <td class="${item.montoEjecutado > 0 ? 'text-primary' : ''}">${formatCurrency(item.montoEjecutado)}</td>
                <td>
                    <div class="progress-bar-container" title="${perc}%">
                        <div class="progress-bar-fill" style="width: ${Math.min(perc, 100)}%; background-color: ${barColor};"></div>
                    </div>
                </td>
                <td>
                    <button class="btn btn-edit-pre" data-id="${item.id}" style="padding: 6px 10px; background: transparent; color: var(--warning); border: 1px solid var(--warning);"><i class="fa-solid fa-pen-to-square"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        updateSummaries(currentBudgetData);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;" class="text-danger">Error: ${e.message}</td></tr>`;
    }
}

function updateSummaries(data) {
    const planeado = data ? data.totalPlaneado : 0;
    const ejecutado = data ? data.totalEjecutado : 0;
    
    document.getElementById('pre-total-planeado').textContent = formatCurrency(planeado);
    document.getElementById('pre-total-ejecutado').textContent = formatCurrency(ejecutado);
    document.getElementById('pre-total-dif').textContent = formatCurrency(planeado - ejecutado);
}

async function generarPresupuesto() {
    const today = new Date();
    const payload = {
        workspaceId: parseInt(AppState.workspaceId),
        anio: today.getFullYear(),
        mes: today.getMonth() + 1
    };

    try {
        await api.generarPresupuesto(payload);
        showToast('Presupuesto generado correctamente');
        await loadPresupuesto();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function openEditItem(id) {
    const item = currentBudgetData.items.find(i => i.id == id);
    if (!item) return;

    editItemId = id;
    document.getElementById('lbl-pre-item-nombre').textContent = item.itemRecurrenteNombre || item.categoriaNombre;
    document.getElementById('pre-monto-planeado').value = item.montoPlaneado;
    modalItemCtx.open();
}

async function handleUpdateItem(e) {
    e.preventDefault();
    const monto = parseFloat(document.getElementById('pre-monto-planeado').value);

    try {
        await api.updateItemPresupuesto(editItemId, { montoPlaneado: monto });
        showToast('Monto actualizado');
        modalItemCtx.close();
        await loadPresupuesto();
    } catch (e) {
        showToast(e.message, 'error');
    }
}
