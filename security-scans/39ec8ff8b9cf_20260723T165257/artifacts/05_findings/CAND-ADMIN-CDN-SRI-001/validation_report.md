# Validation Report: Admin CDN Script Without SRI

Rubric:
- [x] The admin page loads an external executable script.
- [x] The script runs in the privileged admin origin.
- [x] The URL is not locally vendored, version-pinned to an immutable asset, or protected by SRI.
- [ ] Repository evidence does not show an actual CDN/package compromise.
- [ ] No attacker-controlled repository input selects the script URL.

Validation method: static HTML/config inspection.

Evidence observed:
- `public/admin.html:337` loads `https://cdn.jsdelivr.net/npm/chart.js`.
- `public/admin.html:11` permits `https://cdn.jsdelivr.net` in `script-src`.

Disposition: suppressed as a confirmed vulnerability; retain as defense-in-depth hardening.

Confidence: high for hardening gap, none for active exploit in current repository state.

Remaining uncertainty: none material for suppression; exploitability would require compromise or unexpected behavior outside the repository.

