const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const {
  _test: {
    buildLead,
    buildLeadFingerprint,
    buildRecipientThrottleId,
    buildSpamAssessment,
    buildSpamBucketId,
    canonicalFingerprintPart,
    countUrlLikeTokens,
    getClientIp,
    isBotSubmission,
    normalizeEmail,
    normalizeIp,
    normalizePhone
  }
} = require('./index');

function fakeReq(headers = {}) {
  return {
    ip: '203.0.113.10',
    socket: {},
    connection: {},
    get(name) {
      return headers[name.toLowerCase()] || '';
    }
  };
}

test('getClientIp prefers platform IP over spoofable forwarded header', () => {
  const req = {
    ip: '203.0.113.10',
    get(name) {
      return name === 'x-forwarded-for' ? '198.51.100.99' : '';
    }
  };

  assert.equal(getClientIp(req), '203.0.113.10');
});

test('getClientIp falls back to sanitized forwarded header only when platform IP is absent', () => {
  const req = {
    ip: '',
    socket: {},
    connection: {},
    get(name) {
      return name === 'x-forwarded-for' ? '198.51.100.1, 203.0.113.8<script>' : '';
    }
  };

  assert.equal(getClientIp(req), '203.0.113.8');
});

test('lead fingerprint is stable across casing and whitespace changes', () => {
  const leadA = buildLead({
    type: 'support_ticket',
    topic: 'general',
    name: 'Jane Customer',
    email: 'JANE@EXAMPLE.COM',
    phone: '(574) 555-0100',
    message: 'Need help with my fiber service.'
  });

  const leadB = buildLead({
    type: 'support_ticket',
    topic: 'general',
    name: '  jane   customer ',
    email: 'jane@example.com',
    phone: '(574) 555-0100',
    message: 'Need   help with my fiber service.'
  });

  assert.equal(buildLeadFingerprint(leadA), buildLeadFingerprint(leadB));
});

test('lead fingerprint changes when meaningful submission content changes', () => {
  const leadA = buildLead({
    type: 'business_quote',
    businessName: 'Example Co',
    contactName: 'Sam Smith',
    email: 'sam@example.com',
    phone: '574-555-0100',
    address: '100 Main St',
    requirements: 'Need 500 Mbps'
  });

  const leadB = buildLead({
    type: 'business_quote',
    businessName: 'Example Co',
    contactName: 'Sam Smith',
    email: 'sam@example.com',
    phone: '574-555-0100',
    address: '100 Main St',
    requirements: 'Need 1 Gbps'
  });

  assert.notEqual(buildLeadFingerprint(leadA), buildLeadFingerprint(leadB));
});

test('canonicalFingerprintPart normalizes repeated whitespace and casing', () => {
  assert.equal(canonicalFingerprintPart('  A  Mixed\tValue  '), 'a mixed value');
});

test('normalizeIp strips unsafe characters and IPv6 mapped prefix', () => {
  assert.equal(normalizeIp('::ffff:203.0.113.10<script>'), '203.0.113.10');
});

test('lead contact fields normalize email casing and phone formatting', () => {
  const lead = buildLead({
    type: 'support_ticket',
    topic: 'general',
    name: 'Jane Customer',
    email: '  JANE.Customer@EXAMPLE.COM ',
    phone: '+1 (574) 555-0100',
    message: 'Need help with my fiber service.'
  });

  assert.equal(lead.email, 'jane.customer@example.com');
  assert.equal(lead.phone, '5745550100');
});

test('contact normalizers return canonical values', () => {
  assert.equal(normalizeEmail('  SALES@Example.COM  '), 'sales@example.com');
  assert.equal(normalizePhone('574.555.0100'), '5745550100');
  assert.equal(normalizePhone('1-574-555-0100'), '5745550100');
});

test('spam bucket IDs aggregate repeated submissions by source and window', () => {
  const assessment = { action: 'quarantine', reasons: ['honeypot_filled', 'bad_origin'] };
  const first = buildSpamBucketId({ ip: '203.0.113.10', assessment, now: 60 * 60 * 1000 });
  const second = buildSpamBucketId({ ip: '203.0.113.10', assessment, now: 60 * 60 * 1000 + 5000 });
  const later = buildSpamBucketId({ ip: '203.0.113.10', assessment, now: 2 * 60 * 60 * 1000 });

  assert.equal(first, second);
  assert.notEqual(first, later);
  assert.doesNotMatch(first, /203\.0\.113\.10/);
});

test('customer confirmation throttle IDs are normalized and do not expose the email', () => {
  const first = buildRecipientThrottleId('  CUSTOMER@Example.COM ');
  const second = buildRecipientThrottleId('customer@example.com');
  const other = buildRecipientThrottleId('other@example.com');

  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.match(first, /^customer_confirmation_[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /@|example\.com|customer@example/i);
});

test('honeypot fields trigger quarantine scoring', () => {
  const assessment = buildSpamAssessment({
    type: 'support_ticket',
    website_check: 'https://spam.example',
    form_started_at: String(Date.now() - 10000),
    form_interaction_count: '4'
  }, fakeReq({ 'user-agent': 'Mozilla/5.0', origin: 'https://communityfiber.net' }));

  assert.equal(isBotSubmission({ company_url: 'https://spam.example' }), true);
  assert.equal(assessment.action, 'quarantine');
  assert.match(assessment.reasons.join(','), /honeypot_filled/);
});

test('normal browser form signals are allowed', () => {
  const assessment = buildSpamAssessment({
    type: 'support_ticket',
    name: 'Jane Customer',
    email: 'jane@example.com',
    phone: '574-555-0100',
    message: 'Please help with my service.',
    form_started_at: String(Date.now() - 10000),
    form_interaction_count: '5'
  }, fakeReq({
    'user-agent': 'Mozilla/5.0',
    origin: 'https://communityfiber.net',
    referer: 'https://communityfiber.net/support.html'
  }));

  assert.equal(assessment.action, 'allow');
  assert.equal(assessment.score, 0);
});

test('too-fast no-interaction submissions are quarantined', () => {
  const assessment = buildSpamAssessment({
    type: 'business_quote',
    form_started_at: String(Date.now()),
    form_interaction_count: '0'
  }, fakeReq({ 'user-agent': 'Mozilla/5.0' }));

  assert.equal(assessment.action, 'quarantine');
  assert.ok(assessment.reasons.includes('submitted_too_fast'));
  assert.ok(assessment.reasons.includes('no_recorded_interaction'));
});

test('direct automation with link-heavy content is quarantined', () => {
  const assessment = buildSpamAssessment({
    type: 'builder_inquiry',
    details: 'Visit https://a.example www.b.example and spam.example.com now.'
  }, fakeReq({ 'user-agent': 'python-requests/2.31' }));

  assert.equal(countUrlLikeTokens(assessment.reasons.join(' ')), 0);
  assert.equal(assessment.action, 'quarantine');
  assert.ok(assessment.reasons.includes('excessive_links'));
  assert.ok(assessment.reasons.includes('automation_user_agent'));
});

test('foreign origins are quarantined', () => {
  const assessment = buildSpamAssessment({
    type: 'support_ticket',
    form_started_at: String(Date.now() - 10000),
    form_interaction_count: '3'
  }, fakeReq({
    'user-agent': 'Mozilla/5.0',
    origin: 'https://attacker.example'
  }));

  assert.equal(assessment.action, 'quarantine');
  assert.ok(assessment.reasons.includes('bad_origin'));
});
