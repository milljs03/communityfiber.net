# Fix Report

## Implemented Fixes

### CAND-CMS-URL-ATTR-XSS-001

Affected component: `public/assets/js/security.js`

Change:
- `safeUrl()` now rejects control characters and HTML attribute-breaking characters: `"`, `'`, `<`, `>`, and backtick.
- `safeUrl()` now rejects protocol-relative URLs beginning with `//`.
- Same-origin relative URLs are parsed through `new URL()` and returned as canonical path/search/hash strings instead of raw input.
- HTTPS absolute URLs and explicitly allowed raster data images remain supported.

Regression test:
- Added `scripts/security-utils.test.js`.
- The test evaluates the actual `safeUrl()` function source with a fake browser origin.
- It verifies rejection of the validated payload `/" onerror="alert(document.domain)" x="`, rejection of `//evil.example/...`, and preservation of safe relative, HTTPS, and raster data image URLs.

### CAND-BUILD-JSONLD-XSS-001

Affected component: `scripts/build-posts.js`

Change:
- Added `safeJsonForHtmlScript()` for JSON-LD serialization.
- The helper escapes `<`, `>`, `&`, U+2028, and U+2029 after JSON serialization.
- Article-page JSON-LD and blog-index JSON-LD now use the helper instead of raw `JSON.stringify(...)`.

Regression test:
- Extended `scripts/security-utils.test.js`.
- It verifies that `</script><script>...` does not remain in rendered JSON-LD output.
- It verifies escaped JSON still parses back to the original data.

### CAND-BUILD-CTA-HREF-001

Affected component: `scripts/build-posts.js`

Change:
- Added `safeContentHref()` for blog CTA links emitted from post content.
- CTA hrefs now fail generation if they are empty, contain control or attribute-breaking characters, use protocol-relative syntax, use a non-HTTPS scheme, or leave `https://communityfiber.net`.
- Existing same-origin relative CTA links are preserved without changing their rendered paths.
- `validatePost()` checks CTA hrefs before any generated page is written, and `renderBlock()` reuses the same helper at the sink.

Regression test:
- Extended `scripts/security-utils.test.js`.
- It verifies current safe relative and same-origin HTTPS CTA hrefs are preserved.
- It verifies `javascript:`, `data:`, `http:`, ambiguous scheme syntax, protocol-relative, cross-origin, and attribute-breaking hrefs are rejected.

### CAND-HTML-CSP-MALFORMED-001

Affected components:
- `public/admin.html`
- `public/about.html`
- `public/blog.html`
- `public/builders.html`
- `public/business.html`
- `public/outage.html`
- `public/speedtest.html`
- `public/blog/*.html`
- `scripts/build-posts.js`

Change:
- Closed malformed CSP meta `content` attributes with `;">` on affected shipped pages.
- Fixed the generated blog article template so regenerated post pages retain the closed CSP tag.

Regression test:
- Extended `scripts/security-utils.test.js`.
- It verifies the shipped affected pages and blog template include a closed `connect-src ... https://content-firebaseappcheck.googleapis.com;">` CSP attribute.

## Validation After Fix

Passed:
- `node --test scripts\security-utils.test.js`
- `node scripts\build-posts.js`
- `node --check public\assets\js\security.js`
- `node --check scripts\security-utils.test.js`
- `node --check scripts\build-posts.js`
- `npm.cmd test` in `functions`
- `node --check scripts\build-city-pages.js`

Not run:
- Firebase Emulator Suite rule tests were not available/configured in this repository.
- A root production build was not executed because the repository has no root `package.json` or root build script.

## Remaining Launch Blockers

No remaining Critical, High, Medium, or Low reportable findings from this scan after these fixes.

Remaining non-blocking hardening:
- Defense in depth: vendor or integrity-pin admin Chart.js.
