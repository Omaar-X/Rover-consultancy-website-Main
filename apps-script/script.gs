/**
 * =============================================================================
 * ROVER CONSULTANCY SERVICES — Google Apps Script Backend
 * =============================================================================
 * Handles inquiry (contact) form submissions and newsletter signups from
 * EVERY page on the static website (Home, Contact Us, Hotel Booking, Air
 * Tickets, Hajj, Umrah — anywhere a `data-form="inquiry"` form exists).
 * Saves every submission to a Google Sheet (color-coded by service so the
 * sheet is easy to scan at a glance), emails the office a notification, and
 * sends the customer an auto-reply with a reference number.
 *
 * ── DEPLOY KORAR NIYOM (one time) ────────────────────────────────────────────
 *  1. https://sheets.new — ekta notun Google Sheet banan (nam: "Rover Website Data").
 *  2. Sheet er URL theke SHEET_ID copy korun:
 *     https://docs.google.com/spreadsheets/d/<EI_ANSHO_TA_SHEET_ID>/edit
 *  3. Sheet er menu: Extensions → Apps Script → ei puro file paste korun.
 *  4. Niche CONFIG e SHEET_ID r NOTIFY_EMAIL bosan.
 *  5. Deploy → New deployment → type: "Web app"
 *       - Execute as: Me
 *       - Who has access: Anyone
 *     → Deploy → "Web app URL" ta copy korun.
 *  6. Website er js/config.js file e:  contactWebhookUrl: '<WEB_APP_URL>'  bosiye din.
 *
 *  Notun kore code change korle abar Deploy → Manage deployments → Edit →
 *  Version: New version → Deploy korte hobe (URL same thake).
 * =============================================================================
 */

var CONFIG = {
  // Google Sheet er ID (step 2 dekhen). Faka rakhle script-er attached sheet use hobe.
  SHEET_ID: '',

  // Notun inquiry ashlei ei email e notification jabe.
  NOTIFY_EMAIL: 'info@roverconsultancy.com',

  // Customer ke automatic reply email pathano hobe kina.
  SEND_AUTO_REPLY: true,

  // Email er "from" name.
  BRAND_NAME: 'Rover Consultancy Services',

  // Sheet tab names.
  INQUIRY_SHEET: 'Inquiries',
  NEWSLETTER_SHEET: 'Newsletter',

  // Header row styling (matches the site's brand navy).
  HEADER_BG: '#1B3A8C',
  HEADER_FONT_COLOR: '#FFFFFF',

  // Row background color per service category — this is what makes the
  // sheet "colorful": every inquiry lands in a tinted row based on which
  // service/page it came from, so staff can scan the sheet at a glance.
  CATEGORY_COLORS: {
    visa:    '#D6E9FF',
    tour:    '#DAF2DE',
    air:     '#EADDF7',
    hotel:   '#D3F3F5',
    hajj:    '#FCEFC7',
    umrah:   '#FBDCE7',
    general: '#E9EBEF'
  },

  // Friendly labels shown in the "Category" column.
  CATEGORY_LABELS: {
    visa:    'Visa Services',
    tour:    'Tour Packages',
    air:     'Air Tickets',
    hotel:   'Hotel Booking',
    hajj:    'Hajj',
    umrah:   'Umrah',
    general: 'General Inquiry'
  },

  // Soft zebra striping for the Newsletter sheet (no category there).
  NEWSLETTER_ROW_COLORS: ['#FFFFFF', '#E9F1FF']
};

// Which page a submission came from → friendly label + default category.
// Checked in order, so more specific paths (hotel-booking) must come before
// generic fallbacks (home "/").
var PAGE_MAP = [
  { test: /hotel-booking/i,        label: 'Hotel Booking', category: 'hotel' },
  { test: /air-tickets/i,          label: 'Air Tickets',   category: 'air' },
  { test: /tour-packages/i,        label: 'Tour Packages', category: 'tour' },
  { test: /hajj/i,                 label: 'Hajj',          category: 'hajj' },
  { test: /umrah/i,                label: 'Umrah',         category: 'umrah' },
  { test: /visa-services/i,        label: 'Visa Services', category: 'visa' },
  { test: /contact-us/i,           label: 'Contact Us',    category: null }, // category comes from the "service" field
  { test: /about-us/i,             label: 'About Us',      category: 'general' },
  { test: /blog/i,                 label: 'Blog',          category: 'general' },
  { test: /(^\/?$|index\.html)/i,  label: 'Home',           category: null } // category comes from the "service" field
];

// Fallback when a page's form doesn't set its own fixed category (Home /
// Contact Us offer a full service dropdown) — keyed by the form's "service" value.
var SERVICE_CATEGORY_MAP = {
  visa: 'visa',
  tour: 'tour',
  'air-ticket': 'air',
  hotel: 'hotel',
  hajj: 'hajj',
  umrah: 'umrah',
  general: 'general'
};

/* ─── ENTRY POINTS ─────────────────────────────────────────────────────────── */

/**
 * Health check — browser e Web App URL khulle ei message dekhabe.
 */
function doGet() {
  return jsonResponse({
    ok: true,
    service: 'Rover Consultancy website backend',
    time: new Date().toISOString()
  });
}

/**
 * Website theke POST asha request handle kore.
 * Frontend FormData pathay (action=submitInquiry | subscribeNewsletter),
 * je form-e submit hoyeche shei page-er path-o thake (params.page).
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // serialize writes so two submissions can't collide

  try {
    var params = (e && e.parameter) || {};
    var action = String(params.action || 'submitInquiry');

    if (action === 'subscribeNewsletter') {
      return handleNewsletter(params);
    }
    return handleInquiry(params);
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message || error) });
  } finally {
    lock.releaseLock();
  }
}

/* ─── INQUIRY (CONTACT FORM — used by every page's inquiry form) ───────────── */

function handleInquiry(params) {
  var name = clean(params.name);
  var email = clean(params.email);
  var phone = clean(params.phone);
  var service = clean(params.service) || 'general';
  var country = clean(params.country);
  var message = clean(params.message);
  var contactMethod = clean(params.source);   // "Preferred Contact Method" select on hotel/air/contact forms
  var page = clean(params.page);

  if (!name || !email) {
    return jsonResponse({ ok: false, error: 'Name and email are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'Invalid email address.' });
  }

  var pageInfo = resolvePageInfo(page, service);
  var ref = generateRef();
  var sheet = getSheet(CONFIG.INQUIRY_SHEET, [
    'Timestamp', 'Reference', 'Name', 'Email', 'Phone',
    'Service', 'Category', 'Country', 'Preferred Contact', 'Message', 'Page'
  ]);

  sheet.appendRow([
    new Date(), ref, name, email, phone, service,
    CONFIG.CATEGORY_LABELS[pageInfo.category] || pageInfo.category,
    country, contactMethod, message, pageInfo.label
  ]);

  colorizeRow(sheet, sheet.getLastRow(), 11, CONFIG.CATEGORY_COLORS[pageInfo.category] || CONFIG.CATEGORY_COLORS.general);

  // Office notification
  safeSendEmail(
    CONFIG.NOTIFY_EMAIL,
    '[' + ref + '] New website inquiry — ' + name + ' (' + (CONFIG.CATEGORY_LABELS[pageInfo.category] || service) + ')',
    'New inquiry from the website:\n\n' +
    'Reference : ' + ref + '\n' +
    'Name      : ' + name + '\n' +
    'Email     : ' + email + '\n' +
    'Phone     : ' + (phone || '-') + '\n' +
    'Service   : ' + service + '\n' +
    'Category  : ' + (CONFIG.CATEGORY_LABELS[pageInfo.category] || pageInfo.category) + '\n' +
    'Country   : ' + (country || '-') + '\n' +
    'Contact   : ' + (contactMethod || '-') + '\n' +
    'Page      : ' + pageInfo.label + '\n\n' +
    'Message:\n' + (message || '-') + '\n'
  );

  // Customer auto-reply
  if (CONFIG.SEND_AUTO_REPLY) {
    safeSendEmail(
      email,
      'We received your inquiry — ' + ref,
      'Dear ' + name + ',\n\n' +
      'Thank you for contacting ' + CONFIG.BRAND_NAME + '.\n' +
      'Your inquiry has been received and our team will get back to you within 24 hours.\n\n' +
      'Your reference number: ' + ref + '\n\n' +
      'Warm regards,\n' +
      CONFIG.BRAND_NAME + '\n' +
      'Phone/WhatsApp: 01726-763326\n' +
      'Email: info@roverconsultancy.com'
    );
  }

  return jsonResponse({ ok: true, ref: ref });
}

/* ─── NEWSLETTER (footer form — present on every page) ─────────────────────── */

function handleNewsletter(params) {
  var email = clean(params.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'Invalid email address.' });
  }

  var page = clean(params.page);
  var pageInfo = resolvePageInfo(page, '');
  var sheet = getSheet(CONFIG.NEWSLETTER_SHEET, ['Timestamp', 'Email', 'Page']);

  // Duplicate check — same email dubara add hobe na.
  var emails = sheet.getRange(1, 2, sheet.getLastRow() || 1, 1).getValues();
  for (var i = 0; i < emails.length; i++) {
    if (String(emails[i][0]).toLowerCase() === email.toLowerCase()) {
      return jsonResponse({ ok: true, duplicate: true });
    }
  }

  sheet.appendRow([new Date(), email, pageInfo.label]);

  var rowIndex = sheet.getLastRow();
  var stripeColor = CONFIG.NEWSLETTER_ROW_COLORS[rowIndex % CONFIG.NEWSLETTER_ROW_COLORS.length];
  colorizeRow(sheet, rowIndex, 3, stripeColor);

  return jsonResponse({ ok: true });
}

/* ─── HELPERS ──────────────────────────────────────────────────────────────── */

// Figures out which page an inquiry came from (friendly label) and which
// service category it belongs to (for row coloring). Pages with a fixed
// single-service form (Hotel Booking, Air Tickets, Hajj, Umrah, Visa
// Services) get their category from the page itself; pages with a full
// service dropdown (Home, Contact Us) get it from the submitted "service" field.
function resolvePageInfo(pagePath, service) {
  var path = String(pagePath || '').toLowerCase();
  var match = null;

  for (var i = 0; i < PAGE_MAP.length; i++) {
    if (PAGE_MAP[i].test.test(path)) {
      match = PAGE_MAP[i];
      break;
    }
  }

  var label = match ? match.label : (pagePath || 'Website');
  var category = (match && match.category)
    || SERVICE_CATEGORY_MAP[String(service || '').toLowerCase()]
    || 'general';

  return { label: label, category: category };
}

function getSpreadsheet() {
  if (CONFIG.SHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SHEET_ID);
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('SHEET_ID is empty and the script is not attached to a spreadsheet.');
  }
  return active;
}

function getSheet(name, headers) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground(CONFIG.HEADER_BG)
      .setFontColor(CONFIG.HEADER_FONT_COLOR)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 32);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

// Paints an entire row (columns 1..lastCol) a solid background color and
// gives it a thin border — this is what keeps the sheet visually color-coded
// as new inquiries/newsletter signups come in.
function colorizeRow(sheet, rowIndex, lastCol, color) {
  var range = sheet.getRange(rowIndex, 1, 1, lastCol);
  range.setBackground(color).setBorder(true, true, true, true, false, false, '#C7CCD6', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(rowIndex, 2).setFontWeight('bold'); // Reference / Email column stands out
}

function generateRef() {
  var year = new Date().getFullYear();
  var num = Math.floor(Math.random() * 90000) + 10000;
  return 'RCS-' + year + '-' + num;
}

function clean(value) {
  return String(value == null ? '' : value).trim().slice(0, 2000);
}

function safeSendEmail(to, subject, body) {
  try {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      name: CONFIG.BRAND_NAME
    });
  } catch (error) {
    // Email quota sesh hoye gele o form submission fail hobe na.
    Logger.log('Email failed: ' + error);
  }
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
