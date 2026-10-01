/**
 * TecniBuy API Client
 * Wrapper around fetch with auth token management, auto-refresh, and error handling
 */

const API_BASE = '/api';

// FastAPI returns `detail` as a plain string for most errors, but for
// 422 validation errors it returns a list of objects like
// { loc: [...], msg: '...', type: '...' }. Passing that straight into
// `new Error(...)` used to stringify to "[object Object]" in the UI.
// This normalizes both shapes into a readable string.
function formatErrorDetail(data, status) {
  const detail = data?.detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map(err => {
        if (typeof err === 'string') return err;
        const field = Array.isArray(err?.loc) ? err.loc[err.loc.length - 1] : null;
        const msg = err?.msg || 'Valor inválido';
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (messages.length) return messages.join('; ');
  }

  if (typeof detail === 'string' && detail) return detail;
  if (detail && typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg;
    try {
      return JSON.stringify(detail);
    } catch {
      // fall through
    }
  }

  return data?.message || `Error ${status}`;
}

export const api = {
  accessToken: null,
  refreshToken: null,

  init() {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  },

  setTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;
    if (access) localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
  },

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  async request(method, path, body = null, auth = true) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (auth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const options = {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    };

    let response = await fetch(`${API_BASE}${path}`, options);

    // Handle 401 - try to refresh token
    if (response.status === 401 && auth) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(`${API_BASE}${path}`, { ...options, headers });
      } else {
        // Refresh failed - logout and redirect
        this.logout();
        if (window.location.hash !== '#/login') {
          window.location.hash = '#/login';
        }
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }
    }

    // Parse response
    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else if (response.status !== 204) {
      data = await response.text();
    }

    if (!response.ok) {
      throw new Error(formatErrorDetail(data, response.status));
    }

    return data;
  },

  // Like request(), but for multipart/form-data uploads (FormData body).
  // Shares the same 401 -> refresh -> retry logic instead of doing a raw
  // fetch, so an expired access token no longer causes silent upload
  // failures (the caller previously only saw a console.error).
  async requestFormData(method, path, formData) {
    const buildHeaders = () => {
      const headers = {};
      if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
      return headers;
    };

    let response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: buildHeaders(),
      body: formData,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        response = await fetch(`${API_BASE}${path}`, {
          method,
          headers: buildHeaders(),
          body: formData,
        });
      } else {
        this.logout();
        if (window.location.hash !== '#/login') {
          window.location.hash = '#/login';
        }
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }
    }

    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else if (response.status !== 204) {
      data = await response.text();
    }

    if (!response.ok) {
      throw new Error(formatErrorDetail(data, response.status));
    }

    return data;
  },

  async refreshAccessToken() {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data = await response.json();
      this.setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      this.clearTokens();
      return false;
    }
  },

  logout() {
    this.clearTokens();
    // Optionally call logout endpoint to revoke refresh token on server
    if (this.refreshToken) {
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      }).catch(() => {}); // Ignore errors
    }
  },

  // Auth endpoints
  async register(data) {
    return this.request('POST', '/auth/register', data, false);
  },

  async login(data) {
    return this.request('POST', '/auth/login', data, false);
  },

  async getMe() {
    return this.request('GET', '/users/me');
  },

  // Users
  async updateMe(data) {
    return this.request('PUT', '/users/me', data);
  },

  async changePassword(data) {
    return this.request('PUT', '/users/me/password', data);
  },

  async deleteMe() {
    return this.request('DELETE', '/users/me');
  },

  async getPublicUser(userId) {
    return this.request('GET', `/users/${userId}/public`, null, false);
  },

  // Products
  async listProducts(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    });
    return this.request('GET', `/products?${searchParams.toString()}`, null, false);
  },

  async getProduct(id) {
    return this.request('GET', `/products/${id}`, null, false);
  },

  async createProduct(data) {
    return this.request('POST', '/products', data);
  },

  async updateProduct(id, data) {
    return this.request('PUT', `/products/${id}`, data);
  },

  async deleteProduct(id) {
    return this.request('DELETE', `/products/${id}`);
  },

  async uploadProductImage(productId, file, alt = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (alt) formData.append('alt', alt);

    return this.requestFormData('POST', `/products/${productId}/images`, formData);
  },

  async deleteProductImage(productId, imageId) {
    return this.request('DELETE', `/products/${productId}/images/${imageId}`);
  },

  async getMyListings(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    });
    return this.request('GET', `/products/my/listings?${searchParams.toString()}`);
  },

  // Alias used by the "my products" page
  async getMyProducts(params = {}) {
    return this.getMyListings(params);
  },

  // Categories
  async listCategories(flat = false) {
    return this.request('GET', `/categories?flat=${flat}`, null, false);
  },

  async getCategory(id) {
    return this.request('GET', `/categories/${id}`, null, false);
  },

  // Ratings
  async getProductRatings(productId, page = 1, pageSize = 20) {
    return this.request('GET', `/products/${productId}/ratings?page=${page}&page_size=${pageSize}`, null, false);
  },

  async getProductRatingsSummary(productId) {
    return this.request('GET', `/products/${productId}/ratings/summary`, null, false);
  },

  async createRating(productId, data) {
    return this.request('POST', `/products/${productId}/ratings`, data);
  },

  async updateRating(ratingId, data) {
    return this.request('PUT', `/products/ratings/${ratingId}`, data);
  },

  async deleteRating(ratingId) {
    return this.request('DELETE', `/products/ratings/${ratingId}`);
  },

  // Media
  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || 'Error al subir archivo');
    }

    return response.json();
  },

  // Chat
  async listConversations() {
    return this.request('GET', '/conversations');
  },

  // Alias used by the chat list page
  async getConversations() {
    return this.listConversations();
  },

  async createConversation(otherUserId) {
    return this.request('POST', '/conversations', { other_user_id: otherUserId });
  },

  // The backend has no single "get conversation by id" endpoint, so we
  // derive it from the full list (used to load the other user's info when
  // opening a specific chat thread).
  async getConversation(conversationId) {
    const list = await this.listConversations();
    const conv = list.find(c => c.id === parseInt(conversationId));
    if (!conv) throw new Error('Conversación no encontrada');
    return conv;
  },

  async getConversationOtherUser(conversationId) {
    const conv = await this.getConversation(conversationId);
    return conv.other_user;
  },

  async getMessages(conversationId, page = 1, pageSize = 50) {
    return this.request('GET', `/conversations/${conversationId}/messages?page=${page}&page_size=${pageSize}`);
  },

  async sendMessage(conversationId, { text, recipientId }) {
    return this.request('POST', `/conversations/${conversationId}/messages`, {
      conversation_id: parseInt(conversationId),
      recipient_id: recipientId,
      text,
    });
  },

  // Decodes the user id out of the current JWT access token. Centralized
  // here so every page (app.js, chat-list.js, chat.js, chat-widget.js)
  // agrees on the same id when identifying "own" messages in the chat UI.
  getCurrentUserId() {
    if (!this.accessToken) return null;
    try {
      const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
      return parseInt(payload.sub);
    } catch {
      return null;
    }
  },
};