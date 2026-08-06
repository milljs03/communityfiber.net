# Validation Report: Blog JSON-LD Script Breakout

Rubric:
- [x] Source is a supported content input: `content/posts/*.json` is consumed by the build script.
- [x] The build script serializes attacker-controlled content into a script context.
- [x] The serialization does not escape HTML parser terminators such as `</script`.
- [x] The generated output is public HTML under `public/blog/*.html` and `public/blog.html`.
- [x] Preconditions are narrower than the live CMS path: attacker needs write access to source content or the build content pipeline.

Validation method: local Node PoC for `JSON.stringify()` inside an HTML script element plus static tracing.

Evidence observed:
- `scripts/build-posts.js:168` embeds article JSON-LD with `JSON.stringify(jsonLd, null, 2)`.
- `scripts/build-posts.js:287` embeds blog-index JSON-LD with `JSON.stringify(jsonLd, null, 2)`.
- `validatePost()` checks required fields and slug shape at `scripts/build-posts.js:35-49`, but does not reject or encode script-breaking strings in titles/descriptions/images.
- PoC with value `</script><script>console.log(1)</script>` produced `<script type="application/ld+json">{"headline":"</script><script>console.log(1)</script>"}</script>`.

Disposition: reportable.

Confidence: high for build-time generated HTML behavior; medium for attacker reachability because repository evidence shows source-controlled JSON rather than a public editor workflow.

Remaining uncertainty: who can edit `content/posts/*.json` in production workflow is outside the repository.

