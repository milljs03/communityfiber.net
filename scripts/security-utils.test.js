const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSafeUrl() {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'public/assets/js/security.js'), 'utf8');
  const start = source.indexOf('export function safeUrl');
  const end = source.indexOf('export function setText', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const context = {
    URL,
    window: {
      location: {
        origin: 'https://communityfiber.net'
      }
    }
  };
  vm.runInNewContext(`
    function text(value, fallback = '') {
      if (value === null || value === undefined) return fallback;
      return String(value);
    }
    ${source.slice(start, end).replace('export ', '')}
    result = safeUrl;
  `, context);
  return context.result;
}

function loadSafeJsonForHtmlScript() {
  const source = fs.readFileSync(path.resolve(__dirname, 'build-posts.js'), 'utf8');
  const start = source.indexOf('function safeJsonForHtmlScript');
  const end = source.indexOf('\n\nfunction readJson', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const context = { JSON };
  vm.runInNewContext(`
    ${source.slice(start, end)}
    result = safeJsonForHtmlScript;
  `, context);
  return context.result;
}

function loadSafeContentHref() {
  const source = fs.readFileSync(path.resolve(__dirname, 'build-posts.js'), 'utf8');
  const start = source.indexOf('function safeContentHref');
  const end = source.indexOf('\n\nfunction safeJsonForHtmlScript', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const context = {
    URL,
    SITE_URL: 'https://communityfiber.net'
  };
  vm.runInNewContext(`
    ${source.slice(start, end)}
    result = safeContentHref;
  `, context);
  return context.result;
}

const safeUrl = loadSafeUrl();
const safeJsonForHtmlScript = loadSafeJsonForHtmlScript();
const safeContentHref = loadSafeContentHref();

test('safeUrl rejects slash-prefixed attribute injection payloads', () => {
  const payload = '/" onerror="alert(document.domain)" x="';
  assert.equal(safeUrl(payload, '', { allowDataImage: true }), '');
});

test('safeUrl keeps same-origin relative paths canonical and attribute-safe', () => {
  assert.equal(safeUrl('/blog.html?x=1#top'), '/blog.html?x=1#top');
  assert.equal(safeUrl('./residential.html'), '/residential.html');
  assert.equal(safeUrl('../support.html'), '/support.html');
});

test('safeUrl rejects protocol-relative cross-origin URLs', () => {
  assert.equal(safeUrl('//evil.example/logo.png', 'fallback.png'), 'fallback.png');
});

test('safeUrl allows https URLs and raster data images when requested', () => {
  assert.equal(safeUrl('https://example.com/logo.png'), 'https://example.com/logo.png');
  assert.equal(
    safeUrl('data:image/png;base64,aGVsbG8=', '', { allowDataImage: true }),
    'data:image/png;base64,aGVsbG8='
  );
});

test('safeJsonForHtmlScript escapes script-breaking characters', () => {
  const rendered = safeJsonForHtmlScript({
    headline: '</script><script>alert(1)</script>',
    ampersand: 'Tom & Jerry',
    separators: '\u2028\u2029'
  });

  assert.equal(rendered.includes('</script>'), false);
  assert.equal(rendered.includes('<script>'), false);
  assert.match(rendered, /\\u003C\/script\\u003E/);
  assert.match(rendered, /\\u0026/);
  assert.match(rendered, /\\u2028\\u2029/);
  assert.deepEqual(JSON.parse(rendered), {
    headline: '</script><script>alert(1)</script>',
    ampersand: 'Tom & Jerry',
    separators: '\u2028\u2029'
  });
});

test('safeContentHref preserves same-origin CTA hrefs', () => {
  assert.equal(safeContentHref('../residential.html'), '../residential.html');
  assert.equal(safeContentHref('/support.html#faq'), '/support.html#faq');
  assert.equal(
    safeContentHref('https://communityfiber.net/business.html?source=blog'),
    'https://communityfiber.net/business.html?source=blog'
  );
});

test('safeContentHref rejects executable, cross-origin, and attribute-breaking CTA hrefs', () => {
  assert.throws(() => safeContentHref('javascript:alert(1)'), /HTTPS or a relative path/);
  assert.throws(() => safeContentHref('https:evil.example/path'), /HTTPS or a relative path/);
  assert.throws(() => safeContentHref('http://communityfiber.net/path'), /HTTPS or a relative path/);
  assert.throws(() => safeContentHref('data:text/html,<script>alert(1)</script>'), /unsafe characters/);
  assert.throws(() => safeContentHref('//evil.example/path'), /Protocol-relative/);
  assert.throws(() => safeContentHref('https://evil.example/path'), /must stay on/);
  assert.throws(() => safeContentHref('/" onmouseover="alert(1)"'), /unsafe characters/);
});

test('CSP meta tags are closed in shipped pages and the blog template', () => {
  const files = [
    'public/admin.html',
    'public/about.html',
    'public/blog.html',
    'public/builders.html',
    'public/business.html',
    'public/outage.html',
    'public/speedtest.html',
    'public/blog/business-fiber-internet-guide.html',
    'public/blog/fiber-vs-cable-elkhart-county.html',
    'public/blog/how-fiber-installation-works.html',
    'public/blog/what-internet-speed-do-i-need.html',
    'scripts/build-posts.js'
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
    assert.match(
      source,
      /connect-src [^"]*https:\/\/content-firebaseappcheck\.googleapis\.com;">/,
      `${file} must close the CSP content attribute`
    );
  }
});
