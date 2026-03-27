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
const profileBaseUrl = '/api/profile';

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
  if (gatePillEl) gatePillEl.textContent = 'Required';
  if (gatePillEl) gatePillEl.classList.remove('dashboard-required-complete');
  if (gateCopyEl) gateCopyEl.textContent = 'Complete your profile to unlock your full dashboard experience.';
  if (saveProfileBtn) saveProfileBtn.textContent = 'Save Profile & Unlock Dashboard';
}

function showDashboard(activeTab = 'overview') {
  if (gate) gate.hidden = true;
  if (content) content.hidden = false;
  setActiveTab(activeTab);
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

  if (!Array.isArray(purchases) || purchases.length === 0) {
    purchasedEmptyEl.hidden = false;
    return;
  }

  purchasedEmptyEl.hidden = true;
  const fragment = document.createDocumentFragment();

  purchases.forEach((purchase) => {
    const item = document.createElement('a');
    item.className = 'dashboard-course-item';
    item.href = `/courses/${encodeURIComponent(purchase.courseId)}`;

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

    const open = document.createElement('span');
    open.className = 'dashboard-course-arrow';
    open.textContent = 'Open';

    item.append(titleWrap, status, open);
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

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/auth?mode=signin';
    return;
  }

  try {
    const profile = await loadProfile(user);
    const localPurchases = getLocalPurchases(user);
    let purchases = localPurchases;
    try {
      const remotePurchases = await loadPurchases(user);
      purchases = mergePurchases(remotePurchases, localPurchases);
    } catch {
      purchases = localPurchases;
    }
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
  } catch (error) {
    if (error.status === 401) {
      showGate();
      renderPurchases([]);
      setFeedback(gateFeedbackEl, 'Session could not be verified by server. Please refresh and try again.', 'error');
      return;
    }
    showGate();
    renderPurchases([]);
    setFeedback(gateFeedbackEl, 'Could not load profile data. Please complete your details.', 'error');
  }
});

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
    await signOut(auth);
    window.location.href = '/auth?mode=signin';
  });
}
