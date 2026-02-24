# Helpers & Hooks Reference

This file documents shared hooks/helpers used across Breezyfin so panel code stays consistent and maintainable.

## How To Choose

| Need | Preferred Helper |
|---|---|
| Save/restore panel scroll + cache scrollTop | `usePanelScrollState` |
| Wire panel back handling | `usePanelBackHandler` |
| Wire toolbar callbacks + layered panel back flow | `usePanelToolbarActions` |
| Wire toolbar callbacks consistently | `useToolbarActions` |
| Bridge toolbar-level back handler into panel back flow | `useToolbarBackHandler` |
| Open/close multiple popups/menus | `useDisclosureMap` |
| Build stable per-popup open/close handlers | `useDisclosureHandlers` |
| Close popup when focus/pointer leaves scope | `useDismissOnOutsideInteraction` |
| Centralize PlayerPanel remote/media-key handling | `usePlayerKeyboardShortcuts` |
| Centralize PlayerPanel video loading/session selection flow | `usePlayerVideoLoader` |
| Centralize PlayerPanel skip overlay + next-episode prompt state machine | `usePlayerSkipOverlayState` |
| Centralize PlayerPanel seek + track-switching flow | `usePlayerSeekAndTrackSwitching` |
| Centralize PlayerPanel play/pause/retry/end command handlers | `usePlayerPlaybackCommands` |
| Centralize Media Details focus debug tracing | `useMediaDetailsFocusDebug` |
| Centralize Media Details focus orchestration (pointer + 5-way seed/focus) | `useMediaDetailsFocusOrchestrator` |
| Centralize Media Details watched/favorite mutations | `useMediaDetailsItemActions` |
| Centralize Media Details popup picker handlers | `useMediaDetailsPickerHandlers` |
| Keep app input mode (`pointer`/`5way`) in sync | `useInputMode` |
| Keep component state synced to settings changes | `useBreezyfinSettingsSync` |
| Fast lookup of items by id/key | `useMapById` |
| Fetch item metadata with cancel-safe effect | `useItemMetadata` |
| Reusable toast lifecycle | `useToastMessage` |
| Reusable image fallback behavior | `useImageErrorFallback` |
| Audio/subtitle preference pick + persist | `useTrackPreferences` |
| Runtime playback/platform capability snapshot + cache controls | `getRuntimePlatformCapabilities` / `setRuntimeCapabilityProbeRefreshDays` / `refreshRuntimePlatformCapabilities` |

---

## Hooks

### `usePanelScrollState`
- File: `src/hooks/usePanelScrollState.js`
- Purpose: one-stop panel scroll memory hook; combines normalized `scrollTop`, `Scroller` restore wiring, and optional cache persistence callbacks.
- Signature:
```js
usePanelScrollState({
  cachedState = null,
  isActive = false,
  onCacheState = null,
  cacheKey = null,
  requireCacheKey = false
})
```
- Returns:
  - `scrollTop`
  - `setScrollTop`
  - `captureScrollTo` (pass to `Scroller` `cbScrollTo`)
  - `handleScrollStop` (pass to `Scroller` `onScrollStop`)
- Use when:
  - panel has cached state and should restore scroll on return.
  - panel wants keyed cache (`cacheKey`), e.g. per library id/item id.
- Example:
```js
const {
  captureScrollTo,
  handleScrollStop
} = usePanelScrollState({
  cachedState,
  isActive,
  onCacheState,
  cacheKey: library?.Id,
  requireCacheKey: true
});
```

### `useScrollerScrollMemory` and `useCachedScrollTopState`
- File: `src/hooks/useScrollerScrollMemory.js`
- Purpose:
  - `useCachedScrollTopState`: normalizes persisted `scrollTop` and keeps state stable.
  - `useScrollerScrollMemory`: low-level restore/capture primitives.
- Use when:
  - panel has special behavior not covered by `usePanelScrollState`.

### `usePanelBackHandler`
- File: `src/hooks/usePanelBackHandler.js`
- Purpose: register/unregister panel-local back callback safely.
- Signature:
```js
usePanelBackHandler(registerBackHandler, handler, { enabled = true })
```
- Use when:
  - panel needs custom back behavior (close popup first, then fallback).

### `usePanelToolbarActions`
- File: `src/hooks/usePanelToolbarActions.js`
- Purpose: high-level panel helper that combines:
  - `useToolbarActions` callback bundling
  - `useToolbarBackHandler` bridge
  - `usePanelBackHandler` layered back registration
- Signature:
```js
usePanelToolbarActions({
  onNavigate,
  onSwitchUser,
  onLogout,
  onExit,
  registerBackHandler,
  isActive = false,
  onPanelBack = null
})
```
- Use when:
  - panel needs standard toolbar wiring and should run local back logic before toolbar back handling.

### `useToolbarActions`
- File: `src/hooks/useToolbarActions.js`
- Purpose: builds stable toolbar callback bundle for `Toolbar`/`SettingsToolbar`.
- Signature:
```js
useToolbarActions({
  onNavigate,
  onSwitchUser,
  onLogout,
  onExit,
  registerBackHandler
})
```
- Use when:
  - passing toolbar props repeatedly in a panel.

### `useToolbarBackHandler`
- File: `src/hooks/useToolbarBackHandler.js`
- Purpose: bridge toolbar-provided back handler into panel back flow.
- Returns:
  - `registerToolbarBackHandler(handler)`
  - `runToolbarBackHandler()` -> `boolean`
- Typical pattern:
```js
const { registerToolbarBackHandler, runToolbarBackHandler } = useToolbarBackHandler();
const handleInternalBack = useCallback(() => runToolbarBackHandler(), [runToolbarBackHandler]);
```

### `useDisclosureMap`
- File: `src/hooks/useDisclosureMap.js`
- Purpose: manage many popup/menu open states in one map.
- Returns:
  - `disclosures`
  - `openDisclosure(key)`
  - `closeDisclosure(key)`
  - `setDisclosure(key, bool)`
  - `closeAllDisclosures(keys?)`
- Use when:
  - a panel has multiple popups and back handling should close whichever is open.

### `useDisclosureHandlers`
- File: `src/hooks/useDisclosureHandlers.js`
- Purpose: generate stable `open`/`close` handlers per disclosure key from `useDisclosureMap` methods.
- Signature:
```js
useDisclosureHandlers(keys, openDisclosure, closeDisclosure)
```
- Use when:
  - a panel has many popup callbacks and you want to avoid repetitive `useCallback(() => openDisclosure(...))` blocks.

### `useDismissOnOutsideInteraction`
- File: `src/hooks/useDismissOnOutsideInteraction.js`
- Purpose: close overlays when focus/pointer/touch happens outside a scope node.
- Signature:
```js
useDismissOnOutsideInteraction({
  enabled = true,
  scopeRef,
  onDismiss
})
```

### `usePlayerKeyboardShortcuts`
- File: `src/views/player-panel/hooks/usePlayerKeyboardShortcuts.js`
- Purpose: isolate global PlayerPanel key handling (seek, back layering, play/pause media keys).
- Signature:
```js
usePlayerKeyboardShortcuts({
  isActive,
  onUserInteraction,
  showControls,
  setShowControls,
  skipOverlayVisible,
  showAudioPopup,
  showSubtitlePopup,
  isSeekContext,
  seekBySeconds,
  handleInternalBack,
  handleBackButton,
  handlePause,
  handlePlay,
  playing,
  controlsRef,
  skipOverlayRef,
  focusSkipOverlayAction,
  isProgressSliderTarget
})
```

### `usePlayerVideoLoader`
- File: `src/views/player-panel/hooks/usePlayerVideoLoader.js`
- Purpose: encapsulate the PlayerPanel playback load pipeline:
  - settings + playback profile resolution
  - media source/session selection
  - audio/subtitle initialization
  - stream URL construction (direct/hls/transcode)
  - startup and stall recovery wiring
- Signature:
```js
const loadVideo = usePlayerVideoLoader({
  item,
  videoRef,
  hlsRef,
  loadVideoRef,
  resetRecoveryGuards,
  setLoading,
  reloadAttemptedRef,
  subtitleCompatibilityFallbackAttemptedRef,
  lastProgressRef,
  setError,
  seekOffsetRef,
  loadTrackPreferences,
  playbackOverrideRef,
  playbackOptions,
  playbackSettingsRef,
  setToastMessage,
  setMediaSourceData,
  setDuration,
  setAudioTracks,
  setSubtitleTracks,
  pickPreferredAudio,
  pickPreferredSubtitle,
  setCurrentAudioTrack,
  setCurrentSubtitleTrack,
  startupFallbackTimerRef,
  attemptTranscodeFallback,
  attachHlsPlayback,
  pendingOverrideClearRef,
  showPlaybackError,
  startWatchTimerRef,
  playing,
  attemptPlaybackSessionRebuild,
  playbackFailureLockedRef,
  failStartTimerRef,
  playbackSessionRef
});
```

### `usePlayerSkipOverlayState`
- File: `src/views/player-panel/hooks/usePlayerSkipOverlayState.js`
- Purpose: encapsulate Player skip-intro/credits + next-episode prompt state transitions and dismiss/skip handlers.
- Returns:
  - `checkSkipSegments(positionSeconds)`
  - `handleSkipSegment()`
  - `handleDismissNextEpisodePrompt()`
  - `handleDismissSkipOverlay()`

### `usePlayerSeekAndTrackSwitching`
- File: `src/views/player-panel/hooks/usePlayerSeekAndTrackSwitching.js`
- Purpose: centralize seek behavior and track switching reload/session-override behavior for HLS/direct/transcode flows.
- Returns:
  - `isSeekContext(target)`
  - `isProgressSliderTarget(target)`
  - `seekBySeconds(deltaSeconds)`
  - `handleSeek(event)`
  - `handleAudioTrackChange(trackIndex)`
  - `handleSubtitleTrackChange(trackIndex)`

### `usePlayerPlaybackCommands`
- File: `src/views/player-panel/hooks/usePlayerPlaybackCommands.js`
- Purpose: centralize playback command callbacks that sit above low-level stop/recovery wiring:
  - `play`/`pause`
  - `retry playback`
  - `back from player`
  - `on-ended` autoplay-next flow
  - canplay fatal fallback decision helper
- Returns:
  - `handleEnded()`
  - `handlePlay(options?)`
  - `handlePause(options?)`
  - `handleRetryPlayback()`
  - `handleBackButton()`
  - `tryPlaybackFallbackOnCanPlayError(errorMessage)`

### `useMediaDetailsFocusDebug`
- File: `src/views/media-details-panel/hooks/useMediaDetailsFocusDebug.js`
- Purpose: encapsulate opt-in focus/scroll debug tracing (`bfFocusDebug`) and attach focus/scroll debug listeners.
- Returns:
  - `detailsDebugEnabled`
  - `describeNode(node)`
  - `logDetailsDebug(message, payload?)`

### `useMediaDetailsFocusOrchestrator`
- File: `src/views/media-details-panel/hooks/useMediaDetailsFocusOrchestrator.js`
- Purpose: centralize Media Details focus routing/orchestration:
  - pointer-to-focus sync and guard behavior
  - initial focus seeding for series/non-series
  - focus target helper methods used by interaction handlers
  - cast/season focus scrolling behavior
- Returns key methods:
  - `scrollCastIntoView()`, `scrollSeasonIntoView()`
  - `focusTopHeaderAction()`, `focusEpisodeSelector()`
  - `focusEpisodeCardByIndex()`, `focusEpisodeInfoButtonByIndex()`, `focusEpisodeFavoriteButtonByIndex()`, `focusEpisodeWatchedButtonByIndex()`
  - `focusSeasonCardByIndex()`, `focusSeasonWatchedButton()`, `focusBelowSeasons()`
  - `focusNonSeriesAudioSelector()`, `focusNonSeriesSubtitleSelector()`, `focusNonSeriesPrimaryPlay()`
  - `handleDetailsPointerDownCapture()`, `handleDetailsPointerClickCapture()`

### `useMediaDetailsItemActions`
- File: `src/views/media-details-panel/hooks/useMediaDetailsItemActions.js`
- Purpose: centralize favorite/watched mutation flows and related local refresh behavior for item/episode/season contexts.
- Returns:
  - `handleToggleFavorite()`
  - `handleToggleFavoriteById(itemId?, currentFavoriteState?)`
  - `handleToggleWatched(itemId?, currentWatchedState?)`

### `useMediaDetailsPickerHandlers`
- File: `src/views/media-details-panel/hooks/useMediaDetailsPickerHandlers.js`
- Purpose: centralize audio/subtitle picker selection and episode picker selection behavior.
- Returns:
  - `handleTrackSelect(event)`
  - `handleEpisodePopupSelect(event)`

### `useInputMode`
- File: `src/hooks/useInputMode.js`
- Purpose: track and synchronize app input mode and Spotlight pointer mode (`pointer` vs `5way`) from pointer/keyboard events.
- Signature:
```js
useInputMode(Spotlight)
```
- Returns:
  - `'pointer' | '5way'`

### `useBreezyfinSettingsSync`
- File: `src/hooks/useBreezyfinSettingsSync.js`
- Purpose: subscribe to settings updates from:
  - `breezyfin-settings-changed` custom event
  - `storage` event (cross-tab/window)
- Signature:
```js
useBreezyfinSettingsSync(onSettings, { enabled = true, applyOnMount = true })
```

### `useMapById`
- File: `src/hooks/useMapById.js`
- Purpose: `Array -> Map` lookup helper by `Id` or custom key selector.
- Signature:
```js
useMapById(items, keySelector = 'Id')
```
- Use when:
  - click handlers need constant-time lookup from `data-*` id to item object.

### `useItemMetadata`
- File: `src/hooks/useItemMetadata.js`
- Purpose: fetch item details with effect cancel guard.
- Signature:
```js
useItemMetadata(itemId, { enabled = true, errorContext = 'item metadata' })
```

### `useImageErrorFallback`
- File: `src/hooks/useImageErrorFallback.js`
- Purpose: shared `onError` behavior for images:
  - hide broken image
  - mark container with placeholder class
  - optional callback
- Signature:
```js
useImageErrorFallback(placeholderClassName, { onError })
```

### `useToastMessage`
- File: `src/hooks/useToastMessage.js`
- Purpose: standard toast lifecycle with optional fade-out staging.
- Signature:
```js
useToastMessage({ durationMs = 2000, fadeOutMs = 0 })
```
- Returns:
  - `toastMessage`
  - `toastVisible`
  - `setToastMessage`
  - `clearToast`

### `useTrackPreferences`
- File: `src/hooks/useTrackPreferences.js`
- Purpose: pick/apply/save audio/subtitle track preferences consistently.
- Returns key methods:
  - `resolveDefaultTrackSelection(mediaStreams, options)`
  - `saveAudioSelection(trackIndex, audioStreams)`
  - `saveSubtitleSelection(trackIndex, subtitleStreams)`
  - `loadTrackPreferences()`
  - `saveTrackPreferences()`

---

## Utility Helpers

### `getPosterCardClassProps`
- File: `src/utils/posterCardClassProps.js`
- Purpose: map common card class names from a CSS module into props for `PosterMediaCard`.

### `focusToolbarSpotlightTargets`
- File: `src/utils/toolbarFocus.js`
- Purpose: focus first available toolbar spotlight target id safely.

### `createLastFocusedSpotlightContainer`
- File: `src/utils/spotlightContainerUtils.js`
- Purpose: create `SpotlightContainerDecorator` with `enterTo: 'last-focused'`.

### `scrollElementIntoHorizontalView`
- File: `src/utils/horizontalScroll.js`
- Purpose: keep focused cards visible in horizontal scrollers with configurable edge buffer.

### Player and media detail helpers
- `src/views/player-panel/utils/playerPanelHelpers.js`
  - `formatPlaybackTime(seconds)`
  - `getPlayerTrackLabel(track)`
  - `getSkipSegmentLabel(segmentType, hasNextEpisode?)`
  - `getPlayerErrorBackdropUrl(item, imageApi)`
- `src/views/player-panel/utils/episodeNavigation.js`
  - `getNextEpisodeForItem(service, item)`
  - `getPreviousEpisodeForItem(service, item)`
- `src/views/media-details-panel/utils/mediaDetailsHelpers.js`
  - language display mapping, track summary labels
  - season/episode image fallback resolution
  - episode badge/date/runtime + progress/played predicates

### Player panel local components
- `src/views/player-panel/components/PlayerErrorPopup.js`
  - shared playback error popup surface/actions.
- `src/views/player-panel/components/PlayerTrackPopup.js`
  - shared audio/subtitle popup list shell.
- `src/views/player-panel/components/PlayerLoadingOverlay.js`
  - loading glass spinner shell.
- `src/views/player-panel/components/PlayerSeekFeedback.js`
  - transient seek feedback label overlay.
- `src/views/player-panel/components/PlayerSkipOverlay.js`
  - skip-intro/next-episode pill overlay shell.
- `src/views/player-panel/components/PlayerToast.js`
  - lightweight player toast shell.
- `src/views/player-panel/components/PlayerControlsOverlay.js`
  - top/bottom player controls shell (back, progress, transport, tracks, volume).

### Player panel local hooks
- `src/views/player-panel/hooks/usePlayerKeyboardShortcuts.js`
  - centralizes player keyboard/media key handling with seek/context guards.
- `src/views/player-panel/hooks/usePlayerVideoLoader.js`
  - centralizes playback source/session selection and video load orchestration.
- `src/views/player-panel/hooks/usePlayerSkipOverlayState.js`
  - centralizes skip-intro/next-episode prompt transitions and skip/dismiss handlers.
- `src/views/player-panel/hooks/usePlayerSeekAndTrackSwitching.js`
  - centralizes seek logic and audio/subtitle switching behavior across HLS/direct/transcode paths.
- `src/views/player-panel/hooks/usePlayerPlaybackCommands.js`
  - centralizes player command handlers (`play/pause/retry/end/back`) above low-level stop/recovery.
- `src/views/player-panel/hooks/usePlayerRecoveryHandlers.js`
  - centralizes playback recovery/session rebuild + fallback/transcode/HLS fatal recovery logic.
- `src/views/player-panel/hooks/usePlayerLifecycleEffects.js`
  - centralizes player lifecycle effects (item bootstrap, control hide timers, stall watchdog, focus/cleanup timers).

### Media details panel local hooks
- `src/views/media-details-panel/hooks/useMediaDetailsFocusDebug.js`
  - centralizes optional focus/scroll debug tracing lifecycle.
- `src/views/media-details-panel/hooks/useMediaDetailsFocusOrchestrator.js`
  - centralizes pointer/5-way focus routing and initial focus seeding.
- `src/views/media-details-panel/hooks/useMediaDetailsKeyboardShortcuts.js`
  - centralizes details panel BACK/PLAY key handling and pointer-mode guard behavior.
- `src/views/media-details-panel/hooks/useMediaDetailsTrackOptions.js`
  - centralizes audio/subtitle option lists and summary labels.
- `src/views/media-details-panel/hooks/useMediaCredits.js`
  - merges/normalizes cast + creator credits from item/season/episode metadata.
- `src/views/media-details-panel/hooks/useMediaDetailsDataLoader.js`
  - centralizes media details cache-backed data loading and series/episode selection orchestration.
- `src/views/media-details-panel/hooks/useMediaDetailsItemActions.js`
  - centralizes favorite/watched mutation flows and related refresh behavior.
- `src/views/media-details-panel/hooks/useMediaDetailsPickerHandlers.js`
  - centralizes audio/subtitle and episode picker selection handlers.
- `src/views/media-details-panel/hooks/useMediaDetailsInteractionHandlers.js`
  - centralizes cast/season/episode focus-navigation + key interaction handlers.

### Media details panel local components
- `src/views/media-details-panel/components/MediaDetailsToast.js`
  - shared details toast rendering shell.
- `src/views/media-details-panel/components/MediaTrackPickerPopup.js`
  - shared audio/subtitle picker popup structure.
- `src/views/media-details-panel/components/MediaEpisodePickerPopup.js`
  - shared episode picker popup structure.
- `src/views/media-details-panel/components/MediaTrackSelectorButton.js`
  - shared compact audio/subtitle selector button shell.
- `src/views/media-details-panel/components/MediaTrackSelectorRow.js`
  - shared compact audio/subtitle selector pair layout.
- `src/views/media-details-panel/components/MediaDetailsIntroSection.js`
  - details heading/breadcrumb + intro metadata/overview/action controls shell.
- `src/views/media-details-panel/components/MediaCastSection.js`
  - cast toggle + cast card row section.
- `src/views/media-details-panel/components/MediaSeasonsSection.js`
  - season cards section with watched toggle and poster fallbacks.
- `src/views/media-details-panel/components/MediaSeriesStickyControls.js`
  - sticky episode selector + track selectors + primary play controls.
- `src/views/media-details-panel/components/MediaEpisodesSection.js`
  - episodes grid/sideways layout rendering with favorite/watched status badges and action buttons.

### Settings and track storage helpers
- `src/utils/settingsStorage.js`
  - `readBreezyfinSettings(rawOverride?)`
  - `writeBreezyfinSettings(settings)` (also emits `breezyfin-settings-changed`)
- `src/utils/trackPreferences.js`
  - `readTrackPreferences(rawOverride?)`
  - `writeTrackPreferences(preferences)`
  - `createAudioPreference(index, stream)`
  - `createSubtitlePreference(index, stream)`

---

## Related Docs

- [`README.md`](./README.md)
- [`DEVELOPING.md`](./DEVELOPING.md)
- [`THEMES.md`](./THEMES.md)
- [`COMPONENTS.md`](./COMPONENTS.md)
- [`VIEWS.md`](./VIEWS.md)
- [`TODOS.md`](./TODOS.md)

---

## Conventions

- Prefer the highest-level helper first (`usePanelScrollState` over raw scroll hooks).
- Keep popup state in a disclosure map, not separate booleans.
- Prefer `usePanelToolbarActions`; use `useToolbarActions` directly only for low-level/custom cases.
- Keep panel back flow layered:
  1. close local disclosure(s)
  2. run toolbar back handler
  3. fallback to app-level navigation.
