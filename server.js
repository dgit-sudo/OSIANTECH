const express = require('express');
const path = require('path');
const http = require('http');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const assetVersion = String(
  process.env.ASSET_VERSION
  || process.env.RENDER_GIT_COMMIT
  || process.env.GITHUB_SHA
  || Date.now(),
);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.assetVersion = assetVersion;

// Compute nav course groups from catalog
(() => {
  const coursesCatalog = require('./data/coursesCatalog.json');
  const navCategoryKey = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const navCourseGroups = [];
  const navCourseMap = new Map();

  coursesCatalog.forEach((course) => {
    const category = String(course.category || 'General').trim() || 'General';
    const key = navCategoryKey(category);
    if (!navCourseMap.has(key)) {
      const entry = { key, name: category, courses: [] };
      navCourseMap.set(key, entry);
      navCourseGroups.push(entry);
    }
    const entry = navCourseMap.get(key);
    entry.courses.push(course);
  });

  app.locals.navCourseCatalog = navCourseGroups;
})();

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Firebase Auth Custom Domain Reverse Proxy (allows https://osian.tech/__/auth/handler)
app.use('/__/auth', (req, res) => {
  const targetUrl = `https://osiantech-7f0d7.firebaseapp.com/__/auth${req.url}`;
  fetch(targetUrl, {
    method: req.method,
    headers: {
      'accept': req.headers['accept'] || '*/*',
      'user-agent': req.headers['user-agent'] || '',
      'host': 'osiantech-7f0d7.firebaseapp.com',
    },
  })
    .then(async (response) => {
      res.status(response.status);
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'content-encoding' && lowerKey !== 'content-length' && lowerKey !== 'transfer-encoding') {
          res.setHeader(key, value);
        }
      });
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    })
    .catch((err) => {
      console.error('[Firebase Auth Proxy Error]', err.message);
      res.status(502).send('Auth proxy error');
    });
});


// Routes
const indexRouter = require('./routes/index');
const coursesRouter = require('./routes/courses');
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const profileRouter = require('./routes/profile');
const supportRouter = require('./routes/support');
const chatRouter = require('./routes/chat');

app.use('/', indexRouter);
app.use('/courses', coursesRouter);
app.use('/auth', authRouter);
app.use('/dashboard', dashboardRouter);
app.use('/api/profile', profileRouter);
app.use('/api/support', supportRouter);
app.use('/chat', chatRouter);

// Compatibility redirects for legacy auth links.
app.get('/enroll', (_req, res) => res.redirect('/auth?mode=signup'));
app.get('/signup', (_req, res) => res.redirect('/auth?mode=signup'));
app.get('/signin', (_req, res) => res.redirect('/auth?mode=signin'));
app.get('/checkout', (req, res) => {
  const id = Number.parseInt(String(req.query.courseId || ''), 10);
  if (Number.isFinite(id) && id > 0) {
    return res.redirect(`/courses/${id}/checkout`);
  }
  return res.redirect('/courses');
});
app.get('/checkout/:id', (req, res) => {
  const id = Number.parseInt(String(req.params.id || ''), 10);
  if (Number.isFinite(id) && id > 0) {
    return res.redirect(`/courses/${id}/checkout`);
  }
  return res.redirect('/courses');
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Page Not Found', page: '' });
});

server.listen(PORT, () => {
  console.log(`Osian Academy running at http://localhost:${PORT}`);
});

module.exports = app;
