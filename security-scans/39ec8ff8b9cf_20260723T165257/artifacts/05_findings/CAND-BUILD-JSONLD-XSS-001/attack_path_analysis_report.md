# Attack Path: Blog JSON-LD Script Breakout

Final policy decision: report.

Severity: Medium / P2.

Affected locations:
- root_control/sink: `scripts/build-posts.js:168`
- root_control/sink: `scripts/build-posts.js:287`
- source example: `content/posts/business-fiber-internet-guide.json:3`

Attack path:
1. An attacker gains the ability to alter `content/posts/*.json` or another supported build-content input.
2. They place `</script><script>...</script>` in a JSON-LD-bearing field such as title or description.
3. `scripts/build-posts.js` builds public HTML and embeds `JSON.stringify(...)` directly in `<script type="application/ld+json">`.
4. The browser HTML parser treats the literal `</script>` as the end of the JSON-LD script, then parses the injected script as active markup.
5. Visitors to the generated blog page execute injected JavaScript in the Community Fiber origin.

Attack-path facts:
- In scope: yes. Build scripts and CMS/content rendering are included in the requested audit scope.
- Exposure: public generated blog pages after a build/deploy.
- Vector: remote for visitors, but content-write precondition is source/build pipeline access.
- Auth scope: developer/editor-controlled source content, not anonymous runtime input.
- Cross-boundary behavior: yes when editorial content is treated as data but enters a script context.
- Existing mitigations: body and meta text fields use HTML escaping; slug validation exists.
- Counterevidence: current checked-in JSON does not contain a malicious payload, and the repository does not prove non-developer editors can change these JSON files. This limits likelihood.
- Confidence: high for the generated HTML behavior, medium for attacker reachability.

Severity calibration:
- Impact: high if triggered because it is stored first-party script execution.
- Likelihood: unknown/medium due to source-content access precondition.
- Final severity: Medium.

