/**
 * TecniBuy Chat Page
 * Individual conversation (texto plano, sin cifrado E2E)
 */

import { api } from '../api.js';
import { navigateTo, showToast, formatRelativeTime } from '../app.js';
import { filterContent } from '../crypto.js';

let conversationId = null;
let messages = [];
let otherUser = null;
let pollingInterval = null;
let isLoading = false;

export async function render(params) {
  const app = document.getElementById('app');
  conversationId = params.conversationId;

  // Show loading
  app.innerHTML = `
    <section class="chat-page" aria-labelledby="chat-title">
      <div class="container">
        <div class="loading-placeholder" style="text-align: center; padding: 4rem;">
          <div class="spinner" style="margin: 0 auto 1rem;"></div>
          <p>Cargando chat...</p>
        </div>
      </div>
    </section>
  `;

  try {
    // Load conversation and messages
    const [convRes, messagesRes, otherUserRes] = await Promise.allSettled([
      api.getConversation(conversationId),
      api.getMessages(conversationId, 1, 50),
      api.getConversationOtherUser(conversationId),
    ]);

    if (convRes.status === 'rejected') throw convRes.reason;
    if (otherUserRes.status === 'rejected') throw otherUserRes.reason;

    otherUser = otherUserRes.value;

    // Render messages
    messages = messagesRes.status === 'fulfilled' ? messagesRes.value : [];
    renderChat();

    // Start polling for new messages
    startPolling();
  } catch (error) {
    console.error('Error loading chat:', error);
    app.innerHTML = `
      <section class="chat-page">
        <div class="container">
          <div class="error-state">
            <p>⚠️ Error al cargar chat: ${error.message}</p>
            <a href="#/chat" class="btn btn-primary">Volver a mensajes</a>
          </div>
        </div>
      </section>
    `;
  }
}

function renderChat() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <section class="chat-page" aria-labelledby="chat-title">
      <div class="container">
        <header class="chat-header">
          <button class="chat-back-btn" id="chat-back-btn" aria-label="Volver a mensajes">←</button>
          <div class="chat-header-info">
            <h1 id="chat-title" class="chat-title">${escapeHtml(otherUser.username)}</h1>
            <div class="chat-status">
              ${otherUser.is_online ? '<span class="online-indicator" aria-label="En línea">●</span>' : ''}
            </div>
          </div>
          <div class="chat-header-actions">
            <button class="btn btn-ghost btn-sm" id="chat-info-btn" aria-label="Info del chat">ℹ️</button>
          </div>
        </header>

        <!-- Messages Area -->
        <div class="chat-messages" id="chat-messages" role="log" aria-label="Mensajes" aria-live="polite">
          ${messages.length > 0
            ? messages.map(msg => renderMessage(msg)).join('')
            : '<div class="chat-empty"><p>💬 Sin mensajes aún</p><p class="form-help">Enviá el primer mensaje</p></div>'
          }
        </div>

        <!-- Message Input -->
        <form class="chat-input-form" id="chat-form">
          <div class="chat-input-wrapper">
            <label for="message-input" class="visually-hidden">Mensaje</label>
            <textarea
              id="message-input"
              name="message"
              class="chat-input"
              placeholder="Escribí un mensaje..."
              rows="1"
              maxlength="4000"
              aria-describedby="message-hint"
              required
            ></textarea>
            <div class="chat-input-actions">
              <span id="message-hint" class="form-help">Enter para enviar · Shift+Enter para nueva línea</span>
            </div>
          </div>
          <button type="submit" class="btn btn-primary chat-send-btn" id="send-btn" aria-label="Enviar mensaje">
            <span aria-hidden="true">➤</span>
          </button>
        </form>
      </div>
    </section>
  `;

  setupChat();
  scrollToBottom();
}

function setupChat() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const backBtn = document.getElementById('chat-back-btn');

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
  });

  // Handle Enter / Shift+Enter
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });

  // Submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    // Client-side content filter
    const filterResult = filterContent(text);
    if (!filterResult.allowed) {
      showToast(filterResult.reason, 'error');
      return;
    }

    sendBtn.disabled = true;
    input.disabled = true;

    try {
      // The backend's MessageCreate schema requires conversation_id and
      // recipient_id in the body too (not just in the URL).
      await api.sendMessage(conversationId, {
        text,
        recipientId: otherUser.id,
      });

      // Clear input
      input.value = '';
      input.style.height = 'auto';

      // Optimistically add to UI (will be confirmed by polling)
      addOptimisticMessage(text);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Error al enviar: ' + error.message, 'error');
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  });

  // Back button
  backBtn.addEventListener('click', () => {
    stopPolling();
    navigateTo('/chat');
  });

  // Focus input on load
  input.focus();
}

function addOptimisticMessage(text) {
  const container = document.getElementById('chat-messages');
  const emptyState = container.querySelector('.chat-empty');
  if (emptyState) emptyState.remove();

  const msgEl = document.createElement('div');
  msgEl.className = 'message message-own message-sending';
  msgEl.innerHTML = `
    <div class="message-bubble">
      <p class="message-text">${escapeHtml(text)}</p>
      <time class="message-time">${formatRelativeTime(new Date().toISOString())}</time>
      <span class="message-status sending" aria-label="Enviando">⟳</span>
    </div>
  `;
  container.appendChild(msgEl);
}

async function loadNewMessages() {
  if (isLoading) return;
  isLoading = true;

  try {
    // Get messages after the last one we have
    const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : 0;
    const newMessages = await api.getMessages(conversationId, 1, 50, lastMsgId);

    for (const msg of newMessages) {
      if (!messages.some(m => m.id === msg.id)) {
        messages.push(msg);
        appendMessage(msg);
      }
    }

    // Update sending messages to sent
    updateSendingMessages();
  } catch (error) {
    console.error('Error polling messages:', error);
  } finally {
    isLoading = false;
  }
}

function appendMessage(msg) {
  const container = document.getElementById('chat-messages');
  const emptyState = container.querySelector('.chat-empty');
  if (emptyState) emptyState.remove();

  const isOwn = msg.sender_id === api.getCurrentUserId();
  const msgEl = document.createElement('div');
  msgEl.className = `message ${isOwn ? 'message-own' : 'message-other'}`;
  msgEl.dataset.messageId = msg.id;

  if (isOwn) {
    msgEl.innerHTML = renderOwnMessage(msg);
  } else {
    msgEl.innerHTML = renderOtherMessage(msg);
  }

  container.appendChild(msgEl);
  scrollToBottom();
}

function renderOwnMessage(msg) {
  return `
    <div class="message-bubble">
      <p class="message-text">${escapeHtml(msg.text)}</p>
      <time class="message-time">${formatRelativeTime(msg.created_at)}</time>
      <span class="message-status ${msg.status || 'sent'}" aria-label="${msg.status || 'Enviado'}">
        ${msg.status === 'sending' ? '⟳' : msg.status === 'sent' ? '✓' : '✓✓'}
      </span>
    </div>
  `;
}

function renderOtherMessage(msg) {
  return `
    <div class="message-bubble">
      <p class="message-text">${escapeHtml(msg.text)}</p>
      <time class="message-time">${formatRelativeTime(msg.created_at)}</time>
    </div>
  `;
}

function renderMessage(msg) {
  const isOwn = msg.sender_id === api.getCurrentUserId();
  return isOwn ? renderOwnMessage(msg) : renderOtherMessage(msg);
}

function updateSendingMessages() {
  document.querySelectorAll('.message-sending').forEach(el => {
    el.classList.remove('message-sending');
    const statusEl = el.querySelector('.message-status');
    if (statusEl) {
      statusEl.textContent = '✓';
      statusEl.classList.remove('sending');
      statusEl.classList.add('sent');
      statusEl.setAttribute('aria-label', 'Enviado');
    }
  });
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function startPolling() {
  // Poll every 3 seconds
  pollingInterval = setInterval(loadNewMessages, 3000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Cleanup on unload
window.addEventListener('beforeunload', stopPolling);
window.addEventListener('hashchange', () => {
  if (!window.location.hash.includes('/chat/')) {
    stopPolling();
  }
});
