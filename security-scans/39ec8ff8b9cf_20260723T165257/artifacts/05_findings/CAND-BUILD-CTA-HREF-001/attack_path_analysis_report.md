# Attack Path: Blog CTA Unsafe Href Scheme

Final policy decision: report.

Severity: Low / P3.

Affected locations:
- root_control/sink: `scripts/build-posts.js:102`
- source documentation: `content/posts/README.md:21`
- source example: `content/posts/what-internet-speed-do-i-need.json:61`

Attack path:
1. An attacker gains the ability to alter a blog post CTA block in `content/posts/*.json`.
2. They set `href` to a dangerous URL such as `javascript:alert(1)`.
3. `renderBlock()` escapes HTML attribute metacharacters but does not validate the URL scheme.
4. The generated public article contains an active `javascript:` link.
5. A visitor must click the generated CTA for script execution.

Attack-path facts:
- In scope: yes. Build-time blog content rendering is part of public content rendering.
- Exposure: public generated article pages.
- Vector: remote user interaction, after content-source modification.
- Auth scope: source/editor write precondition.
- Cross-boundary behavior: yes, but click interaction is required.
- Existing mitigations: attribute escaping prevents quote-breakout; only scheme validation is missing.
- Counterevidence: current checked-in CTA values are safe relative URLs; no public editor for JSON files is shown.
- Confidence: high for unsafe generated link behavior, medium for attacker reachability.

Severity calibration:
- Impact: medium.
- Likelihood: medium/low because it needs content-write access and victim click.
- Final severity: Low.

