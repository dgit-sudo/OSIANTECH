const express = require('express');
const router = express.Router();

const rawCourses = require('../data/coursesCatalog.json');

function toInr(price = '') {
  if (!price || /not listed/i.test(price)) return 'INR -';
  const numeric = String(price).replace(/[^0-9.]/g, '');
  if (!numeric) return 'INR -';
  return `INR ${numeric}`;
}

function inferCategory(title = '') {
  const text = title.toLowerCase();
  if (/python|java|php|net|node|react|angular|web|app|programming|software|django|full stack/.test(text)) return 'Technology';
  if (/data|machine learning|ai|analytics|tableau|power bi|hadoop/.test(text)) return 'Data';
  if (/autocad|revit|civil|design|animation|photoshop|illustrator|coreldraw|vfx|multimedia|jewellery|interior/.test(text)) return 'Design';
  if (/ethical hacking|penetration|security|ceh|network|ccna|ccnp/.test(text)) return 'Security';
  if (/cloud|aws|azure|salesforce|rhce|rhcsa|server/.test(text)) return 'Cloud';
  if (/sap|tally|account|finance|gst|banking|marketing|business|trading|hr/.test(text)) return 'Business';
  return 'General';
}

const allCourses = rawCourses.map((course) => ({
  ...course,
  category: inferCategory(course.title),
  displayPrice: toInr(course.price),
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

  res.render('checkout', {
    title: `Checkout – ${course.title}`,
    page: 'courses',
    course,
  });
});

router.post('/:id/checkout/complete', (req, res) => {
  const course = allCourses.find(c => c.id === parseInt(req.params.id, 10));
  if (!course) return res.status(404).render('404', { title: '404 – Course Not Found', page: '' });

  const country = String(req.body.country || '').trim();
  if (!country) {
    return res.status(400).json({ error: 'Country is required before checkout.' });
  }

  return res.json({
    ok: true,
    message: 'Mock checkout complete. Razorpay integration pending.',
    courseId: course.id,
    courseTitle: course.title,
    country,
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
