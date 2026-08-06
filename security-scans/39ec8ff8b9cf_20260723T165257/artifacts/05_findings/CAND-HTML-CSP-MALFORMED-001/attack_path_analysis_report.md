# Attack Path: Malformed Meta CSP

Final policy decision: report.

Severity: Low / P3.

Affected locations:
- `public/admin.html:9-16`
- `public/about.html:20-27`
- `public/blog.html:76-83`
- `public/builders.html:22-29`
- `public/business.html:22-29`
- `public/outage.html:8-15`
- `public/speedtest.html:9-16`
- `public/blog/*.html:44-51`

Attack path:
1. The site intends to enforce per-page CSP through meta tags.
2. Several pages leave the `content` attribute unterminated at the CSP boundary.
3. Browser repair or parsing behavior can make the intended page-level policy unreliable.
4. A separate injection or compromised script path would have less reliable CSP mitigation on those pages.

Attack-path facts:
- In scope: yes. Public launch headers and CSP are explicitly in scope.
- Exposure: public/static pages and admin page.
- Vector: none by itself; this weakens mitigation rather than introducing attacker input.
- Auth scope: public and admin surfaces.
- Cross-boundary behavior: no standalone boundary crossing.
- Existing mitigations: Firebase Hosting header sets a minimal CSP with `base-uri`, `object-src`, `form-action`, and `frame-ancestors`.
- Counterevidence: this is not independently exploitable without a separate injection path; some pages have correctly formed CSP tags.
- Confidence: high that markup is malformed, low for standalone exploitability.

Severity calibration:
- Impact: low as standalone defense failure.
- Likelihood: medium/public exposure, but no direct exploit sink.
- Final severity: Low.

