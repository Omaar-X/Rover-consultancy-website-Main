/**
 * ==============================================================================
 * ROVER CONSULTANCY SERVICES
 * Schema.org Structured Data Injector
 * Version: 1.0.0
 * ------------------------------------------------------------------------------
 * SRS Reference: Section 7.5 — Schema.org Structured Data
 * Injects Organization, LocalBusiness, TravelAgency, and (where present)
 * FAQPage JSON-LD into <head> for SEO rich results.
 *
 * PHASE 1B: Company data will be sourced from the live Settings API instead of
 * the local local JSON.
 * ==============================================================================
 */

(function () {
  'use strict';

  const requestJson = window.ROVER_REQUEST_JSON || function (path) {
    if (typeof fetch === 'function') {
      return fetch(path).then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${path}`);
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
  };

  function injectJsonLd(id, data) {
    // Avoid duplicate injection if script runs twice
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  async function buildSchemas() {
    let settings = {};
    try {
      settings = await requestJson((window.ROVER_CONFIG && window.ROVER_CONFIG.dataPaths.settings) || '../data/settings.json');
    } catch (e) {
      console.warn('[Rover Schema] Could not load settings.json, using fallback values.');
    }

    const company = settings.company || {};
    const contact = settings.contact || {};
    const social = settings.social || {};

    const siteUrl = window.location.origin + '/';
    const logoUrl = siteUrl + 'images/logo/rover-logo.svg';

    /* --- Organization + TravelAgency Schema --- */
    const organizationSchema = {
      '@context': 'https://schema.org',
      '@type': 'TravelAgency',
      'name': company.name || 'Rover Consultancy Services',
      'alternateName': company.short_name || 'Rover Consultancy',
      'description': (settings.seo_defaults && settings.seo_defaults.meta_description) ||
        'Rover Consultancy Services offers expert visa consultation, tour packages, air tickets, hotel booking, and Hajj & Umrah services in Dhaka, Bangladesh.',
      'url': siteUrl,
      'logo': logoUrl,
      'image': logoUrl,
      'telephone': contact.phone_display || '+880-1726-763326',
      'email': contact.email || 'info@roverconsultancy.com',
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': 'Dhaka',
        'addressCountry': 'BD'
      },
      'sameAs': [
        social.facebook,
        social.instagram,
        social.linkedin,
        social.youtube
      ].filter(Boolean)
    };

    /* --- LocalBusiness Schema (Homepage & Contact page) --- */
    const localBusinessSchema = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      'name': company.name || 'Rover Consultancy Services',
      'image': logoUrl,
      'telephone': contact.phone_display || '+880-1726-763326',
      'email': contact.email || 'info@roverconsultancy.com',
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': 'Dhaka',
        'addressCountry': 'BD'
      },
      'priceRange': '$$',
      'openingHoursSpecification': [{
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        'opens': '10:00',
        'closes': '19:00'
      }]
    };

    injectJsonLd('schema-organization', organizationSchema);
    injectJsonLd('schema-localbusiness', localBusinessSchema);

    const pageModule = document.body && document.body.dataset ? document.body.dataset.pageModule : '';
    const skipDynamicSeoSchema = pageModule === 'visa';

    /* --- WebPage Schema --- */
    if (!skipDynamicSeoSchema) {
      const webPageSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        'name': document.title,
        'url': window.location.href,
        'isPartOf': {
          '@type': 'WebSite',
          'name': company.name || 'Rover Consultancy Services',
          'url': siteUrl
        }
      };

      injectJsonLd('schema-webpage', webPageSchema);
    }

    /* --- FAQPage Schema — only if FAQ data is present on this page --- */
    try {
      const faqData = await requestJson((window.ROVER_CONFIG && window.ROVER_CONFIG.dataPaths.faq) || '../data/faq.json');
      if (faqData && faqData.faqs && faqData.faqs.length && document.querySelector('[data-render="faq"]')) {
        const faqSchema = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          'mainEntity': faqData.faqs.map((f) => ({
            '@type': 'Question',
            'name': f.question,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': f.answer
            }
          }))
        };
        injectJsonLd('schema-faqpage', faqSchema);
      }
    } catch (e) {
      console.warn('[Rover Schema] FAQ schema not injected:', e);
    }

    /* --- BreadcrumbList Schema — auto-built from data-breadcrumb elements --- */
    if (!skipDynamicSeoSchema) {
      const breadcrumbEls = document.querySelectorAll('[data-breadcrumb-item]');
      if (breadcrumbEls.length) {
        const items = Array.from(breadcrumbEls).map((el, i) => ({
          '@type': 'ListItem',
          'position': i + 1,
          'name': el.textContent.trim(),
          'item': el.tagName === 'A' ? el.href : window.location.href
        }));
        injectJsonLd('schema-breadcrumb', {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          'itemListElement': items
        });
      }
    }
  }

  document.addEventListener('DOMContentLoaded', buildSchemas);

})();
