/**
 * Utility functions for Finanzas UFPS
 */

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' 
        ? '<i class="fa-solid fa-circle-check"></i>' 
        : '<i class="fa-solid fa-circle-exclamation"></i>';
        
    toast.innerHTML = `${icon} <span>${message}</span>`;
    
    container.appendChild(toast);
    
    // Remove after animation finishes (4s delay + 0.3s duration)
    setTimeout(() => {
        if (container.contains(toast)) {
            container.removeChild(toast);
        }
    }, 4500);
}

export function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(amount);
}

export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00'); // append time to avoid timezone offset issues
    return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
    }).format(date);
}

export function initModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return null;
    
    const closeBtn = modal.querySelector('.modal-close');
    
    const open = () => modal.classList.add('active');
    const close = () => modal.classList.remove('active');
    
    if (closeBtn) closeBtn.addEventListener('click', close);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });
    
    return { open, close, element: modal };
}
