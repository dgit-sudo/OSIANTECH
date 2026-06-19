/* =========================================================
   OSIAN ACADEMY — HOME SCROLL ANIMATIONS  v2
   GSAP + ScrollTrigger — cinematic, no continuous motion
   ========================================================= */

gsap.registerPlugin(ScrollTrigger);

const $  = s => document.querySelector(s);
const $$ = s => gsap.utils.toArray(s);

/* ─── Shorthand: create a one-shot ScrollTrigger config ─── */
function ST(trigger, start) {
  return { trigger, start: start || 'top 80%', once: true, invalidateOnRefresh: true };
}

/* ═══════════════════════════════════════════════════════════
   1.  HERO — cinematic entrance (set states BEFORE timeline)
═══════════════════════════════════════════════════════════ */

gsap.set('.s-topbar',       { y: -44, opacity: 0 });
gsap.set('.sh-headline',    { y: 90,  opacity: 0 });
gsap.set('.sh-placement',   { x: -70, opacity: 0 });
gsap.set('.sh-pill',        { y: 50,  scale: 0.6, opacity: 0 });
gsap.set('.sh-join',        { scale: 0, opacity: 0 });
gsap.set('.sh-tags span',   { y: 10,  scale: 0.7, opacity: 0 });
gsap.set('.sh-partner-row', { y: 18,  opacity: 0 });
gsap.set('.sh-visual-card', { x: 110, rotationY: -18, opacity: 0, transformPerspective: 900 });

const heroTl = gsap.timeline({ defaults: { ease: 'power4.out' }, delay: 0.08 });
heroTl
  .to('.s-topbar',       { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },         0)
  .to('.sh-headline',    { opacity: 1, y: 0, duration: 1.05 },                              0.1)
  .to('.sh-placement',   { opacity: 1, x: 0, duration: 0.7, ease: 'back.out(1.8)' },       0.55)
  .to('.sh-pill',        { opacity: 1, y: 0, scale: 1, stagger: 0.13, duration: 0.6, ease: 'back.out(2.2)' }, 0.72)
  .to('.sh-join',        { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(2.5)' },  1.05)
  .to('.sh-tags span',   { opacity: 1, scale: 1, y: 0, stagger: 0.04, duration: 0.45, ease: 'back.out(1.6)' }, 1.15)
  .to('.sh-partner-row', { opacity: 1, y: 0, duration: 0.55 },                             1.35)
  .to('.sh-visual-card', { opacity: 1, x: 0, rotationY: 0, duration: 1.1, ease: 'power3.out', transformPerspective: 900 }, 0.35);

/* ═══════════════════════════════════════════════════════════
   2.  ABOUT / STORY
═══════════════════════════════════════════════════════════ */

if ($('.s-about')) {
  const stAbout = ST('.s-about', 'top 78%');

  gsap.fromTo('.sa-founded-tag',
    { scale: 0.3, rotation: -12, opacity: 0 },
    { scale: 1, rotation: 0, opacity: 1, duration: 0.65, ease: 'back.out(2.8)', scrollTrigger: stAbout }
  );
  gsap.fromTo('.sa-title',
    { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
    { clipPath: 'inset(0 0% 0 0)', duration: 1.1, ease: 'power3.inOut', delay: 0.15, scrollTrigger: stAbout }
  );

  const aboutLeft = $$('.sa-meta, .sa-list li, .sa-link');
  if (aboutLeft.length) {
    gsap.fromTo(aboutLeft,
      { x: -55, opacity: 0 },
      { x: 0, opacity: 1, stagger: 0.1, duration: 0.65, ease: 'power3.out', delay: 0.3, scrollTrigger: stAbout }
    );
  }

  if ($('.sa-video-card')) {
    gsap.fromTo('.sa-video-card',
      { x: 100, rotationY: -20, opacity: 0, transformPerspective: 900 },
      { x: 0, rotationY: 0, opacity: 1, duration: 1.15, ease: 'power3.out', scrollTrigger: stAbout }
    );
  }
}

/* ═══════════════════════════════════════════════════════════
   3.  FEATURE CARDS — fly in from 6 different directions
═══════════════════════════════════════════════════════════ */

const featCards = $$('.sft-card');
if (featCards.length) {
  const featDirs = [
    { x: -100, y: -60, rX: 18 },  { x: 0,    y: -100, rX: 25 }, { x: 100, y: -60, rX: 18 },
    { x: -100, y:  60, rX: -18 }, { x: 0,    y:  100, rX: -25 }, { x: 100, y:  60, rX: -18 }
  ];
  featCards.forEach((card, i) => {
    const d = featDirs[i] || { x: 0, y: 80, rX: 10 };
    gsap.fromTo(card,
      { x: d.x, y: d.y, opacity: 0, scale: 0.72, rotationX: d.rX, transformPerspective: 700 },
      { x: 0, y: 0, opacity: 1, scale: 1, rotationX: 0,
        duration: 1.0, delay: i * 0.1, ease: 'power3.out',
        scrollTrigger: ST('.sft-grid', 'top 85%') }
    );
  });
}

/* ═══════════════════════════════════════════════════════════
   4.  STATS BAND — band slides up, numbers flip in 3-D
═══════════════════════════════════════════════════════════ */

if ($('.s-stats')) {
  gsap.fromTo('.s-stats',
    { y: 60, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', scrollTrigger: ST('.s-stats', 'top 88%') }
  );
  $$('.sst-item').forEach((item, i) => {
    gsap.fromTo(item,
      { scale: 0, opacity: 0, rotationY: 90, transformPerspective: 600 },
      { scale: 1, opacity: 1, rotationY: 0, duration: 0.75, delay: i * 0.15,
        ease: 'back.out(2)', scrollTrigger: ST('.s-stats', 'top 84%') }
    );
  });
}

/* ═══════════════════════════════════════════════════════════
   5.  JOB PROGRAMS GRID — waterfall with 3-D tilt
═══════════════════════════════════════════════════════════ */

if ($('.s-programs')) {
  gsap.fromTo('.spr-head',
    { y: 55, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', scrollTrigger: ST('.s-programs', 'top 82%') }
  );
  $$('.spr-card').forEach((card, i) => {
    gsap.fromTo(card,
      { y: 70, opacity: 0, scale: 0.82, rotationX: 14, transformPerspective: 800 },
      { y: 0, opacity: 1, scale: 1, rotationX: 0, duration: 0.7, delay: i * 0.07,
        ease: 'power3.out', scrollTrigger: ST('.spr-grid', 'top 88%') }
    );
  });
}

/* ═══════════════════════════════════════════════════════════
   6.  COURSES CAROUSEL
═══════════════════════════════════════════════════════════ */

if ($('#courses')) {
  gsap.fromTo('.section-header-row',
    { y: 40, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', scrollTrigger: ST('#courses', 'top 82%') }
  );
  gsap.fromTo('.catalog-carousel',
    { y: 80, opacity: 0, scale: 0.95 },
    { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out', delay: 0.2,
      scrollTrigger: ST('#courses', 'top 78%') }
  );
}

/* ═══════════════════════════════════════════════════════════
   7.  FAQ — curtain reveal title, alternate-side items
═══════════════════════════════════════════════════════════ */

if ($('.s-faq')) {
  gsap.fromTo('.sfaq-title',
    { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
    { clipPath: 'inset(0 0% 0 0)', duration: 1.0, ease: 'power3.inOut',
      scrollTrigger: ST('.s-faq', 'top 80%') }
  );
  gsap.fromTo('.sfaq-sub',
    { y: 30, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.65, ease: 'power3.out', delay: 0.3,
      scrollTrigger: ST('.s-faq', 'top 80%') }
  );
  $$('.sfaq-item').forEach((item, i) => {
    gsap.fromTo(item,
      { x: i % 2 === 0 ? -70 : 70, opacity: 0, rotationX: 10, transformPerspective: 600 },
      { x: 0, opacity: 1, rotationX: 0, duration: 0.65, delay: i * 0.07,
        ease: 'power3.out', scrollTrigger: ST('.sfaq-list', 'top 88%') }
    );
  });
}

/* ═══════════════════════════════════════════════════════════
   8.  ONE PLATFORM — staggered rise with scale punch
═══════════════════════════════════════════════════════════ */

if ($('.s-oneplatform')) {
  const sopEls = $$('.sop-tagline, .sop-body, .sop-tabs');
  if (sopEls.length) {
    gsap.fromTo(sopEls,
      { y: 55, opacity: 0, scale: 0.94 },
      { y: 0, opacity: 1, scale: 1, stagger: 0.18, duration: 0.75, ease: 'power3.out',
        scrollTrigger: ST('.s-oneplatform', 'top 80%') }
    );
  }
}

/* ═══════════════════════════════════════════════════════════
   9.  TRUSTED BRANDS — badges pop + spin
═══════════════════════════════════════════════════════════ */

if ($('.s-trusted')) {
  gsap.fromTo('.str-head',
    { y: 40, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', scrollTrigger: ST('.s-trusted', 'top 80%') }
  );
  $$('.str-badge').forEach((badge, i) => {
    gsap.fromTo(badge,
      { scale: 0, opacity: 0, rotation: i % 2 === 0 ? -30 : 30 },
      { scale: 1, opacity: 1, rotation: 0, duration: 0.75, delay: i * 0.12,
        ease: 'back.out(2.4)', scrollTrigger: ST('.str-badges', 'top 86%') }
    );
  });
}

/* ═══════════════════════════════════════════════════════════
   10. COVERAGE GRID — diagonal cascade (row + col delay)
═══════════════════════════════════════════════════════════ */

if ($('.s-coverage')) {
  gsap.fromTo('.scov-head',
    { y: 45, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', scrollTrigger: ST('.s-coverage', 'top 82%') }
  );
  $$('.scov-state').forEach((state, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    gsap.fromTo(state,
      { y: 65, x: (col - 1.5) * 18, opacity: 0, scale: 0.65 },
      { y: 0, x: 0, opacity: 1, scale: 1,
        duration: 0.6, delay: (row + col) * 0.06,
        ease: 'back.out(1.8)', scrollTrigger: ST('.scov-grid', 'top 88%') }
    );
  });
  if ($('.scov-cta')) {
    gsap.fromTo('.scov-cta',
      { y: 35, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.65, ease: 'back.out(1.7)',
        scrollTrigger: ST('.scov-cta', 'top 90%') }
    );
  }
}

/* ═══════════════════════════════════════════════════════════
   11. TESTIMONIALS — cards rise with 3-D Y-axis tilt
═══════════════════════════════════════════════════════════ */

if ($('.s-testi')) {
  gsap.fromTo('.stesti-head',
    { y: 50, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.75, ease: 'power3.out', scrollTrigger: ST('.s-testi', 'top 80%') }
  );
  $$('.stesti-card').forEach((card, i) => {
    gsap.fromTo(card,
      { y: 90, opacity: 0, scale: 0.82,
        rotationY: i % 2 === 0 ? -18 : 18, transformPerspective: 900 },
      { y: 0, opacity: 1, scale: 1, rotationY: 0,
        duration: 0.85, delay: i * 0.15, ease: 'power3.out',
        scrollTrigger: ST('.stesti-grid', 'top 86%') }
    );
  });
}

/* ═══════════════════════════════════════════════════════════
   12. PLACEMENT PARTNERS — scatter-to-grid
═══════════════════════════════════════════════════════════ */

if ($('.s-partners')) {
  gsap.fromTo('.spart-head',
    { y: 40, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', scrollTrigger: ST('.s-partners', 'top 80%') }
  );
  $$('.spart-logo').forEach((logo, i) => {
    gsap.fromTo(logo,
      { y: 35, opacity: 0, scale: 0.45, rotation: (i % 3 - 1) * 12 },
      { y: 0, opacity: 1, scale: 1, rotation: 0,
        duration: 0.55, delay: i * 0.04,
        ease: 'back.out(2.2)', scrollTrigger: ST('.spart-grid', 'top 88%') }
    );
  });
}

/* ═══════════════════════════════════════════════════════════
   13. NEWSLETTER
═══════════════════════════════════════════════════════════ */

if ($('.s-newsletter')) {
  gsap.fromTo('.s-newsletter',
    { y: 50, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', scrollTrigger: ST('.s-newsletter', 'top 88%') }
  );
  if ($('.snl-form')) {
    gsap.fromTo('.snl-form',
      { scaleX: 0.55, opacity: 0 },
      { scaleX: 1, opacity: 1, duration: 0.75, ease: 'back.out(2)', delay: 0.2,
        scrollTrigger: ST('.s-newsletter', 'top 84%') }
    );
  }
}

/* ═══════════════════════════════════════════════════════════
   14. CTA SECTION — zoom-punch entrance
═══════════════════════════════════════════════════════════ */

if ($('.cta-section')) {
  gsap.fromTo('.cta-content',
    { y: 70, scale: 0.88, opacity: 0 },
    { y: 0, scale: 1, opacity: 1, duration: 0.95, ease: 'power3.out',
      scrollTrigger: ST('.cta-section', 'top 82%') }
  );
}
