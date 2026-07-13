/* =============================================================================
   ROVER CONSULTANCY SERVICES
   Theme Manager — Dark / Light Mode
   Version: 2.0.0
   ============================================================================= */
(function () {
  'use strict';

  /* ── 1. Apply saved theme IMMEDIATELY (before paint) ──────────────────── */
  var saved = localStorage.getItem('rover-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);

  /* ── 2. Wire up toggle button ──────────────────────────────────────────── */
  function initTheme() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;

    var label = btn.querySelector('.theme-toggle__label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'theme-toggle__label';
      label.setAttribute('aria-hidden', 'true');

      var moonIcon = btn.querySelector('.icon-moon');
      if (moonIcon && moonIcon.parentNode === btn) {
        btn.insertBefore(label, moonIcon);
      } else {
        btn.appendChild(label);
      }
    }

    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('rover-theme', theme);
      var nextLabel = theme === 'dark' ? 'Light mode' : 'Dark mode';
      label.textContent = nextLabel;
      btn.setAttribute('aria-label', 'Switch to ' + nextLabel.toLowerCase());
      btn.setAttribute('title', nextLabel);
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }

    btn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      setTheme(current === 'dark' ? 'light' : 'dark');
    });

    /* Sync system preference if no saved choice */
    if (!localStorage.getItem('rover-theme')) {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      if (prefersDark.matches) setTheme('dark');
      prefersDark.addEventListener('change', function (e) {
        if (!localStorage.getItem('rover-theme')) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }

    setTheme(document.documentElement.getAttribute('data-theme') || saved);
  }

  /* ── 3. Hero Particles ─────────────────────────────────────────────────── */
  function initParticles() {
    var container = document.getElementById('heroParticles');
    if (!container) return;
    var count = 28;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('span');
      p.className = 'hero-particle';
      var size = Math.random() * 2 + 1;
      p.style.cssText = [
        '--x:' + (Math.random() * 100) + '%',
        '--dur:' + (Math.random() * 12 + 8) + 's',
        '--delay:-' + (Math.random() * 15) + 's',
        'width:' + size + 'px',
        'height:' + size + 'px',
        'opacity:' + (Math.random() * 0.5 + 0.2)
      ].join(';');
      container.appendChild(p);
    }
  }

  /* ── 4. Scroll reveal ──────────────────────────────────────────────────── */
  function initReveal() {
    var els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
    if (!els.length) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
      els.forEach(function (el) { io.observe(el); });
    } else {
      els.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }

  /* ── 5. Smooth counter animation ───────────────────────────────────────── */
  function animateCounter(el, target, suffix) {
    var start = 0;
    var duration = 2000;
    var startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 3);
      var val = Math.round(ease * target);
      el.textContent = val.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initCounters() {
    var els = document.querySelectorAll('[data-stat]');
    if (!els.length) return;
    var triggered = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !triggered) {
          triggered = true;
          els.forEach(function (el) {
            var val  = parseInt(el.textContent) || 0;
            var text = el.textContent;
            var suffix = text.replace(/[0-9,]/g, '') || '+';
            if (val === 0) {
              /* Read from settings data if available */
              var key = el.getAttribute('data-stat');
              var map = {
                countries_covered: 50,
                visas_processed: 3000,
                happy_clients: 3000,
                years_experience: 10
              };
              val = map[key] || 0;
              suffix = key === 'years_experience' ? '+' : '+';
            }
            animateCounter(el, val, suffix);
          });
        }
      });
    }, { threshold: 0.3 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ── 6. Sticky header ──────────────────────────────────────────────────── */
  function initStickyHeader() {
    var header = document.getElementById('siteHeader');
    if (!header) return;
    window.addEventListener('scroll', function () {
      header.classList.toggle('is-sticky', window.scrollY > 60);
    }, { passive: true });
  }

  /* ── Init all ──────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initTheme();
      initParticles();
      initReveal();
      initCounters();
      initStickyHeader();
    });
  } else {
    initTheme();
    initParticles();
    initReveal();
    initCounters();
    initStickyHeader();
  }
})();
