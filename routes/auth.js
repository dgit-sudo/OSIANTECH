const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const mode = req.query.mode === 'signin' ? 'signin' : 'signup';
  res.render('auth', {
    title: mode === 'signin' ? 'Sign In - Osian Academy' : 'Sign Up - Osian Academy',
    page: 'auth',
    mode,
  });
});

router.get('/signup', (_req, res) => res.redirect('/auth?mode=signup'));
router.get('/signin', (_req, res) => res.redirect('/auth?mode=signin'));

module.exports = router;