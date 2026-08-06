# Validation Report: Malformed Meta CSP

Rubric:
- [x] Affected pages are shipped public/admin HTML.
- [x] The CSP meta `content` attribute is malformed or not terminated at the policy boundary.
- [x] Correct counterexamples exist in other pages, proving this is not the intended template shape.
- [x] Firebase Hosting supplies only a minimal header CSP, so the malformed meta weakens page-level script/style/frame policy.
- [ ] This does not by itself create script execution without a separate injection or compromised script path.

Validation method: static HTML inspection.

Evidence observed:
- Malformed CSP blocks are present at `public/admin.html:9-16`, `public/about.html:20-27`, `public/blog.html:76-83`, `public/builders.html:22-29`, `public/business.html:22-29`, `public/outage.html:8-15`, `public/speedtest.html:9-16`, and generated blog pages at `public/blog/*.html:44-51`.
- Correctly closed counterexamples exist at `public/index.html:71-78`, `public/residential.html:81-88`, `public/support.html:62-69`, and city pages at `public/{bristol,goshen,middlebury,milford,nappanee,new-paris,syracuse,wakarusa}.html:150-157`.
- `firebase.json:35-51` only sets `base-uri`, `object-src`, `form-action`, and `frame-ancestors`, not the full per-page `script-src`, `style-src`, `img-src`, `frame-src`, and `connect-src` policy.

Disposition: reportable as configuration hardening / low severity.

Confidence: high that the markup is malformed; low that this is independently exploitable.

Remaining uncertainty: browser-specific repair behavior was not tested with a DOM parser, and no separate exploit path depends solely on this issue.

