import { api } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    if (localStorage.getItem('token')) {
        window.location.href = 'app.html';
        return;
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const goToRegister = document.getElementById('go-to-register');
    const goToLogin = document.getElementById('go-to-login');
    const alertBox = document.getElementById('auth-alert');
    const authSubtitle = document.getElementById('auth-subtitle');

    const showAlert = (message, type = 'error') => {
        alertBox.textContent = message;
        alertBox.className = `alert alert-${type}`;
        alertBox.classList.remove('hidden');
        setTimeout(() => alertBox.classList.add('hidden'), 5000);
    };

    goToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authSubtitle.textContent = 'Crea tu cuenta ahora';
        alertBox.classList.add('hidden');
    });

    goToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        authSubtitle.textContent = 'Accede a tu workspace financiero';
        alertBox.classList.add('hidden');
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('btn-login');

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-sm"></span> Ingresando...';
            
            const response = await api.login(email, password);
            if (response && response.data && response.data.token) {
                // Save auth info
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('userName', response.data.nombre);
                localStorage.setItem('userEmail', response.data.email);
                
                // Save workspace (pick the first one if multiple or just save the array)
                if (response.data.workspaces && response.data.workspaces.length > 0) {
                    localStorage.setItem('workspaces', JSON.stringify(response.data.workspaces));
                    localStorage.setItem('activeWorkspace', response.data.workspaces[0].id);
                }
                
                showAlert('¡Login Exitoso! Redirigiendo...', 'success');
                setTimeout(() => window.location.href = 'app.html', 1000);
            } else {
                showAlert('Respuesta inválida del servidor.');
            }
        } catch (error) {
            showAlert(error.message || 'Credenciales incorrectas o error de servidor.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Ingresar</span><i class="fa-solid fa-arrow-right"></i>';
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('reg-nombre').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const btn = document.getElementById('btn-register');

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-sm"></span> Creando...';
            
            const response = await api.register(nombre, email, password);
            
            if (response && response.data && response.data.token) {
                // Auto login after register
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('userName', response.data.nombre);
                localStorage.setItem('userEmail', response.data.email);
                
                if (response.data.workspaces && response.data.workspaces.length > 0) {
                    localStorage.setItem('workspaces', JSON.stringify(response.data.workspaces));
                    localStorage.setItem('activeWorkspace', response.data.workspaces[0].id);
                }
                
                showAlert('¡Cuenta creada exitosamente!', 'success');
                setTimeout(() => window.location.href = 'app.html', 1500);
            } else {
                showAlert('Cuenta creada, por favor inicia sesión.', 'success');
                setTimeout(() => goToLogin.click(), 1500);
            }
        } catch (error) {
            showAlert(error.message || 'Error al crear la cuenta. Verifica que el correo no esté en uso.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Crear Cuenta</span><i class="fa-solid fa-user-plus"></i>';
        }
    });
});
