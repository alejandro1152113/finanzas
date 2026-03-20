import { api } from '../api.js';
import { AppState } from '../app.js';
import { showToast, initModal, formatCurrency } from '../utils.js';

let modalCtx = null;
let modalTarCtx = null;
export let cuentaEditId = null;
export let tarjetaEditId = null;

export async function initCuentas() {
    if (!modalCtx) {
        modalCtx = initModal('modal-cuenta');
        
        document.getElementById('btn-nueva-cuenta').addEventListener('click', () => {
            cuentaEditId = null;
            document.getElementById('form-cuenta').reset();
            document.querySelector('#modal-cuenta .modal-title').textContent = 'Nueva Cuenta';
            
            // Habilitar saldo inicial solo en creación
            document.getElementById('cta-saldo').disabled = false;
            modalCtx.open();
        });

        document.getElementById('form-cuenta').addEventListener('submit', handleSaveCuenta);
        
        // Event delegation for table buttons
        document.getElementById('lista-cuentas').addEventListener('click', async (e) => {
            const btnDelete = e.target.closest('.btn-delete-cta');
            if (btnDelete) {
                const id = btnDelete.dataset.id;
                if (confirm('¿Seguro que deseas eliminar esta cuenta permanentemente? Todas las transacciones asociadas podrían afectarse.')) {
                    await deleteCuenta(id);
                }
            }

            const btnEdit = e.target.closest('.btn-edit-cta');
            if (btnEdit) {
                const id = btnEdit.dataset.id;
                openEditCuenta(id);
            }
        });
    }

    if (!modalTarCtx) {
        modalTarCtx = initModal('modal-tarjeta');
        
        document.getElementById('btn-nueva-tarjeta').addEventListener('click', () => {
            tarjetaEditId = null;
            document.getElementById('form-tarjeta').reset();
            document.querySelector('#modal-tarjeta .modal-title').textContent = 'Nueva Tarjeta de Crédito';
            modalTarCtx.open();
        });

        document.getElementById('form-tarjeta').addEventListener('submit', handleSaveTarjeta);
        
        // Event delegation for table buttons (Tarjetas)
        document.getElementById('lista-tarjetas').addEventListener('click', async (e) => {
            const btnDelete = e.target.closest('.btn-delete-tar');
            if (btnDelete) {
                const id = btnDelete.dataset.id;
                if (confirm('¿Seguro que deseas eliminar esta tarjeta permanentemente?')) {
                    await deleteTarjeta(id);
                }
            }

            const btnEdit = e.target.closest('.btn-edit-tar');
            if (btnEdit) {
                const id = btnEdit.dataset.id;
                openEditTarjeta(id);
            }
        });
    }

    await Promise.all([loadCuentas(), loadTarjetas()]);
}

async function loadCuentas() {
    const tbody = document.getElementById('lista-cuentas');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><span class="spinner-sm"></span> Cargando...</td></tr>';
    
    try {
        const response = await api.getCuentas(AppState.workspaceId);
        AppState.cuentas = response.data || [];
        
        if (AppState.cuentas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No hay cuentas registradas.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        AppState.cuentas.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${c.id}</td>
                <td style="font-weight: 500;">${c.nombre}</td>
                <td><span class="badge" style="background:var(--primary); color:white;">${c.tipo}</span></td>
                <td>${c.moneda}</td>
                <td class="font-bold">${formatCurrency(c.saldo)}</td>
                <td>
                    <button class="btn btn-edit-cta" data-id="${c.id}" style="padding: 6px 10px; background: transparent; color: var(--warning); border: 1px solid var(--warning);"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-delete-cta" data-id="${c.id}" style="padding: 6px 10px; background: transparent; color: var(--danger); border: 1px solid var(--danger);"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;" class="text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar cuentas', 'error');
    }
}

async function handleSaveCuenta(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    
    const nombre = document.getElementById('cta-nombre').value;
    const tipo = document.getElementById('cta-tipo').value;
    const moneda = document.getElementById('cta-moneda').value;
    const saldoInicial = parseFloat(document.getElementById('cta-saldo').value) || 0;

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Guardando...';

        const payload = {
            workspaceId: parseInt(AppState.workspaceId),
            nombre: nombre,
            tipo: tipo,
            moneda: moneda,
            saldoInicial: saldoInicial
        };

        if (cuentaEditId) {
            await api.updateCuenta(cuentaEditId, payload);
            showToast('Cuenta actualizada exitosamente');
        } else {
            await api.createCuenta(payload);
            showToast('Cuenta creada exitosamente');
        }
        
        modalCtx.close();
        await loadCuentas();
    } catch (error) {
        showToast(error.message || 'Error al guardar la cuenta', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Cuenta';
    }
}

function openEditCuenta(id) {
    const cta = AppState.cuentas.find(c => c.id == id);
    if (!cta) return;
    
    cuentaEditId = cta.id;
    document.getElementById('cta-nombre').value = cta.nombre;
    document.getElementById('cta-tipo').value = cta.tipo;
    document.getElementById('cta-moneda').value = cta.moneda;
    
    // Disable saldo field in Edit, API usually protects saldoInicial from being updated normally without transactions
    const saldoInput = document.getElementById('cta-saldo');
    saldoInput.value = cta.saldoInicial || 0;
    saldoInput.disabled = true;
    
    document.querySelector('#modal-cuenta .modal-title').textContent = 'Editar Cuenta';
    modalCtx.open();
}

async function deleteCuenta(id) {
    try {
        await api.deleteCuenta(id);
        showToast('Cuenta eliminada');
        await loadCuentas();
    } catch (error) {
        showToast(error.message || 'Error al eliminar', 'error');
    }
}

// ============== LÓGICA TARJETAS =================

async function loadTarjetas() {
    const tbody = document.getElementById('lista-tarjetas');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><span class="spinner-sm"></span> Cargando...</td></tr>';
    
    try {
        const response = await api.getCreditCards(AppState.workspaceId);
        AppState.tarjetas = response.data || [];
        
        if (AppState.tarjetas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No hay tarjetas registradas.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        AppState.tarjetas.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${t.id}</td>
                <td style="font-weight: 500;">${t.nombre} <br><small class="text-muted">${t.franquicia || 'N/A'}</small></td>
                <td class="font-bold">${formatCurrency(t.cupo)}</td>
                <td>Día ${t.diaCorte}</td>
                <td>Día ${t.diaPago}</td>
                <td>
                    <button class="btn btn-edit-tar" data-id="${t.id}" style="padding: 6px 10px; background: transparent; color: var(--warning); border: 1px solid var(--warning);"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-delete-tar" data-id="${t.id}" style="padding: 6px 10px; background: transparent; color: var(--danger); border: 1px solid var(--danger);"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;" class="text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar tarjetas', 'error');
    }
}

async function handleSaveTarjeta(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    
    const payload = {
        workspaceId: parseInt(AppState.workspaceId),
        nombre: document.getElementById('tar-nombre').value,
        franquicia: document.getElementById('tar-franquicia').value,
        moneda: document.getElementById('tar-moneda').value,
        cupo: parseFloat(document.getElementById('tar-cupo').value) || 0,
        diaCorte: parseInt(document.getElementById('tar-corte').value) || 1,
        diaPago: parseInt(document.getElementById('tar-pago').value) || 1
    };

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Guardando...';

        if (tarjetaEditId) {
            await api.updateCreditCard(tarjetaEditId, payload);
            showToast('Tarjeta actualizada exitosamente');
        } else {
            await api.createCreditCard(payload);
            showToast('Tarjeta creada exitosamente');
        }
        
        modalTarCtx.close();
        await loadTarjetas();
    } catch (error) {
        showToast(error.message || 'Error al guardar la tarjeta', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Tarjeta';
    }
}

function openEditTarjeta(id) {
    const t = AppState.tarjetas.find(x => x.id == id);
    if (!t) return;
    
    tarjetaEditId = t.id;
    document.getElementById('tar-nombre').value = t.nombre;
    if(t.franquicia) document.getElementById('tar-franquicia').value = t.franquicia;
    document.getElementById('tar-moneda').value = t.moneda || 'COP';
    document.getElementById('tar-cupo').value = t.cupo || 0;
    document.getElementById('tar-corte').value = t.diaCorte || 1;
    document.getElementById('tar-pago').value = t.diaPago || 1;
    
    document.querySelector('#modal-tarjeta .modal-title').textContent = 'Editar Tarjeta';
    modalTarCtx.open();
}

async function deleteTarjeta(id) {
    try {
        await api.deleteCreditCard(id);
        showToast('Tarjeta eliminada');
        await loadTarjetas();
    } catch (error) {
        showToast(error.message || 'Error al eliminar', 'error');
    }
}
