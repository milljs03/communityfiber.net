# Validation Report: CMS URL Attribute XSS

Rubric:
- [x] Attacker-controlled value crosses a trust boundary: CMS Firestore URL fields are public content controlled by administrators or a compromised admin account.
- [x] Closest control accepts a crafted malicious value: `safeUrl()` returns values starting with `/`, `./`, or `../` before URL parsing or attribute encoding.
- [x] Value reaches a browser execution sink: returned URL is interpolated into quoted `src`/`href` attributes in strings assigned via `innerHTML`.
- [x] Existing controls do not defeat the payload: `escapeHtml()` is used for text fields, but not for `safeUrl()` results in the vulnerable attribute contexts.
- [x] Impact is security-relevant: public visitors and authenticated staff/admins who view affected pages can execute attacker-supplied JavaScript in the site origin.

Validation method: local Node PoC for the sanitizer branch and static source-to-sink tracing.

Evidence observed:
- Root control: `public/assets/js/security.js:18-23`.
- Entrypoints: `public/assets/js/about.js:160-176`, `public/assets/js/business.js:15-35`, `public/assets/js/blog.js:13-62`.
- PoC payload: `/" onerror="alert(document.domain)" x="`.
- PoC result: the existing sanitizer accepts the payload and the vulnerable template becomes `<img src="/" onerror="alert(document.domain)" x="" alt="x">`.

Disposition: reportable.

Confidence: high.

Remaining uncertainty: live Firestore data was not queried and production was not tested. The static path is sufficient because public render code always re-applies `safeUrl()` to the stored field before interpolation.

