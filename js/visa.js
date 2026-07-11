(function () {
  'use strict';

  const CONFIG = window.ROVER_CONFIG || {};
  const SITE_ORIGIN = (window.location.origin && window.location.origin !== 'null')
    ? window.location.origin
    : 'https://www.roverconsultancy.com';
  const SITE_BASE = SITE_ORIGIN.replace(/\/$/, '') + '/';
  const VISA_PAGE_URL = SITE_BASE + 'visa-services/';
  let visaCatalogPromise = null;
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

  const qs = (sel, ctx) => (ctx || document).querySelector(sel);
  const qsa = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const state = {
    catalog: null,
    documentCategories: [],
    countries: [],
    filtered: [],
    activeCountry: null,
    filters: {
      query: '',
      region: 'all',
      visaType: 'all',
      featured: 'all',
      sort: 'recommended'
    }
  };

  const DEFAULT_CHECKLISTS = {
    general: [
      'Valid passport with at least 6 months of remaining validity',
      'Recent passport-size photographs on a white background',
      'Completed visa application form with accurate details',
      'Bank statement or financial documents where required',
      'Travel itinerary, booking confirmation, or invitation letter'
    ],
    employed: [
      'Employment letter or NOC from the employer',
      'Recent salary slips or payroll proof',
      'Personal bank statement for the required period',
      'Copy of company ID card or business card',
      'Supporting travel booking and accommodation details'
    ],
    business: [
      'Trade licence or business registration documents',
      'Business card and company letterhead if available',
      'Recent bank statement for the business or applicant',
      'Tax documents or VAT/TIN information where applicable',
      'Travel plan and accommodation confirmation'
    ],
    student: [
      'Student ID card or enrollment letter',
      'Sponsor documents if the trip is financed by family',
      'Bank statement or sponsorship financial proof',
      'Institution leave letter when required',
      'Travel booking and accommodation details'
    ],
    family: [
      'Family relationship proof where relevant',
      'Sponsor letter from the primary applicant',
      'Recent bank statement or financial proof',
      'Passport copy and photographs for each traveler',
      'Travel itinerary and hotel/flight details'
    ]
  };

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function slugToTitle(slug) {
    return String(slug || '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function norm(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isTextValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  function normalizeChecklistItem(item) {
    if (typeof item === 'string') {
      return item.trim();
    }

    if (!item || typeof item !== 'object') {
      return '';
    }

    return String(item.label || item.text || item.title || '').trim();
  }

  function normalizeDocumentCategories(source) {
    if (!source) return [];

    if (Array.isArray(source)) {
      return source.map((category, index) => ({
        key: norm(category.key || category.slug || category.label || `category-${index + 1}`).replace(/\s+/g, '-'),
        label: category.label || slugToTitle(category.key || `Category ${index + 1}`),
        items: Array.isArray(category.items)
          ? category.items.map(normalizeChecklistItem).filter(Boolean)
          : []
      })).filter((category) => category.key && category.label && category.items.length);
    }

    if (typeof source === 'object') {
      return Object.entries(source).map(([key, category]) => ({
        key: norm(key).replace(/\s+/g, '-'),
        label: category?.label || slugToTitle(key),
        items: Array.isArray(category?.items)
          ? category.items.map(normalizeChecklistItem).filter(Boolean)
          : []
      })).filter((category) => category.key && category.label && category.items.length);
    }

    return [];
  }

  function getCountryImageUrl(slug) {
    return new URL(`../images/destinations/${slug}.jpg`, window.location.href).href;
  }

  function getDefaultServiceCharge(visaType) {
    const map = {
      'e-visa': '8,000 BDT',
      'electronic visa': '3,000 BDT',
      'sticker visa': '8,000 BDT'
    };
    return map[norm(visaType)] || '8,000 BDT';
  }

  function getStatusLabel(status) {
    const map = {
      active: { label: 'Active', cls: 'badge-active' },
      coming_soon: { label: 'Coming Soon', cls: 'badge-coming-soon' },
      unavailable: { label: 'Temporarily Unavailable', cls: 'badge-unavailable' }
    };
    return map[norm(status)] || map.active;
  }

  function getProcessingComplexityLabel(processingDays, status) {
    if (norm(status) !== 'active') return 'Limited';
    const parsed = parseNumbers(processingDays);
    if (!parsed.length) return 'Moderate';
    const days = parsed[parsed.length - 1];
    if (days <= 3) return 'Low';
    if (days <= 7) return 'Moderate';
    if (days <= 15) return 'High';
    return 'Very high';
  }

  function getCurrencyCode(currencyDisplay) {
    const text = String(currencyDisplay || '').trim().toUpperCase();
    const codes = text.match(/\b[A-Z]{3}\b/g) || [];
    return codes[0] || 'BDT';
  }

  function getCurrencySymbol(currencyCode) {
    const map = {
      BDT: '৳',
      USD: '$',
      EUR: '€',
      GBP: '£',
      CAD: 'C$',
      AUD: 'A$',
      SGD: 'S$',
      MYR: 'RM',
      THB: '฿',
      AED: 'د.إ',
      TRY: '₺',
      INR: '₹',
      JPY: '¥',
      CNY: '¥'
    };
    return map[norm(currencyCode).toUpperCase()] || currencyCode || '';
  }

  function formatCurrencyLabel(currencyDisplay) {
    const code = getCurrencyCode(currencyDisplay);
    const symbol = getCurrencySymbol(code);
    return symbol ? `${symbol} ${code}` : code;
  }

  function getTotalCostLabel(country) {
    const total = getTotalCostValue(country);

    if (!total) return 'Contact us';

    const currencyCode = getCurrencyCode(country.currency_display || country.currency);
    const symbol = getCurrencySymbol(currencyCode);
    const formatted = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0
    }).format(total);

    return symbol ? `${symbol} ${formatted}` : formatted;
  }

  function getTotalCostValue(country) {
    const visaFeeParts = parseNumbers(country.pricing?.visaFee);
    const serviceChargeParts = parseNumbers(country.pricing?.serviceCharge);
    if (!visaFeeParts.length || !serviceChargeParts.length) return 0;
    const visaFee = visaFeeParts.reduce((sum, value) => sum + value, 0);
    const serviceCharge = serviceChargeParts.reduce((sum, value) => sum + value, 0);
    return visaFee + serviceCharge;
  }

  function buildWhatsappLink(country) {
    const whatsappNumber = (CONFIG.contact && CONFIG.contact.whatsapp) || '';
    if (!whatsappNumber) return '#';
    const message = `Hello Rover Consultancy, I would like to know about ${country.country_name} visa services.`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function getVisaTypeBadgeClass(visaType) {
    const key = norm(visaType);
    if (key.includes('sticker')) return 'badge-sticker';
    if (key.includes('electronic')) return 'badge-electronic';
    return 'badge-evisa';
  }

  function parseNumbers(text) {
    return String(text || '')
      .replace(/,/g, '')
      .match(/\d+(?:\.\d+)?/g)
      ?.map(Number) || [];
  }

  function formatWorkingDays(value) {
    const text = String(value || '').trim();
    if (!text || /^n\/a$/i.test(text) || /^tbd$/i.test(text)) return 'Contact us';
    return /working days/i.test(text) ? text : `${text} working days`;
  }

  function formatPriceLabel(value) {
    const text = String(value || '').trim();
    if (!text) return 'Contact Us';
    if (/^(contact us|coming soon|tbd|n\/a)$/i.test(text)) return 'Contact Us';
    return text;
  }

  function splitFeeDisplay(rawValue, visaType) {
    const source = String(rawValue || '').trim();
    const defaultServiceCharge = getDefaultServiceCharge(visaType);

    if (!source) {
      return {
        visaFee: 'Contact us',
        serviceCharge: defaultServiceCharge,
        startingPrice: defaultServiceCharge
      };
    }

    if (/^(contact us|coming soon|tbd|n\/a)$/i.test(source)) {
      return {
        visaFee: source,
        serviceCharge: 'Contact us',
        startingPrice: source
      };
    }

    const parts = source.split('+').map((item) => item.trim()).filter(Boolean);
    if (parts.length > 1) {
      return {
        visaFee: parts[0],
        serviceCharge: parts.slice(1).join(' + '),
        startingPrice: source
      };
    }

    const numericParts = parseNumbers(source);
    if (numericParts.length) {
      return {
        visaFee: source,
        serviceCharge: defaultServiceCharge,
        startingPrice: `${source} + ${defaultServiceCharge}`
      };
    }

    return {
      visaFee: source,
      serviceCharge: defaultServiceCharge,
      startingPrice: source
    };
  }

  function inferSummary(country) {
    if (isTextValue(country.detail_summary)) return country.detail_summary;
    const status = getStatusLabel(country.status).label;
    const time = formatWorkingDays(country.processing_days);
    return `${country.country_name} visa support with ${country.visa_type} processing, ${time}, and ${status.toLowerCase()} service status.`;
  }

  function inferPhotoSpecs(country) {
    if (isTextValue(country.photo_specs)) return country.photo_specs;
    return country.visa_type && norm(country.visa_type).includes('sticker')
      ? '2 recent passport-size photos on a white background'
      : '2 recent passport-size photos on a white background';
  }

  function inferBankBalance(country) {
    if (isTextValue(country.bank_balance)) return country.bank_balance;
    if (norm(country.status) !== 'active') return 'Contact us for the latest requirement';
    return 'Contact us for destination-specific guidance';
  }

  function inferNotes(country) {
    if (isTextValue(country.special_notes)) return country.special_notes;
    if (norm(country.status) === 'coming_soon') return 'This destination is available for consultation on request.';
    if (norm(country.status) === 'unavailable') return 'Service is currently unavailable. Please contact us for alternatives.';
    return 'Document requirements can vary by applicant profile and destination rules. Contact us before preparing final paperwork.';
  }

  function normalizeCountry(country, catalog) {
    const slug = norm(country.country_id || country.country_name).replace(/\s+/g, '-');
    const feeInfo = splitFeeDisplay(country.visa_fee_display || country.starting_price_display || country.visa_fee, country.visa_type);
    const documentCategories = normalizeDocumentCategories(country.document_categories || catalog?.document_categories);

    return {
      ...country,
      country_id: slug,
      country_name: country.country_name || slugToTitle(slug),
      continent: country.continent || 'Asia',
      flag_emoji: country.flag_emoji || '🏳️',
      visa_type: country.visa_type || 'E-Visa',
      status: norm(country.status) || 'active',
      processing_days: country.processing_days || 'Contact us',
      image_url: country.image_url || getCountryImageUrl(slug),
      summary: inferSummary(country),
      pricing: feeInfo,
      visa_fee: formatPriceLabel(feeInfo.visaFee),
      service_charge: formatPriceLabel(feeInfo.serviceCharge),
      starting_price: formatPriceLabel(feeInfo.startingPrice),
      currency_display: country.currency || 'BDT',
      currency_label: formatCurrencyLabel(country.currency || 'BDT'),
      total_cost: getTotalCostLabel({
        ...country,
        pricing: feeInfo,
        currency_display: country.currency || 'BDT'
      }),
      processing_complexity: getProcessingComplexityLabel(country.processing_days || 'Contact us', country.status),
      photo_specs: isTextValue(country.photo_specs) ? country.photo_specs : inferPhotoSpecs(country),
      bank_balance: isTextValue(country.bank_balance) ? country.bank_balance : inferBankBalance(country),
      special_notes: inferNotes(country),
      document_categories: documentCategories
    };
  }

  function injectOrReplaceJsonLd(id, data) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  function updateMeta(tagName, attrName, attrValue, content) {
    let el = document.querySelector(`${tagName}[${attrName}="${attrValue}"]`);
    if (!el) {
      el = document.createElement(tagName);
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function updateSeo(country, mode) {
    const isDetail = mode === 'detail' && country;
    const pageTitle = isDetail
      ? `${country.country_name} Visa Services | Rover Consultancy Services`
      : 'Visa Services | Rover Consultancy Services';
    const pageDescription = isDetail
      ? `${country.country_name} visa services from Rover Consultancy Services. View visa type, processing time, fees, and checklist details.`
      : 'Explore visa services for 50+ destinations with Rover Consultancy Services. Search by country, region, and visa type, then view live details.';
    const canonicalUrl = isDetail
      ? `${VISA_PAGE_URL}?country=${encodeURIComponent(country.country_id)}`
      : VISA_PAGE_URL;
    const ogImage = isDetail
      ? country.image_url
      : new URL('../images/hero/og-homepage.jpg', window.location.href).href;

    document.title = pageTitle;

    updateMeta('meta', 'name', 'description', pageDescription);
    updateMeta('meta', 'property', 'og:title', pageTitle);
    updateMeta('meta', 'property', 'og:description', pageDescription);
    updateMeta('meta', 'property', 'og:url', canonicalUrl);
    updateMeta('meta', 'property', 'og:image', ogImage);
    updateMeta('meta', 'name', 'twitter:title', pageTitle);
    updateMeta('meta', 'name', 'twitter:description', pageDescription);
    updateMeta('meta', 'name', 'twitter:image', ogImage);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const pageTitleEl = qs('[data-visa-page-title]');
    const subtitleEl = qs('[data-visa-page-subtitle]');
    const breadcrumbCurrentEl = qs('[data-breadcrumb-current]');
    if (pageTitleEl) {
      pageTitleEl.textContent = isDetail ? `${country.country_name} visa services` : 'Visa services for 50+ countries';
    }
    if (subtitleEl) {
      subtitleEl.textContent = isDetail
        ? `${country.country_name} details are loaded from the shared JSON catalog, keeping the route extensible and SEO-friendly.`
        : 'Search by country, region, or visa type. Each destination pulls from the shared JSON catalog so the module stays easy to expand.';
    }
    if (breadcrumbCurrentEl) {
      breadcrumbCurrentEl.textContent = isDetail ? country.country_name : 'All Countries';
    }

    injectVisaSchema(country, pageTitle, pageDescription, canonicalUrl, ogImage, isDetail);
  }

  function injectVisaSchema(country, title, description, url, image, isDetail) {
    if (isDetail && country) {
      injectOrReplaceJsonLd('visa-schema-service', {
        '@context': 'https://schema.org',
        '@type': 'Service',
        'name': `${country.country_name} Visa Services`,
        'description': description,
        'serviceType': country.visa_type,
        'provider': {
          '@type': 'TravelAgency',
          'name': 'Rover Consultancy Services',
          'url': VISA_PAGE_URL
        },
        'areaServed': {
          '@type': 'Country',
          'name': country.country_name
        },
        'offers': {
          '@type': 'Offer',
          'price': getTotalCostValue(country) || undefined,
          'priceCurrency': getCurrencyCode(country.currency_display || country.currency || 'BDT'),
          'url': url,
          'availability': 'https://schema.org/InStock'
        },
        'image': image,
        'url': url
      });
    } else {
      const visibleCountries = state.countries.filter((country) => norm(country.status) === 'active');
      injectOrReplaceJsonLd('visa-schema-collection', {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': title,
        'description': description,
        'url': url,
        'isPartOf': {
          '@type': 'WebSite',
          'name': 'Rover Consultancy Services',
          'url': SITE_BASE
        },
        'mainEntity': {
          '@type': 'ItemList',
          'numberOfItems': visibleCountries.length,
          'itemListElement': visibleCountries.map((country, index) => ({
            '@type': 'ListItem',
            'position': index + 1,
            'name': country.country_name,
            'url': `${VISA_PAGE_URL}?country=${encodeURIComponent(country.country_id)}`
          }))
        }
      });
    }

    const breadcrumbItems = [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': SITE_BASE
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Visa Services',
        'item': VISA_PAGE_URL
      }
    ];

    if (isDetail && country) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        'position': 3,
        'name': country.country_name,
        'item': url
      });
    }

    injectOrReplaceJsonLd('visa-schema-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': breadcrumbItems
    });
  }

  async function loadVisaCatalog() {
    if (visaCatalogPromise) return visaCatalogPromise;

    visaCatalogPromise = (async () => {
      if (CONFIG.dataSource === 'api') {
        // API hook: return fetch(`${CONFIG.apiBaseUrl}?action=getCountries`).then((r) => r.json());
      }

      const path = (CONFIG.dataPaths && CONFIG.dataPaths.countries) || '../data/countries.json';
      const payload = await requestJson(path);
      const countries = Array.isArray(payload.countries) ? payload.countries : [];
      const documentCategories = normalizeDocumentCategories(payload.document_categories);
      return {
        ...payload,
        countries,
        document_categories: documentCategories
      };
    })();

    return visaCatalogPromise;
  }

  function buildFilterOptions(countries) {
    const regionSelect = qs('[data-visa-region]');
    const visaTypeSelect = qs('[data-visa-type]');
    const featuredSelect = qs('[data-visa-featured]');
    if (regionSelect) {
      const regions = Array.from(new Set(countries.map((country) => country.continent).filter(Boolean)));
      regionSelect.innerHTML = '<option value="all">All regions</option>' + regions.map((region) => (
        `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`
      )).join('');
    }
    if (visaTypeSelect) {
      const visaTypes = Array.from(new Set(countries.map((country) => country.visa_type).filter(Boolean)));
      visaTypeSelect.innerHTML = '<option value="all">All visa types</option>' + visaTypes.map((visaType) => (
        `<option value="${escapeHtml(visaType)}">${escapeHtml(visaType)}</option>`
      )).join('');
    }
    if (featuredSelect) {
      featuredSelect.innerHTML = `
        <option value="all">All countries</option>
        <option value="featured">Featured only</option>
        <option value="not_featured">Not featured</option>
      `;
    }
  }

  function bindFilterEvents() {
    const search = qs('[data-visa-search]');
    const region = qs('[data-visa-region]');
    const visaType = qs('[data-visa-type]');
    const featured = qs('[data-visa-featured]');
    const sort = qs('[data-visa-sort]');

    if (search) search.addEventListener('input', () => {
      state.filters.query = search.value.trim();
      renderCountryList();
    });
    if (region) region.addEventListener('change', () => {
      state.filters.region = region.value;
      renderCountryList();
    });
    if (visaType) visaType.addEventListener('change', () => {
      state.filters.visaType = visaType.value;
      renderCountryList();
    });
    if (featured) featured.addEventListener('change', () => {
      state.filters.featured = featured.value;
      renderCountryList();
    });
    if (sort) sort.addEventListener('change', () => {
      state.filters.sort = sort.value;
      renderCountryList();
    });

    qsa('[data-visa-reset-filters]').forEach((button) => {
      button.addEventListener('click', () => {
        if (state.activeCountry) {
          window.location.href = VISA_PAGE_URL;
          return;
        }

        state.filters.query = '';
        state.filters.region = 'all';
        state.filters.visaType = 'all';
        state.filters.featured = 'all';
        state.filters.sort = 'recommended';

        if (search) search.value = '';
        if (region) region.value = 'all';
        if (visaType) visaType.value = 'all';
        if (featured) featured.value = 'all';
        if (sort) sort.value = 'recommended';
        renderCountryList();
      });
    });
  }

  function applyFilters(countries) {
    const query = norm(state.filters.query);
    const region = norm(state.filters.region);
    const visaType = norm(state.filters.visaType);
    const featured = norm(state.filters.featured);

    let filtered = countries.filter((country) => {
      const isActive = norm(country.status) === 'active';
      const matchesQuery = !query || norm(country.country_name).includes(query);
      const matchesRegion = region === 'all' || norm(country.continent) === region;
      const matchesVisaType = visaType === 'all' || norm(country.visa_type) === visaType;
      const matchesFeatured = featured === 'all'
        || (featured === 'featured' && Boolean(country.featured))
        || (featured === 'not_featured' && !country.featured);
      return isActive && matchesQuery && matchesRegion && matchesVisaType && matchesFeatured;
    });

    switch (state.filters.sort) {
      case 'price-asc':
        filtered.sort((a, b) => getPriceScore(a) - getPriceScore(b) || a.country_name.localeCompare(b.country_name));
        break;
      case 'price-desc':
        filtered.sort((a, b) => getPriceScore(b) - getPriceScore(a) || a.country_name.localeCompare(b.country_name));
        break;
      case 'alphabetical-asc':
        filtered.sort((a, b) => a.country_name.localeCompare(b.country_name));
        break;
      case 'alphabetical-desc':
        filtered.sort((a, b) => b.country_name.localeCompare(a.country_name));
        break;
      default:
        filtered.sort((a, b) => {
          const activeA = norm(a.status) === 'active' ? 0 : 1;
          const activeB = norm(b.status) === 'active' ? 0 : 1;
          const featuredA = a.featured ? 0 : 1;
          const featuredB = b.featured ? 0 : 1;
          return activeA - activeB || featuredA - featuredB || a.country_name.localeCompare(b.country_name);
        });
    }

    return filtered;
  }

  function getPriceScore(country) {
    const parsed = parseNumbers(country.starting_price);
    if (!parsed.length) return Number.POSITIVE_INFINITY;
    return parsed.reduce((total, value) => total + value, 0);
  }

  function renderStatusBadge(status) {
    const label = getStatusLabel(status);
    return `<span class="badge ${label.cls}"><span class="badge-dot"></span>${escapeHtml(label.label)}</span>`;
  }

  function renderVisaTypeBadge(visaType) {
    return `<span class="badge ${getVisaTypeBadgeClass(visaType)}">${escapeHtml(visaType)}</span>`;
  }

  function renderFeaturedCountryCard(country) {
    const detailUrl = `?country=${encodeURIComponent(country.country_id)}`;
    return `
      <article class="visa-featured-card reveal">
        <a class="visa-featured-card__media" href="${detailUrl}" aria-label="View details for ${escapeHtml(country.country_name)}">
          <img class="visa-featured-card__image" src="${escapeHtml(country.image_url)}" alt="${escapeHtml(country.country_name)} destination" width="320" height="200" loading="lazy" onerror="this.onerror=null;this.src='../images/hero/hero-bg.jpg';">
        </a>
        <div class="visa-featured-card__body">
          <div class="visa-featured-card__topline">
            ${renderStatusBadge(country.status)}
            ${renderVisaTypeBadge(country.visa_type)}
          </div>
          <h3 class="visa-featured-card__title">${escapeHtml(country.country_name)}</h3>
          <p class="visa-featured-card__meta">${escapeHtml(country.continent)} • ${escapeHtml(formatWorkingDays(country.processing_days))}</p>
          <div class="visa-featured-card__pricing">
            <span>Starting from</span>
            <strong>${escapeHtml(country.starting_price)}</strong>
          </div>
          <div class="visa-card__actions">
            <a class="btn btn-outline btn-sm" href="${detailUrl}">View detail</a>
            <a class="btn btn-primary btn-sm" href="../contact-us/?service=visa&country=${encodeURIComponent(country.country_id)}">Apply</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderCountryCard(country) {
    const detailUrl = `?country=${encodeURIComponent(country.country_id)}`;
    const applyUrl = `../contact-us/?service=visa&country=${encodeURIComponent(country.country_id)}`;
    const featuredBadge = country.featured
      ? '<span class="badge badge-gold-solid">Featured</span>'
      : '';

    return `
      <article class="visa-card reveal">
        <a class="visa-card__media" href="${detailUrl}" aria-label="View details for ${escapeHtml(country.country_name)}">
          <img class="visa-card__image" src="${escapeHtml(country.image_url)}" alt="${escapeHtml(country.country_name)} destination" width="640" height="360" loading="lazy" onerror="this.onerror=null;this.src='../images/hero/hero-bg.jpg';">
          <div class="visa-card__overlay"></div>
          <div class="visa-card__topline">
            ${renderStatusBadge(country.status)}
            ${renderVisaTypeBadge(country.visa_type)}
            ${featuredBadge}
          </div>
          <div class="visa-card__copy">
            <div class="visa-card__flag" aria-hidden="true">${escapeHtml(country.flag_emoji)}</div>
            <h3 class="visa-card__title">${escapeHtml(country.country_name)}</h3>
            <p class="visa-card__region">${escapeHtml(country.continent)}</p>
          </div>
        </a>
        <div class="visa-card__body">
          <div class="visa-card__meta">
            <div><span>Processing time</span><strong>${escapeHtml(formatWorkingDays(country.processing_days))}</strong></div>
            <div><span>Starting price</span><strong>${escapeHtml(country.starting_price)}</strong></div>
            <div><span>Visa fee</span><strong>${escapeHtml(country.visa_fee)}</strong></div>
            <div><span>Service charge</span><strong>${escapeHtml(country.service_charge)}</strong></div>
            <div><span>Currency</span><strong>${escapeHtml(country.currency_display)}</strong></div>
          </div>
          <div class="visa-card__actions">
            <a class="btn btn-outline btn-sm" href="${detailUrl}">View detail</a>
            <a class="btn btn-primary btn-sm" href="${applyUrl}">Apply</a>
          </div>
        </div>
      </article>
    `;
  }

  function updateSummaryCounters(countries) {
    const total = countries.length;
    const active = countries.filter((country) => norm(country.status) === 'active').length;
    const comingSoon = countries.filter((country) => norm(country.status) === 'coming_soon').length;

    const totalEl = qs('[data-visa-total]');
    const activeEl = qs('[data-visa-active]');
    const comingSoonEl = qs('[data-visa-coming-soon]');

    if (totalEl) totalEl.textContent = String(total);
    if (activeEl) activeEl.textContent = String(active);
    if (comingSoonEl) comingSoonEl.textContent = String(comingSoon);
  }

  function updateResultMessage(filtered) {
    const el = qs('[data-visa-results]');
    if (!el) return;
    if (!filtered.length) {
      el.textContent = 'No matches found';
      return;
    }
    el.textContent = `${filtered.length} ${filtered.length === 1 ? 'country' : 'countries'} available`;
  }

  function showListMode() {
    const listView = qs('[data-visa-list-view]');
    const detailView = qs('[data-visa-detail-view]');
    const loading = qs('[data-visa-loading]');
    if (listView) {
      listView.hidden = false;
      listView.style.display = 'block';
    }
    if (detailView) {
      detailView.hidden = true;
      detailView.style.display = 'none';
    }
    if (loading) {
      loading.hidden = true;
      loading.style.display = 'none';
    }
  }

  function showDetailMode() {
    const listView = qs('[data-visa-list-view]');
    const detailView = qs('[data-visa-detail-view]');
    const loading = qs('[data-visa-loading]');
    if (listView) {
      listView.hidden = true;
      listView.style.display = 'none';
    }
    if (detailView) {
      detailView.hidden = false;
      detailView.style.display = 'block';
    }
    if (loading) {
      loading.hidden = true;
      loading.style.display = 'none';
    }
  }

  function renderFeaturedCountries() {
    const section = qs('[data-visa-featured-section]');
    const grid = qs('[data-visa-featured-grid]');
    if (!section || !grid) return;

    const featured = state.countries
      .filter((country) => norm(country.status) === 'active' && country.featured)
      .slice(0, 6);

    if (!featured.length) {
      section.hidden = true;
      grid.innerHTML = '';
      return;
    }

    section.hidden = false;
    grid.innerHTML = featured.map(renderFeaturedCountryCard).join('');
    revealInjectedElements(grid);
  }

  function revealInjectedElements(container) {
    if (!container) return;
    const els = container.querySelectorAll('.reveal, .reveal-left, .reveal-right');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => { el.classList.add('revealed'); el.classList.add('is-visible'); });
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
      { threshold: 0.1, rootMargin: '0px 0px -20px 0px' }
    );
    els.forEach((el) => observer.observe(el));
  }

  function setEmptyState(kind) {
    const emptyState = qs('[data-visa-empty]');
    const invalidState = qs('[data-visa-invalid]');
    if (emptyState) emptyState.classList.add('hidden');
    if (invalidState) invalidState.classList.add('hidden');

    if (kind === 'filters' && emptyState) {
      const title = qs('h2', emptyState);
      const body = qs('p', emptyState);
      const query = norm(state.filters.query);
      if (title) title.textContent = query ? 'No search results' : 'No countries match your filters';
      if (body) {
        body.textContent = query
          ? 'Try a different country name or clear the filters to broaden the results.'
          : 'Try clearing the search term or changing the continent, visa type, or featured filters.';
      }
      emptyState.classList.remove('hidden');
    }

    if (kind === 'invalid' && invalidState) {
      invalidState.classList.remove('hidden');
    }
  }

  function renderCountryList() {
    const grid = qs('[data-visa-grid]');
    const emptyState = qs('[data-visa-empty]');
    const invalidState = qs('[data-visa-invalid]');
    if (!grid) return;

    renderFeaturedCountries();
    const filtered = applyFilters(state.countries);
    state.filtered = filtered;
    updateResultMessage(filtered);

    if (!filtered.length) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.add('hidden');
      if (invalidState) invalidState.classList.add('hidden');
      renderAllCountryDetails([]);
      setEmptyState('filters');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (invalidState) invalidState.classList.add('hidden');
    grid.innerHTML = filtered.map(renderCountryCard).join('');
    renderAllCountryDetails(filtered);
    revealInjectedElements(grid);
  }

  function renderInvalidCountry() {
    const grid = qs('[data-visa-grid]');
    const featuredSection = qs('[data-visa-featured-section]');
    const emptyState = qs('[data-visa-empty]');
    const invalidState = qs('[data-visa-invalid]');
    state.activeCountry = null;
    showListMode();
    if (featuredSection) featuredSection.hidden = true;
    if (grid) grid.innerHTML = '';
    if (emptyState) emptyState.classList.add('hidden');
    if (invalidState) invalidState.classList.remove('hidden');
    renderAllCountryDetails([]);
    updateResultMessage([]);
    updateSeo(null, 'list');
  }

  function getChecklistCategories(country) {
    const source = Array.isArray(country.document_categories) && country.document_categories.length
      ? country.document_categories
      : state.documentCategories;

    if (source && source.length) {
      return source.map((category, index) => ({
        key: category.key || `category-${index + 1}`,
        label: category.label || `Category ${index + 1}`,
        items: Array.isArray(category.items) ? category.items : []
      })).filter((category) => category.items.length);
    }

    return Object.entries(DEFAULT_CHECKLISTS).map(([key, items]) => ({
      key,
      label: slugToTitle(key),
      items
    }));
  }

  function renderChecklistIntoScope(country, scope, options = {}) {
    const selector = qs('[data-visa-profession]', scope);
    const contentEl = qs('[data-visa-checklist-content]', scope);
    if (!selector || !contentEl) return;

    const categories = getChecklistCategories(country);
    if (!categories.length) {
      contentEl.innerHTML = `<p class="text-secondary">${escapeHtml(options.emptyMessage || 'Checklist details will appear here once a profession category is available.')}</p>`;
      return;
    }

    const currentValue = categories.some((category) => category.key === selector.value)
      ? selector.value
      : categories[0].key;

    selector.innerHTML = categories.map((category) => `
      <option value="${escapeHtml(category.key)}">${escapeHtml(category.label)}</option>
    `).join('');
    selector.value = currentValue;

    function renderCategory(key) {
      const active = categories.find((category) => category.key === key) || categories[0];
      contentEl.innerHTML = `
        <div class="visa-checklist-panel__inner">
          <ol class="visa-checklist-list">
            ${active.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ol>
        </div>
      `;
    }

    renderCategory(selector.value);

    selector.onchange = () => {
      renderCategory(selector.value);
    };
    selector.oninput = () => {
      renderCategory(selector.value);
    };
  }

  function renderChecklistSelector(country) {
    renderChecklistIntoScope(country, document);
  }

  function buildChecklistDownload(country) {
    const categories = getChecklistCategories(country);
    const lines = [
      `${country.country_name} Visa Checklist`,
      `Visa type: ${country.visa_type}`,
      `Processing time: ${formatWorkingDays(country.processing_days)}`,
      `Currency: ${country.currency_label}`,
      '',
      ...categories.flatMap((category) => [
        `${category.label}:`,
        ...category.items.map((item, index) => `${index + 1}. ${item}`),
        ''
      ]),
      'Prepared by Rover Consultancy Services'
    ];
    return lines.join('\n');
  }

  function downloadChecklist(country) {
    const blob = new Blob([buildChecklistDownload(country)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${country.country_id || 'visa'}-visa-checklist.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindChecklistDownload(country, scope = document) {
    qsa('[data-visa-download-hook]', scope).forEach((button) => {
      button.removeAttribute('aria-disabled');
      button.textContent = 'Download Checklist';
      button.onclick = () => downloadChecklist(country);
    });
  }

  function renderAllCountryDetailCard(country) {
    return `
      <details class="visa-country-detail" data-visa-country-detail-card="${escapeHtml(country.country_id)}">
        <summary class="visa-country-detail__summary">
          <div class="visa-country-detail__summary-main">
            <span class="visa-country-detail__flag" aria-hidden="true">${escapeHtml(country.flag_emoji)}</span>
            <div>
              <h3>${escapeHtml(country.country_name)}</h3>
              <p>${escapeHtml(country.continent)} • ${escapeHtml(country.visa_type)}</p>
            </div>
          </div>
          <div class="visa-country-detail__summary-meta">
            <span>${escapeHtml(formatWorkingDays(country.processing_days))}</span>
            <strong>${escapeHtml(country.starting_price)}</strong>
          </div>
        </summary>
        <div class="visa-country-detail__body">
          <div class="visa-country-detail__topline">
            ${renderStatusBadge(country.status)}
            ${renderVisaTypeBadge(country.visa_type)}
            ${country.featured ? '<span class="badge badge-gold-solid">Featured</span>' : ''}
          </div>
          <div class="visa-country-detail__info-grid">
            <div class="visa-country-detail__info-card">
              <span>Visa fee</span>
              <strong>${escapeHtml(country.visa_fee)}</strong>
            </div>
            <div class="visa-country-detail__info-card">
              <span>Currency</span>
              <strong>${escapeHtml(country.currency_label)}</strong>
            </div>
            <div class="visa-country-detail__info-card">
              <span>Processing</span>
              <strong>${escapeHtml(formatWorkingDays(country.processing_days))}</strong>
            </div>
            <div class="visa-country-detail__info-card">
              <span>Bank balance</span>
              <strong>${escapeHtml(country.bank_balance)}</strong>
            </div>
          </div>
          <div class="visa-country-detail__content-grid">
            <section class="visa-checklist-panel visa-country-detail__checklist" aria-labelledby="visaChecklist-${escapeHtml(country.country_id)}">
              <div class="visa-section-heading">
                <div>
                  <h3 id="visaChecklist-${escapeHtml(country.country_id)}">Required documents</h3>
                  <p>Switch profession to see the checklist for this destination.</p>
                </div>
                <button type="button" class="btn btn-outline btn-sm" data-visa-download-hook aria-disabled="true">Download Checklist</button>
              </div>
              <div class="form-group visa-checklist-profession">
                <label class="form-label">Profession selector</label>
                <select class="form-control" data-visa-profession></select>
              </div>
              <div class="visa-checklist-content" data-visa-checklist-content></div>
            </section>
            <div class="visa-country-detail__meta">
              <div class="visa-info-card">
                <h3>Photo specs</h3>
                <p>${escapeHtml(country.photo_specs)}</p>
              </div>
              <div class="visa-info-card">
                <h3>Special notes</h3>
                <p>${escapeHtml(country.special_notes)}</p>
              </div>
              <div class="visa-country-detail__actions">
                <a href="?country=${encodeURIComponent(country.country_id)}" class="btn btn-primary btn-sm">Open full detail</a>
                <a href="../contact-us/?service=visa&country=${encodeURIComponent(country.country_id)}" class="btn btn-outline btn-sm">Apply now</a>
              </div>
            </div>
          </div>
        </div>
      </details>
    `;
  }

  function renderAllCountryDetails(countries) {
    const section = qs('[data-visa-all-details-section]');
    const grid = qs('[data-visa-all-details-grid]');
    const count = qs('[data-visa-all-details-count]');
    if (!section || !grid) return;

    if (!countries.length) {
      section.hidden = true;
      grid.innerHTML = '';
      if (count) count.textContent = '0 countries';
      return;
    }

    section.hidden = false;
    if (count) count.textContent = `${countries.length} ${countries.length === 1 ? 'country' : 'countries'}`;
    grid.innerHTML = countries.map(renderAllCountryDetailCard).join('');

    qsa('[data-visa-country-detail-card]', grid).forEach((card) => {
      const countryId = card.getAttribute('data-visa-country-detail-card');
      const country = countries.find((item) => item.country_id === countryId);
      if (!country) return;
      renderChecklistIntoScope(country, card, {
        emptyMessage: 'Checklist details will appear here once a profession category is available.'
      });
      bindChecklistDownload(country, card);
    });
  }

  function renderRelatedCountries(country) {
    const relatedEl = qs('[data-visa-related]');
    if (!relatedEl) return;

    const related = state.countries
      .filter((item) => item.country_id !== country.country_id)
      .filter((item) => norm(item.status) === 'active')
      .filter((item) => item.continent === country.continent || item.visa_type === country.visa_type)
      .slice(0, 4);

    relatedEl.innerHTML = related.map((item) => `
      <a href="?country=${encodeURIComponent(item.country_id)}" class="visa-related-item">
        <span class="visa-related-item__flag" aria-hidden="true">${escapeHtml(item.flag_emoji)}</span>
        <span class="visa-related-item__copy">
          <strong>${escapeHtml(item.country_name)}</strong>
          <small>${escapeHtml(item.visa_type)}</small>
        </span>
      </a>
    `).join('') || '<p class="text-secondary">More related destinations will appear here as the catalog grows.</p>';
  }

  function renderDetail(country) {
    state.activeCountry = country;
    showDetailMode();

    const status = getStatusLabel(country.status);
    const imageEl = qs('[data-visa-detail-image]');
    const applyLink = qs('[data-visa-apply-link]');

    const setText = (selector, value) => {
      const el = qs(selector);
      if (el) el.textContent = value;
    };

    setText('[data-visa-detail-status]', status.label);
    setText('[data-visa-detail-country]', country.country_name);
    setText('[data-visa-detail-summary]', country.summary);
    setText('[data-visa-detail-starting-price]', country.starting_price);
    setText('[data-visa-detail-visa-fee]', country.visa_fee);
    setText('[data-visa-detail-service-charge]', country.service_charge);
    setText('[data-visa-detail-total-cost]', country.total_cost);
    setText('[data-visa-detail-currency]', country.currency_label);
    setText('[data-visa-detail-processing]', formatWorkingDays(country.processing_days));
    setText('[data-visa-detail-type]', country.visa_type);
    setText('[data-visa-detail-complexity]', country.processing_complexity);
    setText('[data-visa-detail-photo]', country.photo_specs);
    setText('[data-visa-detail-bank]', country.bank_balance);
    setText('[data-visa-detail-notes]', country.special_notes);
    setText('[data-visa-detail-flag]', country.flag_emoji);

    if (imageEl) {
      imageEl.src = country.image_url;
      imageEl.alt = `${country.country_name} destination`;
      imageEl.onerror = () => {
        imageEl.onerror = null;
        imageEl.src = '../images/hero/hero-bg.jpg';
      };
    }

    if (applyLink) {
      applyLink.href = `../contact-us/?service=visa&country=${encodeURIComponent(country.country_id)}`;
    }

    const whatsappLink = qs('[data-visa-whatsapp-link]');
    if (whatsappLink) {
      const link = buildWhatsappLink(country);
      whatsappLink.href = link;
      whatsappLink.target = '_blank';
      whatsappLink.rel = 'noopener';
    }

    const statusEl = qs('[data-visa-detail-status]');
    if (statusEl) {
      statusEl.className = `badge ${status.cls}`;
      statusEl.innerHTML = `<span class="badge-dot"></span>${escapeHtml(status.label)}`;
    }

    renderChecklistSelector(country);
    renderRelatedCountries(country);
    bindChecklistDownload(country);
    updateResultMessage([country]);
    updateSeo(country, 'detail');
  }

  function renderInitialMode() {
    const slug = norm(new URLSearchParams(window.location.search).get('country'));
    const selected = slug ? state.countries.find((country) => country.country_id === slug) : null;

    if (selected) {
      renderDetail(selected);
      return;
    }

    if (slug) {
      renderInvalidCountry();
      return;
    }

    state.activeCountry = null;
    showListMode();
    renderCountryList();
    updateSeo(null, 'list');
  }

  async function initVisaModule() {
    const grid = qs('[data-visa-grid]');
    if (!grid) return;

    try {
      const loadingEl = qs('[data-visa-loading]');
      if (loadingEl) loadingEl.hidden = false;

      const catalog = await loadVisaCatalog();
      state.catalog = catalog;
      state.documentCategories = catalog.document_categories || [];
      state.countries = (catalog.countries || []).map((country) => normalizeCountry(country, catalog));
      buildFilterOptions(state.countries);
      updateSummaryCounters(state.countries);
      bindFilterEvents();
      renderInitialMode();

      if (loadingEl) loadingEl.hidden = true;
    } catch (error) {
      console.error('[Rover Visa] Failed to initialize visa module:', error);
      const loadingEl = qs('[data-visa-loading]');
      const listView = qs('[data-visa-list-view]');
      if (loadingEl) loadingEl.hidden = true;
      if (listView) listView.hidden = false;
      const gridEl = qs('[data-visa-grid]');
      const emptyState = qs('[data-visa-empty]');
      if (gridEl) gridEl.innerHTML = '';
      if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = `
          <h2>Visa data is temporarily unavailable</h2>
          <p>Please try again later or contact us directly for assistance.</p>
          <a href="../contact-us/" class="btn btn-primary btn-sm">Contact Us</a>
        `;
      }
      updateSeo(null, 'list');
    }
  }

  document.addEventListener('DOMContentLoaded', initVisaModule);
})();
