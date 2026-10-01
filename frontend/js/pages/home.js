/**
 * TecniBuy Home Page
 * Landing page with featured products, categories, and CTA
 */

import { api } from '../api.js';
import { formatPrice, showToast } from '../app.js';

export async function render() {
  const app = document.getElementById('app');

  // Load featured products and categories in parallel
  const [productsRes, categoriesRes] = await Promise.allSettled([
    api.listProducts({ page_size: 8, sort: 'newest' }),
    api.listCategories(),
  ]);

  const featuredProducts = productsRes.status === 'fulfilled' ? productsRes.value.items : [];
  const categories = categoriesRes.status === 'fulfilled' ? categoriesRes.value : [];

  // Filter top-level categories (no parent)
  const topCategories = categories.filter(c => !c.parent_id).slice(0, 6);

  app.innerHTML = `
    <section class="hero" aria-labelledby="hero-title">
      <div class="container">
        <h1 id="hero-title" class="hero-title">Tu marketplace de confianza 🇦🇷</h1>
        <p class="hero-subtitle">Comprá y vendé con seguridad. Productos nuevos y usados, envíos a todo el país.</p>
        <div class="hero-actions">
          <a href="#/productos" class="btn btn-primary btn-lg">Explorar productos</a>
          <a href="#/productos/nuevo" class="btn btn-secondary btn-lg">Publicar gratis</a>
        </div>
      </div>
    </section>

    <section class="categories-section" aria-labelledby="categories-title">
      <div class="container">
        <header class="section-header">
          <h2 id="categories-title" class="section-title">Categorías populares</h2>
          <a href="#/categorias" class="section-link">Ver todas →</a>
        </header>
        <div class="categories-grid grid grid-auto">
          ${topCategories.map(cat => `
            <a href="#/productos?category_id=${cat.id}" class="category-card card" aria-label="${cat.name}">
              <div class="category-icon" aria-hidden="true">${getCategoryIcon(cat.slug)}</div>
              <h3 class="category-name">${cat.name}</h3>
            </a>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="featured-section" aria-labelledby="featured-title">
      <div class="container">
        <header class="section-header">
          <h2 id="featured-title" class="section-title">Recién publicados</h2>
          <a href="#/productos?sort=newest" class="section-link">Ver todos →</a>
        </header>
        ${featuredProducts.length > 0 ? `
          <div class="products-grid grid grid-auto">
            ${featuredProducts.map(product => renderProductCard(product)).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <p>📭 No hay productos publicados aún</p>
            <a href="#/productos/nuevo" class="btn btn-primary">Sé el primero en publicar</a>
          </div>
        `}
      </div>
    </section>

    <section class="features-section" aria-labelledby="features-title">
      <div class="container">
        <h2 id="features-title" class="visually-hidden">Por qué elegir TecniBuy</h2>
        <div class="features-grid grid grid-3">
          <article class="feature-card card">
            <div class="feature-icon" aria-hidden="true">🔒</div>
            <h3>Seguridad ante todo</h3>
            <p>Chat cifrado de extremo a extremo, verificación de usuarios y sistema de reputación.</p>
          </article>
          <article class="feature-card card">
            <div class="feature-icon" aria-hidden="true">🚚</div>
            <h3>Envíos a todo el país</h3>
            <p>Coordiná la entrega como prefieras: envío, retiro en persona o punto de encuentro.</p>
          </article>
          <article class="feature-card card">
            <div class="feature-icon" aria-hidden="true">💬</div>
            <h3>Chat directo</h3>
            <p>Hablá con vendedores y compradores en tiempo real, sin intermediarios.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="cta-section" aria-labelledby="cta-title">
      <div class="container">
        <div class="cta-card card">
          <h2 id="cta-title">¿Tenés algo para vender?</h2>
          <p>Publicá tu primer producto en minutos. Gratis, fácil y sin comisiones ocultas.</p>
          <a href="#/productos/nuevo" class="btn btn-primary btn-lg">Publicar ahora</a>
        </div>
      </div>
    </section>
  `;
}

function getCategoryIcon(slug) {
  const icons = {
    'electronica': '📱',
    'ropa-accesorios': '👕',
    'hogar-jardin': '🏠',
    'deportes': '⚽',
    'libros-peliculas': '📚',
    'juguetes': '🧸',
    'salud-belleza': '💄',
    'automoviles': '🚗',
  };
  return icons[slug] || '📦';
}

function renderProductCard(product) {
  const imageUrl = product.main_image?.url || '/assets/placeholder-product.svg';
  return `
    <article class="product-card card" data-product-id="${product.id}">
      <a href="#/producto/${product.id}" class="product-card-link">
        <div class="product-image">
          <img src="${imageUrl}" alt="${product.title}" loading="lazy">
          <span class="product-condition">${getConditionLabel(product.condition)}</span>
        </div>
        <div class="product-info">
          <h3 class="product-title">${product.title}</h3>
          <p class="product-price">${formatPrice(product.price)}</p>
          <p class="product-meta">${product.views} vistas · ${formatRelativeTime(product.created_at)}</p>
        </div>
      </a>
    </article>
  `;
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