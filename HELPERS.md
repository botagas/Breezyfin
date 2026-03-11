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
| Auto-focus first actionable popup option on open | `usePopupInitialFocus` |
| Centralize PlayerPanel remote/media-key handling | `usePlayerKeyboardShortcuts` |
| Centralize PlayerPanel external/internal controls-visibility synchronization | `usePlayerVisibilitySync` |
| Centralize PlayerPanel video loading/session selection flow | `usePlayerVideoLoader` |
| Centralize PlayerPanel playback option/session-context builders | `usePlayerPlaybackContext` |
| Centralize PlayerPanel skip overlay + next-episode prompt state machine | `usePlayerSkipOverlayState` |
| Centralize PlayerPanel seek + track-switching flow | `usePlayerSeekAndTrackSwitching` |
| Centralize PlayerPanel track-popup `data-track-index` click handlers | `usePlayerTrackPopupHandlers` |
| Centralize PlayerPanel play/pause/retry/end command handlers | `usePlayerPlaybackCommands` |
| Centralize PlayerPanel stop/focus control handlers | `usePlayerCoreControls` |
| Centralize PlayerPanel layered back handling decisions | `usePlayerBackNavigation` |
| Centralize PlayerPanel audio/subtitle popup disclosure wiring | `usePlayerDisclosures` |
| Centralize PlayerPanel adjacent-episode checks + progress reporting ticker | `usePlayerEpisodeProgress` |
| Centralize PlayerPanel media event callbacks (load/canplay/time/error) | `usePlayerMediaEventHandlers` |
| Centralize PlayerPanel episode-navigation + surface/volume interaction handlers | `usePlayerEpisodeAndSurfaceHandlers` |
| Centralize Media Details focus debug tracing | `useMediaDetailsFocusDebug` |
| Centralize Media Details focus orchestration (pointer + 5-way seed/focus) | `useMediaDetailsFocusOrchestrator` |
| Centralize Media Details section snap + section-switch focus behavior | `useMediaDetailsSectionNavigation` |
| Centralize Media Details watched/favorite mutations | `useMediaDetailsItemActions` |
| Centralize Media Details popup picker handlers | `useMediaDetailsPickerHandlers` |
| Centralize Media Details primary action handlers | `useMediaDetailsPrimaryActions` |
| Centralize Media Details popup disclosure wiring | `useMediaDetailsDisclosures` |
| Centralize Media Details image state/url/fallback handlers | `useMediaDetailsImages` |
| Centralize Media Details DOM scroll/focus helper callbacks | `useMediaDetailsDomHelpers` |
| Centralize Media Details overview overflow measurement + play label derivation | `useMediaDetailsOverviewState` |
| Centralize Media Details panel sync effects (item reset, timeout cleanup, settings sync) | `useMediaDetailsPanelSync` |
| Centralize Media Details per-item bootstrap effect (data load + selection reset) | `useMediaDetailsItemBootstrap` |
| Keep app input mode (`pointer`/`5way`) in sync | `useInputMode` |
| Keep component state synced to settings changes | `useBreezyfinSettingsSync` |
| Fast lookup of items by id/key | `useMapById` |
| Fetch item metadata with cancel-safe effect | `useItemMetadata` |
| Reusable toast lifecycle | `useToastMessage` |
| Reusable image fallback behavior | `useImageErrorFallback` |
| Audio/subtitle preference pick + persist | `useTrackPreferences` |
| Derive Settings runtime capability labels from capability snapshot | `useRuntimeCapabilityLabels` |
| Centralize Settings bootstrap data loading/effects | `useSettingsBootstrap` |
| Centralize Settings panel disclosure/open-close wiring | `useSettingsDisclosures` |
| Centralize Settings panel home-row toggle/reorder handlers | `useSettingsHomeRows` |
| Centralize Settings panel option-selection handlers | `useSettingsOptionHandlers` |
| Centralize Settings panel server/session/log/cache orchestration | `useSettingsSystemHandlers` |
| Centralize Settings panel boolean-setting toggle handlers + persistence writes | `useSettingsToggleHandlers` |
| Centralize Settings panel display/label/diagnostic + panel-back handlers | `useSettingsDisplayHandlers` |
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

### `usePopupInitialFocus`
- File: `src/hooks/usePopupInitialFocus.js`
- Purpose: focus the first actionable item inside a popup once it opens (with mount-timing retries for Sandstone popup lifecycle timing).
- Signature:
```js
usePopupInitialFocus(open, popupContentRef, {
  selector,
  retryDelayMs,
  maxAttempts
})
```
- Use when:
  - opening a popup should always land focus on the first option/action.
  - you want to avoid focus staying on the trigger button/body after popup open.

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

### `usePlayerVisibilitySync`
- File: `src/views/player-panel/hooks/usePlayerVisibilitySync.js`
- Purpose: keep PlayerPanel controls-visibility state synchronized with:
  - optional external `requestedControlsVisible` prop
  - optional `onControlsVisibilityChange` callback
- Signature:
```js
usePlayerVisibilitySync({
  requestedControlsVisible,
  onControlsVisibilityChange,
  showControls,
  setShowControls
})
```

### `usePlayerVideoLoader`
- File: `src/views/player-panel/hooks/usePlayerVideoLoader.js`
- Purpose: encapsulate the PlayerPanel playback load pipeline:
  - settings + playback profile resolution (including subtitle burn-in format policy)
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

### `usePlayerPlaybackContext`
- File: `src/views/player-panel/hooks/usePlayerPlaybackContext.js`
- Purpose: centralize playback option/session context derivation and current track ref sync:
  - `buildPlaybackOptions()` using selected audio/subtitle track state
  - `getPlaybackSessionContext()` for reporting calls
  - keep `currentAudioTrackRef` / `currentSubtitleTrackRef` in sync
- Returns:
  - `buildPlaybackOptions()`
  - `getPlaybackSessionContext()`

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

### `usePlayerTrackPopupHandlers`
- File: `src/views/player-panel/hooks/usePlayerTrackPopupHandlers.js`
- Purpose: centralize `PlayerTrackPopup` click handlers parsing `data-track-index` and dispatching to track-change handlers.
- Returns:
  - `handleAudioTrackItemClick(event)`
  - `handleSubtitleTrackItemClick(event)`

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

### `usePlayerEpisodeAndSurfaceHandlers`
- File: `src/views/player-panel/hooks/usePlayerEpisodeAndSurfaceHandlers.js`
- Purpose: centralize remaining PlayerPanel inline UI interaction handlers:
  - next/previous episode navigation handlers
  - video surface click play/pause toggle
  - volume/mute handlers
  - video playing/pause state callbacks
  - error clear action
- Returns:
  - `handlePlayNextEpisode()`
  - `handlePlayPreviousEpisode()`
  - `handleVideoSurfaceClick()`
  - `handleVolumeChange(event)`
  - `toggleMute()`
  - `handleVideoPlaying()`
  - `handleVideoPause()`
  - `clearError()`

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

### `useMediaDetailsSectionNavigation`
- File: `src/views/media-details-panel/hooks/useMediaDetailsSectionNavigation.js`
- Purpose: centralize intro/content section navigation behavior for Media Details:
  - section snap thresholds and wheel capture
  - focus-driven section switching
  - intro top-nav `DOWN` routing and section primary focus targets
  - scroller stop snap behavior
- Returns key methods:
  - `hasSecondarySection`
  - `focusSectionOnePrimary()`
  - `focusAndShowSecondSection()`
  - `focusIntroTopNavigation()`
  - `handleIntroActionKeyDown(event)`
  - `handleIntroTopNavKeyDown(event)`
  - `handleSectionWheelCapture(event)`
  - `handleDetailsScrollerScrollStop(event)`

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

### `useMediaDetailsDomHelpers`
- File: `src/views/media-details-panel/hooks/useMediaDetailsDomHelpers.js`
- Purpose: centralize Media Details DOM-level helper callbacks used by focus/debug/navigation orchestration:
  - scroll element resolution
  - scroll snapshot generation
  - safe focus without scroll jumps
- Returns:
  - `getDetailsScrollElement()`
  - `getScrollSnapshot()`
  - `focusNodeWithoutScroll(node)`

### `useMediaDetailsOverviewState`
- File: `src/views/media-details-panel/hooks/useMediaDetailsOverviewState.js`
- Purpose: centralize Media Details overview/presentation derivation:
  - overview overflow measurement effect
  - series/non-series primary play label derivation (`Play`/`Continue`/`Next Up`)
- Returns:
  - `hasOverviewOverflow`
  - `seriesPlayLabel`
  - `overviewPlayLabel`

### `useMediaDetailsPanelSync`
- File: `src/views/media-details-panel/hooks/useMediaDetailsPanelSync.js`
- Purpose: centralize Media Details panel-level synchronization effects:
  - reset cast/overview expansion when item changes
  - cleanup pending cast/season/episode focus-scroll timers on unmount
  - subscribe/apply settings (`navbarTheme`, `showSeasonImages`, `useSidewaysEpisodeList`)

### `useMediaDetailsItemBootstrap`
- File: `src/views/media-details-panel/hooks/useMediaDetailsItemBootstrap.js`
- Purpose: centralize per-item bootstrap effect for Media Details:
  - bump request guards on item change
  - reload playback/season data
  - reset non-series/series selection state
  - initialize favorite/watched state from `item.UserData`

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
  - retry once with downgraded non-WebP URL when preferred WebP path fails
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

### `toInteger`
- File: `src/utils/numberParsing.js`
- Purpose: normalize integer-like values (`number` or numeric string) to a strict integer-or-null shape.

### `describeDomNode`
- File: `src/utils/domNodeDescription.js`
- Purpose: build concise debug labels for DOM focus targets (`tag#id.class [spotlight=...] [role=...]`).

### `scrollElementIntoHorizontalView`
- File: `src/utils/horizontalScroll.js`
- Purpose: keep focused cards visible in horizontal scrollers with configurable edge buffer.

### Player and media detail helpers
- `src/views/player-panel/utils/playerPanelHelpers.js`
  - `formatPlaybackTime(seconds)`
  - `getPlayerHeaderTitle(item)` (builds formatted episode title with season/episode prefix when available)
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
  - player wrapper around shared `src/components/BreezyLoadingOverlay.js`.
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
- `src/views/player-panel/hooks/usePlayerVisibilitySync.js`
  - centralizes external/internal controls-visibility synchronization effects.
- `src/views/player-panel/hooks/usePlayerVideoLoader.js`
  - centralizes playback source/session selection and video load orchestration.
- `src/views/player-panel/hooks/usePlayerPlaybackContext.js`
  - centralizes playback option/session-context derivation and selected-track ref synchronization.
- `src/views/player-panel/hooks/usePlayerSkipOverlayState.js`
  - centralizes skip-intro/next-episode prompt transitions and skip/dismiss handlers.
- `src/views/player-panel/hooks/usePlayerSeekAndTrackSwitching.js`
  - centralizes seek logic and audio/subtitle switching behavior across HLS/direct/transcode paths.
- `src/views/player-panel/hooks/usePlayerTrackPopupHandlers.js`
  - centralizes Player track-popup click handlers that parse `data-track-index`.
- `src/views/player-panel/hooks/usePlayerPlaybackCommands.js`
  - centralizes player command handlers (`play/pause/retry/end/back`) above low-level stop/recovery.
- `src/views/player-panel/hooks/usePlayerCoreControls.js`
  - centralizes stop lifecycle, startup-watch timer cleanup, and skip-overlay focus targeting.
- `src/views/player-panel/hooks/usePlayerBackNavigation.js`
  - centralizes layered PlayerPanel back handling (track popups -> skip overlay -> controls).
- `src/views/player-panel/hooks/usePlayerDisclosures.js`
  - centralizes PlayerPanel audio/subtitle popup disclosure state + handlers.
- `src/views/player-panel/hooks/usePlayerEpisodeProgress.js`
  - centralizes adjacent-episode availability checks and playback-progress reporting interval orchestration.
- `src/views/player-panel/hooks/usePlayerMediaEventHandlers.js`
  - centralizes video element load/canplay/timeupdate/error callback behavior and fallback decisions.
- `src/views/player-panel/hooks/usePlayerEpisodeAndSurfaceHandlers.js`
  - centralizes episode navigation plus video surface/volume/mute/error UI handlers.
- `src/views/player-panel/hooks/usePlayerRecoveryHandlers.js`
  - centralizes playback recovery/session rebuild + fallback/transcode/HLS fatal recovery logic.
- `src/views/player-panel/hooks/usePlayerLifecycleEffects.js`
  - centralizes player lifecycle effects (item bootstrap, control hide timers, stall watchdog, focus/cleanup timers).

### Media details panel local hooks
- `src/views/media-details-panel/hooks/useMediaDetailsFocusDebug.js`
  - centralizes optional focus/scroll debug tracing lifecycle.
- `src/views/media-details-panel/hooks/useMediaDetailsFocusOrchestrator.js`
  - centralizes pointer/5-way focus routing and initial focus seeding.
- `src/views/media-details-panel/hooks/useMediaDetailsSectionNavigation.js`
  - centralizes section snap + first/second section focus switch behavior.
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
- `src/views/media-details-panel/hooks/useMediaDetailsPrimaryActions.js`
  - centralizes primary play/back and overview/cast/episode-series action handlers.
- `src/views/media-details-panel/hooks/useMediaDetailsDisclosures.js`
  - centralizes Media Details popup disclosure state and open/close handlers.
- `src/views/media-details-panel/hooks/useMediaDetailsImages.js`
  - centralizes Media Details image state, image URL builders, and fallback/error handlers.
- `src/views/media-details-panel/hooks/useMediaDetailsInteractionHandlers.js`
  - centralizes cast/season/episode focus-navigation + key interaction handlers.
- `src/views/media-details-panel/hooks/useMediaDetailsDomHelpers.js`
  - centralizes DOM scroll-element/snapshot helpers and focus-without-scroll helper callbacks.
- `src/views/media-details-panel/hooks/useMediaDetailsOverviewState.js`
  - centralizes overview overflow state and primary play-label derivation.
- `src/views/media-details-panel/hooks/useMediaDetailsPanelSync.js`
  - centralizes panel sync effects (item reset, timeout cleanup, settings sync).
- `src/views/media-details-panel/hooks/useMediaDetailsItemBootstrap.js`
  - centralizes per-item bootstrap effect for request guards + reload + initial favorite/watched state.

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
- `src/views/settings-panel/hooks/useRuntimeCapabilityLabels.js`
  - derives UI-ready settings labels from runtime playback capabilities.
- `src/views/settings-panel/hooks/useSettingsBootstrap.js`
  - centralizes bootstrap loading/effects for settings, server/user info, saved servers, logs count, and app version.
- `src/views/settings-panel/hooks/useSettingsDisclosures.js`
  - centralizes popup disclosure state booleans and open/close handlers for `SettingsPanel`.
- `src/views/settings-panel/hooks/useSettingsHomeRows.js`
  - centralizes Settings home-row toggle/reorder handlers and move-button event callbacks.
- `src/views/settings-panel/hooks/useSettingsOptionHandlers.js`
  - centralizes Settings option-selection handlers (bitrate/theme/language/capability refresh/subtitle burn-in formats/play-next prompt mode).
- `src/views/settings-panel/hooks/useSettingsSystemHandlers.js`
  - centralizes Settings server/session actions plus diagnostics log and cache-wipe orchestration handlers.
- `src/views/settings-panel/hooks/useSettingsToggleHandlers.js`
  - centralizes boolean-setting toggles and persisted setting mutation handler.
- `src/views/settings-panel/hooks/useSettingsDisplayHandlers.js`
  - centralizes display/label helpers plus diagnostics refresh and panel back handling.
- `src/views/settings-panel/capabilityFormatting.js`
  - formatting/normalization helpers for runtime capability values and refresh period settings.

### Shared constants
- `src/constants/time.js`
  - `JELLYFIN_TICKS_PER_SECOND` for consistent Jellyfin tick/second conversion across services and player hooks.
- `src/constants/toast.js`
  - `PANEL_TOAST_CONFIG` shared toast timing preset for panel toasts.

### Runtime image format helpers
- `src/utils/imageFormat.js`
  - `getPreferredImageFormat()`
  - `applyPreferredImageFormatToParams(searchParams, options?)`
  - `stripPreferredImageFormatFromUrl(url)`
  - `applyImageFormatFallbackFromEvent(event)`

---

## Related Docs

- [`README.md`](./README.md)
- [`DEVELOPING.md`](./DEVELOPING.md)
- [`THEMES.md`](./THEMES.md)
- [`COMPONENTS.md`](./COMPONENTS.md)
- [`VIEWS.md`](./VIEWS.md)
- [`CHECKS.md`](./CHECKS.md)
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
