const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
const indexRouter = require('./routes/index');
const coursesRouter = require('./routes/courses');
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const profileRouter = require('./routes/profile');
const adminRouter = require('./routes/admin');
const supportRouter = require('./routes/support');
const instructorRouter = require('./routes/instructor');

app.use('/', indexRouter);
app.use('/courses', coursesRouter);
app.use('/auth', authRouter);
app.use('/dashboard', dashboardRouter);
app.use('/api/profile', profileRouter);
app.use('/admin', adminRouter);
app.use('/api/support', supportRouter);
app.use('/instructor', instructorRouter);

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

app.listen(PORT, () => {
  console.log(`Osian Academy running at http://localhost:${PORT}`);
});

module.exports = app;
