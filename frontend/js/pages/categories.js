/**
 * TecniBuy Categories Page
 * Category tree navigation
 */

import { api } from '../api.js';
import { navigateTo, showToast, formatPrice } from '../app.js';

export async function render() {
  const app = document.getElementById('app');

  // Load categories
const categories = await api.listCategories(true).catch(() => []);

  app.innerHTML = `
    <section class="categories-page" aria-labelledby="categories-title">
      <div class="container">
        <header class="page-header">
          <h1 id="categories-title" class="page-title">Categorías</h1>
          <p class="page-subtitle">Explorá productos por categoría</p>
        </header>

        <div class="categories-grid" role="list" aria-label="Lista de categorías">
          ${renderCategoryTree(categories, 0).map(cat => renderCategoryCard(cat)).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderCategoryTree(categories, parentId = 0, level = 0) {
  return categories
    .filter(cat => cat.parent_id === parentId)
    .map(cat => ({
      ...cat,
      level,
      children: renderCategoryTree(categories, cat.id, level + 1),
    }));
}

function renderCategoryCard(category) {
  const icon = getCategoryIcon(category.name);
  const hasChildren = category.children && category.children.length > 0;

  return `
    <article class="category-card card" role="listitem" data-category-id="${category.id}" style="--level: ${category.level}">
      <a href="#/productos?category_id=${category.id}" class="category-link">
        <div class="category-icon" aria-hidden="true">${icon}</div>
        <div class="category-info">
          <h3 class="category-name">${escapeHtml(category.name)}</h3>
          ${hasChildren ? `
            <p class="category-subcount">
              ${category.children.length} subcategor${category.children.length === 1 ? 'ía' : 'ías'}
            </p>
          ` : ''}
        </div>
        ${hasChildren ? `
          <button class="category-expand" aria-label="Expandir ${escapeHtml(category.name)}" aria-expanded="false">▼</button>
        ` : ''}
      </a>
      ${hasChildren ? `
        <div class="category-children" role="group" aria-label="Subcategorías de ${escapeHtml(category.name)}">
          ${category.children.map(child => renderCategoryCard(child)).join('')}
        </div>
      ` : ''}
    </article>
  `;
}

function getCategoryIcon(name) {
  const icons = {
    'electrónica': '📱', 'electronica': '📱', 'tecnología': '💻', 'tecnologia': '💻',
    'celulares': '📱', 'computadoras': '💻', 'audio': '🎧', 'gaming': '🎮',
    'ropa': '👕', 'calzado': '👟', 'accesorios': '👜', 'moda': '👗',
    'hogar': '🏠', 'decoración': '🕯️', 'decoracion': '🕯️', 'muebles': '🛋️',
    'jardín': '🌱', 'jardin': '🌱', 'herramientas': '🔧', 'autos': '🚗',
    'deportes': '⚽', 'juguetes': '🧸', 'libros': '📚', 'música': '🎵', 'musica': '🎵',
  };
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(icons)) {
    if (lower.includes(key)) return icon;
  }
  return '📦';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}