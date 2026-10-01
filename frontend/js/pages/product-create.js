/**
 * TecniBuy Product Create/Edit Page
 */

import { api } from '../api.js';
import { navigateTo, showToast, showConfirm, formatPrice } from '../app.js';
import { getCurrentParams, getCurrentRoute } from '../router.js';

let currentProductId = null;
let isEditing = false;
let uploadedImages = [];
let removedImageIds = [];

export async function render(params, query) {
  const app = document.getElementById('app');
  const route = getCurrentRoute();

  isEditing = route.page === 'product-edit';
  currentProductId = params.id;

  // Reset form state on every render. These are module-level variables, so
  // without this reset, images left over from a previous "Publicar
  // producto" session in the same tab would still be attached to the next
  // one. When editing, they get repopulated from the product below.
  uploadedImages = [];
  removedImageIds = [];

  // Load categories for dropdown
  const categories = await api.listCategories(true).catch(() => []);

  // If editing, load product data
  let product = null;
  if (isEditing && currentProductId) {
    try {
      const productRes = await api.getProduct(currentProductId);
      product = productRes;
      uploadedImages = product.images.map(img => ({
        id: img.id,
        object_key: img.object_key,
        url: img.url,
        alt: img.alt,
        position: img.position,
        existing: true,
      }));
    } catch (error) {
      showToast('Error al cargar producto: ' + error.message, 'error');
      navigateTo('/mis-productos');
      return;
    }
  }

  app.innerHTML = `
    <section class="product-form-page" aria-labelledby="form-title">
      <div class="container">
        <header class="page-header">
          <h1 id="form-title" class="page-title">${isEditing ? 'Editar producto' : 'Publicar producto'}</h1>
          <p class="page-subtitle">${isEditing ? 'Modificá los datos de tu publicación' : 'Completá el formulario para publicar tu producto'}</p>
        </header>

        <form id="product-form" class="product-form card" novalidate>
          <!-- Basic Info -->
          <fieldset class="form-section">
            <legend>Información básica</legend>

            <div class="form-group">
              <label for="title" class="form-label">Título *</label>
              <input type="text" id="title" name="title" class="form-input" required
                minlength="3" maxlength="200" value="${escapeHtml(product?.title || '')}"
                placeholder="Ej: iPhone 13 Pro 128GB Azul Sierra" aria-describedby="title-hint title-error">
              <p id="title-hint" class="form-help">Sé descriptivo: marca, modelo, características principales (3-200 caracteres)</p>
              <p id="title-error" class="form-error" aria-live="polite"></p>
            </div>

            <div class="form-group">
              <label for="description" class="form-label">Descripción *</label>
              <textarea id="description" name="description" class="form-input form-textarea" required
                minlength="10" placeholder="Describí el estado, detalles, accesorios incluidos, motivo de venta, etc." aria-describedby="desc-hint desc-error">${escapeHtml(product?.description || '')}</textarea>
              <p id="desc-hint" class="form-help">Mínimo 10 caracteres. Sé honesto y detallado para evitar problemas.</p>
              <p id="desc-error" class="form-error" aria-live="polite"></p>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="category" class="form-label">Categoría *</label>
                <select id="category" name="category_id" class="form-input" required aria-describedby="cat-error">
                  <option value="">Seleccioná una categoría</option>
                  ${categories.map(cat => `
                    <option value="${cat.id}" ${product?.category_id === cat.id ? 'selected' : ''}>
                      ${cat.parent_id ? '— ' : ''}${escapeHtml(cat.name)}
                    </option>
                  `).join('')}
                </select>
                <p id="cat-error" class="form-error" aria-live="polite"></p>
              </div>

              <div class="form-group">
                <label for="condition" class="form-label">Estado *</label>
                <select id="condition" name="condition" class="form-input" required aria-describedby="cond-error">
                  <option value="new" ${product?.condition === 'new' ? 'selected' : ''}>🆕 Nuevo</option>
                  <option value="used" ${product?.condition === 'used' ? 'selected' : ''}>🔧 Usado</option>
                  <option value="refurbished" ${product?.condition === 'refurbished' ? 'selected' : ''}>♻️ Reacondicionado</option>
                </select>
                <p id="cond-error" class="form-error" aria-live="polite"></p>
              </div>
            </div>
          </fieldset>

          <!-- Price & Stock -->
          <fieldset class="form-section">
            <legend>Precio y stock</legend>

            <div class="form-row">
              <div class="form-group">
                <label for="price" class="form-label">Precio (ARS) *</label>
                <div class="input-with-prefix">
                  <span class="input-prefix">$</span>
                  <input type="number" id="price" name="price" class="form-input" required
                    min="0" step="0.01" value="${product?.price || ''}"
                    placeholder="0,00" aria-describedby="price-hint price-error">
                </div>
                <p id="price-hint" class="form-help">Precio final. No incluyas comisiones.</p>
                <p id="price-error" class="form-error" aria-live="polite"></p>
              </div>

              <div class="form-group">
                <label for="stock" class="form-label">Stock *</label>
                <input type="number" id="stock" name="stock" class="form-input" required
                  min="1" max="999" value="${product?.stock || 1}"
                  placeholder="1" aria-describedby="stock-hint stock-error">
                <p id="stock-hint" class="form-help">Unidades disponibles (1-999)</p>
                <p id="stock-error" class="form-error" aria-live="polite"></p>
              </div>
            </div>
          </fieldset>

          <!-- Images -->
          <fieldset class="form-section">
            <legend>Imágenes <span class="form-help" style="font-size: var(--font-size-sm); font-weight: normal;">(máx. 10, 5MB c/u, JPG/PNG/WebP)</span></legend>

            <div class="image-upload-area">
              <div class="upload-zone" id="upload-zone" tabindex="0" role="button" aria-label="Subir imágenes">
                <input type="file" id="image-input" name="images" multiple accept="image/jpeg,image/png,image/webp" hidden aria-label="Seleccionar imágenes">
                <div class="upload-icon" aria-hidden="true">📷</div>
                <p class="upload-text">Arrastrá imágenes aquí o <span class="upload-link">hacé clic para seleccionar</span></p>
                <p class="upload-hint">Máx. 10 imágenes · 5MB cada una · JPG, PNG, WebP</p>
              </div>

              <div class="image-preview-grid" id="image-preview" role="list" aria-label="Imágenes del producto">
                ${uploadedImages.map((img, i) => renderImagePreview(img, i)).join('')}
              </div>

              <p id="image-error" class="form-error" aria-live="polite"></p>
            </div>
          </fieldset>

          <!-- Status (only for editing) -->
          ${isEditing ? `
            <fieldset class="form-section">
              <legend>Estado de la publicación</legend>
              <div class="form-group">
                <label for="status" class="form-label">Estado</label>
                <select id="status" name="status" class="form-input">
                  <option value="active" ${product?.status === 'active' ? 'selected' : ''}>✅ Activo</option>
                  <option value="sold" ${product?.status === 'sold' ? 'selected' : ''}>✅ Vendido</option>
                  <option value="deleted" ${product?.status === 'deleted' ? 'selected' : ''}>🗑️ Eliminado</option>
                </select>
              </div>
            </fieldset>
          ` : ''}

          <!-- Actions -->
          <div class="form-actions">
            <a href="#/mis-productos" class="btn btn-secondary btn-lg">Cancelar</a>
            <button type="submit" class="btn btn-primary btn-lg" id="submit-btn">
              <span class="btn-text">${isEditing ? 'Guardar cambios' : 'Publicar producto'}</span>
              <span class="btn-loading visually-hidden"><span class="spinner"></span> ${isEditing ? 'Guardando...' : 'Publicando...'}</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  `;

  setupForm();
  setupImageUpload();
}

function setupForm() {
  const form = document.getElementById('product-form');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');

  // Validation helpers
  function showError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(`${inputId}-error`);
    if (input) input.setAttribute('aria-invalid', 'true');
    if (errorEl) errorEl.textContent = message;
  }

  function clearError(inputId) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(`${inputId}-error`);
    if (input) input.removeAttribute('aria-invalid');
    if (errorEl) errorEl.textContent = '';
  }

  // Real-time validation
  ['title', 'description', 'category', 'condition', 'price', 'stock'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', () => clearError(id));
      input.addEventListener('blur', () => validateField(id));
    }
  });

  function validateField(id) {
    const input = document.getElementById(id);
    if (!input) return true;

    const value = input.value.trim();

    switch (id) {
      case 'title':
        if (!value) { showError(id, 'El título es obligatorio'); return false; }
        if (value.length < 3) { showError(id, 'Mínimo 3 caracteres'); return false; }
        if (value.length > 200) { showError(id, 'Máximo 200 caracteres'); return false; }
        break;
      case 'description':
        if (!value) { showError(id, 'La descripción es obligatoria'); return false; }
        if (value.length < 10) { showError(id, 'Mínimo 10 caracteres'); return false; }
        break;
      case 'category':
        if (!value) { showError(id, 'Seleccioná una categoría'); return false; }
        break;
      case 'condition':
        if (!value) { showError(id, 'Seleccioná un estado'); return false; }
        break;
      case 'price':
        const price = parseFloat(value);
        if (isNaN(price) || price < 0) { showError(id, 'Precio inválido'); return false; }
        break;
      case 'stock':
        const stock = parseInt(value);
        if (isNaN(stock) || stock < 1) { showError(id, 'Stock inválido (mín. 1)'); return false; }
        if (stock > 999) { showError(id, 'Máximo 999 unidades'); return false; }
        break;
    }
    return true;
  }

  function validateForm() {
    let valid = true;
    let firstInvalidId = null;
    ['title', 'description', 'category', 'condition', 'price', 'stock'].forEach(id => {
      if (!validateField(id)) {
        valid = false;
        if (!firstInvalidId) firstInvalidId = id;
      }
    });
    return { valid, firstInvalidId };
  }

  // Scrolls to and focuses the first field with a validation error, so the
  // person notices it even if the form is taller than the viewport and
  // they're scrolled past it (previously it just looked like nothing
  // happened when they clicked "Publicar").
  function focusFirstError(fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
  }

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const { valid, firstInvalidId } = validateForm();
    if (!valid) {
      focusFirstError(firstInvalidId);
      return;
    }

    const formData = new FormData(form);
    const data = {
      title: formData.get('title').trim(),
      description: formData.get('description').trim(),
      price: parseFloat(formData.get('price')),
      stock: parseInt(formData.get('stock')),
      condition: formData.get('condition'),
      category_id: parseInt(formData.get('category_id')),
    };

    if (isEditing) {
      data.status = formData.get('status') || 'active';
    }

    setLoading(true);

    try {
      let result;
      if (isEditing) {
        result = await api.updateProduct(currentProductId, data);
      } else {
        result = await api.createProduct(data);
        currentProductId = result.id;
      }

      // Upload images
      for (let i = 0; i < uploadedImages.length; i++) {
        const img = uploadedImages[i];
        if (img.file && !img.existing) {
          try {
            const uploadRes = await api.uploadProductImage(currentProductId, img.file, img.alt);
            img.id = uploadRes.id;
            img.object_key = uploadRes.object_key;
            img.url = uploadRes.url;
            img.existing = true;
          } catch (err) {
            console.error('Error uploading image:', err);
          }
        }
      }

      // Delete removed images
      for (const imageId of removedImageIds) {
        try {
          await api.deleteProductImage(currentProductId, imageId);
        } catch (err) {
          console.error('Error deleting image:', err);
        }
      }

      showToast(isEditing ? 'Producto actualizado ✅' : '¡Producto publicado! 🎉', 'success');
      navigateTo('/mis-productos');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    submitBtn.disabled = loading;
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => input.disabled = loading);
    if (loading) {
      btnText.classList.add('visually-hidden');
      btnLoading.classList.remove('visually-hidden');
    } else {
      btnText.classList.remove('visually-hidden');
      btnLoading.classList.add('visually-hidden');
    }
  }
}

function setupImageUpload() {
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('image-input');
  const previewContainer = document.getElementById('image-preview');
  const errorEl = document.getElementById('image-error');

  // Click to upload
  uploadZone.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });

  // Keyboard accessibility
  uploadZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = ''; // Reset to allow same file re-selection
  });

  function handleFiles(files) {
    const fileArray = Array.from(files);
    const validFiles = [];
    const errors = [];

    for (const file of fileArray) {
      const validation = validateImageFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (errors.length > 0) {
      errorEl.textContent = errors.join('; ');
      return;
    }

    errorEl.textContent = '';

    // Check total count
    if (uploadedImages.length + validFiles.length > 10) {
      errorEl.textContent = 'Máximo 10 imágenes permitidas';
      return;
    }

    // Add files
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedImages.push({
          file: file,
          url: e.target.result,
          alt: '',
          existing: false,
          position: uploadedImages.length,
        });
        renderPreviews();
      };
      reader.readAsDataURL(file);
    });
  }

  function validateImageFile(file) {
    // Check type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Formato no permitido (solo JPG, PNG, WebP)' };
    }

    // Check size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: 'Archivo muy grande (máx. 5MB)' };
    }

    return { valid: true };
  }

  function renderPreviews() {
    previewContainer.innerHTML = uploadedImages.map((img, i) => renderImagePreview(img, i)).join('');

    // Setup remove buttons
    previewContainer.querySelectorAll('.image-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        removeImage(index);
      });
    });

    // Setup alt text inputs
    previewContainer.querySelectorAll('.image-alt-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const index = parseInt(input.dataset.index);
        uploadedImages[index].alt = input.value;
      });
    });

    // Setup reorder (drag and drop on previews)
    setupImageReorder();
  }

  function removeImage(index) {
    const img = uploadedImages[index];
    if (img.existing && img.id) {
      removedImageIds.push(img.id);
    }
    uploadedImages.splice(index, 1);
    // Update positions
    uploadedImages.forEach((img, i) => img.position = i);
    renderPreviews();
  }

  function setupImageReorder() {
    let draggedIndex = null;

    previewContainer.querySelectorAll('.image-preview-item').forEach((item, i) => {
      item.draggable = true;

      item.addEventListener('dragstart', (e) => {
        draggedIndex = i;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedIndex = null;
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== i) {
          const [moved] = uploadedImages.splice(draggedIndex, 1);
          uploadedImages.splice(i, 0, moved);
          uploadedImages.forEach((img, idx) => img.position = idx);
          renderPreviews();
        }
      });
    });
  }

  // Initial render
  renderPreviews();
}

function renderImagePreview(img, index) {
  return `
    <div class="image-preview-item" role="listitem" data-index="${index}" draggable="true">
      <img src="${img.url}" alt="${escapeHtml(img.alt || `Imagen ${index + 1}`)}" loading="lazy">
      <input type="text" class="image-alt-input" data-index="${index}" placeholder="Texto alternativo (opcional)" value="${escapeHtml(img.alt || '')}" aria-label="Texto alternativo para imagen ${index + 1}">
      <button type="button" class="image-remove" data-index="${index}" aria-label="Eliminar imagen ${index + 1}">×</button>
      ${img.existing ? '<span class="image-existing-badge" aria-label="Imagen existente">✓</span>' : ''}
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}