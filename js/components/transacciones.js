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
        
        // Listen to Type change to filter Categories and Fuentes
        document.getElementById('trx-tipo').addEventListener('change', () => {
            filterCategoriesByType();
            filterFuentesByType();
            updateUIByContext();
        });

        // Listen to Source change to update Medio Pago automatically
        document.getElementById('trx-fuente').addEventListener('change', () => {
            const fuente = document.getElementById('trx-fuente').value;
            const medio = document.getElementById('trx-medio-pago');
            if (fuente.startsWith('TARJETA_')) {
                medio.value = 'TARJETA';
            } else if (document.getElementById('trx-tipo').value === 'GASTO') {
                medio.value = 'TRANSFERENCIA';
            }
            updateUIByContext();
        });
        
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
        AppState.cuentas = cuentas;

        let cards = cardsResp.data || [];
        if (cards.length === 0) {
            try {
                const newCard = await api.createCreditCard({
                    workspaceId: parseInt(AppState.workspaceId),
                    nombre: 'Tarjeta de Gastos Virtual',
                    franquicia: 'VISA',
                    cupo: 5000000,
                    diaCorte: 15,
                    diaPago: 30
                });
                cards = [newCard.data];
            } catch(e) {}
        }
        AppState.tarjetas = cards;

        filterFuentesByType();

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
        updateUIByContext();
        modalCtx.open();
    } catch (e) {
        showToast('Error cargando listas de categorías o beneficiarios.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
    }
}

function updateUIByContext() {
    const tipo = document.getElementById('trx-tipo').value;
    const fuenteValue = document.getElementById('trx-fuente').value;
    const grpBen = document.getElementById('grp-trx-beneficiario');
    const grpMedio = document.getElementById('grupo-medio-pago');
    const lblFuente = document.getElementById('lbl-trx-fuente');
    const selectMedioPago = document.getElementById('trx-medio-pago');

    if (tipo === 'INGRESO') {
        grpBen.classList.add('hidden');
        grpMedio.classList.add('hidden');
        lblFuente.textContent = 'Destino de los Fondos';
    } else {
        grpBen.classList.remove('hidden');
        grpMedio.classList.remove('hidden');
        lblFuente.textContent = 'Origen de los Fondos';
    }

    // Auto-select payment method based on source type
    if (fuenteValue.startsWith('CUENTA_')) {
        const id = parseInt(fuenteValue.replace('CUENTA_', ''));
        const cuenta = AppState.cuentas.find(c => c.id == id);
        if (cuenta) {
            if (cuenta.tipo === 'EFECTIVO') selectMedioPago.value = 'EFECTIVO';
            else selectMedioPago.value = 'TRANSFERENCIA';
        }
    } else if (fuenteValue.startsWith('TARJETA_')) {
        selectMedioPago.value = 'TARJETA';
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

// Aplica la lógica estricta del constraint del Backend
function filterFuentesByType() {
    const tipo = document.getElementById('trx-tipo').value;
    const selectFuente = document.getElementById('trx-fuente');
    const selectMedioPago = document.getElementById('trx-medio-pago');
    const grupoMedioPago = document.getElementById('grupo-medio-pago');
    
    const previousValue = selectFuente.value;
    selectFuente.innerHTML = '<option value="">Seleccione Origen/Destino</option>';

    // Grp Cuentas
    const grpC = document.createElement('optgroup');
    grpC.label = 'Cuentas Bancarias / Billeteras';
    (AppState.cuentas || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = `CUENTA_${c.id}`;
        opt.textContent = `${c.nombre} (${c.tipo})`;
        grpC.appendChild(opt);
    });
    selectFuente.appendChild(grpC);

    // Grp Tarjetas
    const grpT = document.createElement('optgroup');
    grpT.label = 'Tarjetas de Crédito';
    (AppState.tarjetas || []).forEach(t => {
        const opt = document.createElement('option');
        opt.value = `TARJETA_${t.id}`;
        opt.textContent = `${t.nombre} (${t.franquicia || 'N/A'})`;
        grpT.appendChild(opt);
    });
    selectFuente.appendChild(grpT);

    // Reset or Keep previous value if valid
    if (previousValue && selectFuente.querySelector(`option[value="${previousValue}"]`)) {
        selectFuente.value = previousValue;
    } else if (tipo === 'GASTO' && AppState.tarjetas && AppState.tarjetas.length > 0) {
        selectFuente.value = `TARJETA_${AppState.tarjetas[0].id}`;
    } else if (AppState.cuentas && AppState.cuentas.length > 0) {
        selectFuente.value = `CUENTA_${AppState.cuentas[0].id}`;
    }

    // Lógica de medios de pago
    grupoMedioPago.classList.remove('hidden');
    if (tipo === 'GASTO') {
        // Default to TARJETA if a card is selected, otherwise EFECTIVO/TRANSFERENCIA
        if (selectFuente.value.startsWith('TARJETA_')) {
            selectMedioPago.value = 'TARJETA';
        } else {
            selectMedioPago.value = 'TRANSFERENCIA';
        }
    } else {
        selectMedioPago.value = 'TRANSFERENCIA';
    }
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

    // Determinar medioPago basado en tipo de cuenta seleccionada
    let medioPagoFinal = medioPago || 'TRANSFERENCIA';
    if (fuenteStr.startsWith('CUENTA_')) {
        const cuentaId = parseInt(fuenteStr.replace('CUENTA_', ''));
        const cuenta = (AppState?.cuentas || []).find(c => c.id === cuentaId);
        if (cuenta?.tipo === 'EFECTIVO') {
            medioPagoFinal = 'EFECTIVO';
        } else {
            medioPagoFinal = 'TRANSFERENCIA';
        }
    } else if (fuenteStr.startsWith('TARJETA_')) {
        medioPagoFinal = 'TARJETA';
    }

    let payload = {
        workspaceId: parseInt(workspaceId),
        tipo,
        categoriaId: parseInt(categoriaId),
        categoria_id: parseInt(categoriaId),
        fecha,
        monto: parseFloat(monto),
        descripcion,
        medioPago: medioPagoFinal,
        medio_pago: medioPagoFinal
    };

    if (beneficiarioId) {
        payload.beneficiarioId = parseInt(beneficiarioId);
        payload.beneficiario_id = parseInt(beneficiarioId);
    }

    // Resolviendo la Tarjeta de Credito o Cuenta — enviamos ambas convenciones (camelCase y snake_case)
    // porque no sabemos cuál lee el backend real
    if (fuenteStr.startsWith('CUENTA_')) {
        const id = parseInt(fuenteStr.replace('CUENTA_', ''));
        payload.cuentaId = id;
        payload.cuenta_id = id;
    } else if (fuenteStr.startsWith('TARJETA_')) {
        const id = parseInt(fuenteStr.replace('TARJETA_', ''));
        payload.tarjetaCreditoId = id;
        payload.tarjeta_credito_id = id;
    }

    // Validación de seguridad
    if (tipo === 'INGRESO' && (payload.tarjetaCreditoId || payload.tarjeta_credito_id)) {
        throw new Error("No puedes registrar un INGRESO directamente a una Tarjeta de Crédito. Usa una Cuenta normal.");
    }

    console.log('Final Payload (Robust):', payload);
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
