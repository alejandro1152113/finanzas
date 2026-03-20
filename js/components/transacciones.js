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

        // Populate Cuentas Dropdown
        const selectCuenta = document.getElementById('trx-cuenta');
        selectCuenta.innerHTML = '<option value="">Seleccione Cuenta</option>';
        cuentas.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.nombre} (${c.tipo})`;
            selectCuenta.appendChild(opt);
        });
        
        // Select the first one by default if exists
        if(cuentas.length > 0) {
            selectCuenta.value = cuentas[0].id;
        }

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
        
        // Populate Tarjetas Dropdown
        const selectTarjeta = document.getElementById('trx-tarjeta');
        selectTarjeta.innerHTML = '<option value="">Seleccione Tarjeta</option>';
        cards.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.nombre} (${t.franquicia || 'N/A'}) - Cupo: ${t.cupo}`;
            selectTarjeta.appendChild(opt);
        });

        if(cards.length > 0) {
            selectTarjeta.value = cards[0].id;
        }

        // Setup toggles for visibility based on Payment Rules
        setupTransactionFormToggles();

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

function setupTransactionFormToggles() {
    const trxTipo = document.getElementById('trx-tipo');
    const trxMedioPago = document.getElementById('trx-medio-pago');
    const grupoCuenta = document.getElementById('grupo-cuenta');
    const grupoTarjeta = document.getElementById('grupo-tarjeta');
    const grupoMedioPago = document.getElementById('grupo-medio-pago');

    function updateFormVisibility() {
        const tipo = trxTipo.value;
        const medio = trxMedioPago.value;

        if (tipo === 'INGRESO') {
            // INGRESO uses ONLY Cuenta
            grupoCuenta.classList.remove('hidden');
            grupoTarjeta.classList.add('hidden');
            grupoMedioPago.classList.add('hidden'); // MedioPago is not sent for INGRESOS
        } else {
            // GASTO uses MedioPago
            grupoMedioPago.classList.remove('hidden');
            
            if (medio === 'TARJETA') {
                grupoCuenta.classList.add('hidden');
                grupoTarjeta.classList.remove('hidden');
            } else {
                grupoCuenta.classList.remove('hidden');
                grupoTarjeta.classList.add('hidden');
            }
        }
    }

    trxTipo.addEventListener('change', updateFormVisibility);
    trxMedioPago.addEventListener('change', updateFormVisibility);
    
    // Initial call
    updateFormVisibility();
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
        fecha, monto, descripcion, medioPago, cuentaId, tarjetaCreditoId
    } = formData;

    if (!categoriaId) throw new Error('Debes seleccionar una categoría.');
    if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a 0.');

    let payload = {
        workspaceId: parseInt(workspaceId),
        tipo,
        categoriaId: parseInt(categoriaId),
        fecha,
        monto: parseFloat(monto),
        descripcion
    };

    if (beneficiarioId) {
        payload.beneficiarioId = parseInt(beneficiarioId);
    }

    // Regla estricta encontrada por ChatGPT
    if (tipo === 'INGRESO') {
        if (!cuentaId) throw new Error('Un INGRESO requiere de una Cuenta Destino.');
        payload.cuentaId = parseInt(cuentaId);
    } 
    else if (tipo === 'GASTO') {
        payload.medioPago = medioPago;
        if (medioPago === 'TARJETA') {
            if (!tarjetaCreditoId) throw new Error('Debes seleccionar la Tarjeta de Crédito para usar como medio de pago.');
            payload.tarjetaCreditoId = parseInt(tarjetaCreditoId);
        } else {
            if (!cuentaId) throw new Error('Debes seleccionar una Cuenta de Origen para usar Efectivo o Transferencia.');
            payload.cuentaId = parseInt(cuentaId);
        }
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
        cuentaId: document.getElementById('trx-cuenta').value,
        tarjetaCreditoId: document.getElementById('trx-tarjeta').value
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
