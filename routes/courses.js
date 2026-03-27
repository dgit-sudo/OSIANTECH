const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');
const Razorpay = require('razorpay');

const router = express.Router();

const rawCourses = require('../data/coursesCatalog.json');
const firebaseApiKey = process.env.FIREBASE_API_KEY || '';
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
const purchasesTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(process.env.SUPABASE_PURCHASES_TABLE || '')
  ? process.env.SUPABASE_PURCHASES_TABLE
  : 'user_purchases';

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
const razorpayEnabled = Boolean(razorpayKeyId && razorpayKeySecret);

const dbReady = Boolean(connectionString);
const pool = dbReady
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : null;

const razorpay = razorpayEnabled
  ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  : null;

const supportedRazorpayCurrencies = new Set([
  'INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD', 'JPY', 'NOK', 'SEK', 'ZAR',
]);

let purchasesTableReady = false;

function getGeneratedCourseImage(courseId) {
  const id = Number.parseInt(String(courseId || ''), 10);
  if (!Number.isFinite(id) || id <= 0) return '';
  return `/course-images/osian-course-${id}.svg`;
}

function normalizeCountry(country = '') {
  return String(country).trim().toLowerCase();
}

function getCurrencyByCountry(country = '') {
  const normalized = normalizeCountry(country);
  if (!normalized) return 'INR';
  if (normalized.includes('india')) return 'INR';
  if (normalized.includes('united states') || normalized === 'usa' || normalized === 'us') return 'USD';
  if (normalized.includes('united kingdom') || normalized === 'uk' || normalized === 'gb') return 'GBP';
  if (normalized.includes('united arab emirates') || normalized === 'uae') return 'AED';
  if (normalized.includes('singapore')) return 'SGD';
  if (normalized.includes('japan')) return 'JPY';
  if (normalized.includes('australia')) return 'AUD';
  if (normalized.includes('canada')) return 'CAD';
  if (
    normalized.includes('germany')
    || normalized.includes('france')
    || normalized.includes('italy')
    || normalized.includes('spain')
    || normalized.includes('netherlands')
    || normalized.includes('ireland')
  ) return 'EUR';
  return 'INR';
}

function resolveCurrency(selectedCurrency = '', country = '') {
  const requested = String(selectedCurrency || '').trim().toUpperCase() || getCurrencyByCountry(country);
  if (supportedRazorpayCurrencies.has(requested)) {
    return {
      currency: requested,
      fallbackApplied: false,
      requestedCurrency: requested,
    };
  }

  const fallback = requested === 'INR' ? 'INR' : 'USD';
  return {
    currency: fallback,
    fallbackApplied: true,
    requestedCurrency: requested,
  };
}

function getGstPercent(country = '') {
  const domestic = Number.parseFloat(String(process.env.GST_IN_PERCENT || '18'));
  const international = Number.parseFloat(String(process.env.GST_GLOBAL_PERCENT || '0'));
  return normalizeCountry(country).includes('india') ? domestic : international;
}

function formatAmount(amount, currency = 'INR') {
  const value = Number.parseFloat(String(amount || '0'));
  if (!Number.isFinite(value) || value <= 0) return `${currency} -`;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function toSmallestUnit(amount, currency) {
  const zeroDecimal = new Set(['JPY']);
  if (zeroDecimal.has(currency)) return Math.round(amount);
  return Math.round(amount * 100);
}

function toInr(price = '') {
  if (!price || /not listed/i.test(price)) return 'INR -';
  const numeric = String(price).replace(/[^0-9.]/g, '');
  if (!numeric) return 'INR -';
  return `INR ${numeric}`;
}

function formatInrAmount(amount) {
  const num = Number.parseInt(String(amount || ''), 10);
  if (!Number.isFinite(num) || num <= 0) return 'INR -';
  return `INR ${num.toLocaleString('en-IN')}`;
}

function getFeeFromCourse(course) {
  const nonMetroFee = Number.parseInt(String(course.nonMetroFee || ''), 10);
  const metroFee = Number.parseInt(String(course.metroFee || ''), 10);
  const fallbackFee = Number.parseInt(String(course.price || '').replace(/[^0-9]/g, ''), 10);

  const displayFee = Number.isFinite(nonMetroFee) && nonMetroFee > 0
    ? nonMetroFee
    : Number.isFinite(metroFee) && metroFee > 0
      ? metroFee
      : fallbackFee;

  return {
    selectedFee: displayFee,
  };
}

function getLocationAwareFee(course, { locationDenied = false } = {}) {
  const metroFee = Number.parseInt(String(course.metroFee || ''), 10);
  const nonMetroFee = Number.parseInt(String(course.nonMetroFee || ''), 10);
  const fallbackFee = getFeeFromCourse(course).selectedFee;

  if (locationDenied && Number.isFinite(metroFee) && metroFee > 0) {
    return {
      selectedFee: metroFee,
      basis: 'metro-by-location-denied',
    };
  }

  if (Number.isFinite(nonMetroFee) && nonMetroFee > 0) {
    return {
      selectedFee: nonMetroFee,
      basis: 'non-metro-default',
    };
  }

  if (Number.isFinite(metroFee) && metroFee > 0) {
    return {
      selectedFee: metroFee,
      basis: 'metro-fallback',
    };
  }

  return {
    selectedFee: fallbackFee,
    basis: 'price-fallback',
  };
}

async function verifyFirebaseToken(idToken) {
  if (!firebaseApiKey || !idToken) return { valid: null, uid: null };
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );
    const data = await response.json();
    if (data.error) return { valid: false, uid: null };
    return {
      valid: true,
      uid: data?.users?.[0]?.localId || null,
    };
  } catch {
    return { valid: null, uid: null };
  }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

async function ensurePurchasesTable() {
  if (!pool || purchasesTableReady) return;

  await pool.query(`
    create table if not exists ${purchasesTable} (
      id serial primary key,
      uid varchar(128) not null,
      course_id integer not null,
      course_title text not null,
      purchase_date timestamp default current_timestamp,
      created_at timestamp default current_timestamp,
      unique(uid, course_id),
      constraint valid_ids check (uid <> '' and course_id > 0)
    )
  `);

  await pool.query(`create index if not exists idx_${purchasesTable}_uid on ${purchasesTable}(uid)`);
  await pool.query(`create index if not exists idx_${purchasesTable}_course_id on ${purchasesTable}(course_id)`);

  purchasesTableReady = true;
}

async function hasPurchased(uid, courseId) {
  if (!pool || !uid) return false;
  await ensurePurchasesTable();
  const result = await pool.query(
    `select id from ${purchasesTable} where uid = $1 and course_id = $2 limit 1`,
    [uid, courseId],
  );
  return result.rows.length > 0;
}

function ensureRazorpayConfigured(res) {
  if (razorpayEnabled) return true;
  res.status(500).json({
    error: 'Razorpay is not configured on server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
  });
  return false;
}

function sanitizeOfferId(value = '') {
  const offerId = String(value || '').trim();
  if (!offerId) return '';
  return /^offer_[a-zA-Z0-9]+$/.test(offerId) ? offerId : null;
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function toEpochSeconds(value) {
  const raw = asNumber(value);
  if (!raw) return null;
  if (raw > 1000000000000) return Math.floor(raw / 1000);
  return Math.floor(raw);
}

async function diagnoseOffer(offerId, orderAmountSmallestUnit, currency) {
  if (!offerId) {
    return { eligible: true, reason: '', note: '' };
  }

  if (!razorpay?.offers || typeof razorpay.offers.fetch !== 'function') {
    return {
      eligible: true,
      reason: '',
      note: 'Offer will be validated by Razorpay during payment.',
    };
  }

  try {
    const offer = await razorpay.offers.fetch(offerId);
    const reasons = [];

    const status = String(firstDefined(offer?.status, offer?.state) || '').toLowerCase();
    if (status && status !== 'active') {
      reasons.push(`Offer is ${status}.`);
    }

    const now = Math.floor(Date.now() / 1000);
    const startsAt = toEpochSeconds(firstDefined(offer?.start_at, offer?.starts_at, offer?.valid_from));
    const endsAt = toEpochSeconds(firstDefined(offer?.end_at, offer?.expire_by, offer?.valid_until));

    if (startsAt && now < startsAt) {
      reasons.push('Offer validity has not started yet.');
    }

    if (endsAt && now > endsAt) {
      reasons.push('Offer has expired.');
    }

    const minAmount = asNumber(firstDefined(
      offer?.minimum_amount,
      offer?.min_amount,
      offer?.restrictions?.minimum_amount,
      offer?.restrictions?.min_amount,
      offer?.payment?.minimum_amount,
    ));
    if (minAmount && orderAmountSmallestUnit < minAmount) {
      reasons.push('Order amount is below the offer minimum amount.');
    }

    const offerCurrency = String(firstDefined(
      offer?.currency,
      offer?.currency_code,
      offer?.restrictions?.currency,
      offer?.payment?.currency,
    ) || '').toUpperCase();
    if (offerCurrency && offerCurrency !== currency) {
      reasons.push(`Offer supports ${offerCurrency}, but checkout is ${currency}.`);
    }

    const maxCount = asNumber(firstDefined(offer?.max_count, offer?.max_redemptions));
    const usedCount = asNumber(firstDefined(offer?.count, offer?.redemption_count));
    if (maxCount !== null && usedCount !== null && usedCount >= maxCount) {
      reasons.push('Offer redemption limit reached.');
    }

    const methodRestriction = firstDefined(
      offer?.method,
      offer?.payment_method,
      offer?.restrictions?.method,
      offer?.restrictions?.payment_method,
    );

    if (reasons.length) {
      return {
        eligible: false,
        reason: reasons.join(' '),
        note: '',
      };
    }

    const methodNote = methodRestriction
      ? `Offer is active, but final eligibility depends on payment method: ${String(methodRestriction)}.`
      : 'Offer is active. Final eligibility is confirmed by Razorpay at payment step.';

    return {
      eligible: true,
      reason: '',
      note: methodNote,
    };
  } catch (error) {
    const description = String(error?.error?.description || error?.description || '').trim();
    if (description) {
      return { eligible: false, reason: description, note: '' };
    }
    return {
      eligible: false,
      reason: 'Offer code not found or not available for this account mode.',
      note: '',
    };
  }
}

function quoteForCheckout(course, body = {}) {
  const country = String(body.country || '').trim();
  const postalCode = String(body.postalCode || '').trim();
  const locationDenied = Boolean(body.locationDenied);

  const fee = getLocationAwareFee(course, { locationDenied });
  const gstPercent = getGstPercent(country);
  const gstAmount = Number((fee.selectedFee * (gstPercent / 100)).toFixed(2));
  const totalAmount = Number((fee.selectedFee + gstAmount).toFixed(2));
  const currencyInfo = resolveCurrency(String(body.selectedCurrency || ''), country);

  return {
    country,
    postalCode,
    baseAmount: fee.selectedFee,
    gstPercent,
    gstAmount,
    totalAmount,
    feeBasis: fee.basis,
    currency: currencyInfo.currency,
    currencyFallbackApplied: currencyInfo.fallbackApplied,
    requestedCurrency: currencyInfo.requestedCurrency,
  };
}

const allCourses = rawCourses.map((course) => ({
  ...course,
  category: String(course.category || 'Unspecified').trim() || 'Unspecified',
  displayPrice: toInr(course.price),
  displayFee: getFeeFromCourse(course).selectedFee,
  image: getGeneratedCourseImage(course.id),
}));

function normalizeForSearch(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


router.get('/', (req, res) => {
  const { category } = req.query;
  const searchQuery = String(req.query.q || '').trim();
  const normalizedSearch = normalizeForSearch(searchQuery);
  const searchTokens = normalizedSearch ? normalizedSearch.split(' ') : [];

  let courses = category ? allCourses.filter(c => c.category === category) : allCourses;

  if (searchTokens.length) {
    courses = courses.filter((course) => {
      const haystack = normalizeForSearch(course.title);

      return searchTokens.every((token) => haystack.includes(token));
    });
  }

  const categories = [...new Set(allCourses.map(c => c.category))];
  res.render('courses', {
    title: 'Courses – Osian Academy',
    page: 'courses',
    courses,
    categories,
    activeCategory: category || 'All',
    searchQuery,
    totalCourses: allCourses.length,
    shownCourses: courses.length,
  });
});

router.get('/:id/checkout', (req, res) => {
  const course = allCourses.find(c => c.id === parseInt(req.params.id, 10));
  if (!course) return res.status(404).render('404', { title: '404 – Course Not Found', page: '' });

  const city = String(req.query.city || '').trim();
  const pricing = getFeeFromCourse(course);

  res.render('checkout', {
    title: `Checkout – ${course.title}`,
    page: 'courses',
    course,
    checkoutPricing: {
      city,
      selectedFee: pricing.selectedFee,
      selectedFeeDisplay: formatInrAmount(pricing.selectedFee),
    },
  });
});

router.get('/checkout/config', (_req, res) => {
  return res.json({
    razorpayEnabled,
    keyId: razorpayKeyId,
    defaultCurrency: 'INR',
  });
});

router.post('/checkout/context', (req, res) => {
  const ipCountry = String(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || '').trim();
  const country = String(req.body?.country || ipCountry || '').trim();
  const currency = resolveCurrency('', country).currency;

  return res.json({
    country,
    currencySuggested: currency,
    locationResolved: Boolean(country),
  });
});

router.post('/:id/checkout/quote', (req, res) => {
  const course = allCourses.find(c => c.id === parseInt(req.params.id, 10));
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  const country = String(req.body?.country || '').trim();
  if (!country) return res.status(400).json({ error: 'Country is required.' });

  const quote = quoteForCheckout(course, req.body || {});
  return res.json({
    ok: true,
    quote: {
      ...quote,
      baseAmountDisplay: formatAmount(quote.baseAmount, quote.currency),
      gstAmountDisplay: formatAmount(quote.gstAmount, quote.currency),
      totalAmountDisplay: formatAmount(quote.totalAmount, quote.currency),
    },
  });
});

router.post('/:id/checkout/create-order', async (req, res) => {
  if (!ensureRazorpayConfigured(res)) return;

  const course = allCourses.find(c => c.id === parseInt(req.params.id, 10));
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  const country = String(req.body?.country || '').trim();
  const city = String(req.body?.city || '').trim();
  const postalCode = String(req.body?.postalCode || '').trim();
  const offerId = sanitizeOfferId(req.body?.offerId || '');

  if (!country || !city || !postalCode) {
    return res.status(400).json({ error: 'Country, city, and postal code are required.' });
  }

  if (offerId === null) {
    return res.status(400).json({ error: 'Invalid Offer ID format. Expected format: offer_xxxxx.' });
  }

  const idToken = getBearerToken(req);
  const verification = await verifyFirebaseToken(idToken);
  if (!verification.valid || !verification.uid) {
    return res.status(401).json({ error: 'Please sign in to continue checkout.' });
  }

  if (dbReady) {
    const already = await hasPurchased(verification.uid, course.id);
    if (already) {
      return res.status(409).json({ error: 'Course already purchased with this account.' });
    }
  }

  const quote = quoteForCheckout(course, req.body || {});
  const orderAmount = toSmallestUnit(quote.totalAmount, quote.currency);
  const offerDiagnostics = await diagnoseOffer(offerId, orderAmount, quote.currency);

  if (!offerDiagnostics.eligible) {
    return res.status(400).json({ error: offerDiagnostics.reason || 'Offer is not applicable.' });
  }

  try {
    const orderPayload = {
      amount: orderAmount,
      currency: quote.currency,
      receipt: `course_${course.id}_${Date.now()}`,
      notes: {
        uid: verification.uid,
        courseId: String(course.id),
        country,
        city,
        postalCode,
        feeBasis: quote.feeBasis,
        gstPercent: String(quote.gstPercent),
        offerId: offerId || '',
      },
    };

    if (offerId) {
      orderPayload.offer_id = offerId;
    }

    const order = await razorpay.orders.create(orderPayload);
    const orderOfferId = String(order?.offer_id || '').trim();

    if (offerId && orderOfferId !== offerId) {
      return res.status(400).json({
        error: 'Razorpay did not attach this offer to the order. Verify mode (Test/Live), offer eligibility, and payment method conditions.',
      });
    }

    return res.json({
      ok: true,
      keyId: razorpayKeyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      courseId: course.id,
      courseTitle: course.title,
      offerApplied: Boolean(offerId),
      offerId: offerId || '',
      orderOfferId,
      offerNote: offerDiagnostics.note || '',
      quote: {
        ...quote,
        baseAmountDisplay: formatAmount(quote.baseAmount, quote.currency),
        gstAmountDisplay: formatAmount(quote.gstAmount, quote.currency),
        totalAmountDisplay: formatAmount(quote.totalAmount, quote.currency),
      },
    });
  } catch (error) {
    const razorpayMessage = error?.error?.description || error?.description || '';
    return res.status(500).json({
      error: razorpayMessage || 'Failed to create Razorpay order.',
    });
  }
});

router.post('/:id/checkout/verify-payment', async (req, res) => {
  if (!ensureRazorpayConfigured(res)) return;

  const course = allCourses.find(c => c.id === parseInt(req.params.id, 10));
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  const idToken = getBearerToken(req);
  const verification = await verifyFirebaseToken(idToken);
  if (!verification.valid || !verification.uid) {
    return res.status(401).json({ error: 'Please sign in to verify payment.' });
  }

  const orderId = String(req.body?.razorpay_order_id || '').trim();
  const paymentId = String(req.body?.razorpay_payment_id || '').trim();
  const signature = String(req.body?.razorpay_signature || '').trim();

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: 'Missing Razorpay verification fields.' });
  }

  const digest = crypto
    .createHmac('sha256', razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (digest !== signature) {
    return res.status(400).json({ error: 'Invalid Razorpay signature.' });
  }

  let purchaseRecorded = false;
  if (dbReady) {
    await ensurePurchasesTable();
    const result = await pool.query(
      `
        insert into ${purchasesTable} (uid, course_id, course_title)
        values ($1, $2, $3)
        on conflict (uid, course_id) do nothing
        returning id
      `,
      [verification.uid, course.id, course.title],
    );
    purchaseRecorded = result.rows.length > 0;
  }

  return res.json({
    ok: true,
    verified: true,
    purchaseRecorded,
    courseId: course.id,
    courseTitle: course.title,
  });
});

router.get('/:id', (req, res) => {
  const course = allCourses.find(c => c.id === parseInt(req.params.id));
  if (!course) return res.status(404).render('404', { title: '404 – Course Not Found', page: '' });
  res.render('course-detail', {
    title: `${course.title} – Osian Academy`,
    page: 'courses',
    course,
  });
});

module.exports = router;
