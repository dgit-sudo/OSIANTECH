/* =========================================================
   OSIAN ACADEMY — HOME CINEMATIC INTERACTIONS
   Vanilla JS: scroll reveals, kinetic hero type, tilt cards,
   magnetic buttons. Loaded only on the home page.
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
        .map((word, i) => `<span class="word" style="transition-delay:${i * 70}ms">${word}</span>`)
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
      }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
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
      }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
      staggerGroups.forEach((g) => io2.observe(g));
    }
  }

  /* ---- "How it works" timeline connector reveal ---- */
  const shiwSteps = document.querySelector('.shiw-steps');
  if (shiwSteps) {
    if (prefersReducedMotion) {
      shiwSteps.classList.add('is-visible');
    } else {
      const io3 = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io3.unobserve(entry.target);
        });
      }, { threshold: 0.3 });
      io3.observe(shiwSteps);
    }
  }

  /* ---- 3D tilt on pointer-capable devices ---- */
  if (!prefersReducedMotion && canHover) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      const strength = Number(card.getAttribute('data-tilt-strength') || 8);
      let rect = null;

      card.addEventListener('mouseenter', () => {
        rect = card.getBoundingClientRect();
      });
      card.addEventListener('mousemove', (e) => {
        if (!rect) rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${(-py * strength).toFixed(2)}deg) rotateY(${(px * strength).toFixed(2)}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        rect = null;
      });
    });
  }

  /* ---- Magnetic buttons ---- */
  if (!prefersReducedMotion && canHover) {
    document.querySelectorAll('[data-magnetic]').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.3;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.3;
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  /* ---- One-Platform tab crossfade (progressive enhancement) ---- */
  const tabButtons = document.querySelectorAll('.sop-tab');
  if (tabButtons.length) {
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabButtons.forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.sop-tab-content').forEach((c) => c.classList.add('hidden'));
        btn.classList.add('active');
        const target = document.getElementById(`tab-${btn.dataset.tab}`);
        if (target) target.classList.remove('hidden');
      });
    });
  }
})();
