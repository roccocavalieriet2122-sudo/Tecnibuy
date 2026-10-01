/**
 * TecniBuy Profile Page
 * User profile management
 */

import { api } from '../api.js';
import { navigateTo, showToast, formatDate, showConfirm } from '../app.js';

export async function render() {
  const app = document.getElementById('app');

  // Show loading
  app.innerHTML = `
    <section class="profile-page" aria-labelledby="profile-title">
      <div class="container">
        <div class="loading-placeholder" style="text-align: center; padding: 4rem;">
          <div class="spinner" style="margin: 0 auto 1rem;"></div>
          <p>Cargando perfil...</p>
        </div>
      </div>
    </section>
  `;

  try {
    const user = await api.getMe();
    renderProfile(user);
  } catch (error) {
    console.error('Error loading profile:', error);
    app.innerHTML = `
      <section class="profile-page">
        <div class="container">
          <div class="error-state">
            <p>⚠️ Error al cargar perfil: ${error.message}</p>
            <a href="#/" class="btn btn-primary">Volver al inicio</a>
          </div>
        </div>
      </section>
    `;
  }
}

function renderProfile(user) {
  const app = document.getElementById('app');

  app.innerHTML = `
    <section class="profile-page" aria-labelledby="profile-title">
      <div class="container">
        <header class="page-header">
          <h1 id="profile-title" class="page-title">Mi perfil</h1>
          <p class="page-subtitle">Gestioná tu cuenta y preferencias</p>
        </header>

        <div class="profile-layout">
          <!-- Sidebar Navigation -->
          <nav class="profile-sidebar" aria-label="Navegación del perfil">
            <ul class="profile-nav">
              <li><a href="#/perfil" class="profile-nav-link active" data-tab="account">👤 Cuenta</a></li>
              <li><a href="#/mis-productos" class="profile-nav-link" data-tab="products">📦 Mis productos</a></li>
              <li><a href="#/chat" class="profile-nav-link" data-tab="chat">💬 Mensajes</a></li>
            </ul>
          </nav>

          <!-- Main Content -->
          <main class="profile-main" role="main">
            <!-- Account Tab -->
            <div class="profile-tab active" id="tab-account" role="tabpanel" aria-labelledby="account-heading">
              <h2 id="account-heading" class="visually-hidden">Configuración de cuenta</h2>

              <div class="profile-section card">
                <h3>Información personal</h3>
                <form id="profile-form" class="profile-form" novalidate>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="username" class="form-label">Nombre de usuario *</label>
                      <input type="text" id="username" name="username" class="form-input" required
                        minlength="3" maxlength="50" pattern="[a-zA-Z0-9_]+"
                        value="${escapeHtml(user.username)}" aria-describedby="username-hint username-error">
                      <p id="username-hint" class="form-help">Solo letras, números y guión bajo (3-50 caracteres)</p>
                      <p id="username-error" class="form-error" aria-live="polite"></p>
                    </div>

                    <div class="form-group">
                      <label for="email" class="form-label">Email *</label>
                      <input type="email" id="email" name="email" class="form-input" required
                        value="${escapeHtml(user.email)}" aria-describedby="email-error">
                      <p id="email-error" class="form-error" aria-live="polite"></p>
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="avatar" class="form-label">Avatar URL (opcional)</label>
                    <input type="url" id="avatar" name="avatar" class="form-input"
                      value="${escapeHtml(user.avatar || '')}" placeholder="https://..." aria-describedby="avatar-hint">
                    <p id="avatar-hint" class="form-help">URL de una imagen (JPG, PNG, WebP, máx. 2MB)</p>
                  </div>

                  <button type="submit" class="btn btn-primary" id="update-profile-btn">
                    <span class="btn-text">Guardar cambios</span>
                    <span class="btn-loading visually-hidden"><span class="spinner"></span> Guardando...</span>
                  </button>
                </form>
              </div>

              <div class="profile-section card">
                <h3>Seguridad</h3>
                <form id="password-form" class="profile-form" novalidate>
                  <div class="form-group">
                    <label for="current_password" class="form-label">Contraseña actual *</label>
                    <input type="password" id="current_password" name="current_password" class="form-input" required autocomplete="current-password" aria-describedby="current-error">
                    <p id="current-error" class="form-error" aria-live="polite"></p>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label for="new_password" class="form-label">Nueva contraseña *</label>
                      <input type="password" id="new_password" name="new_password" class="form-input" required
                        minlength="8" maxlength="128" autocomplete="new-password" aria-describedby="new-pass-hint new-error">
                      <p id="new-pass-hint" class="form-help">Mínimo 8 caracteres</p>
                      <p id="new-error" class="form-error" aria-live="polite"></p>
                    </div>

                    <div class="form-group">
                      <label for="confirm_password" class="form-label">Confirmar nueva contraseña *</label>
                      <input type="password" id="confirm_password" name="confirm_password" class="form-input" required autocomplete="new-password" aria-describedby="confirm-error">
                      <p id="confirm-error" class="form-error" aria-live="polite"></p>
                    </div>
                  </div>

                  <button type="submit" class="btn btn-secondary" id="update-password-btn">
                    <span class="btn-text">Actualizar contraseña</span>
                    <span class="btn-loading visually-hidden"><span class="spinner"></span> Actualizando...</span>
                  </button>
                </form>
              </div>

              <div class="profile-section card profile-danger-zone">
                <h3>Zona de peligro</h3>
                <p class="form-help">Estas acciones son irreversibles.</p>
                <button type="button" class="btn btn-danger" id="delete-account-btn">🗑️ Eliminar mi cuenta</button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </section>
  `;

  setupForms(user);
}

function setupForms(user) {
  // Profile form
  const profileForm = document.getElementById('profile-form');
  const updateProfileBtn = document.getElementById('update-profile-btn');
  const profileBtnText = updateProfileBtn.querySelector('.btn-text');
  const profileBtnLoading = updateProfileBtn.querySelector('.btn-loading');

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(profileForm);
    const data = {
      username: formData.get('username').trim(),
      email: formData.get('email').trim().toLowerCase(),
      avatar: formData.get('avatar').trim() || null,
    };

    // Basic validation
    if (!data.username || data.username.length < 3) {
      showFieldError('username', 'Mínimo 3 caracteres');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
      showFieldError('username', 'Solo letras, números y guión bajo');
      return;
    }
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      showFieldError('email', 'Email inválido');
      return;
    }

    setLoading(updateProfileBtn, profileBtnText, profileBtnLoading, true);

    try {
      await api.updateMe(data);
      showToast('Perfil actualizado ✅', 'success');
      // Update header
      document.getElementById('user-name').textContent = data.username;
    } catch (error) {
      showToast(error.message, 'error');
      if (error.message.includes('usuario')) showFieldError('username', error.message);
      if (error.message.includes('email')) showFieldError('email', error.message);
    } finally {
      setLoading(updateProfileBtn, profileBtnText, profileBtnLoading, false);
    }
  });

  // Password form
  const passwordForm = document.getElementById('password-form');
  const updatePasswordBtn = document.getElementById('update-password-btn');
  const passBtnText = updatePasswordBtn.querySelector('.btn-text');
  const passBtnLoading = updatePasswordBtn.querySelector('.btn-loading');

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(passwordForm);
    const current = formData.get('current_password');
    const newPass = formData.get('new_password');
    const confirm = formData.get('confirm_password');

    if (!current) { showFieldError('current_password', 'Ingresá tu contraseña actual'); return; }
    if (!newPass || newPass.length < 8) { showFieldError('new_password', 'Mínimo 8 caracteres'); return; }
    if (newPass !== confirm) { showFieldError('confirm_password', 'Las contraseñas no coinciden'); return; }

    setLoading(updatePasswordBtn, passBtnText, passBtnLoading, true);

    try {
      await api.changePassword({ current_password: current, new_password: newPass });
      showToast('Contraseña actualizada ✅', 'success');
      passwordForm.reset();
    } catch (error) {
      showToast(error.message, 'error');
      if (error.message.includes('actual')) showFieldError('current_password', error.message);
    } finally {
      setLoading(updatePasswordBtn, passBtnText, passBtnLoading, false);
    }
  });

  // Delete account
  document.getElementById('delete-account-btn').addEventListener('click', async () => {
    const confirmed = await showConfirm(
      '¿Eliminar tu cuenta PERMANENTEMENTE? Se borrarán todos tus productos, chats y valoraciones. Esta acción NO se puede deshacer.'
    );
    if (!confirmed) return;

    const btn = document.getElementById('delete-account-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Eliminando...';

    try {
      await api.deleteMe();
      api.logout();
      showToast('Cuenta eliminada', 'success');
      navigateTo('/');
    } catch (error) {
      showToast(error.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '🗑️ Eliminar mi cuenta';
    }
  });

  function showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (input) input.setAttribute('aria-invalid', 'true');
    if (errorEl) errorEl.textContent = message;
  }

  function clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (input) input.removeAttribute('aria-invalid');
    if (errorEl) errorEl.textContent = '';
  }

  // Clear errors on input
  ['username', 'email', 'avatar', 'current_password', 'new_password', 'confirm_password'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.addEventListener('input', () => clearFieldError(id));
  });

  function setLoading(btn, textEl, loadingEl, loading) {
    btn.disabled = loading;
    if (loading) {
      textEl.classList.add('visually-hidden');
      loadingEl.classList.remove('visually-hidden');
    } else {
      textEl.classList.remove('visually-hidden');
      loadingEl.classList.add('visually-hidden');
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}