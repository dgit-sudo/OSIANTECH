import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-client.js';

const countryForm = document.getElementById('checkout-country-form');
const countryInput = document.getElementById('checkout-country');
const paymentPanel = document.getElementById('checkout-payment-panel');
const payBtn = document.getElementById('checkout-pay-btn');
const feedbackEl = document.getElementById('checkout-feedback');

let selectedCountry = '';
let currentUser = null;

function getLocalPurchasesKey(uid) {
  return `osian_purchases_${uid}`;
}

function getLocalPurchases(uid) {
  if (!uid) return [];
  try {
    const raw = window.localStorage.getItem(getLocalPurchasesKey(uid));
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalPurchase(uid, purchase) {
  if (!uid || !purchase?.courseId) return;
  const existing = getLocalPurchases(uid);
  const exists = existing.some((item) => Number(item.courseId) === Number(purchase.courseId));
  if (exists) return;
  const next = [purchase, ...existing];
  window.localStorage.setItem(getLocalPurchasesKey(uid), JSON.stringify(next));
}

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
});

function getCourseIdFromPath() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'courses' && pathParts.length >= 2) {
    return pathParts[1];
  }
  if (pathParts[0] === 'checkout' && pathParts.length >= 2) {
    return pathParts[1];
  }
  return '';
}

async function hasAlreadyPurchased(user, courseId) {
  const local = getLocalPurchases(user.uid).some((item) => Number(item.courseId) === Number(courseId));
  if (local) return true;

  const idToken = await user.getIdToken();
  const response = await fetch(
    `/api/profile/${encodeURIComponent(user.uid)}/purchased/${encodeURIComponent(courseId)}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    },
  );

  if (!response.ok) return false;
  const data = await response.json();
  return Boolean(data.purchased);
}

async function recordPurchase(user, courseId, courseTitle) {
  const idToken = await user.getIdToken();
  const purchaseResponse = await fetch(
    `/api/profile/${encodeURIComponent(user.uid)}/purchases`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        courseId: Number.parseInt(String(courseId), 10),
        courseTitle,
      }),
    },
  );

  if (purchaseResponse.ok) {
    return { ok: true, error: '' };
  }

  let error = 'Could not save purchase record.';
  try {
    const payload = await purchaseResponse.json();
    if (payload?.error) error = payload.error;
  } catch {
    // Ignore JSON parse issues and keep default message.
  }

  return { ok: false, error };
}

function setFeedback(message = '', type = 'info') {
  if (!feedbackEl) return;
  if (!message) {
    feedbackEl.className = 'auth-feedback';
    feedbackEl.textContent = '';
    return;
  }
  feedbackEl.className = `auth-feedback auth-feedback-${type}`;
  feedbackEl.textContent = message;
}

if (countryForm) {
  countryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    selectedCountry = String(countryInput?.value || '').trim();

    if (!selectedCountry) {
      setFeedback('Country is required to decide live class timings.', 'error');
      return;
    }

    if (paymentPanel) paymentPanel.hidden = false;
    setFeedback('Country captured. You can now continue to payment.', 'success');
  });
}

if (payBtn) {
  payBtn.addEventListener('click', async () => {
    if (!currentUser) {
      setFeedback('Please sign in before checkout.', 'error');
      window.location.href = '/auth?mode=signin';
      return;
    }

    if (!selectedCountry) {
      setFeedback('Please submit country first.', 'error');
      return;
    }

    const code = window.prompt('Enter admin code to run mock checkout:');
    if (code !== 'Aa@1Dhyanam') {
      setFeedback('Invalid admin code. Payment blocked.', 'error');
      return;
    }

    setFeedback('Processing mock checkout...', 'info');

    try {
      const courseId = getCourseIdFromPath();

      if (!courseId) {
        setFeedback('Unable to determine course for checkout.', 'error');
        return;
      }

      const alreadyPurchased = await hasAlreadyPurchased(currentUser, courseId);
      if (alreadyPurchased) {
        setFeedback('You already purchased this course with this account.', 'error');
        return;
      }

      const response = await fetch(`/courses/${encodeURIComponent(courseId)}/checkout/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ country: selectedCountry }),
      });

      if (!response.ok) {
        throw new Error('Checkout failed');
      }

      const payload = await response.json();

      const saved = await recordPurchase(currentUser, courseId, payload.courseTitle);
      if (!saved.ok) {
        saveLocalPurchase(currentUser.uid, {
          courseId: Number.parseInt(String(courseId), 10),
          courseTitle: payload.courseTitle,
          purchaseDate: new Date().toISOString(),
          source: 'local-fallback',
        });
      }

      setFeedback(`Enrollment confirmed for ${payload.courseTitle}. (${payload.country})`, 'success');
    } catch {
      setFeedback('Could not complete mock checkout. Please try again.', 'error');
    }
  });
}
