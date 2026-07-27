# Breezyfin Quality Tooling Notes

Last reviewed: 2026-07-12.

This document records the current lint/test/audit posture and the evidence-backed adoption path for external quality tools. It is intentionally practical: only add a tool when it covers a real gap without fighting Enact, React, webOS packaging, or the existing custom audits.

## Current Source Surface

- App JavaScript/React source is linted through `npm run lint`, which delegates to the lockfile-controlled Enact CLI and the repository's React 18-aware ESLint configuration.
- Enact builds use the CLI's supported `--no-linting` option only to avoid CLI 7's embedded React 19 compiler-rule configuration. Standalone lint remains mandatory before builds and is enforced by CI/release workflows.
- Unit tests run through `npm run test -- --watch=false --runInBand`.
- Repository-specific checks run through `npm run audit`.
- Current app-owned style surface is large: `src/` contains 207 CSS/LESS files.
- Current app-owned JS surface is large: `src/` contains 246 JS/JSX files.
- Rendered integration tests use Testing Library through `src/testUtils/renderWithBreezyfin.js`, which installs the Breezyfin Sandstone theme and Spotlight root. Prefer pure view-model/helper seams for isolated policy coverage, then use rendered tests for Popup lifecycle, Spotlight focus, and virtual-grid contracts.

## Current Custom Audit Coverage

The custom audit suite covers repo-specific invariants that generic tools do not understand well:

- documentation path and npm-script drift
- targeted audit script wiring drift
- command path drift
- panel and hook documentation drift
- release metadata drift
- runtime debug statement leaks
- portability/privacy leaks
- sensitive runtime logging and raw playback URL logging
- private references, backup artifacts, and test-media names outside intentional README attribution
- production Enact/React generation drift
- generated third-party notice drift
- Jellyfin service-boundary violations
- local import cycles
- advisory file/function hotspot metrics and checked-in baseline growth
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

`npm run audit:hotspots` parses application source with the explicitly pinned
`@babel/parser` dependency and reports file growth plus function length, complexity,
and nesting against `scripts/code-audit/hotspot-baseline.json`. Metric growth is
informational and must not be treated as a correctness failure. The audit fails only
when source parsing or baseline validation fails. Refresh the baseline deliberately
after review with `npm run audit:hotspots:update`.

## Runtime Diagnostics Performance Contract

- `Enable Diagnostics` defaults off and is the runtime authority for optional overlays, console capture, playback request/decision snapshots, source summaries, runtime diagnostic state, performance counters, and full subtitle canvas/layout sampling.
- Build flags only control persistent-logging capability. They must not silently activate diagnostics in stable, develop, CI, or local production bundles.
- Critical AppCrashBoundary render/global/unhandled-rejection records bypass the runtime master but still respect the absolute persistent-logging disable flag.
- Correctness paths remain active with Diagnostics off: recovery, HLS classification, subtitle readiness/fallback policy, and the bounded external-renderer empty-output watchdog.
- Tests that assert optional diagnostic snapshots must pass `enableDiagnostics: true`. Tests for normal production behavior should verify those snapshots remain empty or null by default.
- Performance measurements are valid only after confirming Diagnostics is off, or when intentionally comparing Diagnostics off/on. The Performance Overlay calibrates 30/60 Hz cadence and reports estimated missed refreshes separately from next-frame input delay.

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

Production dependency security is a release gate; build-tool advisories remain a separately documented review input.

Evidence:

- Axios `^1.18.1` is now an explicit runtime dependency and satisfies the Jellyfin SDK peer dependency. Its required `follow-redirects` and `form-data` chain is also resolved to non-vulnerable versions in the lockfile.
- `npm audit --omit=dev --audit-level=high` currently passes with no production vulnerabilities.
- Findings from an unscoped `npm audit`, including current high-severity
  `brace-expansion`, `fast-uri`, and `js-yaml` reports, are confined to the nested Enact
  CLI build-tool chain and are not part of the packaged application.
- Enact CLI's tarball contains undeclared nested `@enact/dev-utils` tooling. The lockfile
  marks those extraneous entries as development-only so `--omit=dev` reflects their real
  ancestor; preserve that metadata when refreshing the lockfile. Range-scoped overrides
  keep normal dependency paths on patched releases without changing Enact generations.
- Running `npm audit fix` blindly is too risky for this app because Enact/webOS packaging, Sandstone behavior, and production minification have all been regression-sensitive.

Recommended adoption path:

1. Keep `npm audit --omit=dev --audit-level=high` in the release gate.
2. Review CLI-only advisories separately and never apply broad automatic fixes to the Enact toolchain.
3. Prefer safe direct upgrades, documented overrides/resolutions, or upstream tracking over forced transitive replacements.
4. Re-evaluate the CLI findings as part of the future Enact 5/Limestone/React 19 compatibility investigation.

## Release Supply-Chain Checks

- `npm run audit:runtime-deps` validates the production closure remains on Enact 4, Sandstone 2, and React 18 without mixed runtime generations.
- `npm run audit:licenses` validates the generated `THIRD_PARTY_NOTICES.txt`, including copied subtitle-engine and Museo font licenses.
- `npm run audit:private-refs` rejects external-client implementation references, private test-media names, and backup artifacts outside intentional README attribution.
- `npm run report:package-size` groups packaged bytes into app bundles, iLib, subtitle engines, fonts, source maps/declarations, and other files.
- Production packages omit subtitle-engine declarations and source maps; develop packages retain useful source maps for diagnostics.
