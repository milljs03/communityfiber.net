# Finding Discovery Report

Reviewed all 77 rows from `deep_review_input.jsonl`; subagents read assigned files in full and the parent reviewed Firebase rules, Storage rules, Cloud Functions, admin authorization, public forms, dependency advisories, and Firestore paths.

## Candidates Promoted To Validation

1. `CAND-CMS-URL-ATTR-XSS-001` - CMS URL sanitizer allows attribute injection into public `innerHTML` renderers. Root control: `public/assets/js/security.js:18-23`; reachable public sinks in `about.js`, `business.js`, and `blog.js`.
2. `CAND-BUILD-JSONLD-XSS-001` - `scripts/build-posts.js` places `JSON.stringify(...)` output inside JSON-LD `<script>` blocks without escaping `<`, `>`, `&`, U+2028, or U+2029.
3. `CAND-BUILD-CTA-HREF-001` - build-time CTA `href` values are attribute-escaped but not URL-scheme validated.
4. `CAND-HTML-CSP-MALFORMED-001` - several HTML pages have malformed CSP meta tags whose `content` attribute is not terminated at the policy boundary.
5. `CAND-ADMIN-CDN-SRI-001` - admin page loads `https://cdn.jsdelivr.net/npm/chart.js` without SRI or local pinning.

## Important Suppressions

- Firestore client writes are server-side authorized by `firestore.rules`; UI-only `isAdmin` checks are not the only write control. Public content writes require `adminEmail()` or `adminClaim()` and leads/analytics/server controls cannot be written by clients.
- Storage upload risks are not reachable because `storage.rules` denies all reads/writes and CMS images are stored as raster data URLs in Firestore.
- Public form functions enforce method checks, CORS response headers, App Check in production, bounded input validation, rate limits, duplicate suppression, and escaped email HTML.
- Firebase web API keys and the App Check site key are public identifiers; no service account or private key was found in repository text.
- `npm audit` dependency advisories are present, including a high `fast-xml-parser` transitive advisory, but no repository path uses Firebase Storage/XML parser APIs.