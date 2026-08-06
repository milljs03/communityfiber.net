# Attack Path: CMS URL Attribute XSS

Final policy decision: report.

Severity: High / P1.

Affected locations:
- root_control: `public/assets/js/security.js:18-23`
- sink: `public/assets/js/about.js:171,176`
- sink: `public/assets/js/business.js:30,35`
- sink: `public/assets/js/blog.js:39,42,48,54,62`

Attack path:
1. A malicious admin, compromised admin account, or abused CMS write path stores a URL field such as `employees.photoUrl`, `business_logos.logoUrl`, `news.imageUrl`, or `news.linkUrl` with a payload beginning with `/` and containing a quote plus event handler.
2. Firestore rules intentionally allow administrators to write public display collections.
3. Public pages read those Firestore documents and pass the URL field through `safeUrl()`.
4. `safeUrl()` returns the slash-prefixed string unchanged.
5. The returned value is interpolated into a quoted HTML attribute and assigned through `innerHTML`.
6. Browser parsing creates an executable event handler in the site origin.

Attack-path facts:
- In scope: yes. CMS rendering and public content are explicit protected surfaces in the threat model.
- Exposure: public runtime pages. Affected renderers execute for anonymous visitors.
- Vector: remote, after CMS content is written.
- Auth scope: write precondition is admin-only, but impact crosses to anonymous visitors and staff/admin users who view the affected pages.
- Attacker input control: yes under compromised/malicious admin or any future CMS write bypass.
- Cross-boundary behavior: yes. Trusted CMS content crosses from Firestore data into executable browser markup.
- Impact surface: runtime browser origin, public site visitors, and potentially authenticated admin/staff sessions sharing origin/browser storage.
- Secrets references: none directly. Firebase Auth/App Check context and same-origin public app state may be exposed to injected script.
- Existing mitigations: Firestore rules restrict CMS writes to admin users; text fields use `escapeHtml()`; data images are regex-restricted.
- Counterevidence: ordinary public users cannot directly write the affected fields under current Firestore rules. This lowers likelihood compared with unauthenticated XSS, but it does not defeat the issue because the CMS is a high-value privileged surface and stored active content is not an intended admin capability.
- Confidence: high.

Severity calibration:
- Impact: high. Stored first-party script execution can affect public visitors and authenticated staff/admin users.
- Likelihood: high enough for P1 because a compromised admin/CMS content path is an in-scope threat, though not unauthenticated.
- Final severity: High. Not Critical because direct unauthenticated write access was not found.

