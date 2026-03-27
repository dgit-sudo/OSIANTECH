const express = require('express');
const router = express.Router();

const rawCourses = require('../data/coursesCatalog.json');

function getGeneratedCourseImage(courseId) {
  const id = Number.parseInt(String(courseId || ''), 10);
  if (!Number.isFinite(id) || id <= 0) return '';
  return `/course-images/osian-course-${id}.svg`;
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

router.post('/:id/checkout/complete', (req, res) => {
  const course = allCourses.find(c => c.id === parseInt(req.params.id, 10));
  if (!course) return res.status(404).render('404', { title: '404 – Course Not Found', page: '' });

  const country = String(req.body.country || '').trim();
  const city = String(req.body.city || '').trim();
  if (!country) {
    return res.status(400).json({ error: 'Country is required before checkout.' });
  }

  if (!city) {
    return res.status(400).json({ error: 'City is required to schedule your class timing.' });
  }

  const pricing = getFeeFromCourse(course);

  return res.json({
    ok: true,
    message: 'Mock checkout complete. Razorpay integration pending.',
    courseId: course.id,
    courseTitle: course.title,
    country,
    city,
    payableAmount: pricing.selectedFee,
    payableAmountDisplay: formatInrAmount(pricing.selectedFee),
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
