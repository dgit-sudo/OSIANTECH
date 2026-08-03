/* =========================================================
   OSIAN ACADEMY — COURSES CINEMATIC INTERACTIONS
   Scroll reveals, kinetic hero headline, tilt cards,
   magnetic buttons, animated stat counters.
   Loaded only on the courses listing page.
   ========================================================= */
(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover)').matches;

  /* ---- Split hero headline into words for stagger reveal ---- */
  const headline = document.querySelector('[data-hero-headline]');
  if (headline) {
    headline.querySelectorAll('.hero-line').forEach((line) => {
      const text = line.textContent.trim();
      line.innerHTML = text
        .split(' ')
        .map((word, i) => `<span class="word" style="transition-delay:${i * 60}ms">${word}</span>`)
        .join(' ');
    });
    requestAnimationFrame(() => requestAnimationFrame(() => headline.classList.add('is-visible')));
  }

  /* ---- Generic reveal-on-scroll engine ---- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length) {
    if (prefersReducedMotion) {
      revealEls.forEach((el) => el.classList.add('is-visible'));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const delay = Number(entry.target.getAttribute('data-reveal-delay') || 0);
          entry.target.style.setProperty('--reveal-delay', delay);
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
      revealEls.forEach((el) => io.observe(el));
    }
  }

  /* ---- Stagger reveal for grids ---- */
  const staggerGroups = document.querySelectorAll('[data-reveal-stagger]');
  if (staggerGroups.length) {
    staggerGroups.forEach((group) => {
      Array.from(group.children).forEach((child, i) => child.style.setProperty('--i', i));
    });
    if (prefersReducedMotion) {
      staggerGroups.forEach((g) => g.classList.add('is-visible'));
    } else {
      const io2 = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io2.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -50px 0px' });
      staggerGroups.forEach((g) => io2.observe(g));
    }
  }

  /* ---- Animated stat counters ---- */
  const animateCounter = (el, target, suffix) => {
    const isFloat = target % 1 !== 0;
    const duration = 1600;
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = isFloat ? (target * ease).toFixed(1) : Math.round(target * ease);
      el.textContent = current + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const statValues = document.querySelectorAll('.stat-value');
  if (statValues.length && !prefersReducedMotion) {
    const statObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const text = el.textContent;
        const num = parseFloat(text.replace(/[^0-9.]/g, ''));
        const suffix = text.replace(/[0-9.]/g, '');
        if (!Number.isNaN(num)) animateCounter(el, num, suffix);
        statObserver.unobserve(el);
      });
    }, { threshold: 0.5 });
    statValues.forEach((el) => statObserver.observe(el));
  }

  /* ---- 3D tilt on pointer-capable devices ---- */
  if (!prefersReducedMotion && canHover) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      const strength = Number(card.getAttribute('data-tilt-strength') || 6);
      let rect = null;

      card.addEventListener('mouseenter', () => { rect = card.getBoundingClientRect(); });
      card.addEventListener('mousemove', (e) => {
        if (!rect) rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${(-py * strength).toFixed(2)}deg) rotateY(${(px * strength).toFixed(2)}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; rect = null; });
    });
  }

  /* ---- Magnetic buttons ---- */
  if (!prefersReducedMotion && canHover) {
    document.querySelectorAll('[data-magnetic]').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.25;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.25;
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }
})();
