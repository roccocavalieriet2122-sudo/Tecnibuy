/**
 * TecniBuy Products Listing Page
 * Product search, filters, pagination
 */

import { api } from '../api.js';
import { formatPrice, showToast, debounce } from '../app.js';
import { getCurrentParams, getCurrentRoute, navigateTo } from '../router.js';

let currentPage = 1;
let currentFilters = {};
let debouncedSearch = null;

export async function render(params, query) {
  const app = document.getElementById('app');

  // Initialize filters from URL params
  currentPage = parseInt(query.get('page')) || 1;
  currentFilters = {
    q: query.get('q') || '',
    category_id: query.get('category_id') || '',
    min_price: query.get('min_price') || '',
    max_price: query.get('max_price') || '',
    condition: query.get('condition') || '',
    sort: query.get('sort') || 'newest',
  };

  // Load initial data
  const [productsRes, categoriesRes] = await Promise.allSettled([
    api.listProducts({ ...currentFilters, page: currentPage, page_size: 20 }),
    api.listCategories(true), // flat list for filter dropdown
  ]);

  const productsData = productsRes.status === 'fulfilled' ? productsRes.value : { items: [], total: 0, page: 1, page_size: 20, total_pages: 1 };
  const categories = categoriesRes.status === 'fulfilled' ? categoriesRes.value : [];

  app.innerHTML = `
    <section class="products-page" aria-labelledby="products-title">
      <div class="container">
        <header class="page-header">
          <h1 id="products-title" class="page-title">Productos</h1>
          <p class="page-subtitle">${productsData.total} productos encontrados</p>
        </header>

        <div class="products-layout">
          <!-- Sidebar Filters -->
          <aside class="filters-sidebar" id="filters-sidebar" aria-label="Filtros">
            <div class="filters-header">
              <h2>Filtros</h2>
              <button class="btn btn-ghost btn-sm" id="clear-filters" ${productsData.total === 0 ? 'disabled' : ''}>Limpiar</button>
            </div>

            <form id="filters-form" class="filters-form">
              <div class="form-group">
                <label for="search-input" class="form-label">Buscar</label>
                <input type="search" id="search-input" name="q" class="form-input" placeholder="Qué buscás..." value="${escapeHtml(currentFilters.q)}" aria-describedby="search-hint">
                <p id="search-hint" class="form-help">Busca por título o descripción</p>
              </div>

              <div class="form-group">
                <label for="category-filter" class="form-label">Categoría</label>
                <select id="category-filter" name="category_id" class="form-input">
                  <option value="">Todas las categorías</option>
                  ${categories.map(cat => `
                    <option value="${cat.id}" ${currentFilters.category_id == cat.id ? 'selected' : ''}>
                      ${cat.parent_id ? '↳ ' : ''}${escapeHtml(cat.name)}
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="min-price" class="form-label">Precio mín.</label>
                  <input type="number" id="min-price" name="min_price" class="form-input" placeholder="0" min="0" step="0.01" value="${escapeHtml(currentFilters.min_price)}">
                </div>
                <div class="form-group">
                  <label for="max-price" class="form-label">Precio máx.</label>
                  <input type="number" id="max-price" name="max_price" class="form-input" placeholder="∞" min="0" step="0.01" value="${escapeHtml(currentFilters.max_price)}">
                </div>
              </div>

              <div class="form-group">
                <label for="condition-filter" class="form-label">Estado</label>
                <select id="condition-filter" name="condition" class="form-input">
                  <option value="">Todos</option>
                  <option value="new" ${currentFilters.condition === 'new' ? 'selected' : ''}>Nuevo</option>
                  <option value="used" ${currentFilters.condition === 'used' ? 'selected' : ''}>Usado</option>
                  <option value="refurbished" ${currentFilters.condition === 'refurbished' ? 'selected' : ''}>Reacondicionado</option>
                </select>
              </div>

              <div class="form-group">
                <label for="sort-filter" class="form-label">Ordenar por</label>
                <select id="sort-filter" name="sort" class="form-input">
                  <option value="newest" ${currentFilters.sort === 'newest' ? 'selected' : ''}>Más recientes</option>
                  <option value="oldest" ${currentFilters.sort === 'oldest' ? 'selected' : ''}>Más antiguos</option>
                  <option value="price_asc" ${currentFilters.sort === 'price_asc' ? 'selected' : ''}>Precio: menor a mayor</option>
                  <option value="price_desc" ${currentFilters.sort === 'price_desc' ? 'selected' : ''}>Precio: mayor a menor</option>
                  <option value="views" ${currentFilters.sort === 'views' ? 'selected' : ''}>Más vistos</option>
                </select>
              </div>
            </form>
          </aside>

          <!-- Main Products Grid -->
          <main class="products-main" role="main">
            <div class="products-toolbar">
              <div class="results-info" aria-live="polite">
                <span id="results-count">Mostrando ${productsData.items.length} de ${productsData.total} productos</span>
              </div>
              <div class="view-toggle" role="group" aria-label="Vista">
                <button class="view-btn active" data-view="grid" aria-label="Vista cuadrícula" aria-pressed="true">⊞</button>
                <button class="view-btn" data-view="list" aria-label="Vista lista" aria-pressed="false">☰</button>
              </div>
            </div>

            <div id="products-container" class="products-grid grid grid-auto" role="list" aria-label="Lista de productos">
              ${productsData.items.length > 0
                ? productsData.items.map(product => renderProductCard(product)).join('')
                : '<div class="empty-state" style="grid-column: 1/-1;"><p>📭 No se encontraron productos</p><p class="form-help">Probá con otros filtros o términos de búsqueda</p></div>'
              }
            </div>

            <!-- Pagination -->
            ${productsData.total_pages > 1 ? renderPagination(productsData) : ''}
          </main>
        </div>
      </div>
    </section>
  `;

  setupFilters();
  setupViewToggle();
  setupPagination(productsData);
}

function renderProductCard(product) {
  const imageUrl = product.main_image?.url || '/assets/placeholder-product.svg';
  return `
    <article class="product-card card" role="listitem" data-product-id="${product.id}">
      <a href="#/producto/${product.id}" class="product-card-link">
        <div class="product-image">
          <img src="${imageUrl}" alt="${escapeHtml(product.title)}" loading="lazy">
          <span class="product-condition">${getConditionLabel(product.condition)}</span>
        </div>
        <div class="product-info">
          <h3 class="product-title">${escapeHtml(product.title)}</h3>
          <p class="product-price">${formatPrice(product.price)}</p>
          <p class="product-meta">${product.views} vistas · ${formatRelativeTime(product.created_at)}</p>
        </div>
      </a>
    </article>
  `;
}

function renderPagination(data) {
  const { page, total_pages } = data;
  let pages = [];

  // Always show first page
  pages.push(1);

  // Show pages around current page
  const start = Math.max(2, page - 1);
  const end = Math.min(total_pages - 1, page + 1);

  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total_pages - 1) pages.push('...');

  // Always show last page
  if (total_pages > 1) pages.push(total_pages);

  return `
    <nav class="pagination" aria-label="Paginación">
      <button class="pagination-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Página anterior">«</button>
      ${pages.map(p => {
        if (p === '...') return '<span class="pagination-ellipsis" aria-hidden="true">…</span>';
        return `<button class="pagination-btn ${p === page ? 'active' : ''}" data-page="${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`;
      }).join('')}
      <button class="pagination-btn" data-page="${page + 1}" ${page === total_pages ? 'disabled' : ''} aria-label="Página siguiente">»</button>
    </nav>
  `;
}

function setupFilters() {
  const form = document.getElementById('filters-form');
  const clearBtn = document.getElementById('clear-filters');
  const searchInput = document.getElementById('search-input');

  // Debounced search
  debouncedSearch = debounce(() => {
    applyFilters();
  }, 300);

  // Form inputs
  form.querySelectorAll('input, select').forEach(input => {
    if (input.type === 'search' || input.name === 'q') {
      input.addEventListener('input', debouncedSearch);
    } else {
      input.addEventListener('change', applyFilters);
    }
  });

  // Clear filters
  clearBtn.addEventListener('click', () => {
    form.reset();
    currentFilters = {
      q: '',
      category_id: '',
      min_price: '',
      max_price: '',
      condition: '',
      sort: 'newest',
    };
    currentPage = 1;
    applyFilters();
  });

  // Search input Enter key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      debouncedSearch.cancel();
      applyFilters();
    }
  });
}

function applyFilters() {
  const form = document.getElementById('filters-form');
  const formData = new FormData(form);

  currentFilters = {
    q: formData.get('q') || '',
    category_id: formData.get('category_id') || '',
    min_price: formData.get('min_price') || '',
    max_price: formData.get('max_price') || '',
    condition: formData.get('condition') || '',
    sort: formData.get('sort') || 'newest',
  };

  currentPage = 1;
  updateURL();
  loadProducts();
}

function updateURL() {
  const params = new URLSearchParams();
  Object.entries(currentFilters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set('page', currentPage);
  navigateTo(`/productos?${params.toString()}`);
}

async function loadProducts() {
  const container = document.getElementById('products-container');
  const countEl = document.getElementById('results-count');

  // Show loading
  container.innerHTML = '<div class="loading-placeholder" style="grid-column: 1/-1;"><div class="spinner" style="margin: 2rem auto;"></div><p>Cargando...</p></div>';

  try {
    const data = await api.listProducts({ ...currentFilters, page: currentPage, page_size: 20 });

    if (data.items.length > 0) {
      container.innerHTML = data.items.map(product => renderProductCard(product)).join('');
    } else {
      container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p>📭 No se encontraron productos</p><p class="form-help">Probá con otros filtros o términos de búsqueda</p></div>';
    }

    if (countEl) {
      countEl.textContent = `Mostrando ${data.items.length} de ${data.total} productos`;
    }

    // Update pagination
    const paginationContainer = document.querySelector('.pagination');
    if (paginationContainer) {
      paginationContainer.outerHTML = renderPagination(data);
      setupPagination(data);
    } else if (data.total_pages > 1) {
      // Insert pagination if it didn't exist
      const main = document.querySelector('.products-main');
      main.insertAdjacentHTML('beforeend', renderPagination(data));
      setupPagination(data);
    }

  } catch (error) {
    console.error('Error loading products:', error);
    container.innerHTML = '<div class="error-state" style="grid-column: 1/-1;"><p>⚠️ Error al cargar productos</p><button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div>';
    showToast('Error al cargar productos', 'error');
  }
}

function setupPagination(data) {
  document.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page);
      if (page && page !== currentPage && page >= 1 && page <= data.total_pages) {
        currentPage = page;
        updateURL();
        loadProducts();
        // Scroll to top of products
        document.querySelector('.products-main').scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

function setupViewToggle() {
  const container = document.getElementById('products-container');
  const gridBtn = document.querySelector('[data-view="grid"]');
  const listBtn = document.querySelector('[data-view="list"]');

  if (!gridBtn || !listBtn) return;

  gridBtn.addEventListener('click', () => {
    container.classList.remove('products-list');
    container.classList.add('products-grid');
    gridBtn.classList.add('active');
    gridBtn.setAttribute('aria-pressed', 'true');
    listBtn.classList.remove('active');
    listBtn.setAttribute('aria-pressed', 'false');
  });

  listBtn.addEventListener('click', () => {
    container.classList.remove('products-grid');
    container.classList.add('products-list');
    listBtn.classList.add('active');
    listBtn.setAttribute('aria-pressed', 'true');
    gridBtn.classList.remove('active');
    gridBtn.setAttribute('aria-pressed', 'false');
  });
}

function getConditionLabel(condition) {
  const labels = {
    'new': 'Nuevo',
    'used': 'Usado',
    'refurbished': 'Reacondicionado',
  };
  return labels[condition] || condition;
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} hs`;
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString('es-AR');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}