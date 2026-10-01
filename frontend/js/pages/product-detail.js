/**
 * TecniBuy Product Detail Page
 */

import { api } from '../api.js';
import { navigateTo, showToast, formatPrice, formatDate, formatRelativeTime, showConfirm } from '../app.js';
import { getCurrentParams } from '../router.js';

export async function render(params) {
  const app = document.getElementById('app');
  const productId = params.id;

  // Show loading
  app.innerHTML = `
    <section class="product-detail-page" aria-labelledby="product-title">
      <div class="container">
        <div class="loading-placeholder" style="text-align: center; padding: 4rem;">
          <div class="spinner" style="margin: 0 auto 1rem;"></div>
          <p>Cargando producto...</p>
        </div>
      </div>
    </section>
  `;

  try {
    const [productRes, ratingsRes, meRes] = await Promise.allSettled([
      api.getProduct(productId),
      api.getProductRatingsSummary(productId),
      api.accessToken ? api.getMe() : Promise.resolve(null),
    ]);

    if (productRes.status === 'rejected') {
      throw new Error(productRes.reason.message || 'Error al cargar producto');
    }

    const product = productRes.value;
    const ratingsSummary = ratingsRes.status === 'fulfilled' ? ratingsRes.value : { average: 0, count: 0, distribution: {} };
    const currentUser = meRes.status === 'fulfilled' ? meRes.value : null;

    // Load seller info
    const seller = await api.getPublicUser(product.seller_id).catch(() => null);

    // Update seller in ratingsRes if needed
    renderProductDetail(product, ratingsSummary, seller, currentUser);
  } catch (error) {
    console.error('Error loading product:', error);
    app.innerHTML = `
      <section class="product-detail-page">
        <div class="container">
          <div class="error-state">
            <p>⚠️ ${error.message}</p>
            <a href="#/productos" class="btn btn-primary">Volver a productos</a>
          </div>
        </div>
      </section>
    `;
  }
}

function renderProductDetail(product, ratingsSummary, seller, currentUser) {
  const app = document.getElementById('app');

  // We'll check ownership differently - store user ID in app
  let currentUserId = null;
  if (api.accessToken) {
    try {
      const payload = JSON.parse(atob(api.accessToken.split('.')[1]));
      currentUserId = parseInt(payload.sub);
    } catch {}
  }
  const isOwnerCheck = currentUserId === product.seller_id;
  // Admin can only delete listings (not edit them), and only for products
  // they don't already own (owners get the normal owner actions above).
  const isAdmin = !isOwnerCheck && currentUser && currentUser.role === 'admin';

  const images = product.images.length > 0 ? product.images : [{ url: '/assets/placeholder-product.svg', alt: product.title }];

  app.innerHTML = `
    <section class="product-detail-page" aria-labelledby="product-title">
      <div class="container">
        <!-- Breadcrumb -->
        <nav class="breadcrumb" aria-label="Navegación">
          <ol>
            <li><a href="#/">Inicio</a></li>
            <li><a href="#/productos">Productos</a></li>
            <li aria-current="page">${escapeHtml(product.title)}</li>
          </ol>
        </nav>

        <div class="product-detail-grid">
          <!-- Gallery -->
          <div class="product-gallery">
            <div class="main-image" id="main-image">
              <img src="${images[0].url}" alt="${escapeHtml(images[0].alt || product.title)}" id="main-img">
            </div>
            ${images.length > 1 ? `
              <div class="thumbnails" id="thumbnails" role="group" aria-label="Imágenes del producto">
                ${images.map((img, i) => `
                  <button class="thumbnail ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Imagen ${i + 1}" aria-pressed="${i === 0}">
                    <img src="${img.url}" alt="${escapeHtml(img.alt || `Imagen ${i + 1}`)}">
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Info -->
          <div class="product-info-main">
            <header class="product-header">
              <span class="product-condition">${getConditionLabel(product.condition)}</span>
              <h1 id="product-title" class="product-title">${escapeHtml(product.title)}</h1>
              <div class="product-meta">
                <span>${product.views} vistas</span>
                <span>•</span>
                <span>Publicado ${formatRelativeTime(product.created_at)}</span>
                ${product.updated_at !== product.created_at ? `<span>•</span><span>Actualizado ${formatRelativeTime(product.updated_at)}</span>` : ''}
              </div>
            </header>

            <div class="product-price-main">${formatPrice(product.price)}</div>

            ${ratingsSummary.count > 0 ? `
              <div class="product-rating-summary">
                <div class="rating-stars" aria-label="${ratingsSummary.average.toFixed(1)} de 5 estrellas">
                  ${renderStars(ratingsSummary.average)}
                </div>
                <span class="rating-text">${ratingsSummary.average.toFixed(1)} (${ratingsSummary.count} valoraciones)</span>
              </div>
            ` : ''}

            <div class="product-description">
              <h3>Descripción</h3>
              <div class="description-text">${formatDescription(product.description)}</div>
            </div>

            <div class="product-details">
              <dl>
                <dt>Estado</dt>
                <dd>${getConditionLabel(product.condition)}</dd>
                <dt>Stock disponible</dt>
                <dd>${product.stock} ${product.stock === 1 ? 'unidad' : 'unidades'}</dd>
              </dl>
            </div>

            <!-- Seller Info -->
            ${seller ? `
              <div class="seller-card card">
                <div class="seller-header">
                  <div class="seller-avatar" aria-hidden="true">${seller.avatar ? '🖼️' : '👤'}</div>
                  <div class="seller-info">
                    <h3>Vendido por <a href="#/usuario/${seller.id}">${escapeHtml(seller.username)}</a></h3>
                    <p class="seller-meta">Usuario desde ${formatDate(seller.created_at)}</p>
                  </div>
                </div>
                ${!isOwnerCheck ? `
                  <div class="seller-actions">
                    <button class="btn btn-primary" id="chat-btn" data-seller-id="${seller.id}" data-product-id="${product.id}">
                      💬 Contactar
                    </button>
                  </div>
                ` : ''}
              </div>
            ` : ''}

            <!-- Actions -->
            <div class="product-actions">
              ${isOwnerCheck ? `
                <div class="action-buttons owner-actions">
                  <a href="#/productos/editar/${product.id}" class="btn btn-secondary btn-lg">✏️ Editar</a>
                  <button class="btn btn-danger btn-lg" id="delete-product-btn" data-product-id="${product.id}">🗑️ Eliminar</button>
                </div>
              ` : isAdmin ? `
                <div class="action-buttons owner-actions">
                  <button class="btn btn-danger btn-lg" id="delete-product-btn" data-product-id="${product.id}">🗑️ Eliminar (admin)</button>
                </div>
              ` : product.status !== 'active' || product.stock <= 0 ? `
                <div class="action-buttons">
                  <button class="btn btn-primary btn-lg btn-block" disabled>
                    ${product.status === 'sold' ? '✅ Vendido' : '❌ No disponible'}
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Ratings Section -->
        <section class="ratings-section" aria-labelledby="ratings-title">
          <div class="container">
            <h2 id="ratings-title">Valoraciones</h2>
            <div id="ratings-container">
              ${renderRatingsSummary(ratingsSummary)}
              <div id="ratings-list"></div>
            </div>
          </div>
        </section>
      </div>
    </section>
  `;

  // Setup interactions
  setupGallery(images);
  setupDeleteProduct(product.id, isOwnerCheck);
  setupChatButton();
  loadRatings(product.id);
}

function setupGallery(images) {
  const mainImg = document.getElementById('main-img');
  const thumbnails = document.querySelectorAll('.thumbnail');

  thumbnails.forEach(thumb => {
    thumb.addEventListener('click', () => {
      const index = parseInt(thumb.dataset.index);
      if (images[index]) {
        mainImg.src = images[index].url;
        mainImg.alt = images[index].alt || `Imagen ${index + 1}`;
        thumbnails.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-pressed', 'false');
        });
        thumb.classList.add('active');
        thumb.setAttribute('aria-pressed', 'true');
      }
    });
  });
}

function setupDeleteProduct(productId, isOwnerCheck) {
  const btn = document.getElementById('delete-product-btn');
  if (!btn) return;
  const originalLabel = btn.innerHTML;

  btn.addEventListener('click', async () => {
    const confirmed = await showConfirm('¿Eliminar este producto? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Eliminando...';

    try {
      await api.deleteProduct(productId);
      showToast('Producto eliminado', 'success');
      // Owners land back on their listings; an admin deleting someone
      // else's product goes to the general product list instead.
      navigateTo(isOwnerCheck ? '/mis-productos' : '/productos');
    } catch (error) {
      showToast(error.message, 'error');
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  });
}

function setupChatButton() {
  const btn = document.getElementById('chat-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const sellerId = parseInt(btn.dataset.sellerId, 10);
    const productId = btn.dataset.productId;

    btn.disabled = true;
    const originalLabel = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Abriendo chat...';

    try {
      // /chat/:id expects a conversation id, not a user id, so we
      // create-or-get the conversation with the seller first.
      const conv = await api.createConversation(sellerId);
      navigateTo(`/chat/${conv.id}?product=${productId}`);
    } catch (error) {
      showToast(error.message, 'error');
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  });
}

async function loadRatings(productId) {
  const container = document.getElementById('ratings-list');
  if (!container) return;

  try {
    const data = await api.getProductRatings(productId, 1, 10);
    if (data.length > 0) {
      container.innerHTML = data.map(rating => renderRating(rating)).join('');
    } else {
      container.innerHTML = '<p class="form-help" style="text-align: center; padding: 2rem;">Sin valoraciones aún</p>';
    }
  } catch (error) {
    container.innerHTML = '<p class="error-state">Error al cargar valoraciones</p>';
  }
}

function renderRatingsSummary(summary) {
  if (summary.count === 0) return '';

  return `
    <div class="ratings-summary card">
      <div class="rating-overview">
        <div class="rating-big">${summary.average.toFixed(1)}</div>
        <div class="rating-stars-large" aria-label="${summary.average.toFixed(1)} de 5 estrellas">
          ${renderStars(summary.average, true)}
        </div>
        <p>${summary.count} valoraciones</p>
      </div>
      <div class="rating-bars">
        ${[5,4,3,2,1].map(stars => {
          const count = summary.distribution[stars] || 0;
          const percentage = summary.count > 0 ? (count / summary.count) * 100 : 0;
          return `
            <div class="rating-bar-row">
              <span>${stars} ★</span>
              <div class="rating-bar"><div class="rating-bar-fill" style="width: ${percentage}%"></div></div>
              <span>${count}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderRating(rating) {
  return `
    <article class="rating-card card">
      <header class="rating-header">
        <div class="rating-user">
          <span class="rating-avatar" aria-hidden="true">👤</span>
          <span class="rating-username">${escapeHtml(rating.username)}</span>
        </div>
        <div class="rating-meta">
          <span class="rating-stars">${renderStars(rating.rating)}</span>
          <time>${formatDate(rating.created_at)}</time>
        </div>
      </header>
      ${rating.comment ? `<p class="rating-comment">${escapeHtml(rating.comment)}</p>` : ''}
    </article>
  `;
}

function renderStars(value, large = false) {
  const fullStars = Math.floor(value);
  const hasHalf = value % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  let html = '';
  for (let i = 0; i < fullStars; i++) html += large ? '★' : '★';
  if (hasHalf) html += large ? '½' : '★';
  for (let i = 0; i < emptyStars; i++) html += large ? '☆' : '☆';
  return html;
}

function getConditionLabel(condition) {
  const labels = {
    'new': '🆕 Nuevo',
    'used': '🔧 Usado',
    'refurbished': '♻️ Reacondicionado',
  };
  return labels[condition] || condition;
}

function formatDescription(text) {
  // Convert line breaks to paragraphs
  return text.split('\n\n').map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}