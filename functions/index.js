const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { initializeApp } = require('firebase-admin/app');
const crypto = require('crypto');
const emailRouting = require('./email-routing.json');

initializeApp();

const db = getFirestore();
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const DATA_ROOT = 'artifacts/162296779236/public/data';
const RATE_LIMIT_ROOT = 'serverControls/rateLimits/entries';
const DUPLICATE_ROOT = 'serverControls/leadDuplicates/entries';
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';
const REQUIRE_APP_CHECK = !IS_TEST && (!IS_EMULATOR || process.env.REQUIRE_APP_CHECK === 'true');
const RESEND_API_URL = 'https://api.resend.com/emails';

const LEAD_TYPES = new Set(['support_ticket', 'business_quote', 'builder_inquiry']);
const SUPPORT_TOPICS = new Set(['billing', 'availability', 'outage', 'service', 'general', 'other']);
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

function cleanEnum(value, allowed, fallback) {
  const normalized = cleanText(value, 80).toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function cleanEmail(value) {
  const email = cleanText(value, 254, { required: true }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email address.');
  }
  return email;
}

function cleanPhone(value) {
  const phone = cleanText(value, 40, { required: true });
  if (!/^[0-9+().\-\s]{7,40}$/.test(phone)) {
    throw new Error('Invalid phone number.');
  }
  return phone;
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

function isBotSubmission(body) {
  return Boolean(cleanText(body.website_check || body.websiteCheck || '', 200));
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

function buildResendError(status, bodyText) {
  let providerMessage = String(bodyText || '').slice(0, 500);
  try {
    const parsed = JSON.parse(bodyText);
    providerMessage = cleanText(parsed.message || parsed.error || providerMessage, 300);
  } catch (error) {
    providerMessage = providerMessage.replace(/\s+/g, ' ').trim().slice(0, 300);
  }

  let reason = 'resend_request_failed';
  if (/domain is not verified/i.test(providerMessage)) {
    reason = 'resend_domain_not_verified';
  } else if (status === 401 || status === 403) {
    reason = 'resend_auth_or_permission_failed';
  } else if (status === 429) {
    reason = 'resend_rate_limited';
  }

  const error = new Error(`Resend failed with ${status}: ${providerMessage}`);
  error.provider = 'resend';
  error.providerStatus = status;
  error.reason = reason;
  error.safeMessage = providerMessage;
  return error;
}

function buildEmailFailureRecord(error) {
  return {
    status: 'failed',
    provider: error.provider || 'resend',
    reason: error.reason || 'email_send_failed',
    providerStatus: error.providerStatus || null,
    message: cleanText(error.safeMessage || error.message || 'Email delivery failed.', 300),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function sendLeadNotification(lead, leadId) {
  const route = emailRouting.routes?.[lead.type];
  if (!route) {
    console.warn('No email route configured for lead type', lead.type);
    return { status: 'skipped', reason: 'missing_route' };
  }

  const apiKey = RESEND_API_KEY.value();
  if (!apiKey) {
    console.warn('RESEND_API_KEY secret is not configured; skipping lead email.');
    return { status: 'skipped', reason: 'missing_secret' };
  }

  const to = normalizeEmailList(route.to);
  if (to.length === 0) {
    console.warn('Email route has no valid recipients', lead.type);
    return { status: 'skipped', reason: 'missing_recipients' };
  }

  const cc = normalizeEmailList(route.cc);
  const bcc = normalizeEmailList(route.bcc);
  const replyTo = normalizeEmailList(route.replyTo || lead.email || emailRouting.defaultReplyTo);
  const email = buildLeadEmail(route, lead, leadId);
  const payload = {
    from: emailRouting.from,
    to,
    subject: email.subject,
    text: email.text,
    html: email.html
  };

  if (cc.length) payload.cc = cc;
  if (bcc.length) payload.bcc = bcc;
  if (replyTo.length) payload.reply_to = replyTo[0];

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resultText = await response.text();
  if (!response.ok) {
    throw buildResendError(response.status, resultText);
  }

  let result = {};
  try {
    result = JSON.parse(resultText);
  } catch (error) {
    result = { raw: resultText.slice(0, 500) };
  }

  return { status: 'sent', provider: 'resend', id: result.id || '' };
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
  secrets: [RESEND_API_KEY]
}, async (req, res) => {
  await handleJsonPost(req, res, async (body, request, response) => {
    if (isBotSubmission(body)) {
      response.status(200).json({ ok: true });
      return;
    }

    const ip = getClientIp(request);
    const sessionKey = getSessionKey(request, body) || ip;
    await enforceRateLimit({ key: ip, bucket: 'lead_ip', limit: 8, windowMs: 60 * 60 * 1000 });
    await enforceRateLimit({ key: sessionKey, bucket: 'lead_session', limit: 3, windowMs: 15 * 60 * 1000 });

    const lead = buildLead(body);
    const fingerprint = buildLeadFingerprint(lead);
    await enforceLeadDuplicateSuppression(fingerprint);

    lead.ipHash = hashValue(ip).slice(0, 32);
    lead.fingerprintHash = fingerprint.slice(0, 32);

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
      console.error('Lead email notification failed', error);
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
    canonicalFingerprintPart,
    getClientIp,
    hashValue,
    normalizeIp
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
