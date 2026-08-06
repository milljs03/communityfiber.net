# Threat Model

## Product Surfaces

This repository is a Firebase-hosted public website for Community Fiber with a browser-rendered marketing site, public lead forms, a client-side administrative CMS, Cloud Firestore content storage, Firebase Authentication for staff/admin access, Firebase App Check on callable HTTP functions, Firebase Hosting rewrites to Cloud Functions, and a Resend email integration. Firebase Storage is configured but currently denied by rules; CMS image uploads are compressed into data URLs and stored in Firestore documents rather than uploaded to Storage.

## Protected Assets

- Lead submissions containing names, emails, phone numbers, addresses, account numbers, and service/support details.
- Traffic analytics pageview records and session identifiers.
- CMS-controlled website content, plans, neighborhoods, installation steps, employee profiles, testimonials, news, business logos, promotions, outage/banner settings, and publication state.
- Administrative capability to create, edit, publish, or delete public content and settings.
- Firebase project configuration and rule boundaries for project `communityfiber-net` / app id `162296779236`.
- Cloud Function privileged access through the Firebase Admin SDK.
- Resend API key stored as a Cloud Functions secret.
- Production hosting configuration, security headers, and rewrites.

## User Roles

- Anonymous public visitors can read the hosted website, fetch public CMS collections, submit lead forms, and trigger pageview logging endpoints.
- Authenticated `@nptel.com` users are staff viewers in the admin UI and can read leads and analytics if Firestore rules accept their verified email domain.
- The hardcoded email `jmiller@nptel.com` and users with a Firebase custom claim `admin == true` are administrators allowed by Firestore rules to write public CMS collections and settings.
- Cloud Functions run with Firebase Admin SDK privileges and can write lead, analytics, duplicate-suppression, and rate-limit documents independent of client rules.

## Trust Boundaries

- Browser/client code is untrusted. Hiding admin controls or setting `isAdmin` in `public/assets/js/admin.js` is only a UX control; Firestore rules are the authoritative authorization boundary for direct database writes.
- Firebase Authentication ID tokens and custom claims are trusted only after verified by Firebase rules or Cloud Functions runtime. Client-side user email checks are not sufficient by themselves.
- Firestore rules separate public display collections from staff-only submissions/analytics and server-only control collections.
- Cloud Functions accept attacker-controlled HTTP JSON bodies from public forms and must enforce CORS, App Check, method checks, input validation, rate limiting, duplicate suppression, and safe outbound email rendering.
- CMS content read from Firestore is attacker-influenced by anyone who can gain admin write access and must be escaped or URL-sanitized before rendering in public pages.
- External embeds and redirects, including Google Maps, SmartHub, OpenSpeedTest, and NPTech/fiber-service-query domains, leave the application trust boundary.
- Build scripts transform local JSON content into static HTML and must escape generated HTML and URLs.

## Public Entry Points

- Firebase Hosting static HTML, CSS, JavaScript, images, blog pages, city pages, and generated content.
- `/api/submitLead` Cloud Function rewrite for support, business quote, and builder inquiry submissions.
- `/api/logPageView` Cloud Function rewrite for traffic logging.
- Firestore client reads for public display collections and admin reads for leads/analytics.
- Firebase Auth Google sign-in in `admin.html`.
- Public links and address lookup redirects to external domains.
- CMS image file inputs that store compressed `data:image/*` URLs in Firestore.

## Security Objectives

- Anonymous users must not read leads, analytics, server control documents, drafts/private data, admin metadata, or arbitrary Firestore collections.
- Non-admin authenticated users must not write public content, settings, leads, analytics, role data, or server controls.
- Client-side CMS authorization must be backed by Firestore rules or trusted server checks.
- Lead and analytics endpoints must not be usable for unbounded spam, email abuse, financial abuse, or Firestore write amplification.
- CMS-controlled text, links, images, and rich display fields must not execute script or create unsafe redirects.
- Secrets and privileged Firebase Admin SDK credentials must not be committed or shipped to the browser.
- Production deployment must enforce HTTPS, restrictive headers, and the intended Firebase project/rules.

## Likely Attacker Profiles

- Anonymous internet user submitting crafted forms, high-volume traffic, or direct HTTP requests to Cloud Functions.
- Authenticated but non-admin staff user attempting direct Firestore writes or access beyond staff read scope.
- Compromised admin account or malicious admin storing active content, unsafe links, large data URLs, or misleading public content.
- Automated bot abusing public forms, analytics logging, App Check gaps, or expensive Firestore writes.
- External third-party service compromise affecting embedded widgets, CDN scripts, email delivery, analytics, or map scripts.

## Highest-Risk Abuse Cases

- Direct Firestore writes to CMS collections if rules are too broad or rely on client UI checks.
- Unauthorized reads of leads or analytics through collection-group, nested collection, or wildcard rule mistakes.
- Stored XSS through CMS-managed fields rendered via `innerHTML` or inserted into `href`/`src` attributes.
- Email/form spam or Firestore billing abuse through public Cloud Functions.
- Unsafe upload/content paths allowing SVG/HTML/script execution or oversized Firestore documents.
- Public deployment accidentally using emulator/test settings, permissive rules, stale admin claims, or committed privileged credentials.

Repository: local:C:\Users\JosiahMiller\communityfiber.net
Version: 39ec8ff8b9cf