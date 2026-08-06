# Validation Report: Blog CTA Unsafe Href Scheme

Rubric:
- [x] Source is a supported content input: CTA blocks are documented in `content/posts/README.md`.
- [x] The value reaches an anchor `href` in generated public HTML.
- [x] The existing control escapes attribute metacharacters but does not validate URL scheme.
- [x] A dangerous `javascript:` URL remains active after escaping.
- [x] Preconditions are narrower than public CMS: attacker needs source content or build-content pipeline access.

Validation method: local Node PoC for `escapeAttr()` behavior plus static tracing.

Evidence observed:
- `scripts/build-posts.js:102` renders `<a href="${escapeAttr(block.href)}">`.
- `content/posts/README.md:21` documents CTA `href`.
- `validatePost()` does not validate CTA URL schemes.
- PoC with `javascript:alert(1)` produced `<a href="javascript:alert(1)">CTA</a>`.

Disposition: reportable.

Confidence: high for generated unsafe link behavior; medium for attacker reachability because repository evidence shows source-controlled JSON rather than a public editor workflow.

Remaining uncertainty: who can edit `content/posts/*.json` in production workflow is outside the repository.

