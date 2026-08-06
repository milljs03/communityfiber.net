# Security Review: communityfiber.net

## Scope

This was a repository-wide Codex Security audit of `C:\Users\JosiahMiller\communityfiber.net` at revision `39ec8ff8b9cf4a7623ac0a8d6e94f9324a049868`. The scan covered frontend code, shipped public HTML, Cloud Functions, Firebase Hosting config, Firestore rules, Storage rules, Firebase Auth/CMS authorization paths, public forms, build scripts, content JSON, dependency manifests/lockfiles, and secret/config exposure.

No destructive tests, production requests, or live Firebase/Firestore writes were performed. Validation used static source tracing, bounded local Node PoCs, `npm audit --omit=dev`, `npm ls`, and the existing Functions test suite.

### Executive Launch Verdict

Verdict: **Ready to launch after specified fixes**.

Launch-blocking finding:

- High: CMS URL sanitizer allows stored DOM XSS from CMS URL fields into public `innerHTML` renderers.

The application is not guaranteed vulnerability-free. This report reflects repository evidence and local validation only; Firebase console settings, Google API key restrictions, App Check rollout state, and production deployment state were not independently verified.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 4 |
| Severity mix | 1 High, 1 Medium, 2 Low |
| Highest priority | High / P1: CMS URL sanitizer XSS |
| Coverage | 77 source-like worklist rows plus Firebase rules/config/dependency checks |
| Validation | Static trace, local PoCs, dependency audit, existing tests |
| Existing tests run during audit | `npm.cmd test` in `functions`: 6/6 passed |
| Audit artifacts | `security-scans/39ec8ff8b9cf_20260723T165257` |

## Threat Model

Protected assets include lead submissions, analytics data, CMS public content, administrative content-write capability, Firestore rule boundaries, Cloud Functions Admin SDK privileges, Firebase project configuration, and the Resend API secret.

Key trust boundaries are browser code to Firebase rules, public HTTP form submissions to Cloud Functions, Firestore CMS content to browser rendering, Cloud Functions to privileged Firestore/Admin SDK operations, and source-controlled content to generated public HTML.

User roles are anonymous public visitors, authenticated `@nptel.com` staff viewers, the hardcoded admin email `jmiller@nptel.com`, users with `admin == true` custom claims, and Cloud Functions running with Admin SDK privileges.

Highest-risk abuse cases were broken Firebase authorization, unauthorized lead/analytics reads, stored XSS through CMS content, public form/email abuse, unsafe upload/content paths, exposed secrets, and launch security-header misconfiguration.

## Findings

| Finding | Severity | Confidence |
| --- | --- | --- |
| [1. CMS URL sanitizer allows attribute injection into public renderers](#1-cms-url-sanitizer-allows-attribute-injection-into-public-renderers) | High | high |
| [2. Generated blog JSON-LD can break out of script tags](#2-generated-blog-json-ld-can-break-out-of-script-tags) | Medium | medium |
| [3. Generated blog CTA href accepts unsafe URL schemes](#3-generated-blog-cta-href-accepts-unsafe-url-schemes) | Low | medium |
| [4. Malformed meta CSP leaves page-level policy unreliable](#4-malformed-meta-csp-leaves-page-level-policy-unreliable) | Low | high |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct source/config/runtime evidence supports the finding with no material unresolved blocker. |
| medium | Source evidence supports a plausible issue, but role reachability or production workflow needs more proof. |
| low | Weak or incomplete evidence. |

### 1. CMS URL Sanitizer Allows Attribute Injection Into Public Renderers

| Field | Value |
| --- | --- |
| Severity | High |
| Confidence | high |
| Confidence rationale | Local PoC reproduced the exact sanitizer output and generated vulnerable attribute HTML; source-to-sink paths are direct. |
| Category | Stored DOM XSS |
| CWE | CWE-79 |
| Affected lines | `public/assets/js/security.js:18-23`; `public/assets/js/about.js:171,176`; `public/assets/js/business.js:30,35`; `public/assets/js/blog.js:39,42,48,54,62` |
| Blocks launch | Yes |

#### Summary

`safeUrl()` returns any string beginning with `/`, `./`, or `../` unchanged. Public CMS renderers then interpolate those returned values into quoted `src` or `href` attributes in strings assigned with `innerHTML`. A CMS URL value such as `/" onerror="alert(document.domain)" x="` becomes an executable event handler in the first-party origin.

#### Root Cause

The violated invariant is that URL sanitization must produce a value safe for the eventual HTML attribute context. The implementation only validates URL shape, and the slash-prefixed fast path bypasses both URL normalization and HTML attribute encoding.

The vulnerable dataflow is:

CMS Firestore field -> `safeUrl()` in `security.js` -> template literal attribute in `about.js`, `business.js`, or `blog.js` -> `innerHTML` assignment -> browser parser creates an event handler.

#### Validation

Validation used a local Node PoC:

`safeUrl('/" onerror="alert(document.domain)" x="', '', { allowDataImage: true })` returned the payload unchanged, producing `<img src="/" onerror="alert(document.domain)" x="" alt="x">`.

No live Firestore or production page was tested.

#### Reachability

Current Firestore rules prevent anonymous writes, so the attacker needs an admin account, compromised admin account, or a future CMS write bypass. That is still in scope because the CMS is the privileged content surface and stored script execution is not an intended admin capability. The affected pages are public, so the impact crosses from a privileged content write into visitor and staff/admin browsers.

#### Severity

High. The impact is stored first-party JavaScript execution. It is not Critical because anonymous users cannot directly write the affected Firestore fields under the current rules.

Severity would increase if an unauthenticated or ordinary staff user could write those fields. It would decrease if the renderers used DOM properties or escaped all URL values before HTML interpolation.

#### Remediation

Make `safeUrl()` return attribute-safe URLs only, or escape `safeUrl()` output before every `innerHTML` interpolation. Prefer canonicalizing relative paths with `new URL()` and rejecting values containing quotes/control characters. Add a regression test for quote/event-handler payloads and safe relative/HTTPS/data-image cases.

### 2. Generated Blog JSON-LD Can Break Out Of Script Tags

| Field | Value |
| --- | --- |
| Severity | Medium |
| Confidence | medium |
| Confidence rationale | Local PoC proved generated unsafe HTML; attacker reachability depends on who can edit source content JSON. |
| Category | Stored XSS in generated HTML |
| CWE | CWE-79 |
| Affected lines | `scripts/build-posts.js:168`; `scripts/build-posts.js:287` |
| Blocks launch | No, unless non-developer editors can modify `content/posts/*.json` |

#### Summary

`scripts/build-posts.js` embeds `JSON.stringify(...)` directly inside `<script type="application/ld+json">`. If a post field contains `</script><script>...</script>`, the browser closes the JSON-LD block and parses active script markup.

#### Root Cause

JSON serialization is safe for JSON syntax but not automatically safe for an HTML script data context. The build script does not escape `<`, `>`, `&`, U+2028, or U+2029 before embedding JSON-LD in HTML.

#### Validation

Local PoC output:

`<script type="application/ld+json">{"headline":"</script><script>console.log(1)</script>"}</script>`

Current checked-in post JSON does not contain that payload.

#### Reachability

The attacker needs write access to `content/posts/*.json` or the build-content pipeline. Generated blog pages are public after deployment.

#### Severity

Medium. The exploit can produce stored XSS in public pages, but repository evidence shows source-controlled content rather than an internet-exposed editor.

#### Remediation

Add a `safeJsonForHtmlScript()` helper that replaces `<`, `>`, `&`, U+2028, and U+2029 with Unicode escapes before inserting JSON into script tags. Use it for article and blog-index JSON-LD.

### 3. Generated Blog CTA Href Accepts Unsafe URL Schemes

| Field | Value |
| --- | --- |
| Severity | Low |
| Confidence | medium |
| Confidence rationale | Local PoC proved unsafe generated link behavior; exploit requires content-source write access and visitor click. |
| Category | Unsafe link scheme / DOM XSS on click |
| CWE | CWE-79, CWE-83 |
| Affected lines | `scripts/build-posts.js:102` |
| Blocks launch | No |

#### Summary

CTA `href` values are HTML-attribute escaped but not URL-scheme validated. A source content value of `javascript:alert(1)` generates `<a href="javascript:alert(1)">CTA</a>`.

#### Root Cause

The build script treats attribute escaping as equivalent to URL safety. Escaping prevents quote-breakout but does not make dangerous URL schemes safe.

#### Validation

Local PoC confirmed `escapeAttr('javascript:alert(1)')` preserves the active scheme.

#### Reachability

The attacker needs write access to post JSON. A visitor must click the malicious CTA.

#### Severity

Low because impact requires content-write access and user interaction.

#### Remediation

Validate CTA URLs against an allowlist such as relative paths and `https://communityfiber.net/...`; reject `javascript:`, `data:`, and other active schemes during build validation.

### 4. Malformed Meta CSP Leaves Page-Level Policy Unreliable

| Field | Value |
| --- | --- |
| Severity | Low |
| Confidence | high |
| Confidence rationale | Static HTML inspection found malformed CSP blocks and nearby correctly formed counterexamples. |
| Category | Security misconfiguration |
| CWE | CWE-693 |
| Affected lines | `public/admin.html:9-16`; `public/about.html:20-27`; `public/blog.html:76-83`; `public/builders.html:22-29`; `public/business.html:22-29`; `public/outage.html:8-15`; `public/speedtest.html:9-16`; `public/blog/*.html:44-51` |
| Blocks launch | No |

#### Summary

Several shipped HTML pages start a meta CSP but do not terminate the `content` attribute at the end of the policy. This makes the intended page-level CSP unreliable and leaves Firebase Hosting’s minimal header CSP as the only dependable baseline.

#### Root Cause

The HTML templates are missing the closing quote and `>` after the `connect-src` directive. Correctly formed CSP tags in `index.html`, `residential.html`, `support.html`, and city pages show the intended shape.

#### Validation

Static inspection found malformed CSP in admin, about, blog, builders, business, outage, speedtest, and generated blog pages. No standalone exploit was proven.

#### Reachability

Public pages and the admin page are affected. This is a mitigation failure that matters most when paired with another injection or third-party script problem.

#### Severity

Low as a standalone issue. Fix shortly after the High item, because CSP is a useful backstop for the XSS class found above.

#### Remediation

Close the CSP meta tags correctly, or better, move a full CSP into `firebase.json` hosting headers so enforcement is centralized and consistent.

## Firebase Rules Assessment

| Surface | Expected Access | Actual Enforced Access | Assessment | Recommended Emulator Tests |
| --- | --- | --- | --- | --- |
| `artifacts/162296779236/public/data/leads/*` | Staff/admin read; no client writes | Read requires `staffEmail()`, `adminEmail()`, or `adminClaim()`; writes false | No issue found | Anonymous read denied, non-`@nptel.com` read denied, verified staff read allowed, client create/update/delete denied |
| `analytics_pageviews/*` | Staff/admin read; no client writes | Same as leads | No issue found | Same as leads |
| `site_content/*` | Public read; admin write | Public read; write requires `adminEmail()` or `adminClaim()` | Intended, but content must render safely | Anonymous read allowed, ordinary staff write denied, admin write allowed |
| `settings/*` | Public read for banner/settings; admin write | Public read; admin write | Intended | Same as `site_content` |
| `plans`, `neighborhoods`, `install_steps`, `employees`, `testimonials`, `news`, `business_logos` | Public read; admin write | Collection allowlist plus admin write | Intended, but content must render safely | Public list/get allowed only for allowlisted collections; non-admin writes denied |
| `serverControls/**` | Server-only | Read/write false for clients | No issue found | All client reads/writes denied |
| wildcard `/{document=**}` | Deny by default | Read/write false | No issue found | Unknown collection denied |
| Storage `/{allPaths=**}` | No public/client storage access | Read/write false | Not applicable for uploads | All reads/writes denied |

## Dependency And Secret Assessment

`npm audit --omit=dev` in `functions` reported 11 advisories: 1 high, 9 moderate, and 1 low. The high item is `fast-xml-parser` via `@google-cloud/storage` under `firebase-admin`; no app code imports Storage/XML parsing APIs, so it was not validated as reachable. The recommended dependency action is to evaluate upgrading `firebase-admin` to the current compatible major version and rerun tests.

No service-account key, private key, or committed privileged token was found. Firebase web API keys and the App Check reCAPTCHA site key are public identifiers, but they should still be restricted in their provider consoles. The `RESEND_API_KEY` is referenced through Firebase Functions secrets and was not committed.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Firestore rules | Access control / IDOR | No issue found | Rules enforce admin/staff boundaries server-side; no broad `if true` rules found. |
| Storage rules | Upload / active content | Not applicable | All Storage read/write is denied. |
| Cloud Functions | Public form abuse / email injection | No issue found | App Check, CORS response headers, method checks, input validation, rate limits, duplicate suppression, and escaped email HTML are present. |
| CMS public rendering | Stored XSS | Reported | URL sanitizer unsafe in `innerHTML` attribute contexts. |
| Build-time blog rendering | Stored XSS / unsafe links | Reported | JSON-LD script context and CTA URL scheme validation gaps. |
| Hosting headers/CSP | Security headers | Reported | Several malformed meta CSP tags; hosting header CSP is minimal. |
| Dependencies | Known vulnerable packages | Rejected | Advisories present but high advisory not reachable from repository app code. |
| Secrets | Credential exposure | No issue found | No private/service-account key found; public Firebase config expected. |

## Security Hardening Recommendations

Required before launch:

- Fix `safeUrl()` or all vulnerable `innerHTML` URL attribute sinks.
- Add regression tests for CMS URL fields with quote/event-handler payloads.
- Run Firebase Emulator tests for Firestore and Storage rules.

Required shortly after launch:

- Escape JSON-LD with a script-safe JSON serializer in `scripts/build-posts.js`.
- Validate CTA URL schemes during blog build.
- Repair malformed CSP meta tags or centralize a complete CSP in `firebase.json`.
- Upgrade or assess `firebase-admin` dependency advisories.

Recommended defense in depth:

- Vendor or integrity-pin admin third-party scripts such as Chart.js.
- Add audit logging for high-impact CMS writes and deletions.
- Add monitoring/alerts for Cloud Function rate-limit rejections and email-send failures.
- Verify Firebase App Check enforcement, Google Maps key restrictions, and API key restrictions in provider consoles.

## Remediation Plan

| Order | Component | Change | Validation | Complexity | Dependencies |
| --- | --- | --- | --- | --- | --- |
| 1 | `public/assets/js/security.js` | Make `safeUrl()` reject or canonicalize quote/control-character relative URLs before returning them | Unit/regression test plus manual PoC should reject `/" onerror=...` | Small | None |
| 2 | Firestore/Storage rules | Add emulator tests for public/admin/staff/anonymous access matrix | Firebase Emulator Suite | Medium | Firebase test setup |
| 3 | `scripts/build-posts.js` | Add script-safe JSON serializer and use for all JSON-LD | Build with malicious fixture or unit test | Small | None |
| 4 | `scripts/build-posts.js` | Validate CTA `href` schemes | Build fails on `javascript:` fixture | Small | None |
| 5 | HTML/CSP | Fix malformed CSP tags or move full CSP to hosting headers | HTML parse check / deployed header check | Medium | Decide central CSP policy |
| 6 | Dependencies | Upgrade `firebase-admin` if compatible and rerun tests | `npm audit`, `npm test`, deploy dry run | Medium | Dependency compatibility |

## Final Verification Checklist

- Run Firebase Emulator tests for Firestore and Storage allow/deny cases.
- Test anonymous, non-`@nptel.com`, staff, hardcoded admin email, and `admin == true` custom claim behavior.
- Attempt unauthorized direct Firestore reads/writes to leads, analytics, public content writes, serverControls, and unknown collections.
- Test stored-XSS payloads in CMS URL/text fields.
- Test image/data URL handling and oversized CMS image data.
- Run secret scan for private keys/service accounts/tokens.
- Run `npm audit --omit=dev` in `functions`.
- Run production build/generation scripts and inspect generated blog HTML.
- Verify deployed security headers and CSP syntax.
- Test Cloud Function rate limits, duplicate suppression, App Check rejection, and honeypot behavior.
- Verify Firebase project selection before deployment.

