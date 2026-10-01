/**
 * TecniBuy My Products Page
 * User's product management
 */

import { api } from '../api.js';
import { navigateTo, showToast, formatPrice, formatRelativeTime, showConfirm } from '../app.js';
import { getCurrentParams, getCurrentRoute } from '../router.js';

let currentPage = 1;
let currentFilters = { status: '' };
let myProductsData = null;

export async function render(params, query) {
  const app = document.getElementById('app');

  currentPage = parseInt(query.get('page')) || 1;
  currentFilters.status = query.get('status') || '';

  // Show loading
  app.innerHTML = `
    <section class="my-products-page" aria-labelledby="my-products-title">
      <div class="container">
        <div class="loading-placeholder" style="text-align: center; padding: 4rem;">
          <div class="spinner" style="margin: 0 auto 1rem;"></div>
          <p>Cargando tus productos...</p>
        </div>
      </div>
    </section>
  `;

  try {
    const data = await api.getMyProducts({ page: currentPage, page_size: 10, status: currentFilters.status });
    myProductsData = data;
    renderMyProducts(data);
  } catch (error) {
    console.error('Error loading my products:', error);
    app.innerHTML = `
      <section class="my-products-page">
        <div class="container">
          <div class="error-state">
            <p>⚠️ Error al cargar productos: ${error.message}</p>
            <a href="#/" class="btn btn-primary">Volver al inicio</a>
          </div>
        </div>
      </section>
    `;
  }
}

function renderMyProducts(data) {
  const app = document.getElementById('app');

  app.innerHTML = `
    <section class="my-products-page" aria-labelledby="my-products-title">
      <div class="container">
        <header class="page-header page-header-actions">
          <div>
            <h1 id="my-products-title" class="page-title">Mis productos</h1>
            <p class="page-subtitle">${data.total} publicación${data.total !== 1 ? 'es' : ''} en total</p>
          </div>
          <a href="#/productos/nuevo" class="btn btn-primary btn-lg">➕ Publicar producto</a>
        </header>

        <!-- Status Filters -->
        <div class="status-filters" role="group" aria-label="Filtrar por estado">
          ${['active', 'sold', 'deleted'].map(status => `
            <a href="#/mis-productos?status=${status}" class="status-filter ${currentFilters.status === status ? 'active' : ''}"
               data-status="${status}">
              ${getStatusLabel(status)} <span class="filter-count">${getStatusCount(data, status)}</span>
            </a>
          `).join('')}
          <a href="#/mis-productos" class="status-filter ${!currentFilters.status ? 'active' : ''}" data-status="">Todos <span class="filter-count">${data.total}</span></a>
        </div>

        <!-- Products Grid -->
        <div id="products-container" class="my-products-grid grid grid-auto" role="list" aria-label="Tus productos">
          ${data.items.length > 0
            ? data.items.map(product => renderMyProductCard(product)).join('')
            : '<div class="empty-state" style="grid-column: 1/-1;"><p>📭 No tenés productos en este estado</p><a href="#/productos/nuevo" class="btn btn-primary">Publicar tu primer producto</a></div>'
          }
        </div>

        <!-- Pagination -->
        ${data.total_pages > 1 ? renderPagination(data) : ''}
      </div>
    </section>
  `;

  setupActions();
  setupPagination(data);
}

function renderMyProductCard(product) {
  const imageUrl = product.main_image?.url || '/assets/placeholder-product.svg';
  const statusClass = `status-${product.status}`;

  return `
    <article class="my-product-card card" role="listitem" data-product-id="${product.id}">
      <div class="my-product-image">
        <img src="${imageUrl}" alt="${escapeHtml(product.title)}" loading="lazy">
        <span class="my-product-status ${statusClass}" aria-label="Estado: ${getStatusLabel(product.status)}">${getStatusLabel(product.status)}</span>
      </div>
      <div class="my-product-info">
        <h3 class="my-product-title">${escapeHtml(product.title)}</h3>
        <p class="my-product-price">${formatPrice(product.price)}</p>
        <div class="my-product-meta">
          <span>${product.views} vistas</span>
          <span>•</span>
          <span>Stock: ${product.stock}</span>
          <span>•</span>
          <span>${formatRelativeTime(product.created_at)}</span>
        </div>
        <div class="my-product-actions">
          ${product.status === 'active' ? `
            <a href="#/productos/editar/${product.id}" class="btn btn-secondary btn-sm">✏️ Editar</a>
            <button class="btn btn-danger btn-sm delete-product-btn" data-product-id="${product.id}" aria-label="Eliminar ${escapeHtml(product.title)}">🗑️ Eliminar</button>
          ` : product.status === 'sold' ? `
            <span class="status-badge sold">✅ Vendido</span>
            <button class="btn btn-danger btn-sm delete-product-btn" data-product-id="${product.id}" aria-label="Eliminar ${escapeHtml(product.title)}">🗑️ Eliminar</button>
          ` : `
            <span class="status-badge deleted">🗑️ Eliminado</span>
          `}
        </div>
      </div>
    </article>
  `;
}

function getStatusLabel(status) {
  const labels = {
    'active': '✅ Activo',
    'sold': '✅ Vendido',
    'deleted': '🗑️ Eliminado',
  };
  return labels[status] || status;
}

function getStatusCount(data, status) {
  // Since we don't have counts per status in the response, show dash
  // In a real app, we'd have this data from the API
  return '';
}

function renderPagination(data) {
  const { page, total_pages } = data;
  let pages = [];

  pages.push(1);
  const start = Math.max(2, page - 1);
  const end = Math.min(total_pages - 1, page + 1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total_pages - 1) pages.push('...');
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

function setupActions() {
  // Delete buttons
  document.querySelectorAll('.delete-product-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const productId = parseInt(btn.dataset.productId);
      const confirmed = await showConfirm('¿Eliminar este producto? Esta acción no se puede deshacer.');
      if (!confirmed) return;

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';

      try {
        await api.deleteProduct(productId);
        showToast('Producto eliminado', 'success');
        // Reload current page
        const data = await api.getMyProducts({ page: currentPage, page_size: 10, status: currentFilters.status });
        myProductsData = data;
        renderMyProducts(data);
      } catch (error) {
        showToast(error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '🗑️ Eliminar';
      }
    });
  });
}

function setupPagination(data) {
  document.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const page = parseInt(btn.dataset.page);
      if (page && page !== currentPage && page >= 1 && page <= data.total_pages) {
        currentPage = page;
        const newQuery = new URLSearchParams();
        if (currentFilters.status) newQuery.set('status', currentFilters.status);
        newQuery.set('page', currentPage);
        navigateTo(`/mis-productos?${newQuery.toString()}`);
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}