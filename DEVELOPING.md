# Developing Breezyfin

This document is the detailed developer guide for architecture patterns, shared building blocks, styling conventions, and panel decomposition.

## Core principles

- Reuse existing shared hooks/components before introducing new abstractions.
- Keep panel logic modular with panel-local `components/`, `hooks/`, and `utils/` folders.
- Keep styling token-driven and theme-consistent.
- Keep Media Details initial/forced focus playback-first (`Audio -> Subtitle -> Play`) and avoid Favorite/Watched as automatic fallback targets; directional LEFT/RIGHT order may continue through `Favorite -> Watched` after Play when those actions are available.
- Keep comments minimal; only document non-obvious constraints, tradeoffs, or behavior.

## Related docs

- [`README.md`](./README.md)
- [`QUALITY.md`](./QUALITY.md)
- [`HELPERS.md`](./HELPERS.md)
- [`THEMES.md`](./THEMES.md)
- [`COMPONENTS.md`](./COMPONENTS.md)
- [`VIEWS.md`](./VIEWS.md)
- [`CHECKS.md`](./CHECKS.md)
- [`TODOS.md`](./TODOS.md)

## Verification and audits

Use [`CHECKS.md`](./CHECKS.md) as the single source of truth for recurring validation and release gates.
After stable `npm run pack-p`, `ares-package dist` is the final webOS CLI smoke check to confirm the production `dist/` can be packaged into an IPK.
For develop/non-stable packaging validation, run `REACT_APP_ENABLE_PERSISTENT_LOGS=1 REACT_APP_RELEASE_CHANNEL=develop npm run pack-p`, then immediately run `ares-package dist` against that flagged `dist/`.

Quick quality audit command:

- `npm run audit` (runs all repository audit scripts)

Targeted audit commands:

- `npm run audit:docs` (missing concrete repo path references in docs)
- `npm run audit:script-refs` (stale `npm run ...` references in docs/workflows)
- `npm run audit:audit-scripts` (targeted audit scripts missing from the aggregate audit or developer docs)
- `npm run audit:command-paths` (stale source-local file paths in package/workflow commands)
- `npm run audit:view-docs` (decomposed panel directories missing from view/developer architecture docs)
- `npm run audit:helper-docs` (shared and panel-local hook files missing from helper/developer docs)
- `npm run audit:metadata` (release-critical `package.json` / `package-lock.json` / `appinfo.json` drift)
- `npm run audit:runtime-debug` (leftover `console.log`, `console.debug`, or `debugger` in app source)
- `npm run audit:portability` (machine-specific paths and unredacted token literals)
- `npm run audit:service-boundaries` (direct Jellyfin API/request-module imports outside services/tests)
- `npm run audit:import-cycles` (local circular imports in production app source)
- `npm run audit:hotspots` (large-file and complexity-marker hotspots, with conservative growth ceilings)
- `npm run audit:styles` (dead CSS module candidates)
- `npm run audit:style-imports` (stale local LESS/CSS `@import` references)
- `npm run audit:style-entries` (stale local CSS/LESS imports from JS/JSX entrypoints)
- `npm run audit:style-reachability` (orphaned CSS/LESS files not reachable from production JS style entrypoints)
- `npm run audit:stylelint` (LESS-aware CSS correctness checks in `stylelint.config.cjs`)
- `npm run audit:style-vars` (unresolved CSS custom property references without explicit fallbacks)
- `npm run audit:style-tokens` (raw color usage outside token declarations, with a baseline guard against new/increased raw colors)
- `npm run audit:js-colors` (raw color literals in JS outside explicit dynamic subtitle color parsing)
- `npm run audit:duplicates` (blocking cross-file duplicate snippet regression gate)
- `npm run audit:jscpd` (broad JSCPD duplicate-analysis gate using `.jscpd.json`)

Audit results are decision inputs, not style targets. If an audit flags an intentional helper/component pattern, improve the shared API or audit rule instead of reshaping code only to make the report disappear.

## Shared building blocks (prefer these first)

- Back handling: `src/hooks/usePanelBackHandler.js`
- Input mode sync (`pointer`/`5way`): `src/hooks/useInputMode.js`
- Popup/menu state: `src/hooks/useDisclosureMap.js`
- Popup/menu handler map: `src/hooks/useDisclosureHandlers.js`
- Popup first-action focus-on-open helper: `src/hooks/usePopupInitialFocus.js`
- Map lookups by id/key: `src/hooks/useMapById.js`
- Item metadata fetch/state: `src/hooks/useItemMetadata.js`
- Toast lifecycle: `src/hooks/useToastMessage.js`
- Shared toast UI primitive (Player/Media Details/Settings): `src/components/BreezyToast.js`
- Track preference persistence: `src/hooks/useTrackPreferences.js`
- Image fallback handling: `src/hooks/useImageErrorFallback.js`
- App panel history snapshots: `src/App/hooks/usePanelHistory.js`
- App panel back handler registry: `src/App/hooks/usePanelBackHandlerRegistry.js`
- Login rotating backdrop orchestration: `src/views/login-panel/hooks/useLoginBackdrops.js`
- Runtime platform/playback capability detection + cache controls: `src/utils/platformCapabilities.js` (+ decomposed internals in `src/utils/platform-capabilities/`)
- Runtime image format preference + fallback helpers: `src/utils/imageFormat.js`
- Player remote/media-key handler: `src/views/player-panel/hooks/usePlayerKeyboardShortcuts.js`
- Player controls-visibility synchronization: `src/views/player-panel/hooks/usePlayerVisibilitySync.js`
- Player wheel/pointer-edge controls reveal: `src/views/player-panel/hooks/usePlayerInteractionReveal.js`
- Player video load/session orchestration: `src/views/player-panel/hooks/usePlayerVideoLoader.js`
- Player playback option/session-context derivation: `src/views/player-panel/hooks/usePlayerPlaybackContext.js`
- Player skip/prompt state machine: `src/views/player-panel/hooks/usePlayerSkipOverlayState.js`
- Player seek/track-switch flow: `src/views/player-panel/hooks/usePlayerSeekAndTrackSwitching.js`
- Player track-popup click handlers: `src/views/player-panel/hooks/usePlayerTrackPopupHandlers.js`
- Player play/pause/retry/end command handlers: `src/views/player-panel/hooks/usePlayerPlaybackCommands.js`
- Player stop/focus control handlers: `src/views/player-panel/hooks/usePlayerCoreControls.js`
- Player layered back navigation decisions: `src/views/player-panel/hooks/usePlayerBackNavigation.js`
- Player audio/subtitle popup disclosure wiring: `src/views/player-panel/hooks/usePlayerDisclosures.js`
- Player adjacent-episode checks and progress ticker: `src/views/player-panel/hooks/usePlayerEpisodeProgress.js`
- Player media event callbacks: `src/views/player-panel/hooks/usePlayerMediaEventHandlers.js`
- Player episode/surface interaction handlers: `src/views/player-panel/hooks/usePlayerEpisodeAndSurfaceHandlers.js`
- Player recovery/fallback handlers: `src/views/player-panel/hooks/usePlayerRecoveryHandlers.js`
- Player lifecycle effects: `src/views/player-panel/hooks/usePlayerLifecycleEffects.js`
- Smart/manual subtitle burn-in policy: `src/services/jellyfin/playbackSelection.js` (`getSubtitleTranscodePolicy`)
- Player client-side subtitle renderer/cue cache: `src/views/player-panel/hooks/usePlayerSubtitleRenderer.js`
- ASS/SSA renderer lifecycle: `src/views/player-panel/utils/subtitle-renderers/`; Breezyfin lightweight parsing is centered in `src/views/player-panel/utils/subtitleRendererAss.js` with focused helpers for alignment, colors, font size, origin/position, karaoke, clipping, common vector drawing paths, and `\t(...)` transform interpolation, including B-spline `s`/`p` conversion to SVG cubic paths and `\pbo` drawing baseline offsets. Breezyfin lightweight supports rectangular text/cue clips plus vector clip masks for SVG drawing cues, long-running overlapping cue lookup, and active-cue render ordering by ASS layer/source order. Breezyfin lightweight remains Auto, while libass, libass Manual Canvas, JASSUB, JASSUB Manual Canvas, ASS.js, and Burn-in are explicit experimental/manual renderer options available in every release channel for troubleshooting. The manual-canvas libass and JASSUB modes are diagnostic paths for separating video-attached timing issues from native-video canvas compositor issues. JASSUB's packaged default font, sourcemap source, and version-guarded webOS Canvas2D worker patch are prepared by `scripts/prepare-subtitle-package-assets.cjs` and `scripts/subtitle-assets/jassubCanvas2dPatch.cjs`; the Canvas2D patch is required because JASSUB's WebGL path is unreliable on webOS. libass workers, Breezyfin's fallback subtitle font, and external renderer chunks/assets are copied into `dist/` by `scripts/copy-subtitle-assets.cjs` after `npm run pack` / `npm run pack-p`. Stable and develop builds preserve the external renderer chunks, transpile ASS.js/JASSUB renderer chunks for webOS CLI packaging, validate marker-bearing development JASSUB chunks and minified production JASSUB chunks for the forced Canvas2D path, rename generated `chunk.jassub-worker.*.js` to `.worker`, patch the Webpack runtime to load that worker extension, and remove generated `chunk.em-pthread.*` files so `ares-package dist` does not minify unsupported worker syntax.
- Playback diagnostics: record optional probe/fallback outcomes via `src/services/jellyfin/playback-api/diagnostics.js` and expose them through PlayerPanel debug state instead of adding noisy user-facing toasts.
- Jellyfin subtitle fetch contract: `src/services/jellyfin/subtitleApi.js` returns structured event and raw text results for client-side rendering.
- Media details focus debug tracing: `src/views/media-details-panel/hooks/useMediaDetailsFocusDebug.js`
- Media details focus orchestration: `src/views/media-details-panel/hooks/useMediaDetailsFocusOrchestrator.js`
- Media details section snap/focus navigation orchestration: `src/views/media-details-panel/hooks/useMediaDetailsSectionNavigation.js`
- Media details watched/favorite actions: `src/views/media-details-panel/hooks/useMediaDetailsItemActions.js`
- Media details picker handlers: `src/views/media-details-panel/hooks/useMediaDetailsPickerHandlers.js`
- Media details interaction handlers: `src/views/media-details-panel/hooks/useMediaDetailsInteractionHandlers.js`
- Media details data loader: `src/views/media-details-panel/hooks/useMediaDetailsDataLoader.js`
- Media details DOM scroll/focus helper callbacks: `src/views/media-details-panel/hooks/useMediaDetailsDomHelpers.js`
- Media details overview overflow + play-label derivation: `src/views/media-details-panel/hooks/useMediaDetailsOverviewState.js`
- Media details panel sync effects: `src/views/media-details-panel/hooks/useMediaDetailsPanelSync.js`
- Media details per-item bootstrap effect: `src/views/media-details-panel/hooks/useMediaDetailsItemBootstrap.js`
- Media details staged loading reveal orchestration: `src/views/media-details-panel/hooks/useMediaDetailsStagedReveal.js`
- Settings sync listeners: `src/hooks/useBreezyfinSettingsSync.js`
- Settings runtime capability label derivation: `src/views/settings-panel/hooks/useRuntimeCapabilityLabels.js`
- Settings bootstrap loader/effects: `src/views/settings-panel/hooks/useSettingsBootstrap.js`
- Settings popup disclosure wiring: `src/views/settings-panel/hooks/useSettingsDisclosures.js`
- Settings home-row toggle/reorder handlers: `src/views/settings-panel/hooks/useSettingsHomeRows.js`
- Settings option selection handlers: `src/views/settings-panel/hooks/useSettingsOptionHandlers.js`
- Settings system/server/log/cache handlers: `src/views/settings-panel/hooks/useSettingsSystemHandlers.js`
- Settings boolean toggle/persistence handlers: `src/views/settings-panel/hooks/useSettingsToggleHandlers.js`
- Settings display/label/panel-back handlers: `src/views/settings-panel/hooks/useSettingsDisplayHandlers.js`
- Settings pure presentation decisions: `src/views/settings-panel/utils/settingsViewModel.js`

Preferred panel scroll cache wiring:
- `src/hooks/usePanelScrollState.js`
- `usePanelScrollState()` for normalized `scrollTop` state, `Scroller` restore/save wiring, and optional cache persistence.

Low-level scroll primitives (use only when panel behavior is custom):
- `src/hooks/useScrollerScrollMemory.js`
- `useScrollerScrollMemory()` for `Scroller` restore/save wiring.
- `useCachedScrollTopState()` for normalized cached `scrollTop` state.

Preferred panel toolbar/back wiring:
- `src/hooks/usePanelToolbarActions.js`

Shared toolbar low-level helpers:
- `src/hooks/useToolbarActions.js`
- `src/hooks/useToolbarBackHandler.js`

Preferred toolbar wiring pattern:
- Default to `usePanelToolbarActions()` for panel-level toolbar callbacks + layered back flow.
- Only use `useToolbarBackHandler()` + `useToolbarActions()` directly when panel behavior is custom.

Preferred panel scroll-state pattern:
- Use `usePanelScrollState()` for panel `Scroller` restore/save and cached `scrollTop` persistence.
- Only use `useScrollerScrollMemory()` directly when panel behavior is non-standard.

Other shared utilities:
- Reusable media-card overlays: `src/components/MediaCardStatusOverlay.js`
- Shared toolbar focus helper: `src/utils/toolbarFocus.js`
- Shared home row order constant: `src/constants/homeRows.js`
- Shared Jellyfin tick conversion constant: `src/constants/time.js`
- Shared panel toast timing preset: `src/constants/toast.js`
- Shared poster card class helper: `src/utils/posterCardClassProps.js`
- Shared integer parser helper: `src/utils/numberParsing.js`
- Shared DOM node debug descriptor helper: `src/utils/domNodeDescription.js`
- Crash-boundary recovery context/action helper: `src/utils/crashRecovery.js`
- Shared player view helpers: `src/views/player-panel/utils/playerPanelHelpers.js`
- Shared episode next/previous helpers: `src/views/player-panel/utils/episodeNavigation.js`
- Shared media details formatting/image helpers: `src/views/media-details-panel/utils/mediaDetailsHelpers.js`

## Panel decomposition conventions

Library panel decomposition paths:
- `src/views/library-panel/hooks/` (`useLibraryPagination`, `useLibraryScrollPersistence`)

Login panel decomposition paths:
- `src/views/login-panel/components/`
- `src/views/login-panel/hooks/`
- `src/views/login-panel/utils/`

Player panel decomposition paths:
- `src/views/player-panel/components/`
- `src/views/player-panel/hooks/`
- `src/views/player-panel/utils/`

Media details decomposition paths:
- `src/views/media-details-panel/components/`
- `src/views/media-details-panel/hooks/`
- `src/views/media-details-panel/utils/`

Settings panel decomposition paths:
- `src/views/settings-panel/components/`
- `src/views/settings-panel/hooks/`
- `src/views/settings-panel/` (constants, labels, and panel-local formatting helpers)

App shell decomposition paths:
- `src/App/hooks/` (`usePanelHistory`, `usePanelBackHandlerRegistry`)
- `src/App/utils/` (`panelStateCache`, `panelIndex`, `createPanelChildren`, `runtimeDataAttributes`)

Media details section components:
- `MediaCastSection`
- `MediaSeasonsSection`
- `MediaSeriesStickyControls`
- `MediaEpisodesSection`

## Service decomposition conventions

Jellyfin service paths:
- `src/services/jellyfinService.js` (public facade and shared request/auth failure handling)
- `src/services/jellyfin/sessionApi.js` (connect/auth/session restore/logout/server switching)
- `src/services/jellyfin/libraryApi.js` (library, item, search, favorites, system info, segments)
- `src/services/jellyfin/itemStateApi.js` (favorite/watched mutation operations)
- `src/services/jellyfin/playbackApi.js` (playback info, playback URLs, playback progress reporting)
- `src/services/jellyfin/playbackSelection.js` (media-source/audio selection and compatibility logic)
- `src/services/jellyfin/playbackProfileBuilder.js` (playback profile request context)
- `src/services/jellyfin/subtitleApi.js` (subtitle event/raw text fetch helpers for client-side rendering)
- `src/services/jellyfin/requestsApi.js` (plugin-first My Requests paging with bounded tag fallback)

Service rule:
- Keep `jellyfinService` as a thin orchestrator; move domain-specific behavior to `src/services/jellyfin/*` modules.

## Styling and theme references

- Theme tokens: `src/styles/themes/classic.css`, `src/styles/themes/elegant.css`
- Global shared tokens/classes (including shared error surfaces): `src/global.css`
- Shared popup surface styles: `src/styles/popupStyles.module.less`, `src/styles/popupStyles.js`
- Shared popup legacy compat overrides: `src/styles/popup-styles/_popup-styles-compat-webos6.less`
- Shared panel layout mixins: `src/styles/panelLayoutMixins.less`
- webOS compatibility mixins: `src/styles/compatMixins.less`
- Panel styling pattern: `src/views/*-panel-styles/` split files (base + per-theme + shared tail)

Status badge convention:
- Reuse shared badge mixins from `src/styles/cardStyles.less` (`.status-badge-pill()`, `.status-badge-success()`, `.status-badge-favorite()`), then theme with tokens.
- Avoid panel-specific one-off badge geometry/colors when an existing shared badge primitive can be reused.

## webOS 6 layout rule

- For webOS 6 / legacy engines, prefer explicit `width` and `height` on card shells/media surfaces in compat files when layout becomes unstable.
- Do not rely on `aspect-ratio`, implicit flex sizing, or large `min-height` heuristics alone for legacy targets.
- Keep these concrete-size overrides in dedicated compat files only (for example `*-compat-webos6.less`), not in base theme files.

## Comments convention

- Keep comments minimal; prefer clear naming/structure so code explains itself.
- Add comments only where behavior, constraints, or tradeoffs need to be addressed.
