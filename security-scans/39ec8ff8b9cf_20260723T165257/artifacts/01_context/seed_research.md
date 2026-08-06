# Seed Research

No CVE, GHSA, advisory, release, issue, or package-version seed was supplied in the request. The user supplied vulnerability-family seeds covering Firebase authorization, XSS, uploads, public forms, dependency, secret, header, abuse, and launch-readiness risks.

Local seed searches performed:
- Firebase rules and authz: `allow`, `admin`, `staff`, `custom claim`, `email_verified`, `serverControls`, public display collections.
- Client rendering: `innerHTML`, `insertAdjacentHTML`, `safeUrl`, `escapeHtml`, `href`, `src`, `data:image`.
- Public forms/functions: `submitLead`, `logPageView`, `postJson`, App Check headers, rate-limit and duplicate-control roots.
- Secret/dependency: `apiKey`, `RESEND`, private-key/service-account patterns, `npm audit --omit=dev`, and `npm ls` reachability checks.
- Hosting headers: CSP, frame-src, frame-ancestors, target blank, iframes, third-party scripts.

Exact seeded rows are closed in `repository_coverage_ledger.md`.