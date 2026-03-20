import { api } from '../api.js';
import { AppState } from '../app.js';
import { showToast, initModal, formatCurrency, formatDate } from '../utils.js';

let modalCtx = null;

export async function initTransacciones() {
    if (!modalCtx) {
        modalCtx = initModal('modal-transaccion');
        
        document.getElementById('btn-nueva-transaccion').addEventListener('click', async () => {
            document.getElementById('form-transaccion').reset();
            
            // Set today's date by default
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('trx-fecha').value = today;

            // Load Categories and Beneficiaries for selects
            await populateSelects();
        });

        document.getElementById('form-transaccion').addEventListener('submit', handleCreateTransaccion);
        
        // Listen to Type change to filter Categories
        document.getElementById('trx-tipo').addEventListener('change', filterCategoriesByType);
        
        // Listen to deletes
        document.getElementById('lista-transacciones').addEventListener('click', async (e) => {
            const btnDelete = e.target.closest('.btn-delete-trx');
            if (btnDelete) {
                const id = btnDelete.dataset.id;
                if (confirm('¿Seguro que deseas eliminar esta transacción permanentemente?')) {
                    await deleteTransaccion(id);
                }
            }
        });
    }

    await loadTransacciones();
}

async function populateSelects() {
    const btn = document.getElementById('btn-nueva-transaccion');
    const originalBtnContent = btn.innerHTML;
    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Cargando datos...';

        // Fetch if empty, though normally we might fetch every time to be safe
        const [catResp, benResp, cuentasResp, cardsResp] = await Promise.all([
            api.getCategorias(AppState.workspaceId),
            api.getBeneficiarios(AppState.workspaceId),
            api.getCuentas(AppState.workspaceId),
            api.getCreditCards(AppState.workspaceId).catch(() => ({data:[]}))
        ]);

        AppState.categorias = catResp.data || [];
        AppState.beneficiarios = benResp.data || [];
        
        let cuentas = cuentasResp.data || [];
        if (cuentas.length === 0) {
            // Create a default account silently if none exists
            const newCuenta = await api.createCuenta({
                workspaceId: parseInt(AppState.workspaceId),
                nombre: 'Cuenta Principal',
                tipo: 'EFECTIVO',
                moneda: 'COP',
                saldoInicial: 0
            });
            cuentas = [newCuenta.data];
        } 

        let cards = cardsResp.data || [];
        
        // Unificar Cuentas y Tarjetas en trx-fuente
        const selectFuente = document.getElementById('trx-fuente');
        selectFuente.innerHTML = '<option value="">Seleccione Cuenta o Tarjeta</option>';

        if (cuentas.length > 0) {
            const grpC = document.createElement('optgroup');
            grpC.label = 'Cuentas Bancarias / Billeteras';
            cuentas.forEach(c => {
                const opt = document.createElement('option');
                opt.value = `CUENTA_${c.id}`;
                opt.textContent = `${c.nombre} (${c.tipo})`;
                grpC.appendChild(opt);
            });
            selectFuente.appendChild(grpC);
        }

        if (cards.length > 0) {
            const grpT = document.createElement('optgroup');
            grpT.label = 'Tarjetas de Crédito';
            cards.forEach(t => {
                const opt = document.createElement('option');
                opt.value = `TARJETA_${t.id}`;
                opt.textContent = `${t.nombre} (${t.franquicia || 'N/A'}) - Cupo: ${t.cupo}`;
                grpT.appendChild(opt);
            });
            selectFuente.appendChild(grpT);
        }

        // Seleccionar la primera fuente disponible por defecto
        if(cuentas.length > 0) selectFuente.value = `CUENTA_${cuentas[0].id}`;
        else if(cards.length > 0) selectFuente.value = `TARJETA_${cards[0].id}`;

        // Validation rule: Must have at least 1 category
        const selectCat = document.getElementById('trx-categoria');
        const warningCat = document.getElementById('trx-cat-warning');
        
        if (AppState.categorias.length === 0) {
            warningCat.style.display = 'block';
            selectCat.disabled = true;
            document.querySelector('#form-transaccion button[type="submit"]').disabled = true;
            showToast('DEBES crear al menos una categoría antes de registrar movimientos', 'error');
        } else {
            warningCat.style.display = 'none';
            selectCat.disabled = false;
            document.querySelector('#form-transaccion button[type="submit"]').disabled = false;
            filterCategoriesByType();
        }

        // Populate Beneficiaries
        const selectBen = document.getElementById('trx-beneficiario');
        selectBen.innerHTML = '<option value="">Ninguno (Opcional)</option>';
        AppState.beneficiarios.forEach(b => {
            if(b.activo) {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = b.nombre;
                selectBen.appendChild(opt);
            }
        });

        // Open Modal after populating
        modalCtx.open();
    } catch (e) {
        showToast('Error cargando listas de categorías o beneficiarios.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
    }
}

function filterCategoriesByType() {
    const tipo = document.getElementById('trx-tipo').value;
    const selectCat = document.getElementById('trx-categoria');
    
    selectCat.innerHTML = '<option value="">Seleccione Categoría</option>';
    
    const catsFiltered = AppState.categorias.filter(c => c.tipo === tipo && c.activa);
    catsFiltered.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        selectCat.appendChild(opt);
    });
}

async function loadTransacciones() {
    const tbody = document.getElementById('lista-transacciones');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><span class="spinner-sm"></span> Cargando...</td></tr>';
    
    try {
        const response = await api.getTransacciones(AppState.workspaceId);
        const txs = response.data || [];
        
        if (txs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No hay movimientos registrados.</td></tr>';
            return;
        }

        // Sort by date (newest first)
        txs.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

        tbody.innerHTML = '';
        txs.forEach(tx => {
            const tr = document.createElement('tr');
            
            const montoClass = tx.tipo === 'INGRESO' ? 'text-success' : 'text-danger';
            const sign = tx.tipo === 'INGRESO' ? '+' : '-';

            tr.innerHTML = `
                <td>${formatDate(tx.fecha)}</td>
                <td><span class="badge ${tx.tipo}">${tx.tipo}</span></td>
                <td>${tx.categoriaNombre || 'N/A'}</td>
                <td>${tx.descripcion || '--'}</td>
                <td>${tx.beneficiarioNombre || '--'}</td>
                <td class="${montoClass} font-bold">${sign}${formatCurrency(tx.monto)}</td>
                <td>
                    <button class="btn btn-delete-trx" data-id="${tx.id}" style="padding: 6px 10px; background: transparent; color: var(--danger); border: 1px solid var(--danger);"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;" class="text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar transacciones', 'error');
    }
}

function buildTransactionPayload(formData) {
    const { 
        workspaceId, tipo, categoriaId, beneficiarioId, 
        fecha, monto, descripcion, medioPago, fuenteStr
    } = formData;

    if (!categoriaId) throw new Error('Debes seleccionar una categoría.');
    if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a 0.');
    if (!fuenteStr) throw new Error('Debes seleccionar el origen o destino de los fondos (Cuenta o Tarjeta).');
    if (!medioPago) throw new Error('El medio de pago es obligatorio en la Base de Datos.');

    let payload = {
        workspaceId: parseInt(workspaceId),
        tipo,
        categoriaId: parseInt(categoriaId),
        fecha,
        monto: parseFloat(monto),
        descripcion,
        medioPago
    };

    if (beneficiarioId) {
        payload.beneficiarioId = parseInt(beneficiarioId);
    }

    // Resolviendo la Tarjeta de Credito o Cuenta segun su tipo (vienen unificados en fuenteStr)
    if (fuenteStr.startsWith('CUENTA_')) {
        payload.cuentaId = parseInt(fuenteStr.replace('CUENTA_', ''));
    } else if (fuenteStr.startsWith('TARJETA_')) {
        payload.tarjetaCreditoId = parseInt(fuenteStr.replace('TARJETA_', ''));
    }

    // Validación de seguridad para que no intentes ingresar un sueldo directo a una Tarjeta de Crédito (el DB normalmente rompe aquí)
    if (tipo === 'INGRESO' && payload.tarjetaCreditoId) {
        throw new Error("No puedes registrar un INGRESO directamente a una Tarjeta de Crédito. Usa una Cuenta normal.");
    }

    return payload;
}

async function handleCreateTransaccion(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    
    const formData = {
        workspaceId: AppState.workspaceId,
        tipo: document.getElementById('trx-tipo').value,
        categoriaId: document.getElementById('trx-categoria').value,
        beneficiarioId: document.getElementById('trx-beneficiario').value,
        monto: document.getElementById('trx-monto').value,
        fecha: document.getElementById('trx-fecha').value,
        descripcion: document.getElementById('trx-descripcion').value,
        medioPago: document.getElementById('trx-medio-pago').value,
        fuenteStr: document.getElementById('trx-fuente').value
    };

    let payload;
    try {
        payload = buildTransactionPayload(formData);
    } catch (validationError) {
        showToast(validationError.message, 'error');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Guardando...';

        await api.createTransaccion(payload);
        showToast('Movimiento registrado exitosamente');
        modalCtx.close();
        
        await loadTransacciones();
    } catch (error) {
        showToast(error.message || 'Error al registrar el movimiento', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Registrar Movimiento';
    }
}

async function deleteTransaccion(id) {
    try {
        await api.deleteTransaccion(id);
        showToast('Transacción eliminada con éxito');
        await loadTransacciones();
    } catch (error) {
        showToast(error.message || 'Error al eliminar', 'error');
    }
}
