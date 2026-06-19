/* =========================================================
   OSIAN ACADEMY — HOME SCROLL ANIMATIONS
   GSAP + ScrollTrigger — cinematic scroll experience
   ========================================================= */

gsap.registerPlugin(ScrollTrigger);

const $ = s => document.querySelector(s);
const $$ = s => gsap.utils.toArray(s);

/* ─── Immediately hide hero elements to prevent flash ─── */
gsap.set([
  '.sh-headline', '.sh-placement',
  '.sh-pill', '.sh-join',
  '.sh-tags span', '.sh-partner-row',
  '.sh-visual-card', '.s-topbar'
], { opacity: 0 });

/* ═══════════════════════════════════════════════════════
   1.  HERO — cinematic entrance on page load
═══════════════════════════════════════════════════════ */

const heroTl = gsap.timeline({ defaults: { ease: 'power4.out' }, delay: 0.08 });

heroTl
  /* top bar slides down */
  .to('.s-topbar', { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0)

  /* headline: each line slams up from below using split trick */
  .to('.sh-headline', { opacity: 1, y: 0, duration: 1.05 }, 0.1)

  /* placement badge snaps in from left with overshoot */
  .to('.sh-placement', { opacity: 1, x: 0, duration: 0.7, ease: 'back.out(1.8)' }, 0.55)

  /* stat pills bounce in one by one */
  .to('.sh-pill', { opacity: 1, y: 0, scale: 1, stagger: 0.13, duration: 0.6, ease: 'back.out(2.2)' }, 0.72)
  .to('.sh-join', { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(2.5)' }, 1.05)

  /* topic tags wave across */
  .to('.sh-tags span', { opacity: 1, scale: 1, y: 0, stagger: 0.04, duration: 0.45, ease: 'back.out(1.6)' }, 1.15)

  /* partner logos rise */
  .to('.sh-partner-row', { opacity: 1, y: 0, duration: 0.55 }, 1.35)

  /* visual card sweeps in from the right with 3-D tilt */
  .to('.sh-visual-card', {
    opacity: 1, x: 0, rotationY: 0, duration: 1.1,
    ease: 'power3.out', transformPerspective: 900
  }, 0.35);

/* Set GSAP initial FROM states for hero elements */
gsap.set('.sh-headline',    { y: 90, opacity: 0 });
gsap.set('.sh-placement',   { x: -70, opacity: 0 });
gsap.set('.sh-pill',        { y: 50, scale: 0.6, opacity: 0 });
gsap.set('.sh-join',        { scale: 0, opacity: 0 });
gsap.set('.sh-tags span',   { y: 10, scale: 0.7, opacity: 0 });
gsap.set('.sh-partner-row', { y: 18, opacity: 0 });
gsap.set('.sh-visual-card', { x: 110, rotationY: -18, opacity: 0, transformPerspective: 900 });
gsap.set('.s-topbar',       { y: -44, opacity: 0 });

/* Gentle float on visual card after entrance (CSS handles this
   so GSAP transform doesn't conflict with scrub parallax) */
heroTl.call(() => {
  const card = $('.sh-visual-card');
  if (card) card.classList.add('hs-float');
}, [], '>+0.2');

/* Parallax — visual card drifts upward as hero scrolls out */
if ($('.sh-right')) {
  gsap.to('.sh-right', {
    yPercent: 18,
    ease: 'none',
    scrollTrigger: {
      trigger: '.s-hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.5
    }
  });
}

/* ═══════════════════════════════════════════════════════
   2.  ABOUT / STORY
═══════════════════════════════════════════════════════ */

const ST_about = { trigger: '.s-about', start: 'top 78%', once: true };

gsap.from('.sa-founded-tag', {
  scrollTrigger: ST_about,
  opacity: 0, scale: 0.4, duration: 0.55, ease: 'back.out(2.5)'
});
gsap.fromTo('.sa-title',
  { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
  { scrollTrigger: { ...ST_about }, clipPath: 'inset(0 0% 0 0)', duration: 0.95, ease: 'power3.inOut', delay: 0.1 }
);
gsap.from(['.sa-meta', '.sa-list li', '.sa-link'], {
  scrollTrigger: ST_about,
  x: -45, opacity: 0, stagger: 0.1, duration: 0.65, ease: 'power3.out', delay: 0.3
});
gsap.from('.sa-video-card', {
  scrollTrigger: ST_about,
  x: 90, opacity: 0, rotationY: -16, duration: 1.05,
  ease: 'power3.out', transformPerspective: 900, delay: 0.1
});

/* Parallax on video card */
gsap.to('.sa-video-card', {
  yPercent: -12,
  ease: 'none',
  scrollTrigger: { trigger: '.s-about', start: 'top bottom', end: 'bottom top', scrub: 1.2 }
});

/* ═══════════════════════════════════════════════════════
   3.  FEATURE CARDS — 6 different directions
═══════════════════════════════════════════════════════ */

const featDirs = [
  { x: -90, y: -55 }, { x:  0,  y: -90 }, { x:  90, y: -55 },
  { x: -90, y:  55 }, { x:  0,  y:  90 }, { x:  90, y:  55 }
];

$$('.sft-card').forEach((card, i) => {
  const d = featDirs[i] || { x: 0, y: 70 };
  gsap.from(card, {
    scrollTrigger: { trigger: '.sft-grid', start: 'top 82%', once: true },
    x: d.x, y: d.y, opacity: 0, scale: 0.82, rotationX: 12,
    duration: 0.9, delay: i * 0.09, ease: 'power3.out',
    transformPerspective: 700
  });
});

/* ═══════════════════════════════════════════════════════
   4.  STATS BAND — band slides up, each number pops
═══════════════════════════════════════════════════════ */

gsap.from('.s-stats', {
  scrollTrigger: { trigger: '.s-stats', start: 'top 88%', once: true },
  y: 50, opacity: 0, duration: 0.65, ease: 'power3.out'
});
gsap.from('.sst-item', {
  scrollTrigger: { trigger: '.s-stats', start: 'top 82%', once: true },
  scale: 0, opacity: 0, stagger: 0.15, duration: 0.6, delay: 0.2, ease: 'back.out(2.4)'
});

/* ═══════════════════════════════════════════════════════
   5.  NEWSLETTER
═══════════════════════════════════════════════════════ */

gsap.from('.s-newsletter', {
  scrollTrigger: { trigger: '.s-newsletter', start: 'top 88%', once: true },
  y: 35, opacity: 0, duration: 0.6, ease: 'power3.out'
});
gsap.from('.snl-form', {
  scrollTrigger: { trigger: '.s-newsletter', start: 'top 84%', once: true },
  scaleX: 0.6, opacity: 0, duration: 0.65, ease: 'back.out(1.8)', delay: 0.15
});

/* ═══════════════════════════════════════════════════════
   6.  PROGRAMS GRID — heading reveals, cards waterfall
═══════════════════════════════════════════════════════ */

gsap.from('.spr-head', {
  scrollTrigger: { trigger: '.s-programs', start: 'top 80%', once: true },
  y: 50, opacity: 0, duration: 0.75, ease: 'power3.out'
});
gsap.from($$('.spr-card'), {
  scrollTrigger: { trigger: '.spr-grid', start: 'top 85%', once: true },
  y: 65, opacity: 0, scale: 0.88,
  stagger: { amount: 1.4, from: 'start' },
  duration: 0.6, ease: 'power3.out'
});

/* ═══════════════════════════════════════════════════════
   7.  FEATURED COURSES CAROUSEL
═══════════════════════════════════════════════════════ */

gsap.from('.section-header-row', {
  scrollTrigger: { trigger: '#courses', start: 'top 82%', once: true },
  y: 40, opacity: 0, duration: 0.7, ease: 'power3.out'
});
gsap.from('.catalog-carousel', {
  scrollTrigger: { trigger: '#courses', start: 'top 78%', once: true },
  y: 70, opacity: 0, duration: 0.85, ease: 'power3.out', delay: 0.2
});

/* ═══════════════════════════════════════════════════════
   8.  FAQ — heading slides, items fly in from left
═══════════════════════════════════════════════════════ */

gsap.fromTo('.sfaq-title',
  { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
  { scrollTrigger: { trigger: '.s-faq', start: 'top 80%', once: true },
    clipPath: 'inset(0 0% 0 0)', duration: 0.95, ease: 'power3.inOut' }
);
gsap.from('.sfaq-sub', {
  scrollTrigger: { trigger: '.s-faq', start: 'top 80%', once: true },
  y: 25, opacity: 0, duration: 0.6, ease: 'power3.out', delay: 0.3
});
gsap.from($$('.sfaq-item'), {
  scrollTrigger: { trigger: '.sfaq-list', start: 'top 86%', once: true },
  x: -55, opacity: 0, stagger: 0.07, duration: 0.55, ease: 'power3.out'
});

/* ═══════════════════════════════════════════════════════
   9.  ONE PLATFORM SOLUTION
═══════════════════════════════════════════════════════ */

gsap.from(['.sop-tagline', '.sop-body', '.sop-tabs'], {
  scrollTrigger: { trigger: '.s-oneplatform', start: 'top 80%', once: true },
  y: 40, opacity: 0, stagger: 0.14, duration: 0.7, ease: 'power3.out'
});

/* ═══════════════════════════════════════════════════════
   10. TRUSTED BRANDS — badges pop in with rotation
═══════════════════════════════════════════════════════ */

gsap.from('.str-head', {
  scrollTrigger: { trigger: '.s-trusted', start: 'top 80%', once: true },
  y: 40, opacity: 0, duration: 0.7, ease: 'power3.out'
});
gsap.from($$('.str-badge'), {
  scrollTrigger: { trigger: '.str-badges', start: 'top 86%', once: true },
  scale: 0, opacity: 0, rotation: -15,
  stagger: 0.1, duration: 0.65, ease: 'back.out(2.4)'
});

/* ═══════════════════════════════════════════════════════
   11. COVERAGE GRID — states cascade top-left → bottom-right
═══════════════════════════════════════════════════════ */

gsap.from('.scov-head', {
  scrollTrigger: { trigger: '.s-coverage', start: 'top 80%', once: true },
  y: 40, opacity: 0, duration: 0.7, ease: 'power3.out'
});
gsap.from($$('.scov-state'), {
  scrollTrigger: { trigger: '.scov-grid', start: 'top 86%', once: true },
  y: 60, opacity: 0, scale: 0.75,
  stagger: { amount: 1.0, from: 'start' },
  duration: 0.55, ease: 'back.out(1.8)'
});
gsap.from('.scov-cta', {
  scrollTrigger: { trigger: '.scov-cta', start: 'top 90%', once: true },
  y: 30, opacity: 0, scale: 0.92, duration: 0.6, ease: 'back.out(1.7)'
});

/* ═══════════════════════════════════════════════════════
   12. TESTIMONIALS — cards scale up with stagger
═══════════════════════════════════════════════════════ */

gsap.from('.stesti-head', {
  scrollTrigger: { trigger: '.s-testi', start: 'top 80%', once: true },
  y: 40, opacity: 0, duration: 0.7, ease: 'power3.out'
});
gsap.from($$('.stesti-card'), {
  scrollTrigger: { trigger: '.stesti-grid', start: 'top 86%', once: true },
  y: 90, opacity: 0, scale: 0.88,
  stagger: 0.15, duration: 0.75, ease: 'power3.out'
});

/* ═══════════════════════════════════════════════════════
   13. PLACEMENT PARTNERS — logos appear from random positions
═══════════════════════════════════════════════════════ */

gsap.from('.spart-head', {
  scrollTrigger: { trigger: '.s-partners', start: 'top 80%', once: true },
  y: 40, opacity: 0, duration: 0.7, ease: 'power3.out'
});
gsap.from($$('.spart-logo'), {
  scrollTrigger: { trigger: '.spart-grid', start: 'top 86%', once: true },
  opacity: 0, scale: 0.6, y: 25,
  stagger: { amount: 0.9, from: 'random' },
  duration: 0.5, ease: 'back.out(2)'
});

/* ═══════════════════════════════════════════════════════
   14. CTA SECTION
═══════════════════════════════════════════════════════ */

gsap.from('.cta-content', {
  scrollTrigger: { trigger: '.cta-section', start: 'top 82%', once: true },
  y: 60, scale: 0.93, opacity: 0, duration: 0.85, ease: 'power3.out'
});
