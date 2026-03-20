const API_URL = 'https://finanzas-api.ubunifusoft.digital';

/**
 * Función principal para realizar peticiones HTTP a la API.
 * Retorna la data directamente o lanza un error si la petición falla.
 */
async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        // La API a veces retorna texto vacío en DELETE o 500 html pages
        let text = await response.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (e) {
                // If it's not JSON, might be an error page or just plain text
                data = { mensaje: text, status: response.status };
            }
        }

        if (!response.ok) {
            // Manejar errores como 401 o 400 provenientes de la API
            if (response.status === 401) {
                localStorage.clear();
                window.location.href = 'index.html'; // Redirigir si expira
            }
            throw new Error(data && data.mensaje ? data.mensaje : `Error de conexión: ${response.status}`);
        }

        // Estructura ResponseApi generica: {status, mensaje, data}
        if (data && data.status !== undefined && data.status >= 400) {
            throw new Error(data.mensaje || 'Error en la petición');
        }

        return data; // Devuelve la estructura de respuesta completa
    } catch (error) {
        console.error('Error in API Request:', error);
        throw error;
    }
}

export const api = {
    // Auth
    login: (email, password) => fetchAPI('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    }),
    
    register: (nombre, email, password) => fetchAPI('/api/auth/registro', {
        method: 'POST',
        body: JSON.stringify({ nombre, email, password })
    }),

    // Workspaces
    getWorkspaces: (usuarioId) => fetchAPI(`/api/workspaces?usuarioId=${usuarioId}`),

    // Cuentas
    getCuentas: (workspaceId) => fetchAPI(`/api/cuentas?workspaceId=${workspaceId}`),
    
    createCuenta: (payload) => fetchAPI('/api/cuentas', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),

    // Tarjetas
    getCreditCards: (workspaceId) => fetchAPI(`/api/credit-cards?workspaceId=${workspaceId}`),
    createCreditCard: (payload) => fetchAPI('/api/credit-cards', { method: 'POST', body: JSON.stringify(payload) }),
    updateCreditCard: (id, payload) => fetchAPI(`/api/credit-cards/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteCreditCard: (id) => fetchAPI(`/api/credit-cards/${id}`, { method: 'DELETE' }),

    updateCuenta: (id, payload) => fetchAPI(`/api/cuentas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),

    deleteCuenta: (id) => fetchAPI(`/api/cuentas/${id}`, {
        method: 'DELETE'
    }),

    // Categorias
    getCategorias: (workspaceId) => fetchAPI(`/api/categorias?workspaceId=${workspaceId}`),
    
    createCategoria: (payload) => fetchAPI('/api/categorias', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),

    updateCategoria: (id, payload) => fetchAPI(`/api/categorias/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),

    deleteCategoria: (id) => fetchAPI(`/api/categorias/${id}`, {
        method: 'DELETE'
    }),

    // Beneficiarios
    getBeneficiarios: (workspaceId) => fetchAPI(`/api/beneficiarios?workspaceId=${workspaceId}`),
    
    createBeneficiario: (payload) => fetchAPI('/api/beneficiarios', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),

    updateBeneficiario: (id, payload) => fetchAPI(`/api/beneficiarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),

    deleteBeneficiario: (id) => fetchAPI(`/api/beneficiarios/${id}`, {
        method: 'DELETE'
    }),

    // Transacciones
    getTransacciones: (workspaceId) => fetchAPI(`/api/transactions?workspaceId=${workspaceId}`),
    
    createTransaccion: (payload) => fetchAPI('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),

    deleteTransaccion: (id) => fetchAPI(`/api/transactions/${id}`, {
        method: 'DELETE'
    }),

    // Dashboard & Reportes
    getDashboardSummary: (workspaceId, anio, mes) => fetchAPI(`/api/dashboard/resumen-mensual?workspaceId=${workspaceId}&anio=${anio}&mes=${mes}`),
    
    getGastosPorCategoria: (workspaceId, anio, mes) => fetchAPI(`/api/reportes/gastos-por-categoria?workspaceId=${workspaceId}&anio=${anio}&mes=${mes}`)
};
