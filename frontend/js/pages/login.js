/**
 * TecniBuy Login Page
 */

import { api } from '../api.js';
import { navigateTo, showToast, updateAuthUI } from '../app.js';

export async function render() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card card">
        <div class="auth-header">
          <a href="#/" class="auth-logo" aria-label="TecniBuy - Inicio">
            <span aria-hidden="true">🛒</span>
            <span>TecniBuy</span>
          </a>
          <h1>Iniciar sesión</h1>
          <p>Ingresá tus credenciales para acceder a tu cuenta</p>
        </div>

        <form id="login-form" class="auth-form" novalidate>
          <div class="form-group">
            <label for="username" class="form-label">Usuario o email</label>
            <input type="text" id="username" name="username" class="form-input" autocomplete="username" required aria-describedby="username-error">
            <p id="username-error" class="form-error" aria-live="polite"></p>
          </div>

          <div class="form-group">
            <label for="password" class="form-label">Contraseña</label>
            <div class="password-input-wrapper">
              <input type="password" id="password" name="password" class="form-input" autocomplete="current-password" required aria-describedby="password-error">
              <button type="button" class="password-toggle" aria-label="Mostrar/ocultar contraseña" aria-pressed="false">👁️</button>
            </div>
            <p id="password-error" class="form-error" aria-live="polite"></p>
          </div>

          <div class="form-group form-checkbox">
            <input type="checkbox" id="remember" name="remember">
            <label for="remember">Recordarme</label>
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-lg" id="login-btn">
            <span class="btn-text">Iniciar sesión</span>
            <span class="btn-loading visually-hidden"><span class="spinner"></span> Ingresando...</span>
          </button>
        </form>

        <p class="auth-footer">
          ¿No tenés cuenta? <a href="#/register">Registrate gratis</a>
        </p>
      </div>
    </div>
  `;

  setupForm();
}

function setupForm() {
  const form = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.querySelector('.password-toggle');
  const submitBtn = document.getElementById('login-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');

  // Password toggle
  passwordToggle.addEventListener('click', () => {
    const isVisible = passwordInput.type === 'text';
    passwordInput.type = isVisible ? 'password' : 'text';
    passwordToggle.setAttribute('aria-pressed', !isVisible);
    passwordToggle.textContent = isVisible ? '👁️' : '🙈';
  });

  // Form validation
  function showError(input, message) {
    const errorEl = document.getElementById(`${input.id}-error`);
    input.setAttribute('aria-invalid', 'true');
    if (errorEl) errorEl.textContent = message;
  }

  function clearError(input) {
    const errorEl = document.getElementById(`${input.id}-error`);
    input.removeAttribute('aria-invalid');
    if (errorEl) errorEl.textContent = '';
  }

  // Real-time validation
  usernameInput.addEventListener('input', () => clearError(usernameInput));
  passwordInput.addEventListener('input', () => clearError(passwordInput));

  // Submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Validate
    let valid = true;
    if (!username) {
      showError(usernameInput, 'Ingresá tu usuario o email');
      valid = false;
    }
    if (!password) {
      showError(passwordInput, 'Ingresá tu contraseña');
      valid = false;
    }
    if (!valid) return;

    // Submit
    setLoading(true);
    try {
      const data = await api.login({ username, password });
      api.setTokens(data.access_token, data.refresh_token);
      updateAuthUI();
      showToast('¡Bienvenido de vuelta! 🎉', 'success');
      navigateTo('/');
    } catch (error) {
      showToast(error.message, 'error');
      if (error.message.includes('credenciales') || error.message.includes('password')) {
        showError(passwordInput, error.message);
      }
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    submitBtn.disabled = loading;
    if (loading) {
      btnText.classList.add('visually-hidden');
      btnLoading.classList.remove('visually-hidden');
    } else {
      btnText.classList.remove('visually-hidden');
      btnLoading.classList.add('visually-hidden');
    }
  }
}