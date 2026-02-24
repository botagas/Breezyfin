# Developing Breezyfin

This document is the detailed developer guide for architecture patterns, shared building blocks, styling conventions, and panel decomposition.

## Core principles

- Reuse existing shared hooks/components before introducing new abstractions.
- Keep panel logic modular with panel-local `components/`, `hooks/`, and `utils/` folders.
- Keep styling token-driven and theme-consistent.
- Keep comments minimal; only document non-obvious constraints, tradeoffs, or behavior.

## Related docs

- [`README.md`](./README.md)
- [`HELPERS.md`](./HELPERS.md)
- [`THEMES.md`](./THEMES.md)
- [`COMPONENTS.md`](./COMPONENTS.md)
- [`VIEWS.md`](./VIEWS.md)
- [`TODOS.md`](./TODOS.md)

## Shared building blocks (prefer these first)

- Back handling: `src/hooks/usePanelBackHandler.js`
- Input mode sync (`pointer`/`5way`): `src/hooks/useInputMode.js`
- Popup/menu state: `src/hooks/useDisclosureMap.js`
- Popup/menu handler map: `src/hooks/useDisclosureHandlers.js`
- Map lookups by id/key: `src/hooks/useMapById.js`
- Item metadata fetch/state: `src/hooks/useItemMetadata.js`
- Toast lifecycle: `src/hooks/useToastMessage.js`
- Shared toast UI primitive (Player/Media Details/Settings): `src/components/BreezyToast.js`
- Track preference persistence: `src/hooks/useTrackPreferences.js`
- Image fallback handling: `src/hooks/useImageErrorFallback.js`
- Runtime platform/playback capability detection + cache controls: `src/utils/platformCapabilities.js`
- Player remote/media-key handler: `src/views/player-panel/hooks/usePlayerKeyboardShortcuts.js`
- Player video load/session orchestration: `src/views/player-panel/hooks/usePlayerVideoLoader.js`
- Player skip/prompt state machine: `src/views/player-panel/hooks/usePlayerSkipOverlayState.js`
- Player seek/track-switch flow: `src/views/player-panel/hooks/usePlayerSeekAndTrackSwitching.js`
- Player play/pause/retry/end command handlers: `src/views/player-panel/hooks/usePlayerPlaybackCommands.js`
- Player recovery/fallback handlers: `src/views/player-panel/hooks/usePlayerRecoveryHandlers.js`
- Player lifecycle effects: `src/views/player-panel/hooks/usePlayerLifecycleEffects.js`
- Media details focus debug tracing: `src/views/media-details-panel/hooks/useMediaDetailsFocusDebug.js`
- Media details focus orchestration: `src/views/media-details-panel/hooks/useMediaDetailsFocusOrchestrator.js`
- Media details watched/favorite actions: `src/views/media-details-panel/hooks/useMediaDetailsItemActions.js`
- Media details picker handlers: `src/views/media-details-panel/hooks/useMediaDetailsPickerHandlers.js`
- Media details interaction handlers: `src/views/media-details-panel/hooks/useMediaDetailsInteractionHandlers.js`
- Media details data loader: `src/views/media-details-panel/hooks/useMediaDetailsDataLoader.js`
- Settings sync listeners: `src/hooks/useBreezyfinSettingsSync.js`

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
- Shared poster card class helper: `src/utils/posterCardClassProps.js`
- Shared player view helpers: `src/views/player-panel/utils/playerPanelHelpers.js`
- Shared episode next/previous helpers: `src/views/player-panel/utils/episodeNavigation.js`
- Shared media details formatting/image helpers: `src/views/media-details-panel/utils/mediaDetailsHelpers.js`

## Panel decomposition conventions

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
- `src/views/settings-panel/` (constants, labels, and panel-local helpers)

App shell decomposition paths:
- `src/App/hooks/` (`usePanelHistory`, `usePanelBackHandlerRegistry`)
- `src/App/utils/` (`panelStateCache`, `panelIndex`)

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
- Add comments only where behavior, constraints, or tradeoffs are non-obvious.
