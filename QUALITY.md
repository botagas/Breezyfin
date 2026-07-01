# Breezyfin Quality Tooling Notes

Last reviewed: 2026-06-23.

This document records the current lint/test/audit posture and the evidence-backed adoption path for external quality tools. It is intentionally practical: only add a tool when it covers a real gap without fighting Enact, React, webOS packaging, or the existing custom audits.

## Current Source Surface

- App JavaScript/React source is linted through `npm run lint`, which delegates to `enact lint .`.
- Unit tests run through `npm run test -- --watch=false --runInBand`.
- Repository-specific checks run through `npm run audit`.
- Current app-owned style surface is large: `src/` contains 207 CSS/LESS files.
- Current app-owned JS surface is large: `src/` contains 246 JS/JSX files.
- Component-rendering tests are not currently a standard pattern in the repo. Prefer extracting pure view-model/helper seams for behavior coverage. Consider adding a renderer dependency such as Testing Library or React Test Renderer.

## Current Custom Audit Coverage

The custom audit suite covers repo-specific invariants that generic tools do not understand well:

- documentation path and npm-script drift
- targeted audit script wiring drift
- command path drift
- panel and hook documentation drift
- release metadata drift
- runtime debug statement leaks
- portability/privacy leaks
- Jellyfin service-boundary violations
- local import cycles
- hotspot growth ceilings
- dead CSS module class candidates
- local style import drift
- JS/JSX local style entrypoint import drift
- style reachability/orphan file drift
- LESS-aware Stylelint correctness checks
- CSS custom-property reference drift
- raw CSS color baseline growth
- raw JS color literals
- cross-file duplicate snippets

Keep these checks even if external tools are added. External tools should supplement these repo-specific tests, not replace them without a measured comparison.

## External Tool Evaluation

### JSCPD

Integrated as a broad duplicate-analysis gate alongside the custom duplicate audit.

Evidence:

- JSCPD describes itself as a copy/paste detector and advertises broad multi-format support plus CLI/reporting modes: https://github.com/kucherenko/jscpd
- Breezyfin already has a blocking custom duplicate audit that is tuned to this codebase and currently passes. Keep it because it reports repo-specific snippet locations and normalizes source differently from JSCPD.
- Most initial findings were audit-script scaffolding that `audit:duplicates` intentionally does not scan. Common path, file-walk, comment-stripping, location, and import-reference helpers now live in `scripts/audit-utils/files.cjs`.
- `npm run audit:jscpd` now runs the checked-in `.jscpd.json` config against `src` and `scripts` with a zero-duplicate threshold. It is also part of `npm run audit`.
- A zero-clone gate is useful evidence, but it should not justify awkward rewrites if a future finding is intentional or better handled by a higher-level API change.

Maintenance path:

1. Inspect JSCPD findings as normal refactor candidates before changing code.
2. Prefer extracting real helpers, improving shared APIs, or adjusting the JSCPD config over reshaping code only to appease the report.
3. Keep `audit:duplicates` and `audit:jscpd` together unless measured evidence shows one has become redundant.

### Stylelint

Integrated as a focused CSS/LESS correctness gate.

Evidence:

- Stylelint states that no rules are enabled by default; a config is required: https://stylelint.io/user-guide/configure/
- Stylelint supports configuration, rule extension, plugins, and syntax customization/reference-file support for non-plain CSS inputs.
- Breezyfin uses CSS Modules, LESS imports, Enact/Sandstone `:global(...)`, compatibility split files, and token-driven themes. A generic config is likely to report false positives unless it is tuned.
- `npm run audit:stylelint` now runs the checked-in `stylelint.config.cjs` config. It intentionally avoids opinion-heavy formatting rules.

Maintenance path:

1. Keep generated/build outputs ignored and keep compatibility files in scope.
2. Add rules gradually only when they catch real bugs with low false-positive risk.
3. Keep existing `audit:style-imports`, `audit:style-entries`, `audit:style-reachability`, `audit:style-tokens`, and `audit:styles`; Stylelint does not replace those repo-specific checks.
4. If a Stylelint rule fights an intentional webOS/Sandstone pattern, prefer narrowing the rule or documenting the exception instead of reshaping code awkwardly.

### Dependency Security Auditing

Useful as an explicit review input, but not ready for the standard `npm run audit` gate.

Evidence:

- Current findings are not concentrated in the newly added quality tools. They primarily come from the Enact CLI/build-tool chain and the runtime `@jellyfin/sdk` Axios chain (`axios`, `follow-redirects`, and `form-data`).
- A failing security audit would currently block every normal quality run without a validated remediation path.
- Running `npm audit fix` blindly is too risky for this app because Enact/webOS packaging, Sandstone behavior, and production minification have all been regression-sensitive.

Recommended adoption path:

1. Triage runtime dependency findings first, especially the Jellyfin SDK / Axios chain, because they ship with the app bundle.
2. Triage Enact CLI/build-tool findings separately from runtime findings; many are build-time only but still matter for CI and developer machines.
3. Prefer safe direct upgrades, documented overrides/resolutions, or upstream tracking over broad automatic fixes.
4. Add a dedicated security-audit gate only after the remaining findings are either resolved, accepted with rationale, or separated into runtime/build-time thresholds.
