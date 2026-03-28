import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth, googleProvider } from './firebase-client.js';

const root = document.querySelector('[data-admin-page]');
if (!root) {
  // No admin page loaded.
} else {
  const allowedEmail = String(root.getAttribute('data-admin-email') || '').trim().toLowerCase();

  const signinBtn = document.getElementById('admin-google-signin-btn');
  const signoutBtn = document.getElementById('admin-signout-btn');
  const feedbackEl = document.getElementById('admin-feedback');
  const contentEl = document.getElementById('admin-content');

  const tabButtons = Array.from(document.querySelectorAll('[data-admin-tab-btn]'));
  const tabPanels = Array.from(document.querySelectorAll('[data-admin-tab-panel]'));

  const purchasedListEl = document.getElementById('admin-users-purchased');
  const notPurchasedListEl = document.getElementById('admin-users-not-purchased');
  const purchasedEmptyEl = document.getElementById('admin-users-purchased-empty');
  const notPurchasedEmptyEl = document.getElementById('admin-users-not-purchased-empty');
  const profilePreviewEl = document.getElementById('admin-profile-preview');

  const transferForm = document.getElementById('admin-transfer-form');
  const transferSourceEl = document.getElementById('admin-transfer-source');
  const transferTargetEl = document.getElementById('admin-transfer-target');
  const transferFeedbackEl = document.getElementById('admin-transfer-feedback');

  const instructorCreateForm = document.getElementById('admin-instructor-create-form');
  const instructorNameInput = document.getElementById('admin-instructor-name');
  const instructorEmailInput = document.getElementById('admin-instructor-email');
  const instructorPasswordInput = document.getElementById('admin-instructor-password');
  const instructorCreateFeedbackEl = document.getElementById('admin-instructor-create-feedback');
  const instructorListEl = document.getElementById('admin-instructor-list');
  const instructorEmptyEl = document.getElementById('admin-instructor-empty');

  const instructorResetForm = document.getElementById('admin-instructor-reset-form');
  const instructorSelectEl = document.getElementById('admin-instructor-select');
  const instructorNewEmailInput = document.getElementById('admin-instructor-new-email');
  const instructorNewPasswordInput = document.getElementById('admin-instructor-new-password');
  const instructorNewNameInput = document.getElementById('admin-instructor-new-name');
  const instructorResetFeedbackEl = document.getElementById('admin-instructor-reset-feedback');

  const slotForm = document.getElementById('admin-instructor-slot-form');
  const slotInstructorEl = document.getElementById('admin-slot-instructor');
  const slotDateEl = document.getElementById('admin-slot-date');
  const slotStartEl = document.getElementById('admin-slot-start');
  const slotEndEl = document.getElementById('admin-slot-end');
  const slotFeedbackEl = document.getElementById('admin-slot-feedback');
  const slotListEl = document.getElementById('admin-slot-list');

  const supportChatListEl = document.getElementById('admin-support-chat-list');
  const supportChatEmptyEl = document.getElementById('admin-support-chat-empty');
  const supportChatMetaEl = document.getElementById('admin-support-chat-meta');
  const supportChatMessagesEl = document.getElementById('admin-support-chat-messages');
  const supportMessageInput = document.getElementById('admin-support-message-input');
  const supportImageInput = document.getElementById('admin-support-image-input');
  const supportSendBtn = document.getElementById('admin-support-send');
  const supportEndBtn = document.getElementById('admin-support-end');
  const supportFeedbackEl = document.getElementById('admin-support-feedback');

  let currentUser = null;
  let currentToken = '';
  let usersWithPurchases = [];
  let usersWithoutPurchases = [];
  let supportChats = [];
  let activeSupportChatId = 0;
  let supportPollTimer = null;
  let instructors = [];

  function setFeedback(el, message = '', type = 'info') {
    if (!el) return;
    if (!message) {
      el.className = 'auth-feedback';
      el.textContent = '';
      return;
    }
    el.className = `auth-feedback auth-feedback-${type}`;
    el.textContent = message;
  }

  function setActiveTab(tabName) {
    const activeTab = ['purchased', 'not-purchased', 'instructors', 'support'].includes(tabName) ? tabName : 'purchased';
    tabButtons.forEach((btn) => {
      const isActive = btn.getAttribute('data-admin-tab-btn') === activeTab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    tabPanels.forEach((panel) => {
      const isActive = panel.getAttribute('data-admin-tab-panel') === activeTab;
      panel.classList.toggle('active', isActive);
    });

    if (activeTab === 'support') {
      loadSupportChats().catch((error) => {
        setFeedback(supportFeedbackEl, error?.message || 'Could not load support chats.', 'error');
      });
      if (!supportPollTimer) {
        supportPollTimer = setInterval(() => {
          loadSupportChats().catch(() => {
            // Silent polling errors.
          });
          if (activeSupportChatId) {
            loadSupportChatDetail(activeSupportChatId).catch(() => {
              // Silent polling errors.
            });
          }
        }, 7000);
      }
    } else if (supportPollTimer) {
      clearInterval(supportPollTimer);
      supportPollTimer = null;
    }

    if (activeTab === 'instructors') {
      loadInstructors().catch((error) => {
        setFeedback(instructorCreateFeedbackEl, error?.message || 'Could not load instructors.', 'error');
      });
    }
  }

  function formatSlotDate(dateValue) {
    if (!dateValue) return 'Unknown date';
    const date = new Date(`${dateValue}T00:00:00+05:30`);
    if (Number.isNaN(date.getTime())) return dateValue;
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function showAuthorizedState() {
    if (contentEl) contentEl.hidden = false;
    if (signinBtn) signinBtn.hidden = true;
    if (signoutBtn) signoutBtn.hidden = false;
  }

  function showUnauthorizedState(message) {
    if (contentEl) contentEl.hidden = true;
    if (signinBtn) signinBtn.hidden = false;
    if (signoutBtn) signoutBtn.hidden = true;
    setFeedback(feedbackEl, message, 'error');
  }

  function optionLabel(user) {
    const name = user.displayName || user.email || user.uid;
    const count = Number(user.purchaseCount || 0);
    return `${name} (${user.email || user.uid}) - ${count} course${count === 1 ? '' : 's'}`;
  }

  function renderTransferOptions() {
    if (!transferSourceEl || !transferTargetEl) return;

    transferSourceEl.innerHTML = '';
    transferTargetEl.innerHTML = '';

    usersWithPurchases.forEach((user) => {
      const option = document.createElement('option');
      option.value = user.uid;
      option.textContent = optionLabel(user);
      transferSourceEl.appendChild(option);
    });

    usersWithoutPurchases.forEach((user) => {
      const option = document.createElement('option');
      option.value = user.uid;
      option.textContent = optionLabel(user);
      transferTargetEl.appendChild(option);
    });
  }

  function readImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read image file.'));
      reader.readAsDataURL(file);
    });
  }

  function formatWhen(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  }

  async function fetchUserProfile(uid) {
    if (!currentToken || !uid) return;
    setFeedback(feedbackEl, 'Loading profile...', 'info');

    const response = await fetch(`/admin/api/users/${encodeURIComponent(uid)}/profile`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Could not load profile.');
    }

    return payload.profile;
  }

  function renderProfile(profile) {
    if (!profilePreviewEl) return;

    if (!profile) {
      profilePreviewEl.textContent = 'Profile not found.';
      return;
    }

    profilePreviewEl.innerHTML = `
      <div><strong>Name:</strong> ${profile.name || '-'}</div>
      <div><strong>Email:</strong> ${profile.email || '-'}</div>
      <div><strong>Age:</strong> ${profile.age || '-'}</div>
      <div><strong>Nationality:</strong> ${profile.nationality || '-'}</div>
      <div><strong>Phone:</strong> ${profile.phoneNumber || '-'}</div>
      <div><strong>Gender:</strong> ${profile.gender || '-'}</div>
      <div><strong>City:</strong> ${profile.city || '-'}</div>
      <div><strong>Education:</strong> ${profile.education || '-'}</div>
      <div><strong>UID:</strong> ${profile.uid || '-'}</div>
    `;
  }

  function createUserButton(user) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-user-item';
    button.textContent = optionLabel(user);
    button.addEventListener('click', async () => {
      try {
        const profile = await fetchUserProfile(user.uid);
        renderProfile(profile);
        setFeedback(feedbackEl, 'Profile loaded.', 'success');
      } catch (error) {
        setFeedback(feedbackEl, error?.message || 'Could not load profile.', 'error');
      }
    });
    return button;
  }

  function renderUserLists() {
    if (purchasedListEl) purchasedListEl.innerHTML = '';
    if (notPurchasedListEl) notPurchasedListEl.innerHTML = '';

    usersWithPurchases.forEach((user) => {
      if (purchasedListEl) purchasedListEl.appendChild(createUserButton(user));
    });

    usersWithoutPurchases.forEach((user) => {
      if (notPurchasedListEl) notPurchasedListEl.appendChild(createUserButton(user));
    });

    if (purchasedEmptyEl) purchasedEmptyEl.hidden = usersWithPurchases.length > 0;
    if (notPurchasedEmptyEl) notPurchasedEmptyEl.hidden = usersWithoutPurchases.length > 0;

    renderTransferOptions();
  }

  async function loadUsers() {
    if (!currentToken) return;

    setFeedback(feedbackEl, 'Loading activated users...', 'info');

    const response = await fetch('/admin/api/users', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Could not load users.');
    }

    usersWithPurchases = Array.isArray(payload.usersWithPurchases) ? payload.usersWithPurchases : [];
    usersWithoutPurchases = Array.isArray(payload.usersWithoutPurchases) ? payload.usersWithoutPurchases : [];

    renderUserLists();
    setFeedback(feedbackEl, 'Admin data loaded.', 'success');
  }

  function renderInstructorOptions() {
    const targets = [instructorSelectEl, slotInstructorEl];
    targets.forEach((select) => {
      if (!select) return;
      select.innerHTML = '';
      instructors.forEach((instructor) => {
        const option = document.createElement('option');
        option.value = instructor.instructorUid;
        option.textContent = `${instructor.displayName} (${instructor.email})`;
        select.appendChild(option);
      });
    });
  }

  function renderInstructorList() {
    if (!instructorListEl) return;
    instructorListEl.innerHTML = '';

    instructors.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'admin-user-item';
      row.textContent = `${item.displayName} (${item.email}) - ${item.totalSlots || 0} slots`;
      instructorListEl.appendChild(row);
    });

    if (instructorEmptyEl) instructorEmptyEl.hidden = instructors.length > 0;
  }

  async function loadSlotsForSelectedInstructor() {
    if (!currentToken || !slotInstructorEl || !slotListEl) return;
    const instructorUid = String(slotInstructorEl.value || '').trim();
    if (!instructorUid) {
      slotListEl.textContent = 'No instructor selected.';
      return;
    }

    const response = await fetch(`/admin/api/instructors/${encodeURIComponent(instructorUid)}/slots`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Could not load slots.');
    }

    const slots = Array.isArray(payload.slots) ? payload.slots : [];
    slotListEl.innerHTML = '';
    if (!slots.length) {
      slotListEl.textContent = 'No slots configured for this instructor yet.';
      return;
    }

    slots.forEach((slot) => {
      const row = document.createElement('div');
      row.className = 'admin-user-item';
      const dateLabel = formatSlotDate(slot.slotDate);
      row.textContent = `${dateLabel} ${slot.startTime}-${slot.endTime} IST`;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'dashboard-course-action-btn';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        removeInstructorSlot(instructorUid, slot.id).catch((error) => {
          setFeedback(slotFeedbackEl, error?.message || 'Could not remove slot.', 'error');
        });
      });

      row.appendChild(remove);
      slotListEl.appendChild(row);
    });
  }

  async function loadInstructors() {
    if (!currentToken) return;
    const response = await fetch('/admin/api/instructors', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Could not load instructors.');
    }

    instructors = Array.isArray(payload.instructors) ? payload.instructors : [];
    renderInstructorList();
    renderInstructorOptions();
    await loadSlotsForSelectedInstructor();
  }

  async function createInstructor(event) {
    event.preventDefault();
    if (!currentToken) return;

    const displayName = String(instructorNameInput?.value || '').trim();
    const email = String(instructorEmailInput?.value || '').trim();
    const password = String(instructorPasswordInput?.value || '');

    const response = await fetch('/admin/api/instructors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ displayName, email, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Could not create instructor.');
    }

    if (instructorCreateForm) instructorCreateForm.reset();
    await loadInstructors();
    setFeedback(instructorCreateFeedbackEl, 'Instructor account created.', 'success');
  }

  async function resetInstructorAccount(event) {
    event.preventDefault();
    if (!currentToken || !instructorSelectEl) return;

    const instructorUid = String(instructorSelectEl.value || '').trim();
    const email = String(instructorNewEmailInput?.value || '').trim();
    const password = String(instructorNewPasswordInput?.value || '');
    const displayName = String(instructorNewNameInput?.value || '').trim();

    const response = await fetch(`/admin/api/instructors/${encodeURIComponent(instructorUid)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ email, password, displayName }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Could not update instructor account.');
    }

    if (instructorResetForm) instructorResetForm.reset();
    await loadInstructors();
    setFeedback(instructorResetFeedbackEl, 'Instructor account updated.', 'success');
  }

  async function addInstructorSlot(event) {
    event.preventDefault();
    if (!currentToken || !slotInstructorEl) return;

    const instructorUid = String(slotInstructorEl.value || '').trim();
    const slotDate = String(slotDateEl?.value || '').trim();
    const startTime = String(slotStartEl?.value || '').trim();
    const endTime = String(slotEndEl?.value || '').trim();

    const response = await fetch(`/admin/api/instructors/${encodeURIComponent(instructorUid)}/slots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ slotDate, startTime, endTime }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Could not save slot.');
    }

    await loadInstructors();
    setFeedback(slotFeedbackEl, 'Availability slot saved.', 'success');
  }

  async function removeInstructorSlot(instructorUid, slotId) {
    if (!currentToken) return;
    const response = await fetch(
      `/admin/api/instructors/${encodeURIComponent(instructorUid)}/slots/${encodeURIComponent(String(slotId))}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Could not delete slot.');
    }

    await loadInstructors();
    setFeedback(slotFeedbackEl, 'Availability slot removed.', 'success');
  }

  function renderSupportMessages(messages = []) {
    if (!supportChatMessagesEl) return;
    supportChatMessagesEl.innerHTML = '';

    if (!messages.length) {
      supportChatMessagesEl.textContent = 'No messages in this chat yet.';
      return;
    }

    const frag = document.createDocumentFragment();
    messages.forEach((message) => {
      const wrap = document.createElement('div');
      wrap.className = `support-msg support-msg-${message.senderRole === 'admin' ? 'admin' : 'user'}`;

      const text = document.createElement('div');
      text.className = 'support-msg-text';
      text.textContent = message.message || '';
      wrap.appendChild(text);

      if (message.image?.dataUrl) {
        const img = document.createElement('img');
        img.src = message.image.dataUrl;
        img.alt = message.image.fileName || 'chat image';
        img.className = 'support-msg-image';
        wrap.appendChild(img);
      }

      const meta = document.createElement('div');
      meta.className = 'support-msg-time';
      meta.textContent = `${message.senderRole === 'admin' ? 'Admin' : 'User'} · ${formatWhen(message.createdAt)}`;
      wrap.appendChild(meta);
      frag.appendChild(wrap);
    });

    supportChatMessagesEl.appendChild(frag);
    supportChatMessagesEl.scrollTop = supportChatMessagesEl.scrollHeight;
  }

  function renderSupportChatMeta(detail) {
    if (!supportChatMetaEl) return;
    if (!detail) {
      supportChatMetaEl.textContent = 'Select a chat to view details.';
      return;
    }

    const profile = detail.profile;
    const purchases = Array.isArray(detail.purchases) ? detail.purchases : [];
    const purchaseList = purchases.length
      ? purchases.map((p) => `<li>${p.courseTitle || `Course #${p.courseId}`}</li>`).join('')
      : '<li>No purchased courses.</li>';

    supportChatMetaEl.innerHTML = `
      <div><strong>Chat:</strong> #${detail.chat.id} (${detail.chat.status})</div>
      <div><strong>User:</strong> ${detail.user.displayName || '-'} (${detail.user.email || detail.user.uid})</div>
      <div><strong>Started:</strong> ${formatWhen(detail.chat.startedAt)}</div>
      <div><strong>Ended:</strong> ${formatWhen(detail.chat.endedAt)}</div>
      <div><strong>Profile:</strong> ${profile ? 'Activated' : 'Not Available'}</div>
      ${profile ? `<div><strong>Profile Name:</strong> ${profile.name || '-'}</div>` : ''}
      ${profile ? `<div><strong>City:</strong> ${profile.city || '-'}</div>` : ''}
      ${profile ? `<div><strong>Phone:</strong> ${profile.phoneNumber || '-'}</div>` : ''}
      <div><strong>Linked Courses:</strong></div>
      <ul>${purchaseList}</ul>
      ${detail.chat.feedbackRequestedAt ? `<div><strong>Feedback Requested:</strong> ${formatWhen(detail.chat.feedbackRequestedAt)}</div>` : ''}
      ${detail.chat.feedbackSubmittedAt ? `<div><strong>Feedback Submitted:</strong> ${formatWhen(detail.chat.feedbackSubmittedAt)} (Rating: ${detail.chat.feedbackRating || '-'})</div>` : ''}
      ${detail.chat.feedbackComment ? `<div><strong>Feedback Comment:</strong> ${detail.chat.feedbackComment}</div>` : ''}
    `;

    const canReply = detail.chat.status === 'open';
    if (supportMessageInput) supportMessageInput.disabled = !canReply;
    if (supportImageInput) supportImageInput.disabled = !canReply;
    if (supportSendBtn) supportSendBtn.disabled = !canReply;
    if (supportEndBtn) supportEndBtn.disabled = !canReply;
  }

  async function loadSupportChats() {
    if (!currentToken) return;

    const response = await fetch('/api/support/admin/chats', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Could not load support chats.');
    }

    supportChats = Array.isArray(payload.chats) ? payload.chats : [];
    if (!activeSupportChatId && supportChats[0]) {
      activeSupportChatId = Number(supportChats[0].id);
    }

    if (activeSupportChatId && !supportChats.some((chat) => Number(chat.id) === Number(activeSupportChatId))) {
      activeSupportChatId = supportChats[0] ? Number(supportChats[0].id) : 0;
    }

    if (supportChatListEl) supportChatListEl.innerHTML = '';

    supportChats.forEach((chat) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-user-item';
      if (Number(chat.id) === Number(activeSupportChatId)) button.classList.add('active');
      const userName = chat.user?.displayName || chat.user?.email || chat.uid;
      button.textContent = `#${chat.id} ${chat.status === 'open' ? 'Open' : 'Ended'} - ${userName}`;
      button.addEventListener('click', () => {
        activeSupportChatId = Number(chat.id);
        loadSupportChatDetail(activeSupportChatId).catch((error) => {
          setFeedback(supportFeedbackEl, error?.message || 'Could not open chat.', 'error');
        });
      });

      if (supportChatListEl) supportChatListEl.appendChild(button);
    });

    if (supportChatEmptyEl) supportChatEmptyEl.hidden = supportChats.length > 0;

    if (activeSupportChatId) {
      await loadSupportChatDetail(activeSupportChatId);
    }
  }

  async function loadSupportChatDetail(chatId) {
    if (!currentToken || !chatId) return;

    const response = await fetch(`/api/support/admin/chats/${encodeURIComponent(chatId)}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Could not load chat details.');
    }

    renderSupportChatMeta(payload);
    renderSupportMessages(Array.isArray(payload.messages) ? payload.messages : []);
  }

  async function sendSupportReply() {
    if (!currentToken || !activeSupportChatId) {
      setFeedback(supportFeedbackEl, 'Select a support chat first.', 'error');
      return;
    }

    const message = String(supportMessageInput?.value || '').trim();
    const file = supportImageInput?.files?.[0] || null;
    let image = null;

    if (!message && !file) {
      setFeedback(supportFeedbackEl, 'Message or image is required.', 'error');
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

    const response = await fetch(`/api/support/admin/chats/${encodeURIComponent(activeSupportChatId)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ message, image }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Could not send reply.');
    }

    if (supportMessageInput) supportMessageInput.value = '';
    if (supportImageInput) supportImageInput.value = '';

    await loadSupportChats();
    await loadSupportChatDetail(activeSupportChatId);
    setFeedback(supportFeedbackEl, 'Reply sent.', 'success');
  }

  async function endSupportChat() {
    if (!currentToken || !activeSupportChatId) {
      setFeedback(supportFeedbackEl, 'Select a support chat first.', 'error');
      return;
    }

    const response = await fetch(`/api/support/admin/chats/${encodeURIComponent(activeSupportChatId)}/end`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Could not end chat.');
    }

    await loadSupportChats();
    await loadSupportChatDetail(activeSupportChatId);
    setFeedback(supportFeedbackEl, 'Chat ended and feedback request saved.', 'success');
  }

  async function handleTransfer(event) {
    event.preventDefault();
    if (!currentToken) {
      setFeedback(transferFeedbackEl, 'Please sign in first.', 'error');
      return;
    }

    const sourceUid = String(transferSourceEl?.value || '').trim();
    const targetUid = String(transferTargetEl?.value || '').trim();

    if (!sourceUid || !targetUid) {
      setFeedback(transferFeedbackEl, 'Please choose source and target accounts.', 'error');
      return;
    }

    if (sourceUid === targetUid) {
      setFeedback(transferFeedbackEl, 'Source and target must be different.', 'error');
      return;
    }

    setFeedback(transferFeedbackEl, 'Transferring courses...', 'info');

    const response = await fetch('/admin/api/transfer-courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ sourceUid, targetUid }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      setFeedback(transferFeedbackEl, payload?.error || 'Transfer failed.', 'error');
      return;
    }

    setFeedback(
      transferFeedbackEl,
      `Transfer complete. ${payload.transferredCourses} courses moved. Source account removed from app records.`,
      'success',
    );

    await loadUsers();
    renderProfile(null);
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.getAttribute('data-admin-tab-btn')));
  });

  if (signinBtn) {
    signinBtn.addEventListener('click', async () => {
      if (auth.currentUser) {
        try {
          await signOut(auth);
          setFeedback(feedbackEl, 'Logged out existing user session. Continue with admin sign-in.', 'info');
        } catch {
          setFeedback(feedbackEl, 'Could not clear existing session. Please try again.', 'error');
          return;
        }
      }

      googleProvider.setCustomParameters({ prompt: 'select_account' });
      setFeedback(feedbackEl, 'Signing in with Google as admin...', 'info');
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        setFeedback(feedbackEl, error?.message || 'Google sign-in failed.', 'error');
      }
    });
  }

  if (signoutBtn) {
    signoutBtn.addEventListener('click', async () => {
      await signOut(auth);
      showUnauthorizedState('Signed out.');
    });
  }

  if (transferForm) {
    transferForm.addEventListener('submit', (event) => {
      handleTransfer(event).catch((error) => {
        setFeedback(transferFeedbackEl, error?.message || 'Transfer failed.', 'error');
      });
    });
  }

  if (instructorCreateForm) {
    instructorCreateForm.addEventListener('submit', (event) => {
      createInstructor(event).catch((error) => {
        setFeedback(instructorCreateFeedbackEl, error?.message || 'Could not create instructor.', 'error');
      });
    });
  }

  if (instructorResetForm) {
    instructorResetForm.addEventListener('submit', (event) => {
      resetInstructorAccount(event).catch((error) => {
        setFeedback(instructorResetFeedbackEl, error?.message || 'Could not update instructor.', 'error');
      });
    });
  }

  if (slotForm) {
    slotForm.addEventListener('submit', (event) => {
      addInstructorSlot(event).catch((error) => {
        setFeedback(slotFeedbackEl, error?.message || 'Could not save slot.', 'error');
      });
    });
  }

  if (slotInstructorEl) {
    slotInstructorEl.addEventListener('change', () => {
      loadSlotsForSelectedInstructor().catch((error) => {
        setFeedback(slotFeedbackEl, error?.message || 'Could not load slots.', 'error');
      });
    });
  }

  if (supportSendBtn) {
    supportSendBtn.addEventListener('click', () => {
      sendSupportReply().catch((error) => {
        setFeedback(supportFeedbackEl, error?.message || 'Could not send reply.', 'error');
      });
    });
  }

  if (supportEndBtn) {
    supportEndBtn.addEventListener('click', () => {
      endSupportChat().catch((error) => {
        setFeedback(supportFeedbackEl, error?.message || 'Could not end chat.', 'error');
      });
    });
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    currentToken = '';

    if (!currentUser) {
      showUnauthorizedState('Please sign in with the admin Google account.');
      return;
    }

    const email = String(currentUser.email || '').trim().toLowerCase();
    const hasGoogleProvider = Array.isArray(currentUser.providerData)
      && currentUser.providerData.some((provider) => provider?.providerId === 'google.com');

    if (!hasGoogleProvider) {
      await signOut(auth);
      showUnauthorizedState('Access denied. Admin login is allowed only via Google sign-in.');
      return;
    }

    if (!email || email !== allowedEmail) {
      await signOut(auth);
      showUnauthorizedState('Access denied. Only the configured admin email can access this page.');
      return;
    }

    try {
      currentToken = await currentUser.getIdToken(true);
      showAuthorizedState();
      await loadUsers();
      await loadInstructors();
      await loadSupportChats();
    } catch {
      showUnauthorizedState('Could not validate admin session. Please sign in again.');
    }
  });

  setActiveTab('purchased');
}
