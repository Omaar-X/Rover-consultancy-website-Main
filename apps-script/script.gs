/**
 * =============================================================================
 * ROVER CONSULTANCY SERVICES — Google Apps Script Backend
 * =============================================================================
 * Handles inquiry (contact) form submissions and newsletter signups from the
 * static website. Saves every submission to a Google Sheet, emails the office
 * a notification, and sends the customer an auto-reply with a reference number.
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
  NEWSLETTER_SHEET: 'Newsletter'
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
 * Frontend FormData pathay (action=submitInquiry | subscribeNewsletter).
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

/* ─── INQUIRY (CONTACT FORM) ───────────────────────────────────────────────── */

function handleInquiry(params) {
  var name = clean(params.name);
  var email = clean(params.email);
  var phone = clean(params.phone);
  var service = clean(params.service) || 'general';
  var country = clean(params.country);
  var message = clean(params.message);
  var page = clean(params.page);

  if (!name || !email) {
    return jsonResponse({ ok: false, error: 'Name and email are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'Invalid email address.' });
  }

  var ref = generateRef();
  var sheet = getSheet(CONFIG.INQUIRY_SHEET, [
    'Timestamp', 'Reference', 'Name', 'Email', 'Phone',
    'Service', 'Country', 'Message', 'Source Page'
  ]);

  sheet.appendRow([
    new Date(), ref, name, email, phone, service, country, message, page
  ]);

  // Office notification
  safeSendEmail(
    CONFIG.NOTIFY_EMAIL,
    '[' + ref + '] New website inquiry — ' + name + ' (' + service + ')',
    'New inquiry from the website:\n\n' +
    'Reference : ' + ref + '\n' +
    'Name      : ' + name + '\n' +
    'Email     : ' + email + '\n' +
    'Phone     : ' + (phone || '-') + '\n' +
    'Service   : ' + service + '\n' +
    'Country   : ' + (country || '-') + '\n' +
    'Page      : ' + (page || '-') + '\n\n' +
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

/* ─── NEWSLETTER ───────────────────────────────────────────────────────────── */

function handleNewsletter(params) {
  var email = clean(params.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'Invalid email address.' });
  }

  var sheet = getSheet(CONFIG.NEWSLETTER_SHEET, ['Timestamp', 'Email', 'Source Page']);

  // Duplicate check — same email dubara add hobe na.
  var emails = sheet.getRange(1, 2, sheet.getLastRow() || 1, 1).getValues();
  for (var i = 0; i < emails.length; i++) {
    if (String(emails[i][0]).toLowerCase() === email.toLowerCase()) {
      return jsonResponse({ ok: true, duplicate: true });
    }
  }

  sheet.appendRow([new Date(), email, clean(params.page)]);
  return jsonResponse({ ok: true });
}

/* ─── HELPERS ──────────────────────────────────────────────────────────────── */

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
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
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
