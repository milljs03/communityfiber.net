const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const {
  _test: {
    buildLead,
    buildLeadFingerprint,
    canonicalFingerprintPart,
    getClientIp,
    normalizeIp
  }
} = require('./index');

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
