import { api } from '../api.js';
import { AppState } from '../app.js';
import { showToast, formatCurrency, formatDate } from '../utils.js';

let chartInstance = null;

export async function initDashboard() {
    const today = new Date();
    const anio = today.getFullYear();
    const mes = today.getMonth() + 1;

    try {
        // Fetch Parallel
        const [dashResp, reportResp, txResp] = await Promise.all([
            api.getDashboardSummary(AppState.workspaceId, anio, mes),
            api.getGastosPorCategoria(AppState.workspaceId, anio, mes),
            api.getTransacciones(AppState.workspaceId)
        ]);

        updateSummaryCards(dashResp.data);
        updateChart(reportResp.data);
        updateRecentTransactions(txResp.data);
    } catch (error) {
        showToast('Error cargando los datos del dashboard. ' + error.message, 'error');
    }
}

function updateSummaryCards(data) {
    if (!data) return;
    
    document.getElementById('dash-ingresos').textContent = formatCurrency(data.totalIngresos || 0);
    document.getElementById('dash-gastos').textContent = formatCurrency(data.totalGastos || 0);
    
    const balEl = document.getElementById('dash-balance');
    const balance = data.balanceNeto || 0;
    balEl.textContent = formatCurrency(balance);
    
    if (balance > 0) {
        balEl.className = 'amount text-success';
    } else if (balance < 0) {
        balEl.className = 'amount text-danger';
    } else {
        balEl.className = 'amount';
    }
}

function updateChart(data) {
    const ctx = document.getElementById('chart-categorias').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    if (!data || data.length === 0) {
        // Show empty chart or message
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Sin Datos'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#2d3748']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'left',
                        labels: { color: '#94a3b8' }
                    }
                }
            }
        });
        return;
    }

    const labels = data.map(i => i.categoria);
    const values = data.map(i => i.total);
    // Use fallback colors if API doesn't provide color
    const defaultColors = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];
    const colors = data.map((i, idx) => i.color || defaultColors[idx % defaultColors.length]);

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'left',
                    labels: {
                        color: '#f8fafc',
                        padding: 15,
                        font: { family: "'Inter', sans-serif" }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) { label += ': '; }
                            if (context.raw !== null) {
                                label += formatCurrency(context.raw);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function updateRecentTransactions(txs) {
    const tbody = document.getElementById('dash-recent-list');
    
    if (!txs || txs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No hay transacciones recientes</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    
    // Sort and take top 5
    const recent = txs.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 7);
    
    recent.forEach(tx => {
        const tr = document.createElement('tr');
        const isIngreso = tx.tipo === 'INGRESO';
        const colorClass = isIngreso ? 'text-success' : 'text-danger';
        const sign = isIngreso ? '+' : '-';
        
        tr.innerHTML = `
            <td><small>${formatDate(tx.fecha)}</small></td>
            <td><div style="font-weight: 500; font-size: 0.9rem;">${tx.categoriaNombre || 'N/A'}</div><small style="color: var(--text-muted);">${tx.descripcion || ''}</small></td>
            <td class="${colorClass}" style="font-weight: 600; font-size: 0.95rem; text-align: right;">${sign}${formatCurrency(tx.monto)}</td>
        `;
        tbody.appendChild(tr);
    });
}
