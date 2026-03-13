# Breezyfin AI Contributor Guide (AGENTS)

This file is for AI-assisted contributors working in this repository.
It defines how to make changes safely, consistently, and in line with Breezyfin conventions.

If this file conflicts with direct user instructions in a task, follow the user request and note the tradeoff.

## 1) Scope and intent

You are contributing to a production webOS TV app with strong focus, playback, and theme constraints.
Optimize for:

1. correctness on real TV behavior (5-way and pointer)
2. maintainability (reuse existing helpers/hooks/components)
3. consistency with token-driven styling and panel/service decomposition
4. low regression risk and explicit verification

## 2) Required reading before edits

Read these docs before substantial work (in this order):

1. `README.md` (feature surface and runtime diagnostics context)
2. `DEVELOPING.md` (core architecture conventions)
3. `HELPERS.md` (reuse map; shared hooks/helpers inventory)
4. `THEMES.md` (theme/runtime-attribute/compat rules)
5. `COMPONENTS.md` and `VIEWS.md` (shared vs panel-local boundaries)
6. `CHECKS.md` and `TODOS.md` (verification + current priorities)

## 3) Repository operating model

### 3.1 App and views

- Top-level panel orchestration lives in `src/App/`.
- Major views live in `src/views/<Panel>.js`.
- Complex panel behavior should be decomposed into:
  - `src/views/<panel-name>/components/`
  - `src/views/<panel-name>/hooks/`
  - `src/views/<panel-name>/utils/`

### 3.2 Services

- `src/services/jellyfinService.js` is a thin facade.
- Domain logic belongs in `src/services/jellyfin/*` modules.
- Avoid growing the facade with heavy business logic.

### 3.3 Styling and themes

- Theme tokens live in:
  - `src/styles/themes/classic.css`
  - `src/styles/themes/elegant.css`
- Global shared behavior/tokens live in `src/global.css`.
- Shared popup skin lives in `src/styles/popupStyles.module.less`.
- Shared card/status primitives live in `src/styles/cardStyles.less`.
- Compatibility rules must stay in compat files (for example `*-compat-webos6.less`, `*-compat-webos22.less`).

## 4) Reuse-first policy (mandatory)

Before creating new abstractions, check existing shared building blocks from `HELPERS.md`.
Common required defaults:

- scroll memory: `usePanelScrollState`
- panel back wiring: `usePanelBackHandler`
- toolbar + layered back flow: `usePanelToolbarActions`
- popup/menu state: `useDisclosureMap` (+ `useDisclosureHandlers` where helpful)
- popup first focus: `usePopupInitialFocus`
- settings sync: `useBreezyfinSettingsSync`
- image fallback: `useImageErrorFallback`

Do not add duplicate hooks/helpers for behavior already covered by shared modules unless there is a clear, task-specific constraint.

## 5) Hard conventions

### 5.1 Focus/input behavior

- All focusable interactions must behave in both `5way` and `pointer` modes.
- Do not rely on hover-only affordances for critical actions.
- Popups should autofocus first actionable item on open via `usePopupInitialFocus`.
- In Media Details, keep first-section focus playback-first (`Audio -> Subtitle -> Play`) and avoid automatic Favorite/Watched focus fallback.
- Preserve layered back behavior:
  1. close local disclosure(s)
  2. run toolbar/panel-local back handler
  3. fallback to panel/app navigation

### 5.2 Styling discipline

- Prefer tokenized colors/surfaces; avoid introducing raw colors in panel/component styles when an existing token can be used.
- Keep compatibility patches isolated to compat files.
- Reuse shared badge/button/popup primitives instead of one-off clones.
- Keep comments minimal; only document non-obvious constraints/tradeoffs.

### 5.3 Architecture boundaries

- Keep panel orchestrators from regrowing after decomposition.
- Keep side-effect-heavy flows in dedicated hooks.
- Keep presentational fragments in panel-local components.
- Keep pure derivations/utilities in `utils/`.

## 6) Change planning and execution

For non-trivial work:

1. map the existing flow first (files, hooks, style ownership)
2. identify reuse opportunities
3. prefer small, behavior-preserving refactors
4. implement changes in cohesive slices (logic + styles + tests/docs together where applicable)
5. validate with commands from `CHECKS.md`

Avoid broad refactors unless explicitly requested.

## 7) Verification gates

Minimum gate before handoff:

1. `npm run lint`
2. `npm run pack`

Standard gate for functional changes (recommended default):

1. `npm run lint`
2. `npm run test -- --watch=false --runInBand`
3. `npm run audit:styles`
4. `npm run audit:style-tokens`
5. `npm run audit:duplicates`
6. `npm run pack`

Release-oriented gate:

1. `npm run lint`
2. `npm run test -- --watch=false --runInBand`
3. `npm run audit:styles`
4. `npm run audit:style-tokens`
5. `npm run audit:duplicates`
6. `npm run pack-p`

If any gate is skipped, state exactly what was skipped and why.

## 8) Docs maintenance policy

When changes affect architecture or shared behavior, update docs in the same task:

- Added/changed shared hook/helper/utility: update `HELPERS.md`
- Changed architectural conventions: update `DEVELOPING.md`, `COMPONENTS.md`, or `VIEWS.md`
- Changed theme/token/compat behavior: update `THEMES.md`
- Completed planned work: update `TODOS.md`
- Added recurring validation for completed work: update `CHECKS.md`

Rule from repo docs:

- `TODOS.md` = unfinished/planned work only.
- `CHECKS.md` = recurring validation/test runbooks (added after related TODO completion).

## 9) Areas requiring extra caution

1. Playback path selection (DirectPlay/DirectStream/Transcode, DV/HDR fallbacks).
2. Subtitle burn-in behavior (quality-first defaults, HDR/DV-specific logic).
3. Focus chains in Media Details and Player.
4. Popup behavior and first-focus correctness.
5. webOS 6 / legacy compatibility rules.
6. Runtime capability probing/cache behavior in `src/utils/platformCapabilities.js` and `src/utils/platform-capabilities/*`.

For these areas, include explicit manual test notes in the handoff.

## 10) AI handoff format (required)

When finishing work, provide:

1. what changed (behavior-level summary, not only file list)
2. verification commands run and pass/fail status
3. known risks or follow-up checks
4. docs updated (if any)

Use absolute file paths when referencing edited files.

## 11) Anti-patterns to avoid

- Duplicating existing helpers/hooks instead of reusing documented shared ones.
- Mixing compat rules into base style files.
- Adding panel-specific one-off versions of shared primitives (toasts/loading/popup shells/status badges) without clear need.
- Growing `jellyfinService.js` with domain logic that belongs in `src/services/jellyfin/*`.
- Leaving feature behavior undocumented when it changes shared architecture or conventions.
