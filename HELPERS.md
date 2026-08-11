# Helpers & Hooks Reference

This file documents shared hooks/helpers used across Breezyfin so panel code stays consistent and maintainable.

## How To Choose

| Need | Preferred Helper |
|---|---|
| Save/restore non-virtual panel scroll + cache scrollTop | `usePanelScrollState` |
| Render paged uniform media grids with Enact-owned virtualization, focus restoration, visible-index prefetch, and overscroll disabled by default | `MediaVirtualGrid` |
| Library panel paged data loading (first page + incremental load-more) | `useLibraryPagination` |
| Manage shared Library/Home Section media filter popup state | `useMediaFilterState` |
| Manage collapsible, debounced Library/Favorites search input state | `useCollapsibleBrowseSearch` |
| Apply shared media filter semantics | `MEDIA_FILTER_OPTIONS` / `buildMediaFilterState` / `mediaItemMatchesFilters` |
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
| Reveal PlayerPanel controls from wheel/pointer-edge interaction | `usePlayerInteractionReveal` |
| Centralize PlayerPanel playback negotiation and resolved-source descriptor creation | `usePlayerVideoLoader` |
| Own native/native-HLS/HLS.js source attachment, engine readiness, and teardown | `usePlayerSourcePipeline` |
| Gate Player startup until the source engine, selected client subtitles, and SyncPlay authority are ready | `usePlayerStartupCoordinator` |
| Prepare, commit, restore, and roll back native runtime audio-track replacements | `usePlayerAudioTransition` |
| Reject pre-attachment media events and keep HLS.js errors on its generation-bound callback path | `isPlaybackSourceMediaEventCurrent` |
| Centralize PlayerPanel playback option/session-context builders | `usePlayerPlaybackContext` |
| Centralize PlayerPanel skip overlay + next-episode prompt state machine | `usePlayerSkipOverlayState` |
| Select enabled/displayable server Home rows, bound progressive loading, and decide mounted-content revalidation | `src/utils/serverHomeRows.js` |
| Centralize PlayerPanel seek + track-switching flow | `usePlayerSeekAndTrackSwitching` |
| Centralize PlayerPanel track-popup `data-track-index` click handlers | `usePlayerTrackPopupHandlers` |
| Centralize PlayerPanel play/pause/retry/end command handlers | `usePlayerPlaybackCommands` |
| Centralize PlayerPanel stop/focus control handlers | `usePlayerCoreControls` |
| Centralize blocking Player decisions for unsupported audio switches, staged DV-to-HDR/SDR fallback, subtitle burn-in, and no-subtitle fallback | `usePlayerPlaybackDecision` |
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
| Centralize Media Details staged loading reveal flow (backdrop -> branding -> content) | `useMediaDetailsStagedReveal` |
| Centralize Media Details DOM scroll/focus helper callbacks | `useMediaDetailsDomHelpers` |
| Centralize Media Details overview overflow measurement + play label derivation | `useMediaDetailsOverviewState` |
| Centralize Media Details panel sync effects (item reset, timeout cleanup, settings sync) | `useMediaDetailsPanelSync` |
| Centralize Media Details per-item bootstrap effect (data load + selection reset) | `useMediaDetailsItemBootstrap` |
| Keep app input mode (`pointer`/`5way`) in sync | `useInputMode` |
| Keep component state synced to settings changes | `useBreezyfinSettingsSync` |
| Resolve the current Normal / Performance / Performance+ rendering profile | `usePerformanceMode` |
| Gate settings-sync and other panel-scoped side effects behind `isActive` | pass `enabled: isActive` to `useBreezyfinSettingsSync` and similar effect hooks |
| Persist crash recovery action/context across ErrorBoundary remounts | `src/utils/crashRecovery.js` helpers |
| Fast lookup of items by id/key | `useMapById` |
| Fetch item metadata with cancel-safe effect | `useItemMetadata` |
| Reusable toast lifecycle | `useToastMessage` |
| Render a shared Sandstone-selected option with the persistent Selected marker | `SelectionOptionButton` |
| Reusable image fallback behavior, including ordered URL candidates | `useImageErrorFallback` |
| Manage App-level panel history snapshots | `usePanelHistory` |
| Register and run App-level panel back handlers | `usePanelBackHandlerRegistry` |
| Run authenticated non-player inactivity handling while preserving Spotlight ownership | `useAppScreensaver` |
| Run paused-player inactivity handling with wake/resume semantics | `usePlayerPausedScreensaver` |
| Keep bounded Player runtime diagnostic state dormant behind the master setting | `usePlayerRuntimeDiagnostics` |
| Read the app-wide optional diagnostics collection state and clear shared metric state on disable | `RuntimeDiagnosticsProvider` / `useRuntimeDiagnosticsEnabled` |
| Track inactivity through one extendable deadline instead of recreating timers on input | `useInactivityDeadline` |
| Suspend covered App/Player runtime work with shared reason ownership | `useRuntimeSuspended` / `setRuntimeSuspension` |
| Build shared Jellyfin image URLs without panel/service coupling | `buildItemImageUrl` / `buildUserPrimaryImageUrl` |
| Resolve ordered card and panel artwork fallbacks, preserving authenticated provider candidates before generated Jellyfin URLs | `mergeMediaItemImageCandidates` / `getPosterCardImageUrls` / `getLandscapeCardImageUrls` / `getMediaPanelBackdropUrls` |
| Apply mode-aware width, quality, and server blur to authenticated plugin image URLs | `buildExternalImageVariantUrl` |
| Build duplicate-safe media list React keys | `buildMediaListItemKey` |
| Centralize LoginPanel rotating backdrop state, startup-restore deferral, and load/error handling | `useLoginBackdrops` |
| Audio/subtitle preference pick + persist | `useTrackPreferences` |
| Match Jellyfin, HLS, native media tracks, and cross-episode audio/subtitle intents with duplicate-language safety | `resolveRuntimeTrackIndex` / `resolveAudioTrackIndex` / `resolveSubtitleTrackIndex` / `applyNativeAudioTrackSelection` |
| Derive Settings runtime capability labels from capability snapshot | `useRuntimeCapabilityLabels` |
| Centralize Settings bootstrap data loading/effects | `useSettingsBootstrap` |
| Centralize Settings panel disclosure/open-close wiring | `useSettingsDisclosures` |
| Centralize Settings panel home-row toggle/reorder handlers | `useSettingsHomeRows` |
| Centralize Settings panel option-selection handlers | `useSettingsOptionHandlers` |
| Centralize Settings panel server/session/log/cache orchestration | `useSettingsSystemHandlers` |
| Centralize Settings panel boolean-setting toggle handlers + persistence writes | `useSettingsToggleHandlers` |
| Centralize Settings panel display/label/diagnostic + panel-back handlers | `useSettingsDisplayHandlers` |
| Keep Settings tab visibility, subtitle control enablement, popup selected states, and destructive-action copy testable | `settingsViewModel` helpers |
| Runtime playback/platform capability snapshot + cache controls | `getRuntimePlatformCapabilities` / `setRuntimeCapabilityProbeRefreshDays` / `refreshRuntimePlatformCapabilities` / `refreshRuntimePlatformCapabilitiesWithLuna` |
| Render shared Library-like poster grid cards | `PanelPosterMediaCard` |
| Keep focused grid cards visible, restore grid focus after popup/filter changes, use row geometry for directional movement, and trigger load-more prefetch | `shouldLoadMoreFromGridFocus` / `focusRestoredOrFallbackGridCard` / `findDirectionalGridTarget` |
| Render shared browse input and filter trigger visuals | `MediaBrowseControls` |
| Position browse controls above results using the Search panel overlay contract | `MediaBrowseOverlay` + `MediaBrowseControls.module.less` panel classes |
| Route right-most grid-card focus to adjacent filter controls | `focusTargetFromRightMostGridItem` |
| Resolve current Jellyfin username for request/tag matching | `getJellyfinUsername` |
| Decide Smart/manual subtitle burn-in policy | `getSubtitleTranscodePolicy` |
| Build structured playback/player diagnostic entries | `createPlaybackDiagnostic` / `appendPlaybackDiagnostic` / `buildMediaSegmentsLoadDiagnostic` |
| Build consistent playback restart/reload overrides | `buildPlaybackOverride` / `resolveVideoSeekSeconds` |
| Create mutable per-instance HLS.js config and classify/redact runtime errors before recovery/fallback handling | `createHlsPlayerConfig` / `classifyHlsError` / `getHlsErrorHttpStatus` / `buildHlsErrorSummary` |
| Redact sensitive URLs, headers, errors, values, and console arguments before output or storage | `redactSensitiveUrl` / `redactSensitiveText` / `sanitizeSensitiveValue` / `sanitizeConsoleArgs` |
| Classify Player subtitle/burn-in recovery and probable server-transcoder startup failures without side effects | `playerRecoveryPolicy` helpers |
| Keep PlayerPanel loader decisions pure/testable | `buildPlayerPlaybackSettingsSnapshot` / `resolveInitialTrackSelection` / `resolvePlaybackVideoUrl` / `selectHlsEnginePreference` |
| Normalize PlayerPanel subtitle renderer failure and fallback status names, and route renderer failures into burn-in/no-subtitle consent decisions | `normalizeSubtitleRendererFailureReason` / `getSubtitleBurnInFallbackStatus` / `runSubtitleBurnInFallbackDecision` |
| Resolve raw subtitle fetch format priority from Jellyfin subtitle codecs | `getRawSubtitleFormats` |
| Fetch subtitle event/raw text/binary payloads and resolve bitmap delivery candidates for client-side rendering | `getSubtitleTrackEvents` / `getSubtitleTrackText` / `getSubtitleTrackBinary` / `getBitmapSubtitleDeliveryCandidates` / `buildSubtitleStreamUrl` |
| Normalize, place, and render text subtitle cues | `normalizeSubtitleEvents` / `normalizeSubtitleText` / `findActiveSubtitleCues` / `subtitleRendererAss*` / `usePlayerSubtitleRenderer` |
| Normalize numeric Breezyfin subtitle appearance settings shared by Settings and Player overlay | `normalizeNumericSetting` / `adjustNumericSetting` / `SUBTITLE_OVERLAY_FONT_SIZE_RANGE` / `SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE` |
| Render ASS/SSA with an explicit external renderer | `subtitleRendererRegistry` / `libassRenderer` / `jassubRenderer` / `assJsRenderer` / `manualCanvasLayout` |
| Package and validate external subtitle-renderer assets | `prepare-subtitle-package-assets.cjs` / `copy-subtitle-assets.cjs` / `jassubCanvas2dPatch.cjs` |
| Render PGS/PGSSUB before consent-gated burn-in fallback | `bitmapSubtitleRenderers` / `libbitsubRenderer` / `libpgsRenderer` / `PlayerPlaybackDecisionPrompt` |
| Normalize PlayerPanel subtitle overlay appearance, map ASS coordinates onto the visible video stage, preserve authored placement, contain only managed multiline text boxes, group region cues by ASS layer, and apply full-stage rectangular/inverse/vector clips | `getSubtitleOverlayAttributes` / `getSubtitleVideoStageGeometry` / `getAssCoordinatePlane` / `getAssCueContainmentPolicy` / `getAssCueContainment` / `groupSubtitleCuesByPlacement` / `groupSubtitleCuesByLayer` / `getSubtitleAbsolutePositionStyle` / `getSubtitleClipLayerStyle` |

---

## Hooks

### `usePanelScrollState`
- File: `src/hooks/usePanelScrollState.js`
- Purpose: one-stop panel scroll memory hook; combines normalized `scrollTop`, measured `Scroller` restore wiring, and optional cache persistence callbacks.
- Signature:
```js
usePanelScrollState({
  cachedState = null,
  isActive = false,
  onCacheState = null,
  cacheKey = null,
  requireCacheKey = false,
  restoreAnimated = false,
  restoreReady = true,
  onRestoreComplete = null
})
```
- Returns:
  - `scrollTop`
  - `setScrollTop(rawTop)` for an explicit programmatic reset/restore request
  - `commitScrollTop(rawTop)` for explicitly flushing the latest scroll position before navigation/back
  - `commitLatestScrollTop()` for synchronously persisting the most recent continuously tracked Sandstone position
  - `cancelScrollRestore()` for user-input interruption
  - `captureScrollTo` (pass to `Scroller` `cbScrollTo`)
  - `handleScroll` (pass to `Scroller` `onScroll` without triggering React state updates)
  - `handleScrollStop` (pass to `Scroller` `onScrollStop`)
- Use when:
  - panel has cached state and should restore scroll on return.
  - panel wants keyed cache (`cacheKey`), e.g. per library id/item id.
  - panel must persist scroll before leaving, e.g. Back/item navigation can happen before `onScrollStop`.
- Sandstone note: normal `onScroll`/`onScrollStop` commits never schedule another restore. Restore completion is reported only after the measured scroller position reaches the cached target, or after bounded retries establish the reachable clamped position.
- Do not wrap `MediaVirtualGrid` with this hook merely to duplicate Enact virtualization behavior. Uniform grids cache query, filters, loaded pages, pagination cursors, and focused item ID while `MediaVirtualGrid` owns rendered-item virtualization and focus restoration.
- `MediaVirtualGrid` disables Sandstone boundary overscroll and focus zoom by default. It uses two overhang rows in Normal mode and one in Performance/Performance+; override either behavior only for a measured panel-specific requirement. Focus restoration is captured only when a query becomes active, so focus changes observed during scrolling or pagination cannot become late restore commands.
- Example:
```js
const {
  captureScrollTo,
  handleScroll,
  handleScrollStop,
  commitLatestScrollTop
} = usePanelScrollState({
  cachedState,
  isActive,
  onCacheState
});
```

### `useLibraryPagination`
- File: `src/views/library-panel/hooks/useLibraryPagination.js`
- Purpose: panel-local pagination flow for Library:
  - first-page fetch
  - load-more fetch
  - dedupe by id
  - request-id race guards
- Use when:
  - Library panel needs deterministic paged loading behavior without regrowing panel orchestrator logic.

### `useMediaFilterState`
- File: `src/hooks/useMediaFilterState.js`
- Purpose: shared state controller for Library-like media filters:
  - cached active filter ids
  - popup draft filter ids
	  - popup first focus
	  - staged apply/reset/close behavior, committing changed filters only after Popup `onHide`
	  - cached-state wrapping for panels that persist filters with scroll state
- Use with:
  - `MediaFilterControls` for the trigger/popup UI.
  - `MEDIA_FILTER_OPTIONS` and `mediaItemMatchesFilters` for shared filter semantics.

### Media Filter Utilities
- File: `src/utils/mediaFilters.js`
- Purpose: shared filter definitions and item matching for Library-like grids.
- Exports:
  - `MEDIA_FILTER_OPTIONS`
  - `normalizeMediaFilterIds`
  - `areMediaFilterSelectionsEqual`
  - `buildMediaFilterState`
  - `mediaItemMatchesFilters`
- Use when:
  - a panel needs consistent `All`, `Unplayed`, `Played`, `Favorites`, or `My Requests` filtering.
  - filter state must be normalized before caching or comparison.

### Home Section Paging Utilities
- Files:
  - `src/views/home-section-panel/utils/homeSectionPaging.js`
  - `src/views/home-section-panel/utils/homeSectionSource.js`
- Purpose:
  - normalize legacy array pages and plugin paging envelopes without losing server cursors;
  - collect a bounded page of locally filtered Home View More results;
  - preserve continuation when a scan window contains no matching items;
  - route semantic HSS My Requests View More sections through authoritative
    `/Breezyfin/MyRequests` paging while leaving their Home preview on HSS.
- Use when:
  - Home View More consumes a section whose server response may be either an array or a
    structured `{items, nextStartIndex, hasMore}` page.

### `useScrollerScrollMemory` and `useCachedScrollTopState`
- File: `src/hooks/useScrollerScrollMemory.js`
- Purpose:
  - `useCachedScrollTopState`: normalizes persisted `scrollTop` and keeps state stable.
  - `useScrollerScrollMemory`: low-level continuous tracking, synchronous commit, measured/cancellable smooth restore with bounded retries, and cleanup primitives.
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
  - the visible Toolbar `onBack` action, so pointer/ENTER and remote Back use the same layer order
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

### `usePanelHistory`
- File: `src/App/hooks/usePanelHistory.js`
- Purpose: App-shell history controller for panel snapshots:
  - records current panel/view state before navigation.
  - restores selected item, library, Home section, playback options, previous item, return view, and player-control visibility.
  - exposes latest-snapshot updates for panels that need to flush cached state before returning.
- Use when:
  - editing App-level navigation or crash/back recovery behavior.
  - adding a new top-level view that must restore through normal back/history flow.

### `usePanelBackHandlerRegistry`
- File: `src/App/hooks/usePanelBackHandlerRegistry.js`
- Purpose: App-shell registry for current panel back handlers:
  - stores one back-handler ref per top-level panel.
  - exposes register callbacks passed into panel children.
  - runs registered handlers before App-level fallback navigation.
- Use when:
  - adding a new top-level panel with local layered back behavior.
  - changing App back-routing behavior.

### `useIntegrationPanelCache`

- File: `src/App/hooks/useIntegrationPanelCache.js`
- Purpose: own Watchlist, Calendar, SyncPlay, and WatchParty panel snapshots,
  normalized cache actions, explicit section clears, session resets, and shared
  `UserDataChanged` invalidation without regrowing `App.js`. Provider panels may cache
  bounded result pages, cursors, warnings, and scroll state, but never provider secrets.

### `useAppScreensaver`
- File: `src/App/hooks/useAppScreensaver.js`
- Purpose: own authenticated non-player inactivity handling:
	- normalizes the configured timeout and extends a shared inactivity deadline on key, pointer, mouse fallback, click, wheel, view, and setting activity.
	- pauses Spotlight only when Breezyfin owns the pause, remembers the focused control, and restores both safely after wake.
	- consumes the first wake interaction so the underlying control is not activated.
	- publishes App runtime suspension while the opaque screensaver covers the app.
	- disables and cleans up automatically on Player/Login/session transitions and unmount.
- Pure timeout, eligibility, Spotlight-ownership, clamp, bounce, smooth-heading, and bounded random-message helpers live in `src/utils/screensaver.js`.

### `useInactivityDeadline`
- File: `src/hooks/useInactivityDeadline.js`
- Purpose: maintain one inactivity deadline and one scheduled check. High-frequency activity updates the deadline timestamp without clearing/recreating the timer.
- Use for App/Player inactivity surfaces; do not add per-event timeout-reset loops.

### `useRuntimeSuspended`
- File: `src/hooks/useRuntimeSuspension.js`
- Purpose: expose shared, reason-owned runtime suspension for opaque App/Player screensavers.
- `setRuntimeSuspension(reason, true|false)` adds/removes one owner's reason; work resumes only after every owner clears its reason.
- Covered optional loops should subscribe through `useRuntimeSuspended()`. Non-React operational checks may use `getRuntimeSuspended()`.

### `usePlayerPausedScreensaver`
- File: `src/views/player-panel/hooks/usePlayerPausedScreensaver.js`
- Purpose: own the separate paused-playback inactivity flow:
  - activates only after playback has started and remains paused for the configured screensaver timeout.
  - consumes the first wake input so controls underneath are not activated; Player keyboard and interaction-reveal hooks must defer while it is active.
  - resumes playback only for ENTER/OK/Space; pointer, wheel, directional, and Back inputs wake to paused controls.
  - remains disabled while loading, errors, track popups, subtitle decisions, skip prompts, or debug overlays are active.
- Reuses `ScreensaverOverlay` for presentation but intentionally does not share App-shell Spotlight/session behavior.

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
  registerBackHandler,
  onBack
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
  isProgressSliderTarget,
  screensaverActive
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

### `usePlayerInteractionReveal`
- File: `src/views/player-panel/hooks/usePlayerInteractionReveal.js`
- Purpose: reveal PlayerPanel controls from non-keyboard interaction without changing focus or playback state:
  - wheel/scroll-wheel always reveals controls
  - pointer/mouse movement reveals controls only near the top or bottom screen edge
  - an optional `blockedRef` prevents covered surfaces such as the paused-player screensaver from leaking wake input into control visibility
  - passive listeners and `requestAnimationFrame` throttling keep the handler low-risk during playback
- Signature:
```js
usePlayerInteractionReveal({
  enabled,
  disabled,
  showControls,
  setShowControls,
  lastInteractionRef
})
```

### `usePlayerVideoLoader`
- File: `src/views/player-panel/hooks/usePlayerVideoLoader.js`
- Purpose: encapsulate PlayerPanel playback negotiation:
  - settings + playback profile resolution (including subtitle burn-in format policy)
  - media source/session selection
  - audio/subtitle initialization
  - stream URL construction (direct/hls/transcode)
  - immutable playback runtime context and resolved source descriptor creation
  - awaitable, cancellable video-element mount admission that preserves the original
    prepared-plan transaction and allocates no playback generation before the surface exists

  Loader code must not assign `video.src`, attach HLS.js, call `video.load()`, or own
  startup watchdogs. It hands the resolved descriptor to `usePlayerSourcePipeline`.

### `usePlayerSourcePipeline`
- File: `src/views/player-panel/hooks/usePlayerSourcePipeline.js`
- Purpose:
  - own native DirectPlay/DirectStream and native-HLS source assignment
  - reset the native media element before HLS.js attachment and only after destroying
    HLS.js during teardown/replacement
  - own HLS.js creation, listeners, first-fragment readiness, and destruction
  - replace native-HLS with a new generation-bound HLS.js source token when needed
  - own the independent 30-second HLS.js engine bootstrap deadline
  - invalidate the active source token before replacement, terminal failure, Back, or
    unmount

  Recovery hooks classify failures and choose policy actions, but must invoke this
  pipeline for source teardown/replacement rather than mutating the video element or
  constructing an initial HLS.js instance.

### `usePlayerStartupCoordinator`
- File: `src/views/player-panel/hooks/usePlayerStartupCoordinator.js`
- Purpose:
  - register and invalidate generation-bound source tokens
  - combine source-engine, generation-matched client-subtitle, and SyncPlay readiness
  - request native playback after assignment without waiting for `canplay`
  - request HLS.js playback only after the first current-generation fragment is buffered
  - keep SyncPlay paused until its authoritative `Unpause`
  - accept `play()` resolution, `playing`, or genuine timeline movement only after the
    current engine is ready and its `play()` request has been issued
  - own the single post-`play()` startup deadline and DirectPlay fallback
  - finalize loading/reporting exactly once

  HLS engine bootstrap, client-rendered subtitle preparation, and post-`play()` progress
  use independent 30-, 15-, and 12-second deadlines. Server burn-in bypasses the client
  subtitle gate, the 15-second deadline remains fixed across readiness rerenders, and a
  previous source's renderer-ready state cannot satisfy a replacement source.

### `usePlayerAudioTransition`
- File: `src/views/player-panel/hooks/usePlayerAudioTransition.js`
- Purpose:
  - pause native playback while preserving the attached frame during PlaybackInfo preparation
  - serialize one runtime audio transition and lock Player actions other than Back
  - commit one replacement source only after negotiation succeeds
  - restore metadata position before releasing startup and preserve the prior play state
  - save the selected preference only after the replacement becomes ready
  - restore the previous source in a fresh paused generation after post-swap failure
  - close the superseded Jellyfin session after successful readiness, and close an unused
    or failed replacement session before decision handoff, cancellation, or rollback
  - use the SyncPlay bridge's server-clock position and wait for Ready/Unpause authority

  Native runtime changes must use this hook rather than enabling `AudioTrackList` and
  waiting an arbitrary delay. HLS.js remains in `usePlayerSeekAndTrackSwitching` because
  it exposes an explicit generation-bound `AUDIO_TRACK_SWITCHED` event.

### `usePlayerPlaybackReporter`
- File: `src/views/player-panel/hooks/usePlayerPlaybackReporter.js`
- Purpose:
  - report `PlaybackStart` once per item/session/generation
  - serialize progress, pause, seek, and stop reporting
  - coalesce timer ticks while preserving the latest forced state; forced callers await
    their queued report attempt rather than the request that happened to be active
  - stop captured superseded sessions through immutable session metadata without stopping
    reporting for the active replacement, with bounded item/session deduplication
  - keep reporting failures best-effort and isolated from Player controls

### `usePlayerPlaybackContext`
- File: `src/views/player-panel/hooks/usePlayerPlaybackContext.js`
- Purpose: centralize playback option/session context derivation and current track ref sync:
  - `buildPlaybackOptions()` using selected audio/subtitle track state
	  - `buildPlaybackOptions({remapTrackIntents: true})` for next/previous/autoplay, carrying semantic audio and subtitle intent without reusing stale raw stream indexes
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
- Purpose: centralize seek behavior and track switching reload/session-override behavior for HLS/direct/transcode flows:
  - explicit same-item stream indexes replace stale cross-item semantic intents;
  - HLS.js audio/subtitle assignments are registered before mutation and committed only
    after the matching current-generation switch event;
  - failed/timed-out HLS audio changes enter `usePlayerAudioTransition`;
  - native runtime audio changes always enter the controlled prepare/swap flow.
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
  - initial focus seeding for series/non-series with playback-first order (`Audio -> Subtitle -> Play`)
  - focus target helper methods used by interaction handlers
  - cast/season focus scrolling behavior
- Returns key methods:
  - `scrollCastIntoView()`, `scrollSeasonIntoView()`
  - `focusTopHeaderAction()`, `focusEpisodeSelector()`
  - `focusEpisodeCardByIndex()`, `focusEpisodeInfoButtonByIndex()`, `focusEpisodeFavoriteButtonByIndex()`, `focusEpisodeWatchedButtonByIndex()`
  - `focusSeasonCardByIndex()`, `focusSeasonWatchedButton()`, `focusBelowSeasons()`
  - `focusNonSeriesAudioSelector()`, `focusNonSeriesSubtitleSelector()`, `focusNonSeriesPrimaryPlay()`
  - `handleDetailsPointerDownCapture()`, `handleDetailsPointerClickCapture()`
- Focus policy note:
  - prefer playback controls for first-section targeting (`Audio -> Subtitle -> Play`), then fall back as needed.
  - do not use header favorite/watched actions as automatic first-focus targets.

### `useMediaDetailsSectionNavigation`
- File: `src/views/media-details-panel/hooks/useMediaDetailsSectionNavigation.js`
- Purpose: centralize intro/content section navigation behavior for Media Details:
  - section snap thresholds and wheel capture
  - focus-driven section switching
  - smooth-scroll-preserving focus handoff when returning from section two to section one
  - intro top-nav `DOWN` routing and section primary focus targets
  - scroller stop snap behavior
- Returns key methods:
  - `hasSecondarySection`
  - `focusSectionOnePrimary()`
  - `focusAndShowFirstSection()`
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
- Repeated pointer events in the current mode are ref-guarded and must not schedule React or Spotlight updates.
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

### `usePerformanceMode`
- File: `src/hooks/usePerformanceMode.js`
- Purpose: expose one normalized `normal`, `performance`, or `performance-plus` profile while staying synchronized with runtime settings.
- Use when a component must change JavaScript behavior, such as virtual-grid overhang or Jellyfin image request size, rather than only CSS animation behavior.

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
  - advance through ordered fallback URLs after format fallback is exhausted
  - hide broken image
  - mark container with placeholder class
  - optional callback
- Signature:
```js
useImageErrorFallback(placeholderClassName, {
  fallbackUrls,
  onCandidateChange,
  onError,
  resetKey
})
```

### `useToastMessage`
- File: `src/hooks/useToastMessage.js`
- Purpose: standard toast lifecycle with optional fade-out staging, opt-in stacking,
  keyed persistent messages, and targeted dismissal. In stacked mode, persistent entries
  reserve their slots: transient entries evict older transient entries first and are
  suppressed when every configured slot is persistent.
- Signature:
```js
useToastMessage({ durationMs = 2000, fadeOutMs = 0, stack = false, maxVisible = 1 })
```
- Returns:
  - `toastMessage`
  - `toastVisible`
  - `toastMessages`
  - `setToastMessage`
  - `clearToast`
  - `dismissToast(key)`

### `usePluginMediaItemActivation`

- File: `src/hooks/usePluginMediaItemActivation.js`
- Purpose: share linked Jellyfin-item navigation and external provider-details
  activation between HSS Discovery rows and Calendar without weakening the service facade.
  Pass panel `isActive`; the hook invalidates pending lookups on deactivation/unmount
  and lets only the latest activation navigate.
- `src/hooks/usePluginMediaItemPopup.js` composes this activation with the standard
  external-item Popup state used by Home and Home View More. It enriches external
  Discovery records on demand; keep Home feed records compact because genres and
  credits are requested only after the popup opens.

### `useAppSyncPlayCoordinator`

- File: `src/App/hooks/useAppSyncPlayCoordinator.js`
- App composition: `src/App/hooks/useAppSyncPlayNavigation.js`
- Context: `src/contexts/SyncPlayContext.js`
- Purpose: own authenticated SyncPlay group membership, authoritative queue snapshots,
  reconnect verification, suspended/following state, queue replacement consent, and
  cross-item Player navigation. Keep current-video timing in `useNativeSyncPlay`.
- All group and queue changes must use the coordinator commit path so React state and
  `groupRef` / `queueRef` change synchronously. Reconnect completions must match the
  current coordinator generation, authenticated session, requested group, and active
  membership before they can commit.
- Queue identity and playback revision are separate: play/pause/position changes can
  notify a suspended client without causing duplicate cross-item navigation. App-level
  `SyncPlayCommand` handling surfaces remote changes while browsing; `useNativeSyncPlay`
  deduplicates current-item commands and uses `syncPlayStartupBridge` to hold the source
  paused until video, subtitle, and Jellyfin clock readiness are available. Reporting
  Ready never calls `video.play()`; only the authoritative Unpause completes startup.
- Following and suspended modes must also update Jellyfin `IgnoreWait`: following clients
  participate in the group readiness barrier, while suspended clients remain in the
  group without blocking other participants.
- Queue replacement follows Jellyfin's Waiting/Ready contract and must not send an
  immediate Unpause. `startGroupPlayback` is an explicit troubleshooting override for a
  group that remains visibly stuck in Waiting; it must never run automatically.
- Preserve both `StateUpdate` and full `GroupUpdate` WebSocket messages so participant,
  state, and readiness diagnostics do not become stale while playback commands continue.
- Queue replacement waits must consult the live service snapshot before registering and
  must reject pending waiters on logout/unmount so early WebSocket updates and stale
  async continuations cannot create false timeouts.
- `useAppSyncPlayNavigation` binds the coordinator to App history, Player entry, normal
  Play interception, and local Player-Back suspension without regrowing `App.js`.

### Watchlist data helpers

- `src/services/jellyfin/watchlistApi.js` pages the native Jellyfin Likes source by item
  type and title without building a whole-library client snapshot.
- `src/services/jellyfin/watchlistInsightsApi.js` consumes capability-gated plugin pages
  for progress/completion, movie history, and statistics. Statistics tolerate older
  plugin responses without `TopMovies`, while validating the field when present.
- `src/views/watchlist-panel/hooks/useWatchlistInsights.js` owns separate 60-second
  client cache entries for each advanced Watchlist tab, stale-while-refresh behavior,
  in-flight request deduplication, active-tab pagination, sequential first-page warming,
  and user-data invalidation. Background warming stops when the panel becomes inactive
  and never fetches later pages.
- `src/utils/discoveryMediaItems.js` normalizes provider records for HSS Home rows while
  preserving linked Jellyfin IDs and authenticated provider artwork.
- `src/utils/providerItemMetadata.js` normalizes optional provider summary fields for
  `ProviderItemPopup`. Compact feeds may provide only type/year/rating; genres and
  director/writer credits render only when the provider contract supplies them.

### `useProviderPanelShell`

- File: `src/hooks/useProviderPanelShell.js`
- Purpose: share provider-panel external-details state, generation guard, scroll
  restoration, merge-safe cache writes, toolbar actions, and Popup-first Back handling.
  Keep the Popup mounted until `onHide` clears its item so Sandstone can release
  Spotlight ownership normally.
- `reportProviderFailure(scope, failure)` records only bounded structured provider
  fields (`provider`, `operation`, `reason`, `upstreamStatus`, and `failedPage`) and
  is dormant unless the runtime Diagnostics master setting is enabled. Do not log
  raw provider responses or authenticated upstream URLs from panel code.
- `reportProviderDiagnostic(scope, diagnostic)` records bounded successful-empty and
  filtering summaries only while Diagnostics is enabled. Use it to distinguish an
  empty provider result from transport failure without logging payloads or URLs.

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

### Poster card variants
- File: `src/utils/posterMediaCardVariants.js`
- Purpose: normalize `PosterMediaCard` semantic skins (`poster-grid` and `landscape-grid`) without coupling shared card markup to panel CSS-module maps.

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
- Purpose: keep focused cards visible in horizontal scrollers with configurable edge buffer. `getHorizontalScrollAdjustment()` is the pure offset-based decision helper; Home rows cache row-level viewport metrics, invalidate them on resize/layout changes, and coalesce immediate focus corrections through one animation frame rather than measuring rectangles or queuing smooth scrolls for every focus event.

### Player and media detail helpers

- `src/utils/syncTiming.js`
  - median bounded server-clock offset sampling and shared 250 ms/two-second drift
    correction policy for native SyncPlay and JellyWatchParty.
- `src/utils/imageUrls.js`
  - shared image URL builders for item/user image URLs with preferred image format handling.
- `src/utils/reactKeys.js`
  - `buildMediaListItemKey(scope, item, index)` keeps repeated media list keys unique when Jellyfin returns duplicate item ids.
- `src/views/player-panel/utils/playerPanelHelpers.js`
  - `formatPlaybackTime(seconds)`
  - `getPlayerHeaderTitle(item)` (builds formatted episode title with season/episode prefix when available)
  - `getPlayerTrackLabel(track)`
  - `getSkipSegmentLabel(segmentType, hasNextEpisode?)`
  - `getPlayerErrorBackdropUrl(item, imageApi)`
- `src/views/player-panel/utils/episodeNavigation.js`
  - `getNextEpisodeForItem(service, item)`
  - `getPreviousEpisodeForItem(service, item)`
- `src/utils/playbackDiagnostics.js`
	- `createPlaybackDiagnostic(entry)`
	- `appendPlaybackDiagnostic(diagnostics, entry)`
	- optional diagnostic trails are created only when the persisted `enableDiagnostics` master setting is active; operational playback metadata remains separate.
- `src/utils/appLogger.js`
	- `configureAppDiagnostics({enabled, verbose})` applies the runtime master and restores native console methods when disabled.
	- `appendAppLog(...)` buffers ordinary diagnostic records; `appendCriticalAppLog(...)` / `logCriticalAppError(...)` persist bounded critical failures immediately when build capability exists.
	- `REACT_APP_ENABLE_PERSISTENT_LOGS=1` supplies capability only; `REACT_APP_DISABLE_PERSISTENT_LOGS=1` disables all persistence.
- `src/utils/playbackSelection.js`
	- pure media-source, audio, dynamic-range, and subtitle-policy selection shared by Jellyfin negotiation and Player runtime hooks.
- `src/services/jellyfin/playback-api/subtitleBurnIn.js`
  - `getSubtitleBurnInDiagnosticMessage(subtitlePolicy)` and `validateSubtitleBurnInTranscodingUrl(mediaSource, subtitleStreamIndex)` keep burn-in diagnostics and URL validation out of the main PlaybackInfo orchestrator.
- `src/views/player-panel/utils/playbackOverride.js`
  - `buildPlaybackOverride(options)`
  - `resolveVideoSeekSeconds(video, seekOffset?)`
- `src/views/player-panel/utils/hlsErrorClassification.js`
  - `classifyHlsError(errorData)` separates fragment-load, buffer-pressure, append-buffer, gap/stall, and unknown HLS.js runtime failures before recovery/fallback handling.
- `src/views/player-panel/utils/playerVideoLoaderHelpers.js`
  - `buildPlayerPlaybackSettingsSnapshot({settings, playbackOptions, playbackOverride, forceTranscodeOverride})`
  - `resolveInitialTrackSelection({audioStreams, subtitleStreams, playbackOptions, playbackOverride, pickPreferredAudio, pickPreferredSubtitle})`
  - `resolvePlaybackVideoUrl({service, itemId, mediaSource, playbackInfo, resolvedPlayMethod})`
  - `selectHlsEnginePreference({isHls, isHdrLikeStream, nativeHlsSupported, hlsJsSupported})`
- `src/views/player-panel/utils/playerDiagnostics.js`
  - `buildMediaSegmentsLoadDiagnostic({segments?, error?})`
- `src/views/player-panel/utils/subtitleRendererStatus.js`
  - `normalizeSubtitleRendererFailureReason(reason, fallback?)`
  - `getSubtitleBurnInFallbackStatus({fallbackAllowed?, fallbackAlreadyStarted?, hasFallbackHandler?})`
- `src/views/player-panel/utils/subtitleRenderer.js`
  - `normalizeSubtitleEvents(events)` and `normalizeSubtitleText(text, options)` normalize event/raw subtitle payloads into cue objects for the Player overlay. Keep SRT/VTT sanitization and public subtitle APIs here.
  - `findActiveSubtitleCues(events, currentTimeSeconds)` returns normalized active cues for overlay rendering, preserving long-running overlapping cues and sorting active output by ASS layer/source order so higher layers render above lower layers.
- `src/views/player-panel/utils/subtitleRendererAss.js`
  - Parses ASS/SSA and decorates active cues. Supported features include placement,
    alignment, margins, wrapping, `\pos(x,y)`, `\move(...)`, and `\org(x,y)`.
  - Supports `@font` vertical-writing intent, source-authored font sizes, source colors,
    fonts, borders, shadows, blur, fades, common vector paths, drawing clip masks, `\pbo`,
    style reset, scale, spacing, rotation, skew, and interpolated `\t(...)` transforms.
  - Approximates active `\K` and `\kf` sweeps. It does not provide full ASS parity for
    advanced vector edge cases, karaoke collision and outline behavior, arbitrary text
    vector masks, mixed inline `\org` cases, collision resolution, or advanced vertical
    layout and collision behavior.
- `src/views/player-panel/utils/subtitleRendererAssAlignment.js`
  - ASS/SSA alignment normalization helpers, including ASS numpad `\an1`-`\an9` alignment and legacy SSA `\a` alignment mapping.
- `src/views/player-panel/utils/subtitleRendererAssColors.js`
  - ASS/SSA `&HAABBGGRR` color conversion and alpha application helpers shared by lightweight ASS style parsing.
- `src/views/player-panel/utils/subtitleRendererAssClip.js`
  - Parses bounded rectangular ASS `\clip(x1,y1,x2,y2)` and
    `\iclip(x1,y1,x2,y2)` values. It also parses common vector `\clip(...)` and
    `\iclip(...)` paths.
  - The overlay clip layer renders direct and inverse rectangular clips. The SVG drawing
    layer renders vector clips for drawing cues.
  - Arbitrary text vector masks remain future work because CSS clipping cannot represent
    them accurately without mask composition.
- `src/views/player-panel/utils/subtitleRendererAssDimensions.js`
  - Shared ASS script-resolution defaults and scaled-value conversion helpers used by baseline ASS parsing and active `\t(...)` transform interpolation.
- `src/views/player-panel/utils/subtitleRendererAssDrawing.js`
  - Converts common ASS `\p` vector drawing payloads into safe SVG path metadata.
  - Supports move, line, cubic Bezier, close-path, and B-spline `s` and `p` commands. It
    converts splines into SVG cubic segments.
  - Applies `\pbo` baseline offsets and vector `\clip` or `\iclip` masks in the SVG drawing
    layer. Full libass-equivalent edge-case behavior remains future work.
- `src/views/player-panel/utils/subtitleRendererAssFontSize.js`
  - Resolves ASS absolute `\fsN` and relative `\fs+N` / `\fs-N` font-size overrides against the active source style size.
- `src/views/player-panel/utils/subtitleRendererAssOrigin.js`
  - Lifts shared run transforms into cue-level transform metadata when an absolute ASS cue provides `\org(x,y)`, so the overlay can rotate/scale around the authored source-frame origin instead of each text span's center.
- `src/views/player-panel/utils/subtitleRendererAssPosition.js`
  - Normalizes ASS source-frame coordinates into script-resolution metadata and viewport percentages for `\pos(...)`, `\move(...)`, and `\org(...)`.
- `src/views/player-panel/utils/subtitleRendererAssKaraoke.js`
  - Provides basic ASS karaoke support for `\k`, `\K`, `\kf`, and `\ko`.
  - Tracks syllable timing, source primary and secondary colors, and progress for active
    cues. It approximates active `\K` and `\kf` sweeps with a CSS text gradient.
  - Do not add advanced collision or outline behavior until the TV renderer can produce it
    accurately at an acceptable cost.
- `src/views/player-panel/utils/subtitleRendererAssTransform.js`
  - Parses ASS `\t(...)` timing/acceleration payloads, strips transform target tags from baseline inline styling, and interpolates active numeric/color transform state for scale, rotation, skew, border, shadow, blur, spacing, and font size.
- `src/views/player-panel/utils/subtitleOverlaySettings.js`
  - `getSubtitleOverlayAttributes(settings, controlsVisible)` normalizes subtitle appearance settings into overlay `data-*` attributes.
  - `groupSubtitleCuesByPlacement(cues)` groups active cues into top/middle/bottom and left/center/right render buckets.
  - `getSubtitleAbsolutePositionStyle(cue)` preserves source-authored ASS anchors, including intentional off-screen placement, while the subtitle stage clips output to the visible video surface.
- `src/views/player-panel/utils/subtitleRendererAssStage.js`
  - Maps `PlayResX/Y` coordinates across the contained video stage.
  - Uses valid `LayoutResX/Y` only for source-layout and pixel-aspect metadata.
  - Classifies cue geometry before bounded containment. Explicit positions, clips,
    drawings, motion, transform origins, transforms, and intentional off-screen positions
    preserve authored behavior.
  - Applies the bounded initial and font-ready fit only to ordinary unpositioned text boxes.
  - `subtitleTextLoader.js` prefers raw ASS/SSA documents for Breezyfin Lightweight so PlayRes, style tables, and inline geometry survive delivery. It retains event-first loading for SRT/VTT and falls back to Jellyfin `Stream.js` only when raw ASS/SSA delivery is unavailable.
- `src/views/media-details-panel/utils/mediaDetailsHelpers.js`
  - language display mapping, track summary labels
  - season/episode image fallback resolution
  - episode badge/date/runtime + progress/played predicates

### Login panel local hooks
- `src/views/login-panel/hooks/useLoginBackdrops.js`
  - centralizes saved-server backdrop loading, saved-user fallback backdrops, rotation timers, transition state, and image fallback/error handling.
  - `deferLoading` suppresses saved-account network work only while App validates automatic startup restoration; normal Login and Switch User views leave it disabled.

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
- `src/views/player-panel/components/PlayerPlaybackDecisionPrompt.js`
  - shared themed, first-focus popup for blocking audio, dynamic-range, subtitle
    burn-in, and no-subtitle playback decisions.
  - bitrate-limited Dolby Vision exposes original-quality/video-copy playback and
    lower-bitrate SDR transcoding as separate explicit actions.
  - HDR is offered only after a bounded PlaybackInfo preflight finds DirectPlay,
    DirectStream, or audio-only transcoding with video copy.
- `src/views/player-panel/components/PlayerToast.js`
  - lightweight player toast shell.
- `src/views/player-panel/components/PlayerControlsOverlay.js`
  - top/bottom player controls shell (back, progress, transport, tracks, volume).
- `src/views/player-panel/components/PlayerSyncPlayPopup.js`
  - native SyncPlay participants, connection, and group status surface.
- `src/views/player-panel/components/PlayerWatchPartyPopup.js`
  - authenticated room participants, ready state, and bounded chat surface.

### Player panel local hooks
- `src/views/player-panel/hooks/usePlayerGroupSessions.js`
  - composes native SyncPlay and JellyWatchParty hooks, their mutual player-command
    precedence, layered popup Back handling, controls state, and popup props.
- `src/views/player-panel/hooks/usePlayerKeyboardShortcuts.js`
  - centralizes player keyboard/media key handling with seek/context guards.
- `src/views/player-panel/hooks/usePlayerVisibilitySync.js`
  - centralizes external/internal controls-visibility synchronization effects.
- `src/views/player-panel/hooks/usePlayerInteractionReveal.js`
  - centralizes wheel and pointer-edge PlayerPanel controls reveal behavior without focus/playback side effects.
- `src/views/player-panel/hooks/usePlayerVideoLoader.js`
  - admits load transactions, prepares immutable PlaybackPlans, validates item/request/
    override identity, and delegates the admitted transaction to the commit boundary.
- `src/views/player-panel/hooks/playerPlaybackPlanCommit.js`
  - publishes negotiated session/track/debug state, handles required decisions before
    attachment, creates the immutable runtime context, and commits exactly one resolved
    source descriptor after rechecking transaction identity.
- `src/views/player-panel/hooks/usePlayerSourcePipeline.js`
  - exclusively owns native/native-HLS/HLS.js attachment, source tokens, engine bootstrap,
    native-HLS fallback, and teardown.
- `src/views/player-panel/hooks/usePlayerStartupCoordinator.js`
  - gates startup on engine/client-subtitle/SyncPlay readiness and owns the independent
    subtitle and post-play deadlines, initial native-track discovery, and replacement
    metadata/position restoration.
- `src/views/player-panel/hooks/usePlayerAudioTransition.js`
  - owns serialized native runtime audio prepare/swap/rollback behavior.
- `src/views/player-panel/hooks/usePlayerPlaybackContext.js`
  - centralizes playback option/session-context derivation and selected-track ref synchronization.
- `src/views/player-panel/hooks/usePlayerSkipOverlayState.js`
  - centralizes skip-intro/next-episode prompt transitions and skip/dismiss handlers.
- `src/views/player-panel/hooks/usePlayerSeekAndTrackSwitching.js`
  - centralizes seek logic, event-confirmed HLS track changes, subtitle reload isolation,
    and delegation of native audio changes to the transition coordinator.
- `src/views/player-panel/hooks/usePlayerTrackPopupHandlers.js`
  - centralizes Player track-popup click handlers that parse `data-track-index`.
- `src/views/player-panel/hooks/usePlayerPlaybackCommands.js`
  - centralizes player command handlers (`play/pause/retry/end/back`) above low-level stop/recovery.
- `src/views/player-panel/hooks/usePlayerCoreControls.js`
  - centralizes stop lifecycle, startup-watch timer cleanup, and skip-overlay focus targeting.
- `src/views/player-panel/hooks/usePlayerPlaybackDecision.js`
  - centralizes generation-bound, serialized playback decision state and one-shot
    reloads for audio replacement, the bitrate-only DV original-quality attempt,
    staged dynamic-range fallback, subtitle burn-in, and user-confirmed no-subtitle
    playback. Its synchronous reservation prevents concurrent runtime callbacks from
    replacing an active or teardown-pending prompt.
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
  - receives an immutable `playbackRuntimeContext` captured before source attachment.
    HLS callbacks verify their bound source/runtime identity before teardown. Recovery
    continuations use a separate item/generation/load-request transaction after intentional
    teardown because the old source token has correctly been invalidated.
  - executes pure actions from `buildPlayerRecoveryAction`; current transactions claim the
    generation-aware recovery ledger before publishing a replacement override or load.
- `src/views/player-panel/hooks/usePlayerLifecycleEffects.js`
  - centralizes player lifecycle effects (item bootstrap, control hide timers, stall watchdog, focus/cleanup timers).
- `src/views/player-panel/hooks/useNativeSyncPlay.js`
  - timing-only adapter for the currently attached video; app-level membership, queue,
    navigation, suspension, and replacement decisions live in
    `src/App/hooks/useAppSyncPlayCoordinator.js` and `src/contexts/SyncPlayContext.js`.
  - maps native group updates/commands to the player, queues commands until server-clock
    synchronization is available, reports readiness through `syncPlayStartupBridge`,
    and starts only on authoritative Unpause before applying the shared 250 ms correction
    and two-second hard-seek thresholds.
  - reports Buffering only after a continuous three-second wait and reports Ready when
    playback recovers, matching Jellyfin's tolerance for transient media stalls.
  - applies at most one hard seek for each authoritative SyncPlay command; later drift
    for that command converges through bounded playback-rate correction so buffering
    cannot create a repeated seek loop.

### Player playback utilities

- `src/views/player-panel/utils/playbackGeneration.js`
  - creates the sole playback-generation writer with `current`, `isCurrent`,
    unpublished `invalidate`, and published `allocate` operations.
- `src/views/player-panel/utils/playbackRecoveryLedger.js`
  - owns bounded, atomic recovery claims and their generation/item carry scopes.
- `src/views/player-panel/utils/playbackRecoveryTransaction.js`
  - owns one recovery operation across intentional source teardown and rejects it after
    item, playback-generation, load-request, exit, supersession, or unmount changes.
- `src/views/player-panel/utils/playbackPlan.js`
  - converts decorated PlaybackInfo plus player inputs into a callback-free, deeply
    immutable plan containing source, track, decision, range, runtime, and diagnostics
    inputs. It never owns DOM, HLS.js, React setters, or source tokens.
- `src/views/player-panel/utils/playbackLifecycleReducer.js`
  - rejects stale generation/source events and derives the visible startup/recovery phase;
    refs remain authoritative for mutable media and final event validation.
- `src/views/player-panel/utils/hlsStartupMeasurements.js`
  - records bounded current-source HLS startup timing only while Diagnostics is enabled.
- `src/views/player-panel/utils/playerRecoveryPolicy.js`
  - classifies recovery context into pure actions. Hooks remain responsible for ledger
    claims, user decisions, asynchronous execution, and post-await transaction checks.
- `src/views/player-panel/hooks/useJellyWatchParty.js`
  - maps isolated room events to host/guest player control, readiness, reconnect,
    clock-offset, drift-correction, and chat behavior.

### Media details panel local hooks
- `src/views/media-details-panel/hooks/useMediaDetailsFocusDebug.js`
  - centralizes optional focus/scroll debug tracing lifecycle.
- `src/views/media-details-panel/hooks/useMediaDetailsFocusOrchestrator.js`
  - centralizes pointer/5-way focus routing and initial focus seeding.
- `src/views/media-details-panel/hooks/useMediaDetailsSectionNavigation.js`
  - centralizes section snap + first/second section focus switch behavior (including deferred first-section focus after smooth scroll).
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
- `src/views/settings-panel/utils/settingsViewModel.js`
  - centralizes pure Settings presentation decisions, including tab section visibility, Smart/manual subtitle control state, popup selected-state helpers, and wipe-cache confirmation copy.
- `src/views/settings-panel/capabilityFormatting.js`
  - formatting/normalization helpers for runtime capability values and refresh period settings.

### Shared constants
- `src/constants/time.js`
  - `JELLYFIN_TICKS_PER_SECOND` for consistent Jellyfin tick/second conversion across services and player hooks.
- `src/constants/toast.js`
  - `PANEL_TOAST_CONFIG` shared toast timing preset for panel toasts.

### Runtime capability helpers
- `src/utils/platformCapabilities.js`
  - public runtime capability facade (probe cache, refresh TTL, and Luna refresh entrypoint).
- `src/utils/platform-capabilities/*`
  - decomposed internals (`runtimeComputation`, `runtimeCache`, `lunaProbe`, `lunaOverrides`, `runtimeSignature`, and related helpers).

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
