import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-client.js';

const countryForm = document.getElementById('checkout-country-form');
const countryInput = document.getElementById('checkout-country');
const cityInput = document.getElementById('checkout-city');
const postalCodeInput = document.getElementById('checkout-postal-code');
const couponCodeInput = document.getElementById('checkout-coupon-code');
const detectLocationBtn = document.getElementById('checkout-detect-location-btn');
const paymentPanel = document.getElementById('checkout-payment-panel');
const payBtn = document.getElementById('checkout-pay-btn');
const feedbackEl = document.getElementById('checkout-feedback');
const currentFeeEl = document.getElementById('checkout-current-fee');
const baseFeeEl = document.getElementById('checkout-base-fee');
const gstFeeEl = document.getElementById('checkout-gst-fee');
const currencyEl = document.getElementById('checkout-currency');

let selectedCountry = '';
let selectedCity = '';
let selectedPostalCode = '';
let selectedCouponCode = '';
let currentUser = null;
let locationDenied = false;
let checkoutQuote = null;

const currencyStorageKey = 'osian-currency';

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

function getSelectedCurrency() {
  return String(window.localStorage.getItem(currencyStorageKey) || 'INR').toUpperCase();
}

function getEnteredCouponCode() {
  return String(couponCodeInput?.value || selectedCouponCode || '').trim();
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

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout SDK'));
    document.head.appendChild(script);
  });
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
    throw new Error('Reverse geocoding failed');
  }

  const payload = await response.json();
  const address = payload?.address || {};
  const city = address.city || address.town || address.village || address.county || '';
  const country = address.country || '';
  return { city: String(city).trim(), country: String(country).trim() };
}

if (detectLocationBtn) {
  detectLocationBtn.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      setFeedback('Geolocation is not supported in this browser. Please enter city manually.', 'error');
      return;
    }

    setFeedback('Detecting your location...', 'info');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const loc = await reverseGeocode(latitude, longitude);
          if (cityInput && loc.city) cityInput.value = loc.city;
          if (countryInput && loc.country) countryInput.value = loc.country;
          locationDenied = false;
          setFeedback('Location detected. Please verify city and continue.', 'success');
        } catch {
          setFeedback('Could not map coordinates to city. Please enter city manually.', 'error');
        }
      },
      (error) => {
        locationDenied = error?.code === 1;
        setFeedback('Location access denied. Please enter city manually.', 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  });
}

const cityFromQuery = new URLSearchParams(window.location.search).get('city');
if (cityInput && cityFromQuery) {
  cityInput.value = cityFromQuery;
}

async function requestQuote(courseId) {
  const response = await fetch(`/courses/${encodeURIComponent(courseId)}/checkout/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      country: selectedCountry,
      city: selectedCity,
      postalCode: selectedPostalCode,
      offerId: selectedCouponCode,
      selectedCurrency: getSelectedCurrency(),
      locationDenied,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || 'Could not fetch checkout quote.');
  }

  const payload = await response.json();
  return payload.quote;
}

function renderQuote(quote) {
  checkoutQuote = quote;
  if (currencyEl) currencyEl.textContent = quote.currency;
  if (baseFeeEl) baseFeeEl.textContent = quote.baseAmountDisplay;
  if (gstFeeEl) gstFeeEl.textContent = `${quote.gstAmountDisplay} (${quote.gstPercent}%)`;
  if (currentFeeEl) currentFeeEl.textContent = quote.totalAmountDisplay;
}

async function openRazorpay(courseId, idToken, couponCode = '') {
  const response = await fetch(`/courses/${encodeURIComponent(courseId)}/checkout/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      country: selectedCountry,
      city: selectedCity,
      postalCode: selectedPostalCode,
      offerId: couponCode,
      selectedCurrency: getSelectedCurrency(),
      locationDenied,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Could not create Razorpay order.');
  }

  if (payload.quote) renderQuote(payload.quote);

  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const instance = new window.Razorpay({
      key: payload.keyId,
      amount: payload.amount,
      currency: payload.currency,
      name: 'Osian Academy',
      description: payload.courseTitle,
      order_id: payload.orderId,
      prefill: {
        name: currentUser?.displayName || '',
        email: currentUser?.email || '',
      },
      notes: {
        country: selectedCountry,
        city: selectedCity,
        postalCode: selectedPostalCode,
      },
      handler: async (rzp) => {
        try {
          const verifyResponse = await fetch(`/courses/${encodeURIComponent(courseId)}/checkout/verify-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              razorpay_order_id: rzp.razorpay_order_id,
              razorpay_payment_id: rzp.razorpay_payment_id,
              razorpay_signature: rzp.razorpay_signature,
            }),
          });

          const verifyPayload = await verifyResponse.json().catch(() => ({}));
          if (!verifyResponse.ok || !verifyPayload?.ok) {
            throw new Error(verifyPayload?.error || 'Payment verification failed.');
          }

          saveLocalPurchase(currentUser.uid, {
            courseId: Number.parseInt(String(courseId), 10),
            courseTitle: payload.courseTitle,
            purchaseDate: new Date().toISOString(),
            source: 'razorpay',
            paymentId: rzp.razorpay_payment_id,
          });

          resolve({
            courseTitle: payload.courseTitle,
            totalAmountDisplay: payload.quote?.totalAmountDisplay || checkoutQuote?.totalAmountDisplay || '',
          });
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled by user.')),
      },
      theme: { color: '#2f6f8f' },
    });

    instance.open();
  });
}

if (countryForm) {
  countryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    selectedCountry = String(countryInput?.value || '').trim();
    selectedCity = String(cityInput?.value || '').trim();
    selectedPostalCode = String(postalCodeInput?.value || '').trim();
    selectedCouponCode = getEnteredCouponCode();

    if (!selectedCity) {
      setFeedback('City is required to help us schedule your classes.', 'error');
      return;
    }

    if (!selectedCountry) {
      setFeedback('Country is required to decide live class timings.', 'error');
      return;
    }

    if (!selectedPostalCode) {
      setFeedback('Postal code is required for tax and billing rules.', 'error');
      return;
    }

    const courseId = getCourseIdFromPath();
    if (!courseId) {
      setFeedback('Unable to determine course for checkout.', 'error');
      return;
    }

    try {
      const quote = await requestQuote(courseId);
      renderQuote(quote);
      if (paymentPanel) paymentPanel.hidden = false;
      const offerNote = selectedCouponCode ? ' Coupon code will be validated during Razorpay payment.' : '';
      setFeedback(`Pricing summary is ready. You can continue to Razorpay payment.${offerNote}`, 'success');
    } catch (error) {
      setFeedback(error?.message || 'Could not prepare checkout quote.', 'error');
    }
  });
}

if (payBtn) {
  payBtn.addEventListener('click', async () => {
    if (!currentUser) {
      setFeedback('Please sign in before checkout.', 'error');
      window.location.href = '/auth?mode=signin';
      return;
    }

    if (!selectedCountry || !selectedCity || !selectedPostalCode) {
      setFeedback('Please submit city, country, and postal code first.', 'error');
      return;
    }

    setFeedback('Preparing Razorpay checkout...', 'info');

    try {
      const courseId = getCourseIdFromPath();
      const idToken = await currentUser.getIdToken();
      const couponCode = getEnteredCouponCode();

      if (!courseId) {
        setFeedback('Unable to determine course for checkout.', 'error');
        return;
      }

      if (couponCode && !/^offer_[a-zA-Z0-9]+$/.test(couponCode)) {
        setFeedback('Invalid coupon code. Use Razorpay Offer ID format (example: offer_xxxxx).', 'error');
        return;
      }

      const alreadyPurchased = await hasAlreadyPurchased(currentUser, courseId);
      if (alreadyPurchased) {
        setFeedback('You already purchased this course with this account.', 'error');
        return;
      }

      const result = await openRazorpay(courseId, idToken, couponCode);
      setFeedback(`Enrollment confirmed for ${result.courseTitle}. ${result.totalAmountDisplay}`, 'success');
    } catch (error) {
      setFeedback(error?.message || 'Could not complete Razorpay checkout. Please try again.', 'error');
    }
  });
}

