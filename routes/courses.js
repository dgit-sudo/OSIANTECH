const express = require('express');
const router = express.Router();

const rawCourses = require('../data/coursesCatalog.json');

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

function normalizeCity(city = '') {
  return String(city).toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isMetroCity(city = '') {
  const normalized = normalizeCity(city);
  if (!normalized) return false;
  return METRO_CITIES.has(normalized);
}

function getFeeFromCourse(course, city = '') {
  const metroFee = Number.parseInt(String(course.metroFee || ''), 10);
  const nonMetroFee = Number.parseInt(String(course.nonMetroFee || ''), 10);

  const fallbackFee = Number.parseInt(String(course.price || '').replace(/[^0-9]/g, ''), 10);
  const safeMetro = Number.isFinite(metroFee) && metroFee > 0 ? metroFee : fallbackFee;
  const safeNonMetro = Number.isFinite(nonMetroFee) && nonMetroFee > 0 ? nonMetroFee : fallbackFee;

  const metro = isMetroCity(city);
  const selectedFee = metro ? safeMetro : safeNonMetro;

  return {
    metro,
    selectedFee,
    metroFee: safeMetro,
    nonMetroFee: safeNonMetro,
  };
}

const allCourses = rawCourses.map((course) => ({
  ...course,
  category: String(course.category || 'Unspecified').trim() || 'Unspecified',
  displayPrice: toInr(course.price),
  nonMetroDisplayFee: formatInrAmount(course.nonMetroFee),
  metroDisplayFee: formatInrAmount(course.metroFee),
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
  const pricing = getFeeFromCourse(course, city);

  res.render('checkout', {
    title: `Checkout – ${course.title}`,
    page: 'courses',
    course,
    checkoutPricing: {
      city,
      cityType: pricing.metro ? 'Metro' : 'Non-metro',
      selectedFee: pricing.selectedFee,
      selectedFeeDisplay: formatInrAmount(pricing.selectedFee),
      metroFeeDisplay: formatInrAmount(pricing.metroFee),
      nonMetroFeeDisplay: formatInrAmount(pricing.nonMetroFee),
    },
  });
});

router.post('/:id/checkout/complete', (req, res) => {
  const course = allCourses.find(c => c.id === parseInt(req.params.id, 10));
  if (!course) return res.status(404).render('404', { title: '404 – Course Not Found', page: '' });

  const country = String(req.body.country || '').trim();
  const city = String(req.body.city || '').trim();
  if (!country) {
    return res.status(400).json({ error: 'Country is required before checkout.' });
  }

  if (!city) {
    return res.status(400).json({ error: 'City is required to determine metro/non-metro fee.' });
  }

  const pricing = getFeeFromCourse(course, city);

  return res.json({
    ok: true,
    message: 'Mock checkout complete. Razorpay integration pending.',
    courseId: course.id,
    courseTitle: course.title,
    country,
    city,
    cityType: pricing.metro ? 'Metro' : 'Non-metro',
    feeType: pricing.metro ? 'metro' : 'non-metro',
    payableAmount: pricing.selectedFee,
    payableAmountDisplay: formatInrAmount(pricing.selectedFee),
    metroFeeDisplay: formatInrAmount(pricing.metroFee),
    nonMetroFeeDisplay: formatInrAmount(pricing.nonMetroFee),
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
