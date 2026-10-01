/**
 * TecniBuy Router
 * Simple hash-based SPA router with route guards
 */

import { api } from './api.js';

// Route definitions
const routes = {
  '/': { page: 'home', title: 'Inicio', auth: false },
  '/login': { page: 'login', title: 'Iniciar sesión', auth: false, guestOnly: true },
  '/register': { page: 'register', title: 'Registrarse', auth: false, guestOnly: true },
  '/productos': { page: 'products', title: 'Productos', auth: false },
  '/productos/nuevo': { page: 'product-create', title: 'Publicar producto', auth: true },
  '/productos/editar/:id': { page: 'product-edit', title: 'Editar producto', auth: true },
  '/producto/:id': { page: 'product-detail', title: 'Producto', auth: false },
  '/categorias': { page: 'categories', title: 'Categorías', auth: false },
  '/perfil': { page: 'profile', title: 'Mi perfil', auth: true },
  '/mis-productos': { page: 'my-products', title: 'Mis productos', auth: true },
  '/chat': { page: 'chat-list', title: 'Mensajes', auth: true },
  '/chat/:conversationId': { page: 'chat', title: 'Chat', auth: true },
};

let currentRoute = null;
let currentParams = {};

/**
 * Parse hash and match to route
 */
function parseHash() {
  const hash = window.location.hash.slice(1) || '/';
  const [path, queryString] = hash.split('?');
  const query = new URLSearchParams(queryString);

  // Find matching route
  for (const [pattern, config] of Object.entries(routes)) {
    const regex = patternToRegex(pattern);
    const match = path.match(regex);
    if (match) {
      const params = {};
      const paramNames = (pattern.match(/:(\w+)/g) || []).map(p => p.slice(1));
      paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { config, params, query };
    }
  }

  // Not found - redirect to home
  return { config: routes['/'], params: {}, query };
}

/**
 * Convert route pattern to regex
 */
function patternToRegex(pattern) {
  const regexPattern = pattern
    .replace(/\//g, '\\/')
    .replace(/:(\w+)/g, '([^/]+)');
  return new RegExp(`^${regexPattern}$`);
}

/**
 * Navigate to a route
 */
export function navigateTo(hash) {
  window.location.hash = hash;
}

/**
 * Get current route info
 */
export function getCurrentRoute() {
  return currentRoute;
}

export function getCurrentParams() {
  return currentParams;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!api.accessToken;
}

/**
 * Route guard
 */
function checkAuth(config) {
  if (config.auth && !isAuthenticated()) {
    navigateTo('/login');
    return false;
  }
  if (config.guestOnly && isAuthenticated()) {
    navigateTo('/');
    return false;
  }
  return true;
}

/**
 * Render page
 */
async function renderPage() {
  const { config, params, query } = parseHash();

  // Auth check
  if (!checkAuth(config)) {
    return;
  }

  currentRoute = config;
  currentParams = params;

  // Update document title
  document.title = `TecniBuy - ${config.title}`;

  // Update active nav link
  updateActiveNav(config.page);

  // Load page module
  try {
    const module = await import(`./pages/${config.page}.js`);
    if (module.render) {
      await module.render(params, query);
    }
  } catch (error) {
    console.error(`Error loading page ${config.page}:`, error);
    showError('Error al cargar la página');
  }
}

/**
 * Update active navigation link
 */
function updateActiveNav(page) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });
}

/**
 * Show error message
 */
function showError(message) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="error-state">
      <p>⚠️ ${message}</p>
      <button class="btn btn-primary" onclick="window.location.hash='#/'">Volver al inicio</button>
    </div>
  `;
}

/**
 * Initialize router
 */
export function initRouter() {
  window.addEventListener('hashchange', renderPage);
  window.addEventListener('DOMContentLoaded', () => {
    api.init();
    renderPage();
  });
}