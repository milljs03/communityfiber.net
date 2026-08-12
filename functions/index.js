const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { initializeApp } = require('firebase-admin/app');
const crypto = require('crypto');
const emailRouting = require('./email-routing.json');

initializeApp();

const db = getFirestore();
const SMTP2GO_API_KEY = defineSecret('SMTP2GO_API_KEY');
const DATA_ROOT = 'artifacts/162296779236/public/data';
const RATE_LIMIT_ROOT = 'serverControls/rateLimits/entries';
const DUPLICATE_ROOT = 'serverControls/leadDuplicates/entries';
const SPAM_ROOT = 'serverControls/spamSubmissions/entries';
const EMAIL_THROTTLE_ROOT = 'serverControls/emailThrottles/entries';
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_FORM_AGE_MS = 2500;
const MAX_FORM_AGE_MS = 4 * 60 * 60 * 1000;
const SPAM_QUARANTINE_SCORE = 4;
const SPAM_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const SPAM_BUCKET_WINDOW_MS = 60 * 60 * 1000;
const CUSTOMER_CONFIRMATION_RECIPIENT_LIMIT = 3;
const CUSTOMER_CONFIRMATION_RECIPIENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';
const REQUIRE_APP_CHECK = !IS_TEST && (!IS_EMULATOR || process.env.REQUIRE_APP_CHECK === 'true');
const SMTP2GO_API_URL = 'https://api.smtp2go.com/v3/email/send';

const LEAD_TYPES = new Set(['support_ticket', 'business_quote', 'builder_inquiry']);
// Keep in sync with the topic <select> on support.html and the topic routes in
// email-routing.json. A value missing here is silently rewritten to 'general'
// by cleanEnum, which would route mobile enquiries to the wrong inbox.
const SUPPORT_TOPICS = new Set(['billing', 'availability', 'outage', 'service', 'mobile', 'general', 'other']);
const PROJECT_TYPES = new Set(['subdivision', 'mdu', 'mixed', 'commercial', 'other']);
const STATUS_NEW = 'new';

function setJsonHeaders(res) {
  res.set('Access-Control-Allow-Origin', 'https://communityfiber.net');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-CFN-Session, X-Firebase-AppCheck');
  res.set('Vary', 'Origin');
}

function sendError(res, status, code, message) {
  res.status(status).json({ ok: false, code, message });
}

function parseBody(req) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new Error('Request body must be a JSON object.');
  }
  return req.body;
}

function normalizeIp(value) {
  const raw = String(value || '').replace(/^::ffff:/, '');
  const ipLikePrefix = raw.match(/^[a-fA-F0-9:.,\s-]+/);
  return String(ipLikePrefix ? ipLikePrefix[0] : '')
    .trim()
    .slice(0, 120);
}

function getClientIp(req) {
  const platformIp = normalizeIp(req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress);
  if (platformIp) return platformIp;

  // Fallback only. Do not prefer caller-controllable forwarding headers over
  // the platform-populated remote address.
  const forwarded = normalizeIp(String(req.get('x-forwarded-for') || '').split(',').pop());
  return forwarded || 'unknown';
}

function getSessionKey(req, body) {
  const headerValue = req.get('x-cfn-session');
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : headerValue;
  return String(sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function mergeLimitedList(...lists) {
  const merged = [];
  for (const list of lists) {
    for (const item of Array.isArray(list) ? list : []) {
      const value = String(item || '').trim();
      if (value && !merged.includes(value)) {
        merged.push(value);
      }
      if (merged.length >= 50) {
        return merged;
      }
    }
  }
  return merged;
}

function cleanText(value, maxLength, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new Error('Missing required field.');
    return '';
  }

  if (typeof value !== 'string') {
    throw new Error('Invalid string field.');
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (required && !normalized) {
    throw new Error('Missing required field.');
  }
  if (normalized.length > maxLength) {
    throw new Error('Field is too long.');
  }
  return normalized;
}

function safeCleanText(value, maxLength) {
  try {
    return cleanText(String(value ?? ''), maxLength);
  } catch (error) {
    return '';
  }
}

function cleanEnum(value, allowed, fallback) {
  const normalized = cleanText(value, 80).toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function cleanEmail(value) {
  const email = normalizeEmail(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email address.');
  }
  return email;
}

function normalizeEmail(value) {
  return cleanText(value, 254, { required: true }).toLowerCase();
}

function cleanPhone(value) {
  const phone = normalizePhone(value);
  if (!/^\d{7,15}$/.test(phone)) {
    throw new Error('Invalid phone number.');
  }
  return phone;
}

function normalizePhone(value) {
  const raw = cleanText(value, 60, { required: true });
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeEmailList(value) {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item) || /^.+ <[^\s@]+@[^\s@]+\.[^\s@]+>$/.test(item));
}

function getTrapFieldValues(body) {
  return [
    ['website_check', body.website_check],
    ['websiteCheck', body.websiteCheck],
    ['company_url', body.company_url],
    ['companyUrl', body.companyUrl],
    ['referral_source', body.referral_source],
    ['referralSource', body.referralSource]
  ].map(([name, value]) => ({ name, value: safeCleanText(value, 200) }));
}

function isBotSubmission(body) {
  return getTrapFieldValues(body).some((field) => Boolean(field.value));
}

function getRequestHeader(req, name) {
  if (!req?.get) return '';
  return safeCleanText(req.get(name) || '', 600);
}

// Hosts this site is legitimately served from. An origin missing from this
// list scores +4 on the spam assessment, which on its own is enough to
// quarantine a submission — so the Firebase preview hosts have to be here or
// every real browser submission from them is silently discarded.
const ALLOWED_SITE_HOSTS = [
  'communityfiber.net',
  'www.communityfiber.net',
  'communityfiber-net.web.app',
  'communityfiber-net.firebaseapp.com',
  'localhost',
  '127.0.0.1'
];

function isAllowedSiteUrl(value) {
  if (!value) return true;

  try {
    const parsed = new URL(value);
    return ALLOWED_SITE_HOSTS.includes(parsed.hostname);
  } catch (error) {
    return false;
  }
}

function countUrlLikeTokens(value) {
  const text = String(value || '');
  const matches = text.match(/https?:\/\/|www\.|(?:^|[\s<(["'])(?:[a-z0-9-]+\.)+(?:com|net|org|info|xyz|ru|cn|top|click|shop|online|site)\b/gi);
  return matches ? matches.length : 0;
}

function buildSpamAssessment(body, req) {
  const reasons = [];
  let score = 0;

  const filledTraps = getTrapFieldValues(body).filter((field) => field.value);
  if (filledTraps.length > 0) {
    score += 5;
    reasons.push('honeypot_filled');
  }

  const startedRaw = body.form_started_at || body.formStartedAt;
  const startedAt = Number(startedRaw || 0);
  if (!startedRaw) {
    score += 1;
    reasons.push('missing_form_started_at');
  } else if (!Number.isFinite(startedAt) || startedAt <= 0) {
    score += 2;
    reasons.push('invalid_form_started_at');
  } else {
    const formAgeMs = Date.now() - startedAt;
    if (formAgeMs < 0) {
      score += 2;
      reasons.push('future_form_started_at');
    } else if (formAgeMs < MIN_FORM_AGE_MS) {
      score += 3;
      reasons.push('submitted_too_fast');
    } else if (formAgeMs > MAX_FORM_AGE_MS) {
      score += 1;
      reasons.push('stale_form_started_at');
    }
  }

  const interactionCount = Number(body.form_interaction_count || body.formInteractionCount || 0);
  if (!Number.isFinite(interactionCount) || interactionCount < 1) {
    score += 1;
    reasons.push('no_recorded_interaction');
  }

  const combinedText = [
    body.name,
    body.businessName,
    body.company,
    body.contactName,
    body.email,
    body.phone,
    body.address,
    body.accountNumber,
    body.issueType,
    body.requirements,
    body.details,
    body.message
  ].map((value) => String(value || '')).join(' ');

  const urlCount = countUrlLikeTokens(combinedText);
  if (urlCount >= 3) {
    score += 3;
    reasons.push('excessive_links');
  } else if (urlCount > 0) {
    score += 1;
    reasons.push('contains_link');
  }

  if (/<\/?[a-z][\s\S]*>/i.test(combinedText)) {
    score += 2;
    reasons.push('html_markup');
  }

  if (/(.)\1{9,}/.test(combinedText)) {
    score += 1;
    reasons.push('repeated_characters');
  }

  const origin = getRequestHeader(req, 'origin');
  if (origin && !isAllowedSiteUrl(origin)) {
    score += 4;
    reasons.push('bad_origin');
  }

  const referer = getRequestHeader(req, 'referer');
  if (referer && !isAllowedSiteUrl(referer)) {
    score += 3;
    reasons.push('bad_referer');
  }

  const userAgent = getRequestHeader(req, 'user-agent');
  if (!userAgent) {
    score += 2;
    reasons.push('missing_user_agent');
  } else if (/\b(curl|wget|python-requests|httpclient|scrapy|spider|crawler)\b/i.test(userAgent)) {
    score += 2;
    reasons.push('automation_user_agent');
  }

  return {
    score,
    reasons,
    action: score >= SPAM_QUARANTINE_SCORE ? 'quarantine' : 'allow'
  };
}

async function recordSpamSubmission(body, req, assessment) {
  const ip = getClientIp(req);
  const sessionKey = getSessionKey(req, body);
  const now = Date.now();
  const filledTrapNames = getTrapFieldValues(body)
    .filter((field) => field.value)
    .map((field) => field.name);
  const payloadSummary = JSON.stringify(body || {}).slice(0, 4000);
  const payloadHash = hashValue(payloadSummary).slice(0, 32);
  const reasons = Array.isArray(assessment.reasons) ? assessment.reasons.slice(0, 20) : [];
  const id = buildSpamBucketId({ ip, assessment, now });
  const ref = db.doc(`${SPAM_ROOT}/${id}`);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.exists ? snap.data() : null;
    const count = Number(current?.count || 0) + 1;
    const sessionHashes = sessionKey ? [hashValue(sessionKey).slice(0, 32)] : [];

    transaction.set(ref, {
      type: safeCleanText(body.type || 'unknown', 80) || 'unknown',
      score: Math.max(Number(current?.score || 0), Number(assessment.score || 0)),
      reasons: mergeLimitedList(current?.reasons, reasons).slice(0, 20),
      filledTrapNames: mergeLimitedList(current?.filledTrapNames, filledTrapNames).slice(0, 20),
      ipHash: hashValue(ip).slice(0, 32),
      sessionHashes: mergeLimitedList(current?.sessionHashes, sessionHashes).slice(0, 20),
      payloadHashes: mergeLimitedList(current?.payloadHashes, [payloadHash]).slice(0, 20),
      fieldNames: mergeLimitedList(current?.fieldNames, Object.keys(body || {})),
      origin: getRequestHeader(req, 'origin'),
      referer: getRequestHeader(req, 'referer'),
      userAgent: getRequestHeader(req, 'user-agent'),
      count,
      firstSeenAtMs: Number(current?.firstSeenAtMs || 0) || now,
      lastSeenAtMs: now,
      expiresAt: new Date(now + SPAM_RETENTION_MS),
      createdAt: current?.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
}

function buildSpamBucketId({ ip, assessment, now = Date.now() }) {
  const reasons = Array.isArray(assessment?.reasons) ? assessment.reasons : [];
  const primaryReason = reasons[0] || assessment?.action || 'spam';
  const bucket = Math.floor(now / SPAM_BUCKET_WINDOW_MS);
  return `spam_${hashValue(`${ip || 'unknown'}|${primaryReason}|${bucket}`)}`.slice(0, 180);
}

async function enforceRateLimit({ key, bucket, limit, windowMs }) {
  const now = Date.now();
  const keyHash = hashValue(key);
  const id = `${bucket}_${keyHash}`.slice(0, 180);
  const ref = db.doc(`${RATE_LIMIT_ROOT}/${id}`);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.exists ? snap.data() : null;
    const startedAt = Number(current?.startedAt || 0);
    const count = Number(current?.count || 0);
    const inWindow = startedAt && now - startedAt < windowMs;
    const nextCount = inWindow ? count + 1 : 1;

    if (nextCount > limit) {
      throw new Error('rate_limited');
    }

    transaction.set(ref, {
      bucket,
      keyHash,
      startedAt: inWindow ? startedAt : now,
      count: nextCount,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
}

function buildRecipientThrottleId(email) {
  return `customer_confirmation_${hashValue(normalizeEmail(email))}`.slice(0, 180);
}

async function enforceCustomerConfirmationThrottle(email) {
  const normalized = normalizeEmail(email);
  const now = Date.now();
  const id = buildRecipientThrottleId(normalized);
  const ref = db.doc(`${EMAIL_THROTTLE_ROOT}/${id}`);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.exists ? snap.data() : null;
    const startedAt = Number(current?.startedAt || 0);
    const count = Number(current?.count || 0);
    const inWindow = startedAt && now - startedAt < CUSTOMER_CONFIRMATION_RECIPIENT_WINDOW_MS;
    const nextCount = inWindow ? count + 1 : 1;

    if (nextCount > CUSTOMER_CONFIRMATION_RECIPIENT_LIMIT) {
      throw new Error('recipient_rate_limited');
    }

    transaction.set(ref, {
      bucket: 'customer_confirmation_recipient',
      recipientHash: hashValue(normalized),
      startedAt: inWindow ? startedAt : now,
      count: nextCount,
      expiresAt: new Date(now + CUSTOMER_CONFIRMATION_RECIPIENT_WINDOW_MS),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
}

function canonicalFingerprintPart(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildLeadFingerprint(lead) {
  const parts = [
    lead.type,
    lead.email,
    lead.phone,
    lead.name,
    lead.businessName,
    lead.company,
    lead.contactName,
    lead.address,
    lead.message,
    lead.requirements,
    lead.details
  ];
  return hashValue(parts.map(canonicalFingerprintPart).join('|'));
}

async function enforceLeadDuplicateSuppression(fingerprint) {
  const now = Date.now();
  const id = fingerprint.slice(0, 180);
  const ref = db.doc(`${DUPLICATE_ROOT}/${id}`);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.exists ? snap.data() : null;
    const firstSeenAtMs = Number(current?.firstSeenAtMs || 0);
    const isDuplicate = firstSeenAtMs && now - firstSeenAtMs < DUPLICATE_WINDOW_MS;

    if (isDuplicate) {
      throw new Error('duplicate_submission');
    }

    transaction.set(ref, {
      fingerprint,
      firstSeenAtMs: now,
      expiresAtMs: now + DUPLICATE_WINDOW_MS,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
}

function buildLead(body) {
  const type = cleanEnum(body.type, LEAD_TYPES, '');
  if (!type) {
    throw new Error('Invalid lead type.');
  }

  if (type === 'support_ticket') {
    const lead = {
      type,
      topic: cleanEnum(body.topic, SUPPORT_TOPICS, 'general'),
      name: cleanText(body.name, 120, { required: true }),
      email: cleanEmail(body.email),
      phone: cleanPhone(body.phone),
      message: cleanText(body.message, 2000, { required: true }),
      submittedAt: FieldValue.serverTimestamp(),
      status: STATUS_NEW,
      source: 'support'
    };

    if (body.accountNumber) lead.accountNumber = cleanText(body.accountNumber, 80);
    if (body.address) lead.address = cleanText(body.address, 220);
    if (body.issueType) lead.issueType = cleanText(body.issueType, 120);
    return lead;
  }

  if (type === 'business_quote') {
    return {
      type,
      businessName: cleanText(body.businessName, 160, { required: true }),
      contactName: cleanText(body.contactName, 120, { required: true }),
      phone: cleanPhone(body.phone),
      email: cleanEmail(body.email),
      address: cleanText(body.address, 220, { required: true }),
      requirements: cleanText(body.requirements, 2000),
      submittedAt: FieldValue.serverTimestamp(),
      status: STATUS_NEW,
      source: 'business'
    };
  }

  return {
    type,
    company: cleanText(body.company, 160, { required: true }),
    contactName: cleanText(body.contactName, 120, { required: true }),
    phone: cleanPhone(body.phone),
    email: cleanEmail(body.email),
    projectType: cleanEnum(body.projectType, PROJECT_TYPES, 'other'),
    details: cleanText(body.details, 2000),
    submittedAt: FieldValue.serverTimestamp(),
    status: STATUS_NEW,
    source: 'builders'
  };
}

function buildPageView(body, req) {
  return {
    page: cleanText(body.page, 120, { required: true }).replace(/[^\w.\-/]/g, '').slice(0, 120),
    timestamp: FieldValue.serverTimestamp(),
    sessionId: cleanText(body.sessionId, 80, { required: true }),
    referrer: cleanText(body.referrer || 'direct', 500),
    deviceType: cleanEnum(body.deviceType, new Set(['desktop', 'mobile', 'tablet']), 'desktop'),
    screen: cleanText(body.screen, 40),
    language: cleanText(body.language || 'en-US', 40),
    userAgent: cleanText(req.get('user-agent') || body.userAgent || '', 500),
    source: 'traffic-logger'
  };
}

function getLeadDisplayRows(lead) {
  const labels = {
    type: 'Type',
    topic: 'Topic',
    name: 'Name',
    businessName: 'Business Name',
    company: 'Company',
    contactName: 'Contact Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    accountNumber: 'Account Number',
    issueType: 'Issue Type',
    projectType: 'Project Type',
    requirements: 'Requirements',
    details: 'Project Details',
    message: 'Message',
    source: 'Source',
    status: 'Status'
  };

  return Object.keys(labels)
    .filter((key) => lead[key])
    .map((key) => [labels[key], String(lead[key])]);
}

function buildLeadEmail(route, lead, leadId) {
  const rows = getLeadDisplayRows(lead);
  const subjectName = lead.businessName || lead.company || lead.contactName || lead.name || 'Website form';
  const subject = `${route.subjectPrefix || 'New Website Lead'}: ${subjectName}`.slice(0, 180);
  const text = [
    `${route.label || 'Website form'} submitted on communityfiber.net`,
    `Lead ID: ${leadId}`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`)
  ].join('\n');
  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <th style="text-align:left;padding:8px 12px;border-bottom:1px solid #e5e7eb;background:#f8fafc;width:180px;">${escapeHtml(label)}</th>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(value)}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;">
      <h2 style="margin:0 0 12px;">${escapeHtml(route.label || 'Website form')}</h2>
      <p style="margin:0 0 18px;color:#4b5563;">A new form submission was received from communityfiber.net.</p>
      <table style="border-collapse:collapse;width:100%;max-width:720px;border:1px solid #e5e7eb;">
        <tbody>${htmlRows}</tbody>
      </table>
      <p style="margin-top:18px;color:#6b7280;font-size:12px;">Lead ID: ${escapeHtml(leadId)}</p>
    </div>
  `;

  return { subject, text, html };
}

function buildEmailError(status, bodyText) {
  let providerMessage = String(bodyText || '').slice(0, 500);
  try {
    const parsed = JSON.parse(bodyText);
    // SMTP2GO reports problems as data.error / data.error_code, and per-address
    // problems inside data.failures.
    const detail = parsed.data || parsed;
    providerMessage = cleanText(
      detail.error || detail.error_code || parsed.message || providerMessage,
      300
    );
  } catch (error) {
    providerMessage = providerMessage.replace(/\s+/g, ' ').trim().slice(0, 300);
  }

  let reason = 'smtp2go_request_failed';
  if (/sender|not verified|unverified|domain/i.test(providerMessage)) {
    reason = 'smtp2go_sender_not_verified';
  } else if (status === 401 || status === 403) {
    reason = 'smtp2go_auth_or_permission_failed';
  } else if (status === 429) {
    reason = 'smtp2go_rate_limited';
  }

  const error = new Error(`SMTP2GO failed with ${status}: ${providerMessage}`);
  error.provider = 'smtp2go';
  error.providerStatus = status;
  error.reason = reason;
  error.safeMessage = providerMessage;
  return error;
}

function buildEmailFailureRecord(error) {
  return {
    status: 'failed',
    provider: error.provider || 'smtp2go',
    reason: error.reason || 'email_send_failed',
    providerStatus: error.providerStatus || null,
    message: cleanText(error.safeMessage || error.message || 'Email delivery failed.', 300),
    updatedAt: FieldValue.serverTimestamp()
  };
}

/**
 * Acknowledgement sent to whoever submitted the form.
 *
 * Deliberately a separate message rather than CC-ing them on the internal
 * notification: the internal copy is addressed to staff, carries a Lead ID,
 * and is worded for triage. Reply-to points at the team that owns the topic,
 * so a customer replying to the receipt reaches the right group.
 */
function buildCustomerConfirmationEmail(route, lead) {
  const conf = emailRouting.confirmation || {};
  const label = (route.label || 'request').toLowerCase();
  const greetingName = lead.contactName || lead.name || '';
  const hello = greetingName ? `Hi ${greetingName},` : 'Hi,';
  const subject = cleanText(
    (conf.subjectPrefix || 'We received your request') + (route.label ? ` — ${route.label}` : ''),
    180
  );
  const nextSteps = conf.nextSteps
    || 'A member of our team will review it and get back to you shortly during business hours.';
  const phone = conf.phone || '';
  // Drop internal/raw fields — the subject already states the request type,
  // and "Topic: outage" reads like a database value to a customer.
  const internalOnly = new Set(['Type', 'Topic', 'Status', 'Source']);
  const rows = getLeadDisplayRows(lead).filter(([label]) => !internalOnly.has(label));

  const text = [
    hello,
    '',
    `Thanks for contacting Community Fiber. We've received your ${label} and it's on its way to the right team.`,
    '',
    nextSteps,
    phone ? `\nIf it's urgent, call us at ${phone}.` : '',
    '',
    'For your records, here is what you sent:',
    ...rows.map(([k, v]) => `  ${k}: ${v}`),
    '',
    '— Community Fiber'
  ].filter((line) => line !== null).join('\n');

  const htmlRows = rows.map(([k, v]) => `
    <tr>
      <th style="text-align:left;padding:6px 12px;border-bottom:1px solid #e5e7eb;background:#f8fafc;width:170px;font-weight:600;">${escapeHtml(k)}</th>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(v)}</td>
    </tr>`).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;max-width:640px;">
      <p style="margin:0 0 14px;">${escapeHtml(hello)}</p>
      <p style="margin:0 0 14px;">Thanks for contacting Community Fiber. We&rsquo;ve received your ${escapeHtml(label)} and it&rsquo;s on its way to the right team.</p>
      <p style="margin:0 0 14px;">${escapeHtml(nextSteps)}</p>
      ${phone ? `<p style="margin:0 0 18px;">If it&rsquo;s urgent, call us at <a href="tel:${escapeHtml(phone.replace(/[^0-9+]/g, ''))}" style="color:#0A7A31;font-weight:600;">${escapeHtml(phone)}</a>.</p>` : ''}
      <p style="margin:0 0 8px;color:#4b5563;font-size:14px;">For your records, here is what you sent:</p>
      <table style="border-collapse:collapse;width:100%;border:1px solid #e5e7eb;font-size:14px;">
        <tbody>${htmlRows}</tbody>
      </table>
      <p style="margin-top:18px;color:#6b7280;font-size:12px;">Community Fiber &middot; New Paris, Indiana</p>
    </div>`;

  return { subject, text, html };
}

/**
 * Send one message through SMTP2GO.
 *
 * Takes the provider-neutral shape the callers build ({ from, to, cc, bcc,
 * subject, text, html, replyTo }) and adapts it to SMTP2GO's field names.
 *
 * Note the success check: SMTP2GO answers 200 even when it accepted the
 * request but delivered to nobody, so a transport-level OK is not enough —
 * data.succeeded has to be at least one, or the send silently disappears.
 */
async function sendEmail(apiKey, message) {
  const payload = {
    sender: message.from,
    to: message.to,
    subject: message.subject,
    text_body: message.text,
    html_body: message.html
  };
  if (message.cc?.length) payload.cc = message.cc;
  if (message.bcc?.length) payload.bcc = message.bcc;
  if (message.replyTo) {
    payload.custom_headers = [{ header: 'Reply-To', value: message.replyTo }];
  }

  const context = {
    kind: message.kind || 'email',
    leadId: message.leadId || null,
    sender: message.from,
    recipientCount: message.to.length,
    // Recipient domains only. The full addresses live on the lead document;
    // logs are retained and read far more widely than Firestore is.
    recipientDomains: [...new Set(message.to.map((a) => a.split('@').pop()?.replace(/>$/, '')))]
  };

  let response;
  let resultText = '';
  try {
    response = await fetch(SMTP2GO_API_URL, {
      method: 'POST',
      headers: {
        'X-Smtp2go-Api-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
    resultText = await response.text();
  } catch (networkError) {
    // Could not reach SMTP2GO at all — DNS, TLS, timeout, egress blocked.
    logger.error('SMTP2GO request did not complete', {
      ...context,
      error: String(networkError?.message || networkError)
    });
    const err = new Error(`SMTP2GO unreachable: ${networkError?.message || networkError}`);
    err.provider = 'smtp2go';
    err.reason = 'smtp2go_unreachable';
    err.safeMessage = 'Could not reach the email provider.';
    throw err;
  }

  if (!response.ok) {
    // The raw body is the only place the real cause appears; keep it whole in
    // the log even though the copy stored on the lead is truncated.
    logger.error('SMTP2GO rejected the send', {
      ...context,
      httpStatus: response.status,
      responseBody: resultText.slice(0, 2000)
    });
    throw buildEmailError(response.status, resultText);
  }

  let result = {};
  try {
    result = JSON.parse(resultText);
  } catch (error) {
    logger.error('SMTP2GO returned a non-JSON body', { ...context, responseBody: resultText.slice(0, 2000) });
    result = {};
  }

  const data = result.data || {};
  if (Number(data.succeeded || 0) < 1) {
    // A 200 with nothing delivered. Without this branch the send would be
    // recorded as successful and the message would vanish silently.
    logger.error('SMTP2GO accepted the request but delivered to nobody', {
      ...context,
      httpStatus: response.status,
      succeeded: data.succeeded ?? 0,
      failed: data.failed ?? null,
      failures: data.failures || null,
      responseBody: resultText.slice(0, 2000)
    });
    throw buildEmailError(response.status, JSON.stringify(data.failures || data));
  }

  logger.info('Email sent', {
    ...context,
    emailId: data.email_id || result.request_id || '',
    succeeded: data.succeeded
  });
  return { id: data.email_id || result.request_id || '' };
}

/**
 * Send the submitter their acknowledgement. Never throws: a failed receipt
 * must not mask a successfully captured lead or a delivered staff notification.
 */
async function sendCustomerConfirmation(apiKey, route, lead, teamRecipients, leadId) {
  if (emailRouting.confirmation?.enabled === false) {
    return { status: 'skipped', reason: 'disabled' };
  }
  const to = normalizeEmailList(lead.email);
  if (to.length === 0) return { status: 'skipped', reason: 'no_customer_email' };

  const email = buildCustomerConfirmationEmail(route, lead);
  const message = {
    from: emailRouting.confirmation?.from || emailRouting.from,
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    // replying to the receipt should reach the team that owns the topic
    replyTo: teamRecipients.length ? teamRecipients[0] : undefined,
    kind: 'customer_confirmation',
    leadId
  };

  try {
    await enforceCustomerConfirmationThrottle(to[0]);
    const result = await sendEmail(apiKey, message);
    return { status: 'sent', provider: 'smtp2go', id: result.id || '' };
  } catch (error) {
    if (error.message === 'recipient_rate_limited') {
      logger.warn('Customer confirmation skipped due to recipient throttle', {
        leadId: leadId || null,
        route: route.label || null,
        recipientHash: hashValue(to[0]).slice(0, 32)
      });
      return { status: 'skipped', reason: 'recipient_rate_limited' };
    }

    logger.error('Customer confirmation failed (staff notification was unaffected)', {
      leadId: leadId || null,
      route: route.label || null,
      reason: error.reason || 'confirmation_send_failed',
      providerStatus: error.providerStatus || null,
      message: error.safeMessage || error.message || String(error)
    });
    return {
      status: 'failed',
      provider: 'smtp2go',
      reason: error.reason || 'confirmation_send_failed',
      message: cleanText(error.safeMessage || error.message || 'Confirmation delivery failed.', 300)
    };
  }
}

async function sendLeadNotification(lead, leadId) {
  // For support tickets, try to find topic-specific routing first
  let route = null;
  if (lead.type === 'support_ticket' && lead.topic && emailRouting.routes?.support_ticket?.topics?.[lead.topic]) {
    route = emailRouting.routes.support_ticket.topics[lead.topic];
  } else {
    route = emailRouting.routes?.[lead.type];
  }

  if (!route) {
    logger.error('No email route configured — lead saved but nobody was notified', {
      leadId, type: lead.type, topic: lead.topic || null,
      configuredTypes: Object.keys(emailRouting.routes || {}),
      configuredTopics: Object.keys(emailRouting.routes?.support_ticket?.topics || {})
    });
    return { status: 'skipped', reason: 'missing_route' };
  }

  const apiKey = SMTP2GO_API_KEY.value();
  if (!apiKey) {
    logger.error('SMTP2GO_API_KEY is not set — no email will be sent for any lead', { leadId });
    return { status: 'skipped', reason: 'missing_secret' };
  }

  const to = normalizeEmailList(route.to);
  if (to.length === 0) {
    logger.error('Email route has no valid recipients', {
      leadId, type: lead.type, topic: lead.topic || null,
      route: route.label || null, rawTo: route.to || null
    });
    return { status: 'skipped', reason: 'missing_recipients' };
  }

  const cc = normalizeEmailList(route.cc);
  const bcc = normalizeEmailList(route.bcc);
  const replyTo = normalizeEmailList(route.replyTo || lead.email || emailRouting.defaultReplyTo);
  const email = buildLeadEmail(route, lead, leadId);
  const message = {
    from: emailRouting.from,
    to,
    cc,
    bcc,
    subject: email.subject,
    text: email.text,
    html: email.html,
    // staff replying to the notification should reach the customer
    replyTo: replyTo.length ? replyTo[0] : undefined,
    kind: 'staff_notification',
    leadId
  };

  const result = await sendEmail(apiKey, message);

  // Acknowledge the submitter. Sent after the staff notification so a problem
  // with the receipt can never stop the team from hearing about the lead.
  const confirmation = await sendCustomerConfirmation(apiKey, route, lead, to, leadId);

  return {
    status: 'sent',
    provider: 'smtp2go',
    id: result.id || '',
    recipients: to,
    confirmation
  };
}

async function handleJsonPost(req, res, handler) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'method_not_allowed', 'Only POST is allowed.');
    return;
  }

  try {
    await handler(parseBody(req), req, res);
  } catch (error) {
    if (error.message === 'rate_limited') {
      sendError(res, 429, 'rate_limited', 'Too many requests. Please wait and try again.');
      return;
    }

    if (error.message === 'duplicate_submission') {
      res.status(200).json({ ok: true });
      return;
    }

    console.error('Request rejected', error);
    sendError(res, 400, 'invalid_request', error.message || 'Invalid request.');
  }
}

exports.submitLead = onRequest({
  cors: false,
  enforceAppCheck: REQUIRE_APP_CHECK,
  maxInstances: 10,
  secrets: [SMTP2GO_API_KEY]
}, async (req, res) => {
  await handleJsonPost(req, res, async (body, request, response) => {
    const spamAssessment = buildSpamAssessment(body, request);
    if (spamAssessment.action === 'quarantine') {
      // Deliberately answers 200 so bots cannot tell they were caught, which
      // also means a false positive is invisible to the sender. Log it, or a
      // legitimate submission disappears with no trace anywhere.
      logger.warn('Submission quarantined as spam — no lead created, no email sent', {
        type: body.type || null,
        topic: body.topic || null,
        score: spamAssessment.score,
        reasons: spamAssessment.reasons,
        origin: getRequestHeader(request, 'origin') || null,
        referer: getRequestHeader(request, 'referer') || null
      });
      await recordSpamSubmission(body, request, spamAssessment);
      response.status(200).json({ ok: true });
      return;
    }

    const ip = getClientIp(request);
    const sessionKey = getSessionKey(request, body) || ip;
    try {
      await enforceRateLimit({ key: ip, bucket: 'lead_ip', limit: 8, windowMs: 60 * 60 * 1000 });
      await enforceRateLimit({ key: sessionKey, bucket: 'lead_session', limit: 3, windowMs: 15 * 60 * 1000 });
    } catch (error) {
      if (error.message !== 'rate_limited') throw error;
      logger.warn('Submission rate limited — no lead created, no email sent', {
        type: body.type || null, topic: body.topic || null
      });
      await recordSpamSubmission(body, request, {
        score: SPAM_QUARANTINE_SCORE,
        reasons: ['rate_limited'],
        action: 'quarantine'
      });
      response.status(200).json({ ok: true });
      return;
    }

    const lead = buildLead(body);
    const fingerprint = buildLeadFingerprint(lead);
    await enforceLeadDuplicateSuppression(fingerprint);

    lead.ipHash = hashValue(ip).slice(0, 32);
    lead.fingerprintHash = fingerprint.slice(0, 32);
    if (spamAssessment.reasons.length > 0) {
      lead.abuseSignals = {
        score: spamAssessment.score,
        reasons: spamAssessment.reasons
      };
    }

    const leadRef = await db.collection(`${DATA_ROOT}/leads`).add(lead);
    try {
      const notification = await sendLeadNotification(lead, leadRef.id);
      await leadRef.set({
        emailNotification: {
          ...notification,
          updatedAt: FieldValue.serverTimestamp()
        }
      }, { merge: true });
    } catch (error) {
      logger.error('Lead notification threw — lead is saved, email did not send', {
        leadId: leadRef.id,
        type: lead.type,
        topic: lead.topic || null,
        reason: error.reason || 'unknown',
        providerStatus: error.providerStatus || null,
        message: error.safeMessage || error.message || String(error)
      });
      await leadRef.set({
        emailNotification: buildEmailFailureRecord(error)
      }, { merge: true });
    }

    response.status(200).json({ ok: true });
  });
});

if (process.env.NODE_ENV === 'test') {
  exports._test = {
    buildLead,
    buildLeadFingerprint,
    buildCustomerConfirmationEmail,
    buildLeadEmail,
    buildSpamAssessment,
    buildRecipientThrottleId,
    buildSpamBucketId,
    canonicalFingerprintPart,
    countUrlLikeTokens,
    getClientIp,
    hashValue,
    isBotSubmission,
    normalizeEmail,
    normalizeIp,
    normalizePhone
  };
}

exports.logPageView = onRequest({
  cors: false,
  enforceAppCheck: REQUIRE_APP_CHECK,
  maxInstances: 10
}, async (req, res) => {
  await handleJsonPost(req, res, async (body, request, response) => {
    const ip = getClientIp(request);
    const sessionKey = getSessionKey(request, body) || ip;
    await enforceRateLimit({ key: ip, bucket: 'pageview_ip', limit: 120, windowMs: 60 * 60 * 1000 });
    await enforceRateLimit({ key: `${sessionKey}_${body.page || 'page'}`, bucket: 'pageview_session_page', limit: 1, windowMs: 5 * 60 * 1000 });

    await db.collection(`${DATA_ROOT}/analytics_pageviews`).add(buildPageView(body, request));
    response.status(200).json({ ok: true });
  });
});
