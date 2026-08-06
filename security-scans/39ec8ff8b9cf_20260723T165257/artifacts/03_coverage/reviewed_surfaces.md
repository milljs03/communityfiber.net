# Reviewed Surfaces

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

