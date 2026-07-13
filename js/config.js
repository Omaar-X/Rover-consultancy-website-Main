/**
 * ==============================================================================
 * ROVER CONSULTANCY SERVICES
 * Global Configuration
 * Version: 1.0.0
 * ------------------------------------------------------------------------------
 * This is the SINGLE FILE to edit when connecting the live backend in API mode.
 * SRS Reference: Section 4.4 (NFR-M04) — "A single config.js file controls all
 * global settings."
 *
 * DO NOT hardcode business data anywhere else in the JavaScript codebase.
 * All page scripts should read from window.ROVER_CONFIG or the JSON files in
 * /assets/data/.
 * ==============================================================================
 */

var ROVER_SITE_BASE_PATH = (function () {
  var pathname = window.location.pathname || '/';
  var basePath = pathname.replace(/\/[^\/]*$/, '/');

  if (/\/html\/?$/.test(basePath)) {
    basePath = basePath.replace(/\/html\/?$/, '/');
  }

  if (!basePath) basePath = '/';
  if (basePath.charAt(basePath.length - 1) !== '/') {
    basePath += '/';
  }

  return basePath;
})();

window.ROVER_CONFIG = {

  /* ---------------------------------------------------------------------------
     ENVIRONMENT
     Change to "production" once deployed to the live cPanel domain.
  --------------------------------------------------------------------------- */
  environment: 'development',

  apiBaseUrl: '',

  /* ---------------------------------------------------------------------------
     ASSET URL RESOLUTION
     GitHub Pages serves this project from a sub-path, so asset paths that start
     with "/" must be rewritten to the repo base path.
  --------------------------------------------------------------------------- */
  assetUrl: function(path) {
    var raw = String(path || '').trim();
    if (!raw) return raw;
    if (/^(?:[a-z]+:)?\/\//i.test(raw) || raw.indexOf('data:') === 0 || raw.indexOf('blob:') === 0) {
      return raw;
    }

    raw = raw.replace(/^\/+/, '');
    if (raw.indexOf(ROVER_SITE_BASE_PATH) === 0) return raw;
    return ROVER_SITE_BASE_PATH + raw;
  },

  /* ---------------------------------------------------------------------------
     DATA SOURCE MODE
     'local'  -> reads JSON files from /assets/data/
     'api'    -> reads live data from apiBaseUrl above
  --------------------------------------------------------------------------- */
  dataSource: 'local',

  /* ---------------------------------------------------------------------------
     LOCAL DATA FILE PATHS
  --------------------------------------------------------------------------- */
  dataPaths: (function() {
    var base = ROVER_SITE_BASE_PATH.replace(/\/$/, '');
    return {
      countries:    base + '/data/countries.json',
      testimonials: base + '/data/testimonials.json',
      services:     base + '/data/services.json',
      faq:          base + '/data/faq.json',
      settings:     base + '/data/settings.json'
    };
  })(),

  /* ---------------------------------------------------------------------------
     ANALYTICS — Google Analytics 4
     Add the live GA4 Measurement ID when analytics is enabled.
  --------------------------------------------------------------------------- */
  ga4MeasurementId: 'G-XXXXXXXXXX',

  recaptchaSiteKey: '',

  /* ---------------------------------------------------------------------------
     CONTACT SHORTCUTS — used by floating buttons & footer
     Kept here so numbers can be updated in one place.
  --------------------------------------------------------------------------- */
  contact: {
    phone: '01726763326',
    whatsapp: '8801726763326',
    messengerPage: 'roverconsultancy',
    email: 'info@roverconsultancy.com'
  },

  /* ---------------------------------------------------------------------------
     UI BEHAVIOR SETTINGS
  --------------------------------------------------------------------------- */
  ui: {
    headerScrollThreshold: 80,      /* px scrolled before header turns solid   */
    backToTopThreshold: 400,        /* px scrolled before "back to top" shows  */
    counterAnimationDuration: 2000, /* ms — stats counter count-up duration    */
    testimonialAutoplay: false,     /* auto-scroll testimonial slider          */
    testimonialAutoplayDelay: 5000  /* ms between auto-scrolls if enabled      */
  }

};
