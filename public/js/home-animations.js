/* ================================================================
   OSIAN ACADEMY — Homepage Scroll-Driven Animations
   GSAP + ScrollTrigger + CSS Scroll Snap
   ================================================================ */

(function () {
  if (!document.body.classList.contains('page-home')) return;
  if (typeof gsap === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  /* ── Scroll Snap ─────────────────────────────────────────────── */
  // Applied via JS so only the homepage gets snap behaviour
  document.documentElement.style.scrollSnapType = 'y proximity';

  /* ── Helpers ─────────────────────────────────────────────────── */
  const ease = 'power3.out';
  const easeIn = 'power2.in';

  /* ── 1. HERO  (plays on page load — no trigger) ──────────────── */
  const heroTl = gsap.timeline({ defaults: { ease, duration: 0.7 } });
  heroTl
    .from('.hs-eyebrow',    { opacity: 0, y: 14, duration: 0.5 }, 0.15)
    .from('.hs-headline',   { opacity: 0, y: 28, duration: 0.8 }, 0.3)
    .from('.hs-sub',        { opacity: 0, y: 16, duration: 0.55 }, 0.55)
    .from('.hs-cta-row .btn', {
      opacity: 0, y: 12, duration: 0.45, stagger: 0.1
    }, 0.75)
    .from('.hs-feat',       { opacity: 0, x: 22, duration: 0.45, stagger: 0.09 }, 0.65)
    .from('.hs-scroll-cue', { opacity: 0, y: 10, duration: 0.5 }, 1.1);

  /* ── Section helper: fires once when section centre hits viewport ─ */
  function onEnter(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          fn();
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    io.observe(el);
  }

  /* ── 2. COURSES ──────────────────────────────────────────────── */
  onEnter('hs-courses', () => {
    const tl = gsap.timeline({ defaults: { ease, duration: 0.6 } });
    tl.from('#courses .hs-eyebrow',       { opacity: 0, y: 14, duration: 0.45 })
      .from('#courses .hs-section-title', { opacity: 0, y: 18, duration: 0.55 }, '-=0.25')
      .from('#courses .btn-ghost',        { opacity: 0, duration: 0.4 }, '-=0.2')
      .from('.catalog-nav',               { opacity: 0, duration: 0.35 }, '-=0.1')
      .from('.catalog-slide',             {
        opacity: 0, y: 24, duration: 0.5, stagger: 0.1
      }, '-=0.2')
      .from('.hs-empty-courses',          { opacity: 0, y: 16, duration: 0.5 }, '<');
  });

  /* ── 3. WHY OSIAN ────────────────────────────────────────────── */
  onEnter('hs-why', () => {
    const tl = gsap.timeline({ defaults: { ease, duration: 0.6 } });
    tl.from('.why-left .hs-eyebrow',      { opacity: 0, y: 12, duration: 0.45 })
      .from('.why-left .hs-section-title',{ opacity: 0, y: 22, duration: 0.65 }, '-=0.25')
      .from('.why-left .why-body',        { opacity: 0, y: 14, duration: 0.5 }, '-=0.3')
      .from('.why-left .btn',             { opacity: 0, y: 10, duration: 0.4 }, '-=0.2')
      .from('.why-item',                  { opacity: 0, y: 20, duration: 0.45, stagger: 0.1 }, '-=0.35');
  });

  /* ── 4. CATEGORIES ───────────────────────────────────────────── */
  onEnter('hs-categories', () => {
    const tl = gsap.timeline({ defaults: { ease, duration: 0.55 } });
    tl.from('.hs-section-header .hs-eyebrow',      { opacity: 0, y: 12, duration: 0.4 })
      .from('.hs-section-header .hs-section-title', { opacity: 0, y: 20, duration: 0.6 }, '-=0.2')
      .from('.cat-card',                             {
        opacity: 0, y: 18, duration: 0.4, stagger: { each: 0.07, from: 'start' }
      }, '-=0.2');
  });

  /* ── 5. CTA ──────────────────────────────────────────────────── */
  onEnter('hs-cta', () => {
    gsap.from('#enroll > *', {
      opacity: 0,
      y: 18,
      duration: 0.55,
      stagger: 0.13,
      ease
    });
  });

  /* ── Scroll progress dot nav (optional) ─────────────────────── */
  const sections = ['hs-hero','hs-courses','hs-why','hs-categories','hs-cta'];
  const nav = document.createElement('div');
  nav.className = 'hs-dot-nav';
  nav.setAttribute('aria-hidden', 'true');
  sections.forEach((id, i) => {
    const dot = document.createElement('button');
    dot.className = 'hs-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Go to section ' + (i + 1));
    dot.addEventListener('click', () => {
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
    nav.appendChild(dot);
  });
  document.body.appendChild(nav);

  // Update active dot on scroll
  const dotEls = nav.querySelectorAll('.hs-dot');
  const dotObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const idx = sections.indexOf(entry.target.id);
      if (idx === -1) return;
      dotEls.forEach((d, i) => d.classList.toggle('active', i === idx));
    });
  }, { threshold: 0.5 });
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) dotObserver.observe(el);
  });

})();
