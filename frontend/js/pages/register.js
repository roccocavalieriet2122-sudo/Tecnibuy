/**
 * TecniBuy Register Page
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
          <h1>Crear cuenta</h1>
          <p>Registrate gratis y empezá a comprar y vender</p>
        </div>

        <form id="register-form" class="auth-form" novalidate>
          <div class="form-group">
            <label for="username" class="form-label">Nombre de usuario</label>
            <input type="text" id="username" name="username" class="form-input" autocomplete="username" required
              minlength="3" maxlength="50" pattern="[a-zA-Z0-9_]+" aria-describedby="username-error username-hint">
            <p id="username-hint" class="form-help">Solo letras, números y guión bajo (3-50 caracteres)</p>
            <p id="username-error" class="form-error" aria-live="polite"></p>
          </div>

          <div class="form-group">
            <label for="email" class="form-label">Email</label>
            <input type="email" id="email" name="email" class="form-input" autocomplete="email" required aria-describedby="email-error">
            <p id="email-error" class="form-error" aria-live="polite"></p>
          </div>

          <div class="form-group">
            <label for="password" class="form-label">Contraseña</label>
            <div class="password-input-wrapper">
              <input type="password" id="password" name="password" class="form-input" autocomplete="new-password" required
                minlength="8" maxlength="128" aria-describedby="password-error password-hint">
              <button type="button" class="password-toggle" aria-label="Mostrar/ocultar contraseña" aria-pressed="false">👁️</button>
            </div>
            <p id="password-hint" class="form-help">Mínimo 8 caracteres</p>
            <p id="password-error" class="form-error" aria-live="polite"></p>
            <div class="password-strength" id="password-strength" aria-live="polite" hidden>
              <div class="strength-bar">
                <div class="strength-fill" id="strength-fill"></div>
              </div>
              <span class="strength-text" id="strength-text"></span>
            </div>
          </div>

          <div class="form-group">
            <label for="password_confirm" class="form-label">Confirmar contraseña</label>
            <div class="password-input-wrapper">
              <input type="password" id="password_confirm" name="password_confirm" class="form-input" autocomplete="new-password" required aria-describedby="confirm-error">
              <button type="button" class="password-toggle" aria-label="Mostrar/ocultar contraseña" aria-pressed="false">👁️</button>
            </div>
            <p id="confirm-error" class="form-error" aria-live="polite"></p>
          </div>

          <div class="form-group form-checkbox">
            <input type="checkbox" id="terms" name="terms" required>
            <label for="terms">Acepto los <a href="#/terminos">Términos y condiciones</a> y la <a href="#/privacidad">Política de privacidad</a></label>
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-lg" id="register-btn">
            <span class="btn-text">Crear cuenta</span>
            <span class="btn-loading visually-hidden"><span class="spinner"></span> Creando cuenta...</span>
          </button>
        </form>

        <p class="auth-footer">
          ¿Ya tenés cuenta? <a href="#/login">Iniciá sesión</a>
        </p>
      </div>
    </div>
  `;

  setupForm();
}

function setupForm() {
  const form = document.getElementById('register-form');
  const usernameInput = document.getElementById('username');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('password_confirm');
  const submitBtn = document.getElementById('register-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');
  const strengthContainer = document.getElementById('password-strength');
  const strengthFill = document.getElementById('strength-fill');
  const strengthText = document.getElementById('strength-text');

  // Password toggles
  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const isVisible = input.type === 'text';
      input.type = isVisible ? 'password' : 'text';
      btn.setAttribute('aria-pressed', !isVisible);
      btn.textContent = isVisible ? '👁️' : '🙈';
    });
  });

  // Password strength meter
  passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    if (password.length > 0) {
      strengthContainer.hidden = false;
      const strength = calculatePasswordStrength(password);
      updateStrengthMeter(strength);
    } else {
      strengthContainer.hidden = true;
    }
  });

  function calculatePasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 5);
  }

  function updateStrengthMeter(score) {
    const labels = ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte'];
    const colors = ['var(--color-danger)', 'var(--color-warning)', 'var(--color-warning)', 'var(--color-secondary)', 'var(--color-secondary)'];

    const percentage = (score / 5) * 100;
    strengthFill.style.width = `${percentage}%`;
    strengthFill.style.backgroundColor = colors[score - 1] || colors[0];
    strengthText.textContent = labels[score - 1] || labels[0];
    strengthText.style.color = colors[score - 1] || colors[0];
  }

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
  [usernameInput, emailInput, passwordInput, confirmInput].forEach(input => {
    input.addEventListener('input', () => clearError(input));
  });

  // Submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    const terms = document.getElementById('terms').checked;

    // Validate
    let valid = true;

    if (!username) {
      showError(usernameInput, 'Ingresá un nombre de usuario');
      valid = false;
    } else if (username.length < 3) {
      showError(usernameInput, 'Mínimo 3 caracteres');
      valid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showError(usernameInput, 'Solo letras, números y guión bajo');
      valid = false;
    }

    if (!email) {
      showError(emailInput, 'Ingresá tu email');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(emailInput, 'Email inválido');
      valid = false;
    }

    if (!password) {
      showError(passwordInput, 'Ingresá una contraseña');
      valid = false;
    } else if (password.length < 8) {
      showError(passwordInput, 'Mínimo 8 caracteres');
      valid = false;
    }

    if (password !== confirm) {
      showError(confirmInput, 'Las contraseñas no coinciden');
      valid = false;
    }

    if (!terms) {
      showToast('Debés aceptar los términos y condiciones', 'error');
      valid = false;
    }

    if (!valid) return;

    // Submit
        setLoading(true);
    try {
      const data = await api.register({ username, email, password });
      api.setTokens(data.access_token, data.refresh_token);
      updateAuthUI();
      showToast('¡Cuenta creada exitosamente! 🎉', 'success');
      navigateTo('/');
    } catch (error) {
      showToast(error.message, 'error');
      if (error.message.includes('usuario')) {
        showError(usernameInput, error.message);
      } else if (error.message.includes('email')) {
        showError(emailInput, error.message);
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