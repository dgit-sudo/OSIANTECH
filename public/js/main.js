/* =========================================================
   OSIAN ACADEMY — MAIN JS
   ========================================================= */

const themeStorageKey = 'osian-theme';
const currencyStorageKey = 'osian-currency';
const initialTheme = localStorage.getItem(themeStorageKey);
if (initialTheme === 'light') {
  document.body.classList.add('theme-light');
}

(() => {
  const select = document.querySelector('[data-global-currency]');
  if (!select) return;

  const stored = String(localStorage.getItem(currencyStorageKey) || '').toUpperCase();
  const defaultCurrency = stored || 'INR';

  if ([...select.options].some((option) => option.value === defaultCurrency)) {
    select.value = defaultCurrency;
  } else {
    select.value = 'INR';
  }

  localStorage.setItem(currencyStorageKey, select.value);

  select.addEventListener('change', () => {
    localStorage.setItem(currencyStorageKey, String(select.value || 'INR').toUpperCase());
  });
})();

function toggleTheme() {
  const isLight = document.body.classList.toggle('theme-light');
  localStorage.setItem(themeStorageKey, isLight ? 'light' : 'dark');
}

document.querySelectorAll('[data-theme-toggle]').forEach((el) => {
  el.addEventListener('click', (event) => {
    event.preventDefault();
    toggleTheme();
  });
});

const isHomePage = document.body.classList.contains('page-home');

/* ---- Navbar scroll effect ---- */
const navbar = document.getElementById('navbar');
const navActions = document.querySelector('.nav-actions');
if (isHomePage && navbar) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });
}

/* ---- Hamburger menu ---- */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

if (hamburger && navLinks && navActions) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navActions.classList.toggle('open');
    const open = navLinks.classList.contains('open');
    hamburger.setAttribute('aria-expanded', open);
    // animate spans
    const spans = hamburger.querySelectorAll('span');
    if (open) {
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity   = '';
      spans[2].style.transform = '';
    }
  });
  // close on outside click
  document.addEventListener('click', (e) => {
    if (!navbar.contains(e.target)) {
      navLinks.classList.remove('open');
      navActions.classList.remove('open');
    }
  });
}

/* ---- Courses mega menu ---- */
(() => {
  const navbarRoot = document.getElementById('navbar');
  const coursesGroup = navbarRoot?.querySelector('[data-nav-courses-group]');
  const coursesToggle = navbarRoot?.querySelector('[data-nav-courses-toggle]');
  const menu = navbarRoot?.querySelector('[data-nav-courses-menu]');
  if (!navbarRoot || !coursesGroup || !coursesToggle || !menu) return;

  const categories = Array.from(menu.querySelectorAll('[data-nav-course-category]'));
  const panels = Array.from(menu.querySelectorAll('[data-nav-course-panel]'));
  if (!categories.length || !panels.length) return;

  const activate = (key) => {
    categories.forEach((button) => {
      const active = button.dataset.navCourseCategory === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-expanded', active ? 'true' : 'false');
    });

    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.navCoursePanel === key);
    });
  };

  const firstKey = categories[0].dataset.navCourseCategory;
  if (firstKey) activate(firstKey);

  categories.forEach((button) => {
    const key = button.dataset.navCourseCategory;
    button.addEventListener('mouseenter', () => activate(key));
    button.addEventListener('focus', () => activate(key));
    button.addEventListener('click', () => {
      activate(key);
      coursesGroup.classList.add('is-open');
    });
  });

  coursesToggle.addEventListener('click', () => {
    coursesGroup.classList.toggle('is-open');
  });

  document.addEventListener('click', (event) => {
    if (!coursesGroup.contains(event.target)) {
      coursesGroup.classList.remove('is-open');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      coursesGroup.classList.remove('is-open');
    }
  });
})();

/* ---- Intersection Observer for scroll animations ---- */
const animatedEls = document.querySelectorAll('[data-animate]');
if (animatedEls.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // stagger cards within grids
        const delay = entry.target.closest('.courses-grid, .categories-grid, .testimonials-grid, .team-grid, .values-grid')
          ? Array.from(entry.target.parentElement.children).indexOf(entry.target) * 80
          : 0;
        setTimeout(() => {
          entry.target.classList.add('in-view');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  animatedEls.forEach(el => observer.observe(el));
}

/* ---- Smooth anchor scroll ---- */
if (isHomePage) {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/* ---- Counter animation for stats ---- */
function animateCounter(el, target, suffix) {
  const isFloat = target % 1 !== 0;
  let start = 0;
  const duration = 1800;
  const startTime = performance.now();
  const step = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = isFloat ? (start + (target - start) * ease).toFixed(1) : Math.round(start + (target - start) * ease);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const statValues = document.querySelectorAll('.stat-value');
if (isHomePage && statValues.length) {
  const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const text = el.textContent;
        const num = parseFloat(text.replace(/[^0-9.]/g, ''));
        const suffix = text.replace(/[0-9.]/g, '');
        if (!isNaN(num)) animateCounter(el, num, suffix);
        statObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  statValues.forEach(el => statObserver.observe(el));
}

/* Card tilt removed — CSS handles hover */

/* ---- Active nav link on scroll ---- */
const sections = document.querySelectorAll('section[id]');
if (isHomePage && sections.length) {
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      if (window.scrollY >= section.offsetTop - 120) current = section.id;
    });
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) link.classList.add('active');
    });
  }, { passive: true });
}

/* ---- Homepage course carousel ---- */
if (isHomePage) {
document.querySelectorAll('[data-catalog-carousel]').forEach((carousel) => {
  const viewport = carousel.querySelector('.catalog-viewport');
  const track = carousel.querySelector('[data-carousel-track]');
  const slides = Array.from(carousel.querySelectorAll('.catalog-slide'));
  const prevBtn = carousel.querySelector('[data-carousel-prev]');
  const nextBtn = carousel.querySelector('[data-carousel-next]');

  if (!viewport || !track || slides.length <= 3 || !prevBtn || !nextBtn) return;

  let index = 0;

  const getVisibleCount = () => {
    if (window.matchMedia('(max-width: 768px)').matches) return 1;
    if (window.matchMedia('(max-width: 1024px)').matches) return 2;
    return 3;
  };

  const SLIDE_GAP = 24;

  const update = () => {
    const visible = getVisibleCount();
    const maxIndex = Math.max(0, slides.length - visible);
    if (index > maxIndex) index = maxIndex;

    const slideWidth = (viewport.clientWidth - (visible - 1) * SLIDE_GAP) / visible;
    slides.forEach((slide) => {
      slide.style.flex = `0 0 ${slideWidth}px`;
      slide.style.maxWidth = `${slideWidth}px`;
    });

    track.style.transform = `translateX(-${index * (slideWidth + SLIDE_GAP)}px)`;
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= maxIndex;
  };

  prevBtn.addEventListener('click', () => {
    const step = getVisibleCount();
    index = Math.max(0, index - step);
    update();
  });

  nextBtn.addEventListener('click', () => {
    const step = getVisibleCount();
    const maxIndex = Math.max(0, slides.length - getVisibleCount());
    index = Math.min(maxIndex, index + step);
    update();
  });

  window.addEventListener('resize', update, { passive: true });
  update();
});
}

/* ---- FAQ accordion ---- */
document.querySelectorAll('[data-faq-question]').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('[data-faq-item]');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('[data-faq-item]').forEach(i => {
      i.classList.remove('open');
      i.querySelector('[data-faq-question]')?.setAttribute('aria-expanded', 'false');
    });
    if (!wasOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

/* ---- Courses live search (client-side instant filter) ---- */
(() => {
  const form = document.querySelector('[data-courses-search-form]');
  const input = document.querySelector('[data-courses-search-input]');
  const grid = document.querySelector('[data-courses-grid]');
  const cards = Array.from(document.querySelectorAll('[data-course-card]'));
  const empty = document.querySelector('[data-courses-empty]');

  if (!form || !input || !grid || !cards.length) return;

  const normalize = (value = '') => String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const filterCards = () => {
    const query = normalize(input.value);
    const tokens = query ? query.split(' ') : [];
    let visible = 0;

    cards.forEach((card) => {
      const haystack = normalize(card.getAttribute('data-course-title') || '');
      const match = !tokens.length || tokens.every((token) => haystack.includes(token));
      card.style.display = match ? '' : 'none';
      if (match) visible += 1;
    });

    if (empty) empty.style.display = visible ? 'none' : '';
  };

  input.addEventListener('input', filterCards);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    filterCards();
  });

  filterCards();
})();
