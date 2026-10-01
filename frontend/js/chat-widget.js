/**
 * TecniBuy Floating Chat Widget
 * A small "Mensajes" launcher + panel available on every page (not just
 * #/chat), so the user can see and reply to seller conversations without
 * leaving whatever they're doing. Texto plano, sin cifrado E2E.
 */

import { api } from './api.js';
import { formatRelativeTime, showToast } from './app.js';
import { filterContent } from './crypto.js';

const REFRESH_MS = 5000;
// The widget hides itself on the full chat pages, since those already
// cover the same functionality full-screen.
const HIDDEN_ON_ROUTES = [/^#\/chat$/, /^#\/chat\//];

let root = null;
let isOpen = false;
let view = 'list'; // 'list' | 'thread'
let conversations = [];
let activeConversationId = null;
let activeOtherUser = null;
let activeMessages = [];
let refreshTimer = null;
let initialized = false;

function ensureRoot() {
  if (!root) {
    root = document.createElement('div');
    root.id = 'chat-widget-root';
    document.body.appendChild(root);
  }
  return root;
}

export function initChatWidget() {
  ensureRoot();
  syncWithAuth();
  window.addEventListener('hashchange', updateLauncherVisibility);
}

/**
 * Call this whenever auth state changes (login/logout) so the widget
 * appears/disappears and resets accordingly. Safe to call before
 * initChatWidget() has run (e.g. if some future code path calls it early).
 */
export function syncWithAuth() {
  ensureRoot();
  if (api.accessToken) {
    if (!initialized) {
      initialized = true;
      renderShell();
      startRefreshLoop();
    }
    refreshConversations();
  } else {
    teardown();
  }
}

function teardown() {
  initialized = false;
  isOpen = false;
  view = 'list';
  conversations = [];
  activeConversationId = null;
  activeOtherUser = null;
  activeMessages = [];
  stopRefreshLoop();
  if (root) root.innerHTML = '';
}

function startRefreshLoop() {
  stopRefreshLoop();
  refreshTimer = setInterval(() => {
    if (view === 'thread' && isOpen) {
      loadNewMessagesForActiveThread();
    } else {
      refreshConversations();
    }
  }, REFRESH_MS);
}

function stopRefreshLoop() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function renderShell() {
  root.innerHTML = `
    <button class="chat-widget-launcher" id="chat-widget-launcher" aria-label="Mensajes" aria-expanded="false">
      <span aria-hidden="true">💬</span>
      <span class="chat-widget-badge" id="chat-widget-badge" hidden>0</span>
    </button>
    <div class="chat-widget-panel" id="chat-widget-panel" role="dialog" aria-label="Mensajes" hidden>
      <div id="chat-widget-panel-content"></div>
    </div>
  `;

  document.getElementById('chat-widget-launcher').addEventListener('click', togglePanel);
  updateLauncherVisibility();
}

function updateLauncherVisibility() {
  const launcher = document.getElementById('chat-widget-launcher');
  const panel = document.getElementById('chat-widget-panel');
  if (!launcher) return;

  const hideHere = HIDDEN_ON_ROUTES.some(re => re.test(window.location.hash));
  launcher.hidden = hideHere;
  if (hideHere) {
    isOpen = false;
    if (panel) panel.hidden = true;
  }
}

function togglePanel() {
  isOpen = !isOpen;
  const panel = document.getElementById('chat-widget-panel');
  const launcher = document.getElementById('chat-widget-launcher');
  panel.hidden = !isOpen;
  launcher.setAttribute('aria-expanded', String(isOpen));

  if (isOpen) {
    if (view === 'thread' && activeConversationId) {
      renderThreadView();
      loadNewMessagesForActiveThread();
    } else {
      view = 'list';
      renderListView();
      refreshConversations();
    }
  }
}

function closePanel() {
  isOpen = false;
  const panel = document.getElementById('chat-widget-panel');
  const launcher = document.getElementById('chat-widget-launcher');
  if (panel) panel.hidden = true;
  if (launcher) launcher.setAttribute('aria-expanded', 'false');
}

/* ---------------- List view ---------------- */

async function refreshConversations() {
  if (!api.accessToken) return;
  try {
    conversations = await api.getConversations();
    updateBadge();
    if (isOpen && view === 'list') renderListView();
  } catch (error) {
    console.error('Error refreshing conversations (widget):', error);
  }
}

function updateBadge() {
  const badge = document.getElementById('chat-widget-badge');
  if (!badge) return;
  const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  if (total > 0) {
    badge.hidden = false;
    badge.textContent = total > 99 ? '99+' : String(total);
  } else {
    badge.hidden = true;
  }
}

function renderListView() {
  const content = document.getElementById('chat-widget-panel-content');
  if (!content) return;

  content.innerHTML = `
    <header class="chat-widget-header">
      <h2>Mensajes</h2>
      <div class="chat-widget-header-actions">
        <a href="#/chat" class="chat-widget-icon-btn" aria-label="Abrir mensajes en pantalla completa" title="Pantalla completa">⤢</a>
        <button class="chat-widget-icon-btn" id="chat-widget-close" aria-label="Cerrar">×</button>
      </div>
    </header>
    <div class="chat-widget-body">
      ${conversations.length > 0 ? `
        <ul class="chat-widget-conv-list" role="list">
          ${conversations.map(renderConvItem).join('')}
        </ul>
      ` : `
        <div class="chat-widget-empty">
          <p>💬 Todavía no tenés conversaciones</p>
          <p class="form-help">Contactá a un vendedor desde un producto</p>
        </div>
      `}
    </div>
  `;

  document.getElementById('chat-widget-close').addEventListener('click', closePanel);
  content.querySelectorAll('[data-open-conversation]').forEach(el => {
    el.addEventListener('click', () => openThread(parseInt(el.dataset.openConversation, 10)));
  });
}

function renderConvItem(conv) {
  const otherUser = conv.other_user;
  const lastMsg = conv.last_message;
  const unread = conv.unread_count > 0;

  return `
    <li class="chat-widget-conv-item ${unread ? 'unread' : ''}" data-open-conversation="${conv.id}" role="listitem" tabindex="0">
      <span class="chat-widget-avatar" aria-hidden="true">${otherUser.avatar ? '🖼️' : '👤'}</span>
      <span class="chat-widget-conv-info">
        <span class="chat-widget-conv-name">${escapeHtml(otherUser.username)}</span>
        <span class="chat-widget-conv-preview">${lastMsg ? escapeHtml(lastMsg.text) : 'Sin mensajes aún'}</span>
      </span>
      ${unread ? `<span class="chat-widget-unread" aria-label="${conv.unread_count} no leídos">${conv.unread_count}</span>` : ''}
    </li>
  `;
}

/* ---------------- Thread view ---------------- */

async function openThread(conversationId) {
  activeConversationId = conversationId;
  view = 'thread';

  const content = document.getElementById('chat-widget-panel-content');
  content.innerHTML = `<div class="chat-widget-loading">Cargando...</div>`;

  try {
    const conv = conversations.find(c => c.id === conversationId) || await api.getConversation(conversationId);
    activeOtherUser = conv.other_user;

    const msgs = await api.getMessages(conversationId, 1, 50);
    activeMessages = msgs;

    renderThreadView();
    refreshConversations(); // clears/updates unread badge for this conversation
  } catch (error) {
    console.error('Error opening conversation (widget):', error);
    content.innerHTML = `
      <header class="chat-widget-header">
        <button class="chat-widget-icon-btn" id="chat-widget-back" aria-label="Volver">←</button>
        <h2>Error</h2>
        <button class="chat-widget-icon-btn" id="chat-widget-close" aria-label="Cerrar">×</button>
      </header>
      <div class="chat-widget-body">
        <div class="chat-widget-empty"><p>⚠️ ${escapeHtml(error.message)}</p></div>
      </div>
    `;
    document.getElementById('chat-widget-back').addEventListener('click', backToList);
    document.getElementById('chat-widget-close').addEventListener('click', closePanel);
  }
}

function backToList() {
  view = 'list';
  activeConversationId = null;
  activeOtherUser = null;
  activeMessages = [];
  renderListView();
  refreshConversations();
}

function renderThreadView() {
  const content = document.getElementById('chat-widget-panel-content');
  if (!content || !activeOtherUser) return;

  content.innerHTML = `
    <header class="chat-widget-header">
      <button class="chat-widget-icon-btn" id="chat-widget-back" aria-label="Volver a la lista">←</button>
      <h2>${escapeHtml(activeOtherUser.username)}</h2>
      <div class="chat-widget-header-actions">
        <a href="#/chat/${activeConversationId}" class="chat-widget-icon-btn" aria-label="Abrir en pantalla completa" title="Pantalla completa">⤢</a>
        <button class="chat-widget-icon-btn" id="chat-widget-close" aria-label="Cerrar">×</button>
      </div>
    </header>
    <div class="chat-widget-messages" id="chat-widget-messages">
      ${activeMessages.length > 0
        ? activeMessages.map(renderMessage).join('')
        : '<div class="chat-widget-empty"><p>💬 Sin mensajes aún</p></div>'
      }
    </div>
    <form class="chat-widget-input-form" id="chat-widget-form">
      <label for="chat-widget-input" class="visually-hidden">Mensaje</label>
      <input
        id="chat-widget-input"
        type="text"
        class="chat-widget-input"
        placeholder="Escribí un mensaje..."
        maxlength="4000"
        autocomplete="off"
        required
      >
      <button type="submit" class="chat-widget-send-btn" aria-label="Enviar">➤</button>
    </form>
  `;

  document.getElementById('chat-widget-back').addEventListener('click', backToList);
  document.getElementById('chat-widget-close').addEventListener('click', closePanel);
  document.getElementById('chat-widget-form').addEventListener('submit', handleSend);
  scrollThreadToBottom();
}

function renderMessage(msg) {
  const isOwn = msg.sender_id === api.getCurrentUserId();
  return `
    <div class="chat-widget-message ${isOwn ? 'own' : 'other'}">
      <p class="chat-widget-message-text">${escapeHtml(msg.text)}</p>
      <time class="chat-widget-message-time">${formatRelativeTime(msg.created_at)}</time>
    </div>
  `;
}

async function handleSend(e) {
  e.preventDefault();
  const input = document.getElementById('chat-widget-input');
  const text = input.value.trim();
  if (!text) return;

  const filterResult = filterContent(text);
  if (!filterResult.allowed) {
    showToast(filterResult.reason, 'error');
    return;
  }

  input.disabled = true;
  try {
    // conversation_id and recipient_id are required by the backend's
    // MessageCreate schema even though the conversation is already in the URL.
    await api.sendMessage(activeConversationId, {
      text,
      recipientId: activeOtherUser.id,
    });

    input.value = '';
    // Optimistic local echo; polling will reconcile it with the real record.
    activeMessages.push({
      id: `optimistic-${Date.now()}`,
      sender_id: api.getCurrentUserId(),
      created_at: new Date().toISOString(),
      text,
    });
    appendMessageToDom(activeMessages[activeMessages.length - 1]);
  } catch (error) {
    console.error('Error sending message (widget):', error);
    showToast('Error al enviar: ' + error.message, 'error');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function appendMessageToDom(msg) {
  const container = document.getElementById('chat-widget-messages');
  if (!container) return;
  const empty = container.querySelector('.chat-widget-empty');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.innerHTML = renderMessage(msg);
  container.appendChild(div.firstElementChild);
  scrollThreadToBottom();
}

async function loadNewMessagesForActiveThread() {
  if (!activeConversationId) return;
  try {
    const numericMessages = activeMessages.filter(m => typeof m.id === 'number');
    const lastMsgId = numericMessages.length > 0 ? numericMessages[numericMessages.length - 1].id : 0;
    const newMessages = await api.getMessages(activeConversationId, 1, 50, lastMsgId);
    if (!newMessages || newMessages.length === 0) return;

    // Drop optimistic placeholders once the real messages arrive.
    activeMessages = activeMessages.filter(m => typeof m.id === 'number');

    for (const msg of newMessages) {
      if (!activeMessages.some(m => m.id === msg.id)) {
        activeMessages.push(msg);
        if (isOpen && view === 'thread') appendMessageToDom(msg);
      }
    }
  } catch (error) {
    console.error('Error polling messages (widget):', error);
  }
}

function scrollThreadToBottom() {
  const container = document.getElementById('chat-widget-messages');
  if (container) container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
