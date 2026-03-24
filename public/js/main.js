/* =========================================================
   OSIAN ACADEMY — MAIN JS
   ========================================================= */

const themeStorageKey = 'osian-theme';
const initialTheme = localStorage.getItem(themeStorageKey);
if (initialTheme === 'light') {
  document.body.classList.add('theme-light');
}

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

/* ---- Intersection Observer for scroll animations ---- */
const animatedEls = document.querySelectorAll('[data-animate]');
if (isHomePage && animatedEls.length) {
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

/* ---- Course card hover tilt ---- */
if (isHomePage) {
  document.querySelectorAll('.course-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top)  / rect.height - 0.5;
      card.style.transform = `translateY(-6px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'all 0.4s ease';
    });
    card.addEventListener('mouseenter', () => {
      card.style.transition = 'transform 0.1s ease';
    });
  });
}

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

  const update = () => {
    const visible = getVisibleCount();
    const maxIndex = Math.max(0, slides.length - visible);
    if (index > maxIndex) index = maxIndex;

    const slideWidth = viewport.clientWidth / visible;
    slides.forEach((slide) => {
      slide.style.flex = `0 0 ${slideWidth}px`;
      slide.style.maxWidth = `${slideWidth}px`;
    });

    track.style.transform = `translateX(-${index * slideWidth}px)`;
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
