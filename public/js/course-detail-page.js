import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-client.js';

const METRO_CITIES = new Set([
  'mumbai',
  'delhi',
  'new delhi',
  'kolkata',
  'chennai',
  'bengaluru',
  'bangalore',
  'hyderabad',
  'pune',
  'ahmedabad',
]);

function normalizeCity(city = '') {
  return String(city)
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMetroCity(city = '') {
  const normalized = normalizeCity(city);
  return normalized ? METRO_CITIES.has(normalized) : false;
}

function formatInr(amount) {
  const value = Number.parseInt(String(amount || ''), 10);
  if (!Number.isFinite(value) || value <= 0) return 'INR -';
  return `INR ${value.toLocaleString('en-IN')}`;
}

async function reverseGeocode(lat, lon) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) {
    throw new Error('Reverse geocode failed');
  }
  const payload = await response.json();
  const address = payload?.address || {};
  return String(address.city || address.town || address.village || address.county || '').trim();
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
    const nonMetroFee = Number.parseInt(String(feeDisplay.getAttribute('data-non-metro-fee') || ''), 10);
    const metroFee = Number.parseInt(String(feeDisplay.getAttribute('data-metro-fee') || ''), 10);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const city = await reverseGeocode(position.coords.latitude, position.coords.longitude);
            const metro = isMetroCity(city);
            const selected = metro ? metroFee : nonMetroFee;
            feeDisplay.textContent = `${formatInr(selected)} (${metro ? 'Metro' : 'Non-metro'} - ${city || 'Detected'})`;
            if (buyNowBtn && city) {
              buyNowBtn.href = `/checkout/${encodeURIComponent(courseId)}?city=${encodeURIComponent(city)}`;
            }
          } catch {
            feeDisplay.textContent = `Non-metro: ${formatInr(nonMetroFee)} | Metro: ${formatInr(metroFee)}`;
          }
        },
        () => {
          feeDisplay.textContent = `Non-metro: ${formatInr(nonMetroFee)} | Metro: ${formatInr(metroFee)}`;
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
        },
      );
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
