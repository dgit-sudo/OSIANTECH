import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-client.js';

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
