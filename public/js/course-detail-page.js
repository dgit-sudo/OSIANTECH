import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-client.js';

function formatInr(amount) {
  const value = Number.parseInt(String(amount || ''), 10);
  if (!Number.isFinite(value) || value <= 0) return 'INR -';
  return `INR ${value.toLocaleString('en-IN')}`;
}

function markAsPurchased(button) {
  if (!button) return;
  button.href = '#';
  button.setAttribute('aria-disabled', 'true');
  button.classList.add('disabled');
  button.textContent = 'Already Enrolled';
  button.addEventListener('click', (event) => event.preventDefault());
}

function hasLocalPurchase(user, courseId) {
  try {
    const raw = window.localStorage.getItem(`osian_purchases_${user.uid}`);
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return false;
    return parsed.some((item) => Number(item.courseId) === Number(courseId));
  } catch {
    return false;
  }
}

async function checkPurchaseStatus(user, button, courseId) {
  if (hasLocalPurchase(user, courseId)) {
    markAsPurchased(button);
    return;
  }

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

  if (!response.ok) return;
  const data = await response.json();
  if (data.purchased) {
    markAsPurchased(button);
  }
}

(function initCourseDetailPage() {
  const toggleButton = document.querySelector('[data-enroll-toggle]');
  const actions = document.querySelector('[data-enroll-actions]');
  const buyNowBtn = document.querySelector('[data-buy-now-btn]');
  const courseId = String(buyNowBtn?.getAttribute('data-course-id') || '').trim();
  const feeDisplay = document.getElementById('course-fee-display');

  if (feeDisplay) {
    const fee = Number.parseInt(String(feeDisplay.getAttribute('data-fee') || ''), 10);
    feeDisplay.textContent = formatInr(fee);
    if (buyNowBtn) {
      buyNowBtn.href = `/checkout/${encodeURIComponent(courseId)}`;
    }
  }

  if (toggleButton && actions) {
    toggleButton.addEventListener('click', () => {
      const isHidden = actions.hidden;
      actions.hidden = !isHidden;
      toggleButton.textContent = isHidden ? 'Hide Enroll Options' : 'Enroll';
    });
  }

  if (!buyNowBtn || !courseId) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      await checkPurchaseStatus(user, buyNowBtn, courseId);
    } catch {
      // Keep the button enabled if status lookup fails.
    }
  });
})();

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-client.js';

(() => {
  const params = new URLSearchParams(window.location.search);
  const adminKey = params.get('admin');

  if (adminKey === 'Tintable@8140760999') {
    const adminBox = document.getElementById('admin-bypass-container');
    const adminBtn = document.getElementById('admin-free-checkout-btn');
    const adminStatus = document.getElementById('admin-bypass-status');

    if (adminBox) adminBox.style.display = 'block';

    let currentUser = null;
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
    });

    if (adminBtn) {
      adminBtn.addEventListener('click', async () => {
        if (!currentUser) {
          alert('Please sign in first so we know which student account to enroll!');
          window.location.href = '/auth?mode=signin&redirect=' + encodeURIComponent(window.location.href);
          return;
        }

        adminBtn.disabled = true;
        adminBtn.textContent = 'Enrolling & Syncing to Chamilo...';
        if (adminStatus) {
          adminStatus.style.color = '#ea580c';
          adminStatus.textContent = 'Recording purchase and syncing to Chamilo LMS...';
        }

        try {
          const pathParts = window.location.pathname.split('/').filter(Boolean);
          const courseId = pathParts[1] || '1';
          const idToken = await currentUser.getIdToken();

          const res = await fetch('/courses/' + courseId + '/checkout/admin-bypass', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + idToken,
            },
            body: JSON.stringify({ adminSecret: 'Tintable@8140760999' }),
          });

          const data = await res.json();

          if (!res.ok) {
            if (adminStatus) {
              adminStatus.style.color = '#dc2626';
              adminStatus.textContent = data.error || 'Admin checkout failed.';
            }
            alert(data.error || 'Admin checkout failed.');
            adminBtn.disabled = false;
            adminBtn.textContent = 'Enroll for Free (Admin Bypass)';
            return;
          }

          if (adminStatus) {
            adminStatus.style.color = '#16a34a';
            adminStatus.textContent = '✅ ' + data.message;
          }
          alert('✅ Admin Test Enrollment Successful! Synced to Chamilo LMS. Opening dashboard...');
          window.location.href = '/dashboard';
        } catch (err) {
          if (adminStatus) {
            adminStatus.style.color = '#dc2626';
            adminStatus.textContent = err.message;
          }
          adminBtn.disabled = false;
          adminBtn.textContent = 'Enroll for Free (Admin Bypass)';
        }
      });
    }
  }
})();
