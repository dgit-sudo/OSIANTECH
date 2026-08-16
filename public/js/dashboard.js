import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-client.js';

const gate = document.getElementById('dashboard-gate');
const content = document.getElementById('dashboard-content');
const profileForm = document.getElementById('profile-setup-form');
const settingsForm = document.getElementById('profile-settings-form');
const tabButtons = Array.from(document.querySelectorAll('[data-dashboard-tab-btn]'));
const tabPanels = Array.from(document.querySelectorAll('[data-dashboard-tab-panel]'));
const signoutBtn = document.getElementById('dashboard-signout');
const gateFeedbackEl = document.getElementById('dashboard-gate-feedback');
const settingsFeedbackEl = document.getElementById('dashboard-settings-feedback');
const purchasedCoursesEl = document.getElementById('dashboard-purchased-courses');
const purchasedEmptyEl = document.getElementById('dashboard-purchased-empty');
const nameEl = document.getElementById('dashboard-user-name');
const gateCopyEl = document.getElementById('dashboard-gate-copy');
const gatePillEl = document.getElementById('dashboard-required-pill');
const saveProfileBtn = document.getElementById('profile-save-btn');
const supportFabBtn = document.getElementById('dashboard-support-button');
const supportPanelEl = document.getElementById('dashboard-support-panel');
const supportCloseBtn = document.getElementById('dashboard-support-close');
const supportChatListEl = document.getElementById('dashboard-support-chat-list');
const supportMessagesEl = document.getElementById('dashboard-support-messages');
const supportMessageInput = document.getElementById('dashboard-support-message-input');
const supportImageInput = document.getElementById('dashboard-support-image-input');
const supportSendBtn = document.getElementById('dashboard-support-send');
const supportFeedbackEl = document.getElementById('dashboard-support-feedback');
const supportFeedbackForm = document.getElementById('dashboard-support-feedback-form');
const supportFeedbackRatingInput = document.getElementById('dashboard-support-feedback-rating');
const supportFeedbackCommentInput = document.getElementById('dashboard-support-feedback-comment');

// AI chat elements
const aiViewEl = document.getElementById('support-ai-view');
const adminViewEl = document.getElementById('support-admin-view');
const aiMessagesEl = document.getElementById('support-ai-messages');
const aiInputEl = document.getElementById('support-ai-input');
const aiSendBtn = document.getElementById('support-ai-send');
const aiEscalationBar = document.getElementById('support-ai-escalation-bar');
const aiResolvedBar = document.getElementById('support-ai-resolved-bar');
const aiComposeEl = document.getElementById('support-ai-compose');
const adminBackBtn = document.getElementById('support-admin-back');
const adminCloseBtn = document.getElementById('support-admin-close');
const unreadBadgeEl = document.getElementById('support-unread-badge');
const profileBaseUrl = '/api/profile';
let unauthRedirectTimer = null;
let supportChats = [];
let supportActiveChatId = 0;
let supportPollTimer = null;
let unreadPollTimer = null;

// AI chat state
let aiSessionId = null;
let aiCantAnswerCount = 0;
let aiResolved = false;
let aiInAdminMode = false;
let aiAwaitingEscalationQuery = false;

const AI_HUMAN_KEYWORDS = /\b(human|admin|real person|agent|manager|support team|talk to someone|speak to|escalate|person|staff|representative|help desk|live agent)\b/i;
const AI_RESOLVED_KEYWORDS = /\b(thanks|thank you|got it|resolved|solved|that works|that helped|no more questions|that['']?s all|all good|perfect|great|sorted|done|clear|understood|no thanks|bye|goodbye)\b/i;
const AI_CANT_ANSWER = /i don['']t have that information|please contact us|I['']m not sure|I cannot|beyond my knowledge|i don['']t know/i;
const AI_CLOSE_TICKET_KEYWORDS = /\b(close|end|cancel|resolve)\s+(my\s+|the\s+)?(support\s+)?(ticket|request|admin\s+chat|admin\s+ticket)\b|\bclose\s+the\s+ticket\b/i;
const AI_CLOSE_CHAT_KEYWORDS = /\b(close|clear|reset|delete|end)\s+(this\s+|the\s+)?(ai\s+)?chat\b|\bstart\s+(over|fresh|a\s+new\s+chat)\b|\bclear\s+chat\b|\bnew\s+chat\b/i;
let purchasesCache = [];
let purchasesByCourseId = new Map();

function clearUnauthRedirectTimer() {
  if (!unauthRedirectTimer) return;
  clearTimeout(unauthRedirectTimer);
  unauthRedirectTimer = null;
}

function scheduleUnauthRedirect() {
  clearUnauthRedirectTimer();

  // Some browsers emit an initial null auth state before restoring persisted login.
  unauthRedirectTimer = setTimeout(async () => {
    const restoredUser = auth.currentUser;
    if (restoredUser) {
      await hydrateDashboardForUser(restoredUser);
      return;
    }
    window.location.replace('/auth?mode=signin');
  }, 1500);
}

function getLocalPurchases(user) {
  if (!user?.uid) return [];
  try {
    const raw = window.localStorage.getItem(`osian_purchases_${user.uid}`);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergePurchases(primary = [], fallback = []) {
  const seen = new Set();
  const merged = [];
  [...primary, ...fallback].forEach((purchase) => {
    const id = Number(purchase?.courseId || 0);
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(purchase);
  });
  return merged;
}

function setFeedback(targetEl, message = '', type = 'info') {
  if (!targetEl) return;
  if (!message) {
    targetEl.className = 'auth-feedback';
    targetEl.textContent = '';
    return;
  }
  targetEl.className = `auth-feedback auth-feedback-${type}`;
  targetEl.textContent = message;
}

function setActiveTab(tabName) {
  const activeTab = ['overview', 'courses', 'settings'].includes(tabName) ? tabName : 'overview';
  tabButtons.forEach((btn) => {
    const isActive = btn.getAttribute('data-dashboard-tab-btn') === activeTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  tabPanels.forEach((panel) => {
    const isActive = panel.getAttribute('data-dashboard-tab-panel') === activeTab;
    panel.classList.toggle('active', isActive);
  });
}

function showGate() {
  if (gate) gate.hidden = false;
  if (content) content.hidden = true;
  if (supportFabBtn) supportFabBtn.hidden = true;
  if (supportPanelEl) supportPanelEl.hidden = true;
  if (gatePillEl) gatePillEl.textContent = 'Required';
  if (gatePillEl) gatePillEl.classList.remove('dashboard-required-complete');
  if (gateCopyEl) gateCopyEl.textContent = 'Complete your profile to unlock your full dashboard experience.';
  if (saveProfileBtn) saveProfileBtn.textContent = 'Save Profile & Unlock Dashboard';
}

function showDashboard(activeTab = 'overview') {
  if (gate) gate.hidden = true;
  if (content) content.hidden = false;
  if (supportFabBtn) supportFabBtn.hidden = false;
  setActiveTab(activeTab);
  startUnreadPoll();
}

function clearSupportPollTimer() {
  if (!supportPollTimer) return;
  clearInterval(supportPollTimer);
  supportPollTimer = null;
}

function updateBadge(count) {
  if (!unreadBadgeEl) return;
  if (count > 0) {
    unreadBadgeEl.textContent = count > 99 ? '99+' : String(count);
    unreadBadgeEl.hidden = false;
  } else {
    unreadBadgeEl.hidden = true;
  }
}

async function closeAdminTicket() {
  let chatId = supportActiveChatId;
  if (!chatId) {
    const token = await getAiToken();
    const res = await fetch('/api/support/unread-count', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    chatId = data.ok ? data.openChatId : null;
  }
  if (!chatId) throw new Error('No open ticket.');

  const token = await getAiToken();
  const res = await fetch(`/api/support/chats/${encodeURIComponent(chatId)}/end`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not close ticket.');
  }

  aiInAdminMode = false;
  supportActiveChatId = 0;
  supportChats = [];
  updateBadge(0);
}

async function clearAiSession() {
  try {
    const token = await getAiToken();
    await fetch('/api/support/ai/session', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: JSON.stringify({ sessionId: aiSessionId }),
    });
  } catch { /* silent — local reset still happens */ }

  aiSessionId = null;
  aiCantAnswerCount = 0;
  aiAwaitingEscalationQuery = false;
  aiResolved = false;
  if (aiMessagesEl) aiMessagesEl.innerHTML = '';
  if (aiComposeEl) aiComposeEl.hidden = false;
  if (aiResolvedBar) aiResolvedBar.hidden = true;
}

async function refreshUnreadBadge() {
  // Skip badge update while panel is open (user can see messages directly)
  if (supportPanelEl?.classList.contains('open')) return;
  try {
    const token = await getAiToken();
    const res = await fetch('/api/support/unread-count', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    updateBadge(data.ok ? (data.unreadCount || 0) : 0);
    // Track open ticket in memory so openSupportPanel can use it
    if (data.ok && data.openChatId) aiInAdminMode = true;
  } catch { /* silent */ }
}

function startUnreadPoll() {
  if (unreadPollTimer) return; // already running
  refreshUnreadBadge().catch(() => {});
  unreadPollTimer = setInterval(() => refreshUnreadBadge().catch(() => {}), 30000);
}

function setSupportFeedback(message = '', type = 'info') {
  setFeedback(supportFeedbackEl, message, type);
}

async function getSupportToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in first.');
  return user.getIdToken();
}

function formatSupportTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

function getActiveChat() {
  return supportChats.find((chat) => Number(chat.id) === Number(supportActiveChatId)) || null;
}

function renderSupportChatList() {
  if (!supportChatListEl) return;
  supportChatListEl.innerHTML = '';

  if (!supportChats.length) {
    supportChatListEl.textContent = 'No support requests yet.';
    return;
  }

  const frag = document.createDocumentFragment();
  supportChats.forEach((chat) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'support-chat-item';
    if (Number(chat.id) === Number(supportActiveChatId)) button.classList.add('active');
    button.textContent = `#${chat.id} ${chat.status === 'open' ? 'Open' : 'Ended'} - ${chat.lastMessage || 'No messages yet'}`;
    button.addEventListener('click', () => {
      supportActiveChatId = Number(chat.id);
      loadSupportMessages().catch((error) => {
        setSupportFeedback(error?.message || 'Could not load support messages.', 'error');
      });
    });
    frag.appendChild(button);
  });
  supportChatListEl.appendChild(frag);
}

function renderSupportMessages(messages = []) {
  if (!supportMessagesEl) return;
  supportMessagesEl.innerHTML = '';

  if (!messages.length) {
    supportMessagesEl.textContent = 'No messages in this chat yet.';
    return;
  }

  const frag = document.createDocumentFragment();
  messages.forEach((message) => {
    const wrap = document.createElement('div');
    wrap.className = `support-msg support-msg-${message.senderRole === 'admin' ? 'admin' : 'user'}`;

    const text = document.createElement('div');
    text.className = 'support-msg-text';
    text.textContent = message.message || '';

    const time = document.createElement('div');
    time.className = 'support-msg-time';
    time.textContent = formatSupportTime(message.createdAt);

    wrap.appendChild(text);
    if (message.image?.dataUrl) {
      const img = document.createElement('img');
      img.src = message.image.dataUrl;
      img.alt = message.image.fileName || 'uploaded image';
      img.className = 'support-msg-image';
      wrap.appendChild(img);
    }
    wrap.appendChild(time);
    frag.appendChild(wrap);
  });
  supportMessagesEl.appendChild(frag);
  supportMessagesEl.scrollTop = supportMessagesEl.scrollHeight;
}

function updateFeedbackFormVisibility() {
  const active = getActiveChat();
  const shouldShow = Boolean(
    active
    && active.status === 'ended'
    && active.feedbackRequestedAt
    && !active.feedbackSubmittedAt,
  );
  if (supportFeedbackForm) supportFeedbackForm.hidden = !shouldShow;
}

async function loadSupportChats() {
  const token = await getSupportToken();
  const response = await fetch('/api/support/chats/my', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Could not load support chats.');
  }

  supportChats = Array.isArray(payload.chats) ? payload.chats : [];
  if (!supportActiveChatId && supportChats[0]) {
    supportActiveChatId = Number(supportChats[0].id);
  }
  if (supportActiveChatId && !supportChats.some((chat) => Number(chat.id) === Number(supportActiveChatId))) {
    supportActiveChatId = supportChats[0] ? Number(supportChats[0].id) : 0;
  }

  renderSupportChatList();
  updateFeedbackFormVisibility();
}

async function loadSupportMessages() {
  if (!supportActiveChatId) {
    renderSupportMessages([]);
    return;
  }

  const token = await getSupportToken();
  const response = await fetch(`/api/support/chats/${encodeURIComponent(supportActiveChatId)}/messages`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Could not load messages.');
  }

  renderSupportChatList();
  renderSupportMessages(Array.isArray(payload.messages) ? payload.messages : []);
  updateFeedbackFormVisibility();
}

async function startSupportChat() {
  const token = await getSupportToken();
  const response = await fetch('/api/support/chats/start', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Could not start support chat.');
  }

  supportChats = Array.isArray(payload.chats) ? payload.chats : [];
  supportActiveChatId = Number(payload.chatId || 0);
  renderSupportChatList();
  renderSupportMessages(Array.isArray(payload.messages) ? payload.messages : []);
  updateFeedbackFormVisibility();
}

async function sendSupportMessage() {
  if (!supportActiveChatId) {
    setSupportFeedback('Start a support request first.', 'error');
    return;
  }

  const message = String(supportMessageInput?.value || '').trim();
  const file = supportImageInput?.files?.[0] || null;
  let image = null;

  if (!message && !file) {
    setSupportFeedback('Enter a message or attach an image.', 'error');
    return;
  }

  if (file) {
    const dataUrl = await readImageAsDataUrl(file);
    image = {
      dataUrl,
      mimeType: file.type || 'image/png',
      fileName: file.name || 'upload-image',
    };
  }

  const token = await getSupportToken();
  const response = await fetch(`/api/support/chats/${encodeURIComponent(supportActiveChatId)}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, image }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Could not send support message.');
  }

  if (supportMessageInput) supportMessageInput.value = '';
  if (supportImageInput) supportImageInput.value = '';

  await loadSupportChats();
  await loadSupportMessages();
}

async function sendSupportMessageText(messageText) {
  if (!messageText) return;

  if (!supportActiveChatId) {
    await startSupportChat();
  }

  const token = await getSupportToken();
  const response = await fetch(`/api/support/chats/${encodeURIComponent(supportActiveChatId)}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: messageText }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Could not auto-send support message.');
  }

  await loadSupportChats();
  await loadSupportMessages();
}

async function submitSupportFeedback(event) {
  event.preventDefault();
  if (!supportActiveChatId) return;

  const rating = Number.parseInt(String(supportFeedbackRatingInput?.value || ''), 10);
  const comment = String(supportFeedbackCommentInput?.value || '').trim();
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    setSupportFeedback('Rating must be between 1 and 5.', 'error');
    return;
  }

  const token = await getSupportToken();
  const response = await fetch(`/api/support/chats/${encodeURIComponent(supportActiveChatId)}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rating, comment }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Could not submit feedback.');
  }

  if (supportFeedbackRatingInput) supportFeedbackRatingInput.value = '';
  if (supportFeedbackCommentInput) supportFeedbackCommentInput.value = '';
  await loadSupportChats();
  updateFeedbackFormVisibility();
  setSupportFeedback('Thanks! Your feedback was saved.', 'success');
}

// ── AI Chat ──────────────────────────────────────────────────────────────────

function appendAiMessage(role, text) {
  if (!aiMessagesEl) return;
  const wrap = document.createElement('div');
  wrap.className = `support-msg support-msg-${role === 'ai' ? 'admin' : 'user'}`;
  const bubble = document.createElement('div');
  bubble.className = 'support-msg-text';
  bubble.textContent = text;
  wrap.appendChild(bubble);
  aiMessagesEl.appendChild(wrap);
  aiMessagesEl.scrollTop = aiMessagesEl.scrollHeight;
}

function setAiLoading(loading) {
  if (aiSendBtn) aiSendBtn.disabled = loading;
  if (aiSendBtn) aiSendBtn.textContent = loading ? '...' : 'Send';
}

function closeAiChat() {
  aiResolved = true;
  if (aiComposeEl) aiComposeEl.hidden = true;
  if (aiEscalationBar) aiEscalationBar.hidden = true;
  if (aiResolvedBar) aiResolvedBar.hidden = false;
  setTimeout(() => closeSupportPanel(), 3000);
}

async function getAiToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  return user.getIdToken();
}

async function loadAiHistory() {
  try {
    const token = await getAiToken();
    const res = await fetch('/api/support/ai/history', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok || !data.messages?.length) return;

    aiSessionId = data.sessionId;
    data.messages.forEach((m) => appendAiMessage(m.role === 'ai' ? 'ai' : 'user', m.message));
  } catch {
    // Silently skip — history is optional
  }
}

async function sendAiMessage(messageText) {
  if (aiResolved) return;
  const text = messageText || (aiInputEl ? aiInputEl.value.trim() : '');
  if (!text) return;

  if (aiInputEl) aiInputEl.value = '';
  appendAiMessage('user', text);

  // User provided their issue description — create the admin ticket automatically
  if (aiAwaitingEscalationQuery) {
    aiAwaitingEscalationQuery = false;
    setAiLoading(true);
    try {
      await sendSupportMessageText(text);
      appendAiMessage('ai', "Your support ticket has been created! Our admin team will get back to you shortly. Connecting you now...");
      setTimeout(() => switchToAdminMode(), 1400);
    } catch {
      appendAiMessage('ai', "Sorry, I couldn't create the ticket right now. Please email dhyanam@osian.tech or call +91 96242 84999.");
    } finally {
      setAiLoading(false);
    }
    return;
  }

  setAiLoading(true);

  // Detect if user says issue is resolved
  if (AI_RESOLVED_KEYWORDS.test(text) && aiMessagesEl && aiMessagesEl.childElementCount > 2) {
    setAiLoading(false);
    appendAiMessage('ai', "Wonderful! I'm glad I could help. Take care, and feel free to reach out anytime. Closing this chat now. 👋");
    setTimeout(() => closeAiChat(), 1800);
    return;
  }

  // Close admin ticket on request
  if (AI_CLOSE_TICKET_KEYWORDS.test(text)) {
    setAiLoading(false);
    try {
      await closeAdminTicket();
      appendAiMessage('ai', "Your support ticket has been closed. Is there anything else I can help you with?");
    } catch {
      appendAiMessage('ai', "I couldn't find an open ticket to close — it may have already been closed by our team.");
    }
    return;
  }

  // Clear AI chat on request
  if (AI_CLOSE_CHAT_KEYWORDS.test(text)) {
    setAiLoading(false);
    appendAiMessage('ai', "Clearing this chat now. Feel free to start fresh anytime!");
    setTimeout(async () => {
      await clearAiSession();
      appendAiMessage('ai', "👋 Hi! I'm Osian's AI assistant. How can I help you today?");
    }, 1000);
    return;
  }

  // If user asks for a human — immediately collect issue details for ticket creation
  if (AI_HUMAN_KEYWORDS.test(text)) {
    setAiLoading(false);
    aiAwaitingEscalationQuery = true;
    appendAiMessage('ai', "Of course! Please briefly describe your issue and I'll create a support ticket for you right away.");
    return;
  }

  try {
    const token = await getAiToken();
    const res = await fetch('/api/support/ai/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: text, sessionId: aiSessionId }),
    });
    const data = await res.json().catch(() => ({}));
    const reply = data.reply || "I'm having trouble right now. Please try again or contact dhyanam@osian.tech.";
    aiSessionId = data.sessionId || aiSessionId;

    if (AI_CANT_ANSWER.test(reply)) {
      aiCantAnswerCount += 1;
    }

    appendAiMessage('ai', reply);

    // Auto-escalate if AI repeatedly can't answer
    if (aiCantAnswerCount >= 2) {
      aiCantAnswerCount = 0;
      aiAwaitingEscalationQuery = true;
      appendAiMessage('ai', "I don't seem to have enough information to fully resolve this. Let me connect you with our admin team — could you briefly describe what you need help with?");
    }
  } catch {
    appendAiMessage('ai', "Something went wrong on my end. You can try again or contact dhyanam@osian.tech / +91 96242 84999.");
  } finally {
    setAiLoading(false);
  }
}

function switchToAdminMode() {
  aiInAdminMode = true;
  if (aiViewEl) aiViewEl.hidden = true;
  if (adminViewEl) adminViewEl.hidden = false;
  loadSupportChats().catch(() => {});
  clearSupportPollTimer();
  supportPollTimer = setInterval(async () => {
    if (!supportPanelEl?.classList.contains('open')) return;
    try {
      await loadSupportChats();
      if (supportActiveChatId) await loadSupportMessages();
    } catch { /* silent */ }
  }, 7000);
}

function switchToAiMode() {
  aiInAdminMode = false;
  if (adminViewEl) adminViewEl.hidden = true;
  if (aiViewEl) aiViewEl.hidden = false;
  clearSupportPollTimer();
}

// ── Panel open/close ──────────────────────────────────────────────────────────

async function openSupportPanel() {
  if (!supportPanelEl) return;
  supportPanelEl.hidden = false;
  supportPanelEl.classList.add('open');
  if (supportFabBtn) supportFabBtn.hidden = true;
  // Clear badge — user opened the panel
  updateBadge(0);

  // Always check for open admin ticket (handles page-refresh case)
  try {
    const token = await getAiToken();
    const res = await fetch('/api/support/unread-count', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.openChatId) aiInAdminMode = true;
    }
  } catch { /* if fetch fails, fall back to in-memory aiInAdminMode */ }

  if (aiInAdminMode) {
    if (adminViewEl) adminViewEl.hidden = false;
    if (aiViewEl) aiViewEl.hidden = true;
    await loadSupportChats();
    if (supportActiveChatId) await loadSupportMessages();
    clearSupportPollTimer();
    supportPollTimer = setInterval(async () => {
      if (!supportPanelEl.classList.contains('open')) return;
      try {
        await loadSupportChats();
        if (supportActiveChatId) await loadSupportMessages();
      } catch { /* silent */ }
    }, 7000);
    return;
  }

  // AI mode — show greeting on first open
  if (aiViewEl) aiViewEl.hidden = false;
  if (adminViewEl) adminViewEl.hidden = true;
  if (aiMessagesEl && aiMessagesEl.childElementCount === 0) {
    await loadAiHistory();
    if (aiMessagesEl.childElementCount === 0) {
      appendAiMessage('ai', "👋 Hi! I'm Osian's AI assistant. How can I help you today? You can ask me anything about your courses, enrollment, scheduling, placement, or anything else related to Osian Academy.");
    }
  }
}

function closeSupportPanel() {
  if (supportPanelEl) {
    supportPanelEl.classList.remove('open');
    supportPanelEl.hidden = true;
  }
  if (supportFabBtn) supportFabBtn.hidden = false;
  clearSupportPollTimer();
}

async function loadProfile(user) {
  const idToken = await user.getIdToken();
  const response = await fetch(`${profileBaseUrl}/${encodeURIComponent(user.uid)}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (response.status === 401) {
    const err = new Error('Account deleted.');
    err.status = 401;
    throw err;
  }

  if (!response.ok) {
    throw new Error('Profile read failed.');
  }

  const data = await response.json();
  return data.profile || null;
}

async function saveProfile(user, payload) {
  const idToken = await user.getIdToken();
  const response = await fetch(`${profileBaseUrl}/${encodeURIComponent(user.uid)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    const err = new Error('Account deleted.');
    err.status = 401;
    throw err;
  }

  if (!response.ok) {
    throw new Error('Profile save failed.');
  }

  const data = await response.json();
  return data.profile || null;
}

async function loadPurchases(user) {
  const idToken = await user.getIdToken();
  const response = await fetch(`${profileBaseUrl}/${encodeURIComponent(user.uid)}/purchases`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (response.status === 401) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  if (!response.ok) {
    throw new Error('Purchases read failed.');
  }

  const data = await response.json();
  return Array.isArray(data.purchases) ? data.purchases : [];
}

function renderPurchases(purchases) {
  if (!purchasedCoursesEl || !purchasedEmptyEl) return;
  purchasedCoursesEl.innerHTML = '';
  purchasesCache = Array.isArray(purchases) ? purchases : [];
  purchasesByCourseId = new Map(
    purchasesCache
      .filter((item) => Number.isFinite(Number(item?.courseId)) && Number(item.courseId) > 0)
      .map((item) => [String(Number(item.courseId)), item]),
  );

  if (!Array.isArray(purchases) || purchases.length === 0) {
    purchasedEmptyEl.hidden = false;
    return;
  }

  purchasedEmptyEl.hidden = true;
  const fragment = document.createDocumentFragment();

  purchases.forEach((purchase) => {
    const item = document.createElement('div');
    item.className = 'dashboard-course-item';

    const titleWrap = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'dashboard-course-title';
    title.textContent = purchase.courseTitle || `Course #${purchase.courseId}`;

    const sub = document.createElement('span');
    sub.className = 'dashboard-course-cat';
    const date = purchase.purchaseDate ? new Date(purchase.purchaseDate) : null;
    sub.textContent = date && !Number.isNaN(date.getTime())
      ? `Purchased on ${date.toLocaleDateString()}`
      : 'Purchased';

    titleWrap.append(title, sub);

    const status = document.createElement('span');
    status.className = 'dashboard-course-arrow';
    status.textContent = 'Enrolled';

    const actions = document.createElement('div');
    actions.className = 'dashboard-course-actions';

    const open = document.createElement('a');
    open.className = 'dashboard-course-action-btn';
    open.href = `/courses/${encodeURIComponent(purchase.courseId)}`;
    open.textContent = 'Open';

    actions.append(open);

    item.append(titleWrap, status, actions);
    fragment.appendChild(item);
  });

  purchasedCoursesEl.appendChild(fragment);
}

function applyProfileToForm(formEl, profile) {
  if (!profile || !formEl) return;
  const fields = ['name', 'age', 'nationality', 'phoneNumber', 'gender', 'city', 'education'];
  fields.forEach((field) => {
    const input = formEl.querySelector(`[name="${field}"]`);
    if (input) {
      input.value = profile[field] ? String(profile[field]) : '';
    }
  });
}

function extractProfilePayload(formEl, user) {
  const formData = new FormData(formEl);
  return {
    name: String(formData.get('name') || '').trim(),
    age: Number(formData.get('age') || 0),
    nationality: String(formData.get('nationality') || '').trim(),
    phoneNumber: String(formData.get('phoneNumber') || '').trim(),
    gender: String(formData.get('gender') || '').trim(),
    city: String(formData.get('city') || '').trim(),
    education: String(formData.get('education') || '').trim(),
    email: user.email || '',
    completedProfile: true,
  };
}

function validateRequiredProfile(payload) {
  return Boolean(payload.name && payload.age && payload.nationality && payload.phoneNumber && payload.city && payload.education);
}

const DASH_CACHE_KEY_PREFIX = 'osian_dash_';
const DASH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes client-side

function getDashboardCache(uid) {
  try {
    const raw = sessionStorage.getItem(DASH_CACHE_KEY_PREFIX + uid);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) { sessionStorage.removeItem(DASH_CACHE_KEY_PREFIX + uid); return null; }
    return entry.data;
  } catch { return null; }
}

function setDashboardCache(uid, data) {
  try {
    sessionStorage.setItem(DASH_CACHE_KEY_PREFIX + uid, JSON.stringify({ data, expiresAt: Date.now() + DASH_CACHE_TTL }));
  } catch { /* storage full — ignore */ }
}

async function fetchDashboardData(user) {
  const idToken = await user.getIdToken();
  const res = await fetch(`${profileBaseUrl}/${encodeURIComponent(user.uid)}/dashboard`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 401) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
  if (!res.ok) throw new Error('Dashboard load failed.');
  return res.json();
}

function applyDashboardData(user, data) {
  const { profile, purchases: remotePurchases } = data;
  const localPurchases = getLocalPurchases(user);
  const purchases = remotePurchases?.length
    ? mergePurchases(remotePurchases, localPurchases)
    : localPurchases;
  const displayName = profile?.name || user.displayName || user.email || 'Learner';
  if (nameEl) nameEl.textContent = displayName;
  applyProfileToForm(profileForm, profile);
  applyProfileToForm(settingsForm, profile);
  renderPurchases(purchases);
  if (profile?.completedProfile) {
    showDashboard('overview');
  } else {
    showGate();
    setFeedback(gateFeedbackEl, 'Complete your profile to unlock your dashboard.', 'info');
  }
}

async function hydrateDashboardForUser(user) {
  try {
    // Render from cache immediately so the UI appears instant
    const cached = getDashboardCache(user.uid);
    if (cached) {
      applyDashboardData(user, cached);
    }

    // Always fetch fresh data from server (cache hit there too = very fast)
    const data = await fetchDashboardData(user);
    setDashboardCache(user.uid, data);
    applyDashboardData(user, data);
    return;
  } catch (error) {
    if (error.status === 401) {
      showGate();
      renderPurchases([]);
      setFeedback(gateFeedbackEl, 'Session could not be verified. Please refresh.', 'error');
      return;
    }
    showGate();
    renderPurchases([]);
    setFeedback(gateFeedbackEl, 'Could not load profile data. Please complete your details.', 'error');
  }
}


onAuthStateChanged(auth, async (user) => {
  if (user) {
    clearUnauthRedirectTimer();
    await hydrateDashboardForUser(user);
    return;
  }

  scheduleUnauthRedirect();
});

setInterval(() => {
  if (!auth.currentUser) return;
  if (!Array.isArray(purchasesCache) || purchasesCache.length === 0) return;
  renderPurchases(purchasesCache);
}, 30000);

if (profileForm) {
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      window.location.href = '/auth?mode=signin';
      return;
    }

    const payload = extractProfilePayload(profileForm, user);

    if (!validateRequiredProfile(payload)) {
      setFeedback(gateFeedbackEl, 'Please fill all required profile fields.', 'error');
      return;
    }

    try {
      setFeedback(gateFeedbackEl, 'Saving profile...', 'info');
      const savedProfile = await saveProfile(user, payload);
      if (nameEl) nameEl.textContent = savedProfile?.name || payload.name;
      applyProfileToForm(settingsForm, savedProfile || payload);
      setFeedback(gateFeedbackEl, 'Profile completed. Dashboard unlocked.', 'success');
      setFeedback(settingsFeedbackEl, '');
      showDashboard('settings');
    } catch (_error) {
      setFeedback(gateFeedbackEl, 'Could not save profile. Please try again.', 'error');
    }
  });
}

if (settingsForm) {
  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      window.location.href = '/auth?mode=signin';
      return;
    }

    const payload = extractProfilePayload(settingsForm, user);
    if (!validateRequiredProfile(payload)) {
      setFeedback(settingsFeedbackEl, 'Please fill all required profile fields.', 'error');
      return;
    }

    try {
      setFeedback(settingsFeedbackEl, 'Saving changes...', 'info');
      const savedProfile = await saveProfile(user, payload);
      // Bust client cache so next open shows fresh data
      try { sessionStorage.removeItem(DASH_CACHE_KEY_PREFIX + user.uid); } catch { /* ignore */ }
      if (nameEl) nameEl.textContent = savedProfile?.name || payload.name;
      applyProfileToForm(settingsForm, savedProfile || payload);
      setFeedback(settingsFeedbackEl, 'Profile updated successfully.', 'success');
    } catch (error) {
      if (error.status === 401) {
        setFeedback(settingsFeedbackEl, 'Session verification failed. Please refresh and try again.', 'error');
        return;
      }
      setFeedback(settingsFeedbackEl, 'Could not save profile. Please try again.', 'error');
    }
  });
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveTab(button.getAttribute('data-dashboard-tab-btn'));
  });
});

if (signoutBtn) {
  signoutBtn.addEventListener('click', async () => {
    closeSupportPanel();
    const uid = auth.currentUser?.uid;
    if (uid) { try { sessionStorage.removeItem(DASH_CACHE_KEY_PREFIX + uid); } catch { /* ignore */ } }
    await signOut(auth);
    window.location.href = '/auth?mode=signin';
  });
}

if (supportFabBtn) {
  supportFabBtn.addEventListener('click', () => {
    openSupportPanel().catch((error) => {
      setSupportFeedback(error?.message || 'Could not open support chat.', 'error');
    });
  });
}

if (supportCloseBtn) {
  supportCloseBtn.addEventListener('click', () => closeSupportPanel());
}

if (adminCloseBtn) {
  adminCloseBtn.addEventListener('click', () => closeSupportPanel());
}

if (adminBackBtn) {
  adminBackBtn.addEventListener('click', () => switchToAiMode());
}

if (aiSendBtn) {
  aiSendBtn.addEventListener('click', () => {
    sendAiMessage().catch(() => {});
  });
}

if (aiInputEl) {
  aiInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAiMessage().catch(() => {});
    }
  });
}


if (supportSendBtn) {
  supportSendBtn.addEventListener('click', () => {
    sendSupportMessage()
      .then(() => setSupportFeedback('Message sent.', 'success'))
      .catch((error) => setSupportFeedback(error?.message || 'Could not send message.', 'error'));
  });
}

if (supportFeedbackForm) {
  supportFeedbackForm.addEventListener('submit', (event) => {
    submitSupportFeedback(event).catch((error) => {
      setSupportFeedback(error?.message || 'Could not submit feedback.', 'error');
    });
  });
}
