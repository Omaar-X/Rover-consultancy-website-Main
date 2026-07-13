/**
 * ==============================================================================
 * ROVER CONSULTANCY SERVICES
* Main JavaScript — UI Interactions & Data Rendering
 * Version: 1.0.0
 * ------------------------------------------------------------------------------
 * Contents:
 *   1. Utility Helpers
 *   2. Data Loader (JSON data mode)
 *   3. Sticky Header
 *   4. Mobile Menu Drawer
 *   5. Floating Buttons (WhatsApp / Messenger / Phone / Back-to-Top)
 *   6. Scroll Reveal Animations
 *   7. Stats Counter Animation
 *   8. FAQ Accordion
 *   9. Testimonial Slider
 *  10. Country Search (Hero + Search Section)
 *  11. Render Functions — Services, Destinations, Testimonials, FAQ
 *  12. Contact / Inquiry Form (client-side validation only in current frontend)
 *  13. Newsletter Form (client-side validation only in current frontend)
 *  14. Init — DOMContentLoaded bootstrap
 * ==============================================================================
 */

(function () {
  'use strict';

  const CONFIG = window.ROVER_CONFIG || {};
  const resolveAssetUrl = (window.ROVER_CONFIG && typeof window.ROVER_CONFIG.assetUrl === 'function')
    ? window.ROVER_CONFIG.assetUrl
    : (path) => path;

  /* ============================================================================
     1. UTILITY HELPERS
  ============================================================================ */

  const qs  = (sel, ctx) => (ctx || document).querySelector(sel);
  const qsa = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /** Debounce helper — used for scroll/resize/input listeners */
  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /** Simple HTML-escape to keep dynamically-rendered text safe */
  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /** Lightweight JSON loader with XMLHttpRequest fallback for older browser runtimes. */
  function requestJson(path) {
    if (typeof fetch === 'function') {
      return fetch(path).then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load ${path}`);
        }
        return res.json();
      });
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', path, true);
      xhr.responseType = 'json';
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response && typeof xhr.response === 'object'
            ? xhr.response
            : JSON.parse(xhr.responseText || '{}'));
          return;
        }
        reject(new Error(`Failed to load ${path}`));
      };
      xhr.onerror = () => reject(new Error(`Failed to load ${path}`));
      xhr.send();
    });
  }

  window.ROVER_REQUEST_JSON = requestJson;

  /** Fetch a local JSON JSON file (current frontend) */
  async function fetchLocalJson(path) {
    try {
      return await requestJson(path);
    } catch (err) {
      console.error('[Rover] Data load error:', err);
      return null;
    }
  }

  /* ============================================================================
     2. DATA LOADER
     In API mode, swap CONFIG.dataSource to 'api' and these functions will read
     from CONFIG.apiBaseUrl instead — page code calling getCountries() etc. does
     not need to change.
  ============================================================================ */

  const DataLoader = {
    async getCountries() {
      if (CONFIG.dataSource === 'api') {
        // PHASE 1B: return fetch(`${CONFIG.apiBaseUrl}?action=getCountries`).then(r => r.json());
      }
      const data = await fetchLocalJson(CONFIG.dataPaths.countries);
      const countries = data ? data.countries : [];
      return countries.map((c) => ({
        ...c,
        image_url: c.image_url || `images/destinations/${c.country_id}.jpg`
      }));
    },
    async getTestimonials() {
      const data = await fetchLocalJson(CONFIG.dataPaths.testimonials);
      return data ? data.testimonials : [];
    },
    async getServices() {
      const data = await fetchLocalJson(CONFIG.dataPaths.services);
      return data ? data.services : [];
    },
    async getFaqs() {
      const data = await fetchLocalJson(CONFIG.dataPaths.faq);
      return data ? data.faqs : [];
    },
    async getSettings() {
      const data = await fetchLocalJson(CONFIG.dataPaths.settings);
      return data || {};
    }
  };

  /* ============================================================================
     3. STICKY HEADER
  ============================================================================ */

  function initStickyHeader() {
    const header = qs('.site-header');
    if (!header) return;

    const threshold = (CONFIG.ui && CONFIG.ui.headerScrollThreshold) || 80;

    function updateHeader() {
      if (window.scrollY > threshold) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    updateHeader(); // Set initial state (handles page-reload mid-scroll)
    window.addEventListener('scroll', debounce(updateHeader, 10), { passive: true });
  }

  /* ============================================================================
     4. MOBILE MENU DRAWER
  ============================================================================ */

  function initMobileMenu() {
    const hamburger = qs('.hamburger');
    const menu = qs('.mobile-menu');
    const closeBtn = qs('.mobile-menu__close');
    const overlay = qs('.mobile-menu__overlay');

    if (!hamburger || !menu) return;

    function openMenu() {
      menu.classList.add('is-open');
      hamburger.classList.add('is-active');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
    }

    function closeMenu() {
      menu.classList.remove('is-open');
      hamburger.classList.remove('is-active');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    }

    hamburger.addEventListener('click', () => {
      const isOpen = menu.classList.contains('is-open');
      isOpen ? closeMenu() : openMenu();
    });

    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
    });

    // Mobile submenu toggles (accordion-style within drawer)
    qsa('.mobile-nav-item[data-has-submenu]').forEach((item) => {
      const trigger = qs('.mobile-nav-link', item);
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const wasOpen = item.classList.contains('open');
        qsa('.mobile-nav-item').forEach((el) => el.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });

    // Close menu when a direct link (no submenu) is clicked
    qsa('.mobile-nav-link:not([data-has-submenu-trigger])').forEach((link) => {
      link.addEventListener('click', () => {
        if (link.tagName === 'A') closeMenu();
      });
    });
  }

  /* ============================================================================
     5. FLOATING BUTTONS
  ============================================================================ */

  function initFloatingButtons() {
    const whatsappBtn = qs('.float-btn--whatsapp');
    const messengerBtn = qs('.float-btn--messenger');
    const phoneBtn = qs('.float-btn--phone');
    const topBtn = qs('.float-btn--top');

    const contact = CONFIG.contact || {};

    if (whatsappBtn && contact.whatsapp) {
      whatsappBtn.href = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent('Hello Rover Consultancy, I would like to know more about your services.')}`;
    }
    if (messengerBtn && contact.messengerPage) {
      messengerBtn.href = `https://m.me/${contact.messengerPage}`;
    }
    if (phoneBtn && contact.phone) {
      phoneBtn.href = `tel:+${contact.whatsapp || contact.phone}`;
    }

    if (topBtn) {
      const threshold = (CONFIG.ui && CONFIG.ui.backToTopThreshold) || 400;

      function toggleTopBtn() {
        if (window.scrollY > threshold) {
          topBtn.classList.add('visible');
        } else {
          topBtn.classList.remove('visible');
        }
      }

      toggleTopBtn();
      window.addEventListener('scroll', debounce(toggleTopBtn, 10), { passive: true });

      topBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  /* ============================================================================
     6. SCROLL REVEAL ANIMATIONS
     Uses IntersectionObserver — lightweight, no external library (SRS Section 15
     Performance Strategy: no external CDN dependencies).
  ============================================================================ */

  function initScrollReveal() {
    const revealEls = qsa('.reveal, .reveal-left, .reveal-right');
    if (!revealEls.length) return;

    if (!('IntersectionObserver' in window)) {
      // Fallback: show everything immediately on old browsers
      revealEls.forEach((el) => { el.classList.add('revealed'); el.classList.add('is-visible'); });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    revealEls.forEach((el) => observer.observe(el));
  }

  /* ============================================================================
     6B. HERO PARTICLES
     Small ambient effect for the redesigned homepage hero.
  ============================================================================ */

  function initHeroParticles() {
    const particlesBox = qs('#heroParticles');
    if (!particlesBox) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const count = window.innerWidth < 768 ? 14 : 24;
    const fragments = [];

    for (let i = 0; i < count; i += 1) {
      const x = Math.random() * 100;
      const size = 1 + Math.random() * 2.5;
      const duration = 7 + Math.random() * 10;
      const delay = Math.random() * 8;
      const opacity = 0.25 + Math.random() * 0.55;
      fragments.push(
        `<span class="hero-particle" style="--x:${x}%; --size:${size}px; --dur:${duration}s; --delay:-${delay}s; width:${size}px; height:${size}px; opacity:${opacity};"></span>`
      );
    }

    particlesBox.innerHTML = fragments.join('');
  }

  /* ============================================================================
     6C. PAGE NAV / HERO TWEAKS
  ============================================================================ */

  function moveAboutUsAfterHome(navRoot) {
    if (!navRoot) return;
    const items = qsa(':scope > .nav-item, :scope > .mobile-nav-item', navRoot);
    if (!items.length) return;

    const homeItem = items.find((item) => {
      const link = qs('a', item);
      return link && /home/i.test(link.textContent.trim());
    });
    const aboutItem = items.find((item) => {
      const link = qs('a', item);
      return link && /about us/i.test(link.textContent.trim());
    });

    if (homeItem && aboutItem && homeItem.nextElementSibling !== aboutItem) {
      navRoot.insertBefore(aboutItem, homeItem.nextElementSibling);
    }
  }

  function initPageTweaks() {
    const path = (window.location.pathname || '').toLowerCase();
    const body = document.body;

    if (/\/hajj(\.html)?$/.test(path)) {
      body.classList.add('page--hajj');
    } else if (/\/umrah(\.html)?$/.test(path)) {
      body.classList.add('page--umrah');
    }

    moveAboutUsAfterHome(qs('.nav-desktop'));
    moveAboutUsAfterHome(qs('.mobile-menu__nav'));
  }

  /* ============================================================================
     7. STATS COUNTER ANIMATION
  ============================================================================ */

  function initStatsCounter() {
    const counters = qsa('[data-counter]');
    if (!counters.length) return;

    const duration = (CONFIG.ui && CONFIG.ui.counterAnimationDuration) || 2000;

    function animateCounter(el) {
      const target = parseInt(el.getAttribute('data-counter'), 10) || 0;
      const suffix = el.getAttribute('data-suffix') || '';
      const startTime = performance.now();

      function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        // Ease-out cubic for a natural deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        el.textContent = current.toLocaleString() + suffix;
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = target.toLocaleString() + suffix;
        }
      }
      requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      counters.forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach((el) => observer.observe(el));
  }

  /* ============================================================================
     8. FAQ ACCORDION
  ============================================================================ */

  function initFaqAccordion(container) {
    const scope = container || document;
    const items = qsa('.faq-item', scope);

    items.forEach((item) => {
      const question = qs('.faq-question', item);
      const answer = qs('.faq-answer', item);
      if (!question || !answer) return;

      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');

        // Close all others (single-open accordion behavior)
        items.forEach((other) => {
          other.classList.remove('is-open');
          const otherAnswer = qs('.faq-answer', other);
          const otherQuestion = qs('.faq-question', other);
          if (otherAnswer) otherAnswer.style.maxHeight = null;
          if (otherQuestion) otherQuestion.setAttribute('aria-expanded', 'false');
        });

        if (!isOpen) {
          item.classList.add('is-open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
          question.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ============================================================================
     9. TESTIMONIAL SLIDER
  ============================================================================ */

  function initTestimonialSlider() {
    const track = qs('.testimonial-track');
    const prevBtn = qs('.slider-arrow--prev');
    const nextBtn = qs('.slider-arrow--next');
    const dotsContainer = qs('.slider-controls');
    if (!track) return;

    const cards = qsa(':scope > *', track);
    if (!cards.length) return;

    // Build dots
    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      cards.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `Go to testimonial ${i + 1}`);
        dot.addEventListener('click', () => scrollToCard(i));
        dotsContainer.appendChild(dot);
      });
    }

    function scrollToCard(index) {
      const card = cards[index];
      if (!card) return;
      track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' });
    }

    function updateActiveDot() {
      if (!dotsContainer) return;
      const scrollLeft = track.scrollLeft;
      let closestIndex = 0;
      let closestDist = Infinity;
      cards.forEach((card, i) => {
        const dist = Math.abs(card.offsetLeft - track.offsetLeft - scrollLeft);
        if (dist < closestDist) { closestDist = dist; closestIndex = i; }
      });
      qsa('.slider-dot', dotsContainer).forEach((dot, i) => {
        dot.classList.toggle('active', i === closestIndex);
      });
    }

    track.addEventListener('scroll', debounce(updateActiveDot, 100), { passive: true });

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        track.scrollBy({ left: -track.clientWidth * 0.8, behavior: 'smooth' });
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        track.scrollBy({ left: track.clientWidth * 0.8, behavior: 'smooth' });
      });
    }
  }

  /* ============================================================================
     10. COUNTRY SEARCH (Hero search + dedicated Search Section)
  ============================================================================ */

  function initCountrySearch(allCountries) {
    const inputs = qsa('[data-country-search]');
    if (!inputs.length) return;

    inputs.forEach((input) => {
      const resultsBoxId = input.getAttribute('data-results-target');
      const resultsBox = resultsBoxId ? qs(`#${resultsBoxId}`) : null;
      if (!resultsBox) return;

      input.addEventListener('input', debounce(() => {
        const term = input.value.trim().toLowerCase();

        if (!term) {
          resultsBox.innerHTML = '';
          resultsBox.classList.remove('has-results');
          return;
        }

        const matches = allCountries.filter((c) =>
          c.country_name.toLowerCase().includes(term)
        ).slice(0, 6);

        if (!matches.length) {
          resultsBox.innerHTML = `<p class="text-sm text-muted" style="padding: var(--sp-3) var(--sp-4);">No countries found matching "${escapeHtml(input.value)}".</p>`;
          resultsBox.classList.add('has-results');
          return;
        }

        resultsBox.innerHTML = matches.map((c) => `
          <a href="${escapeHtml(resolveAssetUrl(`html/visa-services.html?country=${encodeURIComponent(c.country_id)}`))}" class="search-result-item">
            <span class="flag" aria-hidden="true">${c.flag_emoji}</span>
            <span class="search-result-item__info">
              <span class="search-result-item__name">${escapeHtml(c.country_name)}</span>
              <span class="search-result-item__type">${escapeHtml(c.visa_type)}</span>
            </span>
          </a>
        `).join('');
        resultsBox.classList.add('has-results');
      }, 200));
    });
  }

  /* ============================================================================
     11. RENDER FUNCTIONS — Populate homepage sections from local JSON
  ============================================================================ */

  function statusBadge(status) {
    const map = {
      active:       { cls: 'badge-active',      label: 'Active' },
      coming_soon:  { cls: 'badge-coming-soon',  label: 'Coming Soon' },
      unavailable:  { cls: 'badge-unavailable',  label: 'Temporarily Unavailable' }
    };
    const s = map[status] || map.active;
    return `<span class="badge ${s.cls}"><span class="badge-dot"></span>${s.label}</span>`;
  }

  function visaTypeBadge(type) {
    const map = {
      'E-Visa': 'badge-evisa',
      'Sticker Visa': 'badge-sticker',
      'Electronic Visa': 'badge-electronic'
    };
    const cls = map[type] || 'badge-evisa';
    return `<span class="badge ${cls}">${escapeHtml(type)}</span>`;
  }

  function renderDestinations(countries) {
    const grid = qs('[data-render="destinations"]');
    if (!grid) return;

    const featured = countries.filter((c) => c.featured).slice(0, 8);

    grid.innerHTML = featured.map((c) => `
      <a href="${escapeHtml(resolveAssetUrl(`html/visa-services.html?country=${encodeURIComponent(c.country_id)}`))}"
         class="dest-card reveal"
         aria-label="View ${escapeHtml(c.country_name)} visa information">
        <img
          class="dest-card__img"
          src="${escapeHtml(resolveAssetUrl(`images/destinations/${c.country_id}.jpg`))}"
          onerror="this.src='${escapeHtml(resolveAssetUrl('images/hero/hero-bg-premium.svg'))}'"
          alt="${escapeHtml(c.country_name)} travel destination"
          title="${escapeHtml(c.country_name)}"
          width="360" height="480"
          loading="eager"
          decoding="async" />
        <div class="dest-card__overlay"></div>
        <div class="dest-card__badges">
          ${statusBadge(c.status)}
        </div>
        <div class="dest-card__content">
          <span class="dest-card__flag" aria-hidden="true">${c.flag_emoji}</span>
          <h3 class="dest-card__country-name">${escapeHtml(c.country_name)}</h3>
          <div class="dest-card__meta">
            <span class="dest-card__visa-type">${escapeHtml(c.visa_type)}</span>
            <span class="dest-card__price">Starting from<br><strong>${escapeHtml(c.currency)} ${escapeHtml(c.visa_fee_display)}</strong></span>
          </div>
          <span class="dest-card__cta">
            View Details
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </span>
        </div>
      </a>
    `).join('');

    initScrollReveal(); // Re-init to catch newly-injected .reveal elements
  }

  function serviceIconSvg(icon) {
    const icons = {
      passport: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/></svg>',
      map: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>',
      plane: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-1 .1-1.3.5l-.4.6c-.4.5-.2 1.2.3 1.5L9 12l-2 3H4l-1 1.5 3.5 1L8 21l1.5-1v-3l3-2 3.4 5.4c.3.5 1 .7 1.5.3l.6-.4c.4-.3.6-.8.5-1.3z"/></svg>',
      building: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M9 6h1M14 6h1M9 10h1M14 10h1M9 14h1M14 14h1"/></svg>',
      kaaba: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16M4 4l16 16"/></svg>',
      mosque: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M4 21v-7a8 8 0 0 1 16 0v7M4 21h16M9 21v-5a3 3 0 0 1 6 0v5M12 3v3"/></svg>'
    };
    return icons[icon] || icons.passport;
  }

  function renderServices(services) {
    const grid = qs('[data-render="services"]');
    if (!grid) return;

    grid.innerHTML = services.map((s) => `
      <div class="service-card reveal">
        <div class="service-card__icon-wrap">
          ${serviceIconSvg(s.icon)}
        </div>
        <h3 class="service-card__title">${escapeHtml(s.title)}</h3>
        <p class="service-card__desc">${escapeHtml(s.description)}</p>
        <a href="${escapeHtml(s.link)}" class="btn btn-outline btn-sm">
          ${escapeHtml(s.cta)}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    `).join('');

    initScrollReveal();
  }

  function starSvg() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>';
  }

  function renderTestimonials(testimonials) {
    const track = qs('[data-render="testimonials"]');
    if (!track) return;

    track.innerHTML = testimonials.map((t) => `
      <div class="testimonial-card">
        <div class="testimonial-card__stars" aria-label="${t.rating} out of 5 stars">
          ${starSvg().repeat(t.rating)}
        </div>
        <p class="testimonial-card__text">"${escapeHtml(t.text)}"</p>
        <div class="testimonial-card__author">
          <div class="testimonial-card__avatar flex-center" style="background: var(--grad-primary); color:#fff; font-weight:700; font-size:var(--text-sm);" aria-hidden="true">
            ${escapeHtml(t.avatar_initial)}
          </div>
          <div>
            <div class="testimonial-card__name">${escapeHtml(t.name)}</div>
            <div class="testimonial-card__role">${escapeHtml(t.role)}</div>
            <div class="testimonial-card__country">${t.country_flag} Visited ${escapeHtml(t.country_visited)}</div>
          </div>
        </div>
      </div>
    `).join('');

    initTestimonialSlider();
  }

  function renderFaqs(faqs) {
    const list = qs('[data-render="faq"]');
    if (!list) return;

    list.innerHTML = faqs.map((f, i) => `
      <div class="faq-item">
        <button class="faq-question" aria-expanded="false" aria-controls="faq-answer-${i}">
          <span>${escapeHtml(f.question)}</span>
          <span class="faq-question__icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          </span>
        </button>
        <div class="faq-answer" id="faq-answer-${i}">
          <div class="faq-answer-inner">
            <p>${escapeHtml(f.answer)}</p>
          </div>
        </div>
      </div>
    `).join('');

    initFaqAccordion();
  }

  function renderStats(settings) {
    const stats = settings.stats || {};
    const map = {
      countries_covered: qs('[data-stat="countries_covered"]'),
      visas_processed:   qs('[data-stat="visas_processed"]'),
      happy_clients:     qs('[data-stat="happy_clients"]'),
      years_experience:  qs('[data-stat="years_experience"]')
    };
    Object.keys(map).forEach((key) => {
      const el = map[key];
      if (el && stats[key]) {
        // Extract numeric part for the counter, keep suffix like "+" or ","
        const numMatch = String(stats[key]).match(/[\d,]+/);
        const suffix = String(stats[key]).replace(/[\d,]+/, '');
        if (numMatch) {
          el.setAttribute('data-counter', numMatch[0].replace(/,/g, ''));
          el.setAttribute('data-suffix', suffix);
          el.textContent = '0' + suffix;
        }
      }
    });
    initStatsCounter();
  }

  function applyContactSettings(settings) {
    const contact = settings.contact || {};
    qsa('[data-bind="phone_display"]').forEach((el) => { el.textContent = contact.phone_display || contact.phone || ''; });
    qsa('[data-bind="phone_href"]').forEach((el) => {
      el.href = `tel:+${contact.whatsapp || contact.phone}`;
      el.setAttribute('aria-label', `Call Rover Consultancy ${contact.phone_display || contact.phone || ''}`.trim());
      el.setAttribute('title', 'Call Rover Consultancy');
    });
    qsa('[data-bind="email"]').forEach((el) => {
      el.textContent = contact.email || '';
      if (el.tagName === 'A') el.href = `mailto:${contact.email}`;
    });
    qsa('[data-bind="address"]').forEach((el) => { el.textContent = contact.address || ''; });
    qsa('[data-bind="office_hours"]').forEach((el) => { el.textContent = contact.office_hours || ''; });

    const social = settings.social || {};
    const socialMap = {
      facebook: qsa('[data-social="facebook"]'),
      instagram: qsa('[data-social="instagram"]'),
      linkedin: qsa('[data-social="linkedin"]'),
      youtube: qsa('[data-social="youtube"]')
    };
    Object.keys(socialMap).forEach((key) => {
      socialMap[key].forEach((el) => { if (social[key]) el.href = social[key]; });
    });
  }

  /* ============================================================================
     12. CONTACT / INQUIRY FORM
     current frontend: Client-side validation + simulated submission only.
     API mode: Will POST to Apps Script Web App (action=submitInquiry).
  ============================================================================ */

  function initInquiryForms() {
    const forms = qsa('[data-form="inquiry"]');

    forms.forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        let isValid = true;

        qsa('[required]', form).forEach((field) => {
          const errorEl = form.querySelector(`[data-error-for="${field.name}"]`);
          if (!field.value.trim()) {
            isValid = false;
            field.classList.add('is-error');
            if (errorEl) errorEl.textContent = 'This field is required.';
          } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
            isValid = false;
            field.classList.add('is-error');
            if (errorEl) errorEl.textContent = 'Please enter a valid email address.';
          } else {
            field.classList.remove('is-error');
            if (errorEl) errorEl.textContent = '';
          }
        });

        if (!isValid) return;

        const submitBtn = qs('button[type="submit"]', form);
        if (submitBtn) submitBtn.classList.add('btn--loading');

        // PHASE 1A: Simulate network request.
        // PHASE 1B: Replace this timeout with:
        //   fetch(CONFIG.apiBaseUrl, { method: 'POST', body: new FormData(form) })
        setTimeout(() => {
          if (submitBtn) submitBtn.classList.remove('btn--loading');
          const successBox = qs('[data-form-success]', form.parentElement) || qs('[data-form-success]');
          const refNumber = 'RCS-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 90000) + 10000);

          if (successBox) {
            const refEl = qs('[data-ref-number]', successBox);
            if (refEl) refEl.textContent = refNumber;
            form.style.display = 'none';
            successBox.style.display = 'block';
          } else {
            alert('Thank you! Your inquiry has been received. Reference: ' + refNumber);
            form.reset();
          }
        }, 900);
      });

      // Clear error state as user types
      qsa('.form-control', form).forEach((field) => {
        field.addEventListener('input', () => field.classList.remove('is-error'));
      });
    });
  }

  /* ============================================================================
     13. NEWSLETTER FORM
  ============================================================================ */

  function initNewsletterForms() {
    qsa('[data-form="newsletter"]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = qs('input[type="email"]', form);
        if (!input || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
          if (input) input.classList.add('is-error');
          return;
        }
        input.classList.remove('is-error');
        const btn = qs('button', form);
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = 'Subscribed ✓';
          btn.disabled = true;
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
            form.reset();
          }, 2500);
        }
      });
    });
  }

  /* ============================================================================
     14. INIT — Bootstrap everything after DOM is ready
  ============================================================================ */

  document.addEventListener('DOMContentLoaded', async () => {

    // UI behaviors that don't depend on data
    initStickyHeader();
    initMobileMenu();
    initFloatingButtons();
    initScrollReveal();
    initHeroParticles();
    initPageTweaks();
    initInquiryForms();
    initNewsletterForms();

    // Set current year in footer copyright
    const yearEl = qs('[data-current-year]');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Load local data (current frontend) and render dynamic sections
    try {
      const [countries, services, testimonials, faqs, settings] = await Promise.all([
        DataLoader.getCountries(),
        DataLoader.getServices(),
        DataLoader.getTestimonials(),
        DataLoader.getFaqs(),
        DataLoader.getSettings()
      ]);

      if (countries && countries.length) {
        renderDestinations(countries);
        initCountrySearch(countries);
      }
      if (services && services.length) renderServices(services);
      if (testimonials && testimonials.length) renderTestimonials(testimonials);
      if (faqs && faqs.length) renderFaqs(faqs);
      if (settings) {
        renderStats(settings);
        applyContactSettings(settings);
      }
    } catch (err) {
      console.error('[Rover] Error initializing dynamic content:', err);
    }
  });

})();
