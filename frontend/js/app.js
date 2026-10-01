/**
 * TecniBuy Main Application Entry Point
 * Bootstraps the SPA, initializes auth state, and sets up global event handlers
 */

import { initRouter, navigateTo } from './router.js';
import { api } from './api.js';
import { initChatWidget, syncWithAuth as syncChatWidgetAuth } from './chat-widget.js';
export { navigateTo };
// Initialize router
initRouter();

// Global navigation helper
window.navigateTo = navigateTo;

// Initialize UI state on load
document.addEventListener('DOMContentLoaded', () => {
  api.init();
  // Must run before updateAuthUI(), which calls syncChatWidgetAuth() and
  // needs the widget's root element to already exist.
  initChatWidget();
  updateAuthUI();
  setupMobileMenu();
  setupSearch();
});
/**
 * Update UI based on auth state
 */
export function updateAuthUI() {
  const userMenu = document.getElementById('user-menu');

  if (api.accessToken) {
    // User is logged in - show user menu
    userMenu.innerHTML = `
      <div class="user-menu-dropdown" id="user-dropdown">
        <button class="user-menu-btn" id="user-menu-btn" aria-label="Menú de usuario" aria-expanded="false" aria-haspopup="true">
          <span class="user-avatar" id="user-avatar">👤</span>
          <span class="user-name" id="user-name">Usuario</span>
          <span class="dropdown-arrow" aria-hidden="true">▼</span>
        </button>
        <div class="user-menu-content" id="user-menu-content" role="menu" aria-hidden="true">
          <a href="#/perfil" class="user-menu-item" role="menuitem" data-action="profile">👤 Mi perfil</a>
          <a href="#/mis-productos" class="user-menu-item" role="menuitem" data-action="my-products">📦 Mis productos</a>
          <a href="#/chat" class="user-menu-item" role="menuitem" data-action="chat">💬 Mensajes</a>
          <hr class="user-menu-divider">
          <button class="user-menu-item user-menu-logout" role="menuitem" data-action="logout">🚪 Cerrar sesión</button>
        </div>
      </div>
    `;

    // Load user info
    loadUserInfo();

    // Setup dropdown
    setupUserDropdown();
  } else {
    // User not logged in - show auth buttons
    userMenu.innerHTML = `
      <a href="#/login" class="btn btn-ghost" data-page="login">Iniciar sesión</a>
      <a href="#/register" class="btn btn-primary" data-page="register">Registrarse</a>
    `;
  }

  // Show/hide the floating messages widget to match auth state.
  syncChatWidgetAuth();
}

/**
 * Load current user info from API
 */
async function loadUserInfo() {
  try {
    const user = await api.getMe();
    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-name');
    if (avatarEl) avatarEl.textContent = user.avatar ? '🖼️' : '👤';
    if (nameEl) nameEl.textContent = user.username;
  } catch (error) {
    console.error('Error loading user info:', error);
    // Token might be invalid
    api.clearTokens();
    updateAuthUI();
  }
}

/**
 * Setup user dropdown menu
 */
function setupUserDropdown() {
  const btn = document.getElementById('user-menu-btn');
  const content = document.getElementById('user-menu-content');

  if (!btn || !content) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', !isOpen);
    content.setAttribute('aria-hidden', isOpen);
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !content.contains(e.target)) {
      btn.setAttribute('aria-expanded', 'false');
      content.setAttribute('aria-hidden', 'true');
    }
  });

  // Handle menu items
  content.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action]');
    if (!item) return;

    const action = item.dataset.action;
    if (action === 'logout') {
      e.preventDefault();
      logout();
    }
    // Links with href will navigate naturally
  });
}

/**
 * Logout user
 */
function logout() {
  api.logout();
  updateAuthUI();
  navigateTo('/');
  showToast('Sesión cerrada correctamente');
}

/**
 * Setup mobile menu toggle
 */
function setupMobileMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const navMain = document.querySelector('.nav-main');

  if (!menuToggle || !navMain) return;

  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', !isOpen);
    navMain.classList.toggle('open');
  });
}

/**
 * Setup search functionality
 */
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchInput.value.trim();
      if (query) {
        navigateTo(`/productos?q=${encodeURIComponent(query)}`);
      }
    }
  });
}

/**
 * Format price for Argentine locale
 */
export function formatPrice(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(num);
}

/**
 * Format date for Argentine locale
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  // A missing or malformed date string (e.g. a field the backend didn't
  // send) used to make Intl.DateTimeFormat throw a RangeError and crash
  // whatever page called this. Fail soft instead.
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} hs`;
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return formatDate(dateString);
}

/**
 * Show toast notification
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('show'));

  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Show confirmation dialog
 */
export function showConfirm(message) {
  return new Promise((resolve) => {
    const confirmed = window.confirm(message);
    resolve(confirmed);
  });
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
  let timeoutId;
  const debounced = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
}
