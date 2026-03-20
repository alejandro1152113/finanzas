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
        const [catResp, benResp] = await Promise.all([
            api.getCategorias(AppState.workspaceId),
            api.getBeneficiarios(AppState.workspaceId)
        ]);

        AppState.categorias = catResp.data || [];
        AppState.beneficiarios = benResp.data || [];

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
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;" class="text-danger">Error: ${error.message}</td></tr>`;
        showToast('Error al cargar transacciones', 'error');
    }
}

async function handleCreateTransaccion(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    
    const tipo = document.getElementById('trx-tipo').value;
    const categoriaId = document.getElementById('trx-categoria').value;
    const beneficiarioId = document.getElementById('trx-beneficiario').value;
    const monto = document.getElementById('trx-monto').value;
    const fecha = document.getElementById('trx-fecha').value;
    const descripcion = document.getElementById('trx-descripcion').value;
    const medioPago = document.getElementById('trx-medio-pago').value;

    if (!categoriaId) {
        showToast('Debes seleccionar una categoría.', 'error');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Guardando...';

        const payload = {
            workspaceId: parseInt(AppState.workspaceId),
            tipo: tipo,
            categoriaId: parseInt(categoriaId),
            fecha: fecha,
            monto: parseFloat(monto),
            descripcion: descripcion,
            medioPago: medioPago
        };

        if (beneficiarioId) {
            payload.beneficiarioId = parseInt(beneficiarioId);
        }

        await api.createTransaccion(payload);
        showToast('Movimiento registrado exitosamente');
        modalCtx.close();
        
        await loadTransacciones();
    } catch (error) {
        showToast(error.message || 'Error al registrar el movimiento. ¿Tal vez hace falta una Cuenta interna en el servidor?', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Registrar Movimiento';
    }
}
