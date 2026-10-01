/**
 * TecniBuy Chat List Page
 * List of conversations (texto plano, sin cifrado E2E)
 */

import { api } from '../api.js';
import { navigateTo, showToast, formatRelativeTime, formatDate } from '../app.js';

let conversations = [];

export async function render() {
  const app = document.getElementById('app');

  // Show loading
  app.innerHTML = `
    <section class="chat-list-page" aria-labelledby="chat-list-title">
      <div class="container">
        <div class="loading-placeholder" style="text-align: center; padding: 4rem;">
          <div class="spinner" style="margin: 0 auto 1rem;"></div>
          <p>Cargando mensajes...</p>
        </div>
      </div>
    </section>
  `;

  try {
    const data = await api.getConversations();
    conversations = data;
    renderChatList(data);
  } catch (error) {
    console.error('Error loading conversations:', error);
    app.innerHTML = `
      <section class="chat-list-page">
        <div class="container">
          <div class="error-state">
            <p>⚠️ Error al cargar mensajes: ${error.message}</p>
            <a href="#/" class="btn btn-primary">Volver al inicio</a>
          </div>
        </div>
      </section>
    `;
  }
}

function renderChatList(data) {
  const app = document.getElementById('app');

  app.innerHTML = `
    <section class="chat-list-page" aria-labelledby="chat-list-title">
      <div class="container">
        <header class="page-header page-header-actions">
          <div>
            <h1 id="chat-list-title" class="page-title">Mensajes</h1>
            <p class="page-subtitle">${data.length} conversación${data.length !== 1 ? 'es' : ''}</p>
          </div>
        </header>

        <div class="chat-list-layout">
          <!-- Conversations Sidebar -->
          <aside class="chat-sidebar" aria-label="Lista de conversaciones">
            ${data.length > 0 ? `
              <ul class="conversation-list" role="list" aria-label="Tus conversaciones">
                ${data.map(conv => renderConversationItem(conv)).join('')}
              </ul>
            ` : `
              <div class="empty-state">
                <p>💬 No tenés conversaciones aún</p>
                <p class="form-help">Iniciá una conversación desde un producto</p>
                <a href="#/productos" class="btn btn-primary">Ver productos</a>
              </div>
            `}
          </aside>

          <!-- Chat Preview / Welcome -->
          <main class="chat-main" role="main">
            <div class="chat-welcome">
              <h2>Mensajes</h2>
              <p>Seleccioná una conversación para empezar a chatear</p>
            </div>
          </main>
        </div>
      </div>
    </section>
  `;

  setupConversationClicks();
}

function renderConversationItem(conv) {
  const otherUser = conv.other_user;
  const lastMsg = conv.last_message;
  const unread = conv.unread_count > 0;

  return `
    <li class="conversation-item ${unread ? 'unread' : ''}" data-conversation-id="${conv.id}" role="listitem">
      <a href="#/chat/${conv.id}" class="conversation-link">
        <div class="conversation-avatar" aria-hidden="true">
          ${otherUser.avatar ? '🖼️' : '👤'}
        </div>
        <div class="conversation-info">
          <div class="conversation-header">
            <h3 class="conversation-name">${escapeHtml(otherUser.username)}</h3>
            <time class="conversation-time" datetime="${lastMsg?.created_at || conv.last_activity}">${lastMsg ? formatRelativeTime(lastMsg.created_at) : formatRelativeTime(conv.last_activity)}</time>
          </div>
          <div class="conversation-preview">
            ${lastMsg ? `
              <span class="conversation-sender ${lastMsg.sender_id === api.getCurrentUserId() ? 'own' : ''}">
                ${lastMsg.sender_id === api.getCurrentUserId() ? 'Vos: ' : ''}
              </span>
              <span class="conversation-text">${escapeHtml(lastMsg.text)}</span>
            ` : 'Sin mensajes aún'}
          </div>
        </div>
        ${unread ? `<span class="unread-badge" aria-label="${conv.unread_count} no leídos">${conv.unread_count}</span>` : ''}
      </a>
    </li>
  `;
}

function setupConversationClicks() {
  // Links work naturally via href
  // But we can add keyboard support
  document.querySelectorAll('.conversation-link').forEach(link => {
    link.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        link.click();
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
