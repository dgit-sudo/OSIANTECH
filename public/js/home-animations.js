/* ================================================================
   OSIAN ACADEMY — Scroll-Hijacked Homepage
   Sections swap in-place like Chrome's What's New pages.
   Wheel / touch / keyboard drive GSAP panel transitions.
   ================================================================ */

(function () {
  if (!document.body.classList.contains('page-home')) return;
  if (typeof gsap === 'undefined') return;

  /* ── Config ─────────────────────────────────────────────────── */
  const DURATION    = 0.85;   // panel slide duration
  const EASE        = 'expo.inOut';
  const DEBOUNCE_MS = 950;    // min ms between transitions

  /* ── State ──────────────────────────────────────────────────── */
  const sections = Array.from(document.querySelectorAll('.home-section'));
  if (!sections.length) return;

  let current   = 0;
  let locked    = false;
  let lastWheel = 0;

  /* ── Stack all panels at position 0; only first is visible ──── */
  sections.forEach((s, i) => {
    gsap.set(s, {
      yPercent:   i === 0 ? 0 : 100,
      autoAlpha:  1,         // opacity:1, visibility:visible for all (layout)
    });
    if (i !== 0) s.style.visibility = 'hidden'; // hide non-active without layout change
  });

  /* ── Dot + counter UI ────────────────────────────────────────── */
  const dotNav = document.createElement('nav');
  dotNav.className = 'hs-dot-nav';
  dotNav.setAttribute('aria-label', 'Sections');

  const counter = document.createElement('div');
  counter.className = 'hs-counter';

  sections.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'hs-dot' + (i === 0 ? ' active' : '');
    b.setAttribute('aria-label', 'Section ' + (i + 1));
    b.addEventListener('click', () => navigate(i));
    dotNav.appendChild(b);
  });

  document.body.appendChild(dotNav);
  document.body.appendChild(counter);
  const dots = Array.from(dotNav.querySelectorAll('.hs-dot'));

  function updateUI() {
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
    counter.textContent = (current + 1) + ' / ' + sections.length;
  }
  updateUI();

  /* ── Content animations per section ─────────────────────────── */
  // Track which sections have already animated (don't re-stagger on revisit)
  const done = new Set();

  function runContentAnim(section) {
    const id  = section.id;
    const qs  = (sel) => Array.from(section.querySelectorAll(sel));
    const q1  = (sel) => section.querySelector(sel);
    const def = { ease: 'power3.out', clearProps: 'opacity,transform' };

    // Always replay hero (it's the first impression)
    if (done.has(id) && id !== 'hs-hero') return;
    done.add(id);

    // Kill lingering tweens on section children
    gsap.killTweensOf(section.querySelectorAll('*'));

    switch (id) {

      case 'hs-hero':
        gsap.timeline({ defaults: def })
          .from(q1('.hs-eyebrow'),         { opacity: 0, y: 12, duration: 0.45 }, 0.05)
          .from(q1('.hs-headline'),        { opacity: 0, y: 44, duration: 1.0 }, 0.18)
          .from(q1('.hs-sub'),             { opacity: 0, y: 18, duration: 0.55 }, 0.48)
          .from(qs('.hs-cta-row .btn'),    { opacity: 0, y: 14, stagger: 0.1, duration: 0.45 }, 0.65)
          .from(qs('.hs-feat'),            { opacity: 0, x: 30, stagger: 0.1,  duration: 0.5 }, 0.52)
          .from(q1('.hs-scroll-cue'),      { opacity: 0, y: 10, duration: 0.5 }, 1.15);
        break;

      case 'hs-courses':
        gsap.timeline({ defaults: def })
          .from(q1('.hs-eyebrow'),         { opacity: 0, y: 12, duration: 0.4 }, 0.05)
          .from(q1('.hs-section-title'),   { opacity: 0, y: 28, duration: 0.7 }, 0.2)
          .from(qs('.hs-section-top .btn'),{ opacity: 0, duration: 0.35 }, 0.38)
          .from(qs('.catalog-slide'),      { opacity: 0, y: 36, stagger: 0.12, duration: 0.55 }, 0.38)
          .from(qs('.catalog-nav'),        { opacity: 0, duration: 0.3 }, 0.55)
          .from(q1('.hs-empty-courses'),   { opacity: 0, y: 20, duration: 0.5 }, 0.3);
        break;

      case 'hs-why':
        gsap.timeline({ defaults: def })
          .from(q1('.hs-eyebrow'),              { opacity: 0, y: 12, duration: 0.4 }, 0.05)
          .from(q1('.hs-section-title'),        { opacity: 0, y: 32, duration: 0.75 }, 0.2)
          .from(q1('.why-body'),                { opacity: 0, y: 16, duration: 0.5 }, 0.42)
          .from(q1('.why-left .btn'),           { opacity: 0, y: 10, duration: 0.4 }, 0.58)
          .from(qs('.why-item'),                { opacity: 0, y: 24, stagger: 0.1, duration: 0.45 }, 0.32);
        break;

      case 'hs-categories':
        gsap.timeline({ defaults: def })
          .from(q1('.hs-eyebrow'),         { opacity: 0, y: 12, duration: 0.4 }, 0.05)
          .from(q1('.hs-section-title'),   { opacity: 0, y: 28, duration: 0.65 }, 0.2)
          .from(qs('.cat-card'),           { opacity: 0, y: 22, stagger: { each: 0.08, from: 'start' }, duration: 0.45 }, 0.36);
        break;

      case 'hs-cta':
        gsap.timeline({ defaults: def })
          .from(qs('.hs-cta-content > *'), { opacity: 0, y: 24, stagger: 0.14, duration: 0.6 }, 0.15)
          .from(q1('.hs-mini-footer'),     { opacity: 0, duration: 0.4 }, 0.85);
        break;
    }
  }

  // Animate hero immediately on load
  runContentAnim(sections[0]);

  /* ── Core navigation ─────────────────────────────────────────── */
  function navigate(next) {
    if (locked)              return;
    if (next === current)    return;
    if (next < 0 || next >= sections.length) return;

    locked = true;

    const out = sections[current];
    const inn = sections[next];
    const dir = next > current ? 1 : -1;

    // Make incoming visible and off-screen in the direction of travel
    inn.style.visibility = 'visible';
    gsap.set(inn, { yPercent: 110 * dir });

    gsap.timeline({
      onComplete() {
        // Hide outgoing panel (keeps it off-screen, ready for next use)
        out.style.visibility = 'hidden';
        gsap.set(out, { yPercent: 0 }); // reset for future transitions

        current = next;
        locked  = false;
        updateUI();
        runContentAnim(inn);
      }
    })
    .to(out, { yPercent: -110 * dir, duration: DURATION, ease: EASE }, 0)
    .to(inn, { yPercent: 0,          duration: DURATION, ease: EASE }, 0);
  }

  /* ── Input: Mouse wheel ──────────────────────────────────────── */
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (locked) return;
    const now = Date.now();
    if (now - lastWheel < DEBOUNCE_MS) return;
    lastWheel = now;
    if (e.deltaY > 10)  navigate(current + 1);
    if (e.deltaY < -10) navigate(current - 1);
  }, { passive: false });

  /* ── Input: Keyboard ─────────────────────────────────────────── */
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); navigate(current + 1); }
    if (e.key === 'ArrowUp'   || e.key === 'PageUp')   { e.preventDefault(); navigate(current - 1); }
    if (e.key === 'Home') navigate(0);
    if (e.key === 'End')  navigate(sections.length - 1);
  });

  /* ── Input: Touch swipe ──────────────────────────────────────── */
  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    const dy = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) < 60) return;
    navigate(dy > 0 ? current + 1 : current - 1);
  }, { passive: true });

  /* ── Scroll cue click ────────────────────────────────────────── */
  const cue = document.querySelector('.hs-scroll-cue');
  if (cue) cue.addEventListener('click', () => navigate(1));

})();
