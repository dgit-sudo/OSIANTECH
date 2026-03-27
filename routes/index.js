const express = require('express');
const router = express.Router();
const allCourses = require('../data/coursesCatalog.json');

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

router.get('/', (req, res) => {
  res.render('index', {
    title: 'Osian Academy – Learn Without Limits',
    page: 'home',
    featuredCourses: allCourses.slice(0, 9).map((course) => ({
      ...course,
      displayPrice: toInr(course.price),
      image: getGeneratedCourseImage(course.id),
    })),
  });
});

router.get('/about', (_req, res) => {
  res.render('about', {
    title: 'About Us - Osian Academy',
    page: 'about',
  });
});

router.get('/contact', (_req, res) => {
  res.render('contact', {
    title: 'Contact Us - Osian Academy',
    page: 'contact',
  });
});

router.get('/privacy-policy', (_req, res) => {
  res.render('privacy-policy', {
    title: 'Privacy Policy - Osian Academy',
    page: 'legal',
  });
});

router.get('/terms-of-service', (_req, res) => {
  res.render('terms-of-service', {
    title: 'Terms of Service - Osian Academy',
    page: 'legal',
  });
});

router.get('/cookie-policy', (_req, res) => {
  res.render('cookie-policy', {
    title: 'Cookie Policy - Osian Academy',
    page: 'legal',
  });
});

module.exports = router;
