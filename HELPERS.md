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
| Centralize PlayerPanel video loading/session selection flow | `usePlayerVideoLoader` |
| Gate Player startup until video and selected client subtitles are ready | `usePlayerStartupCoordinator` |
| Centralize PlayerPanel playback option/session-context builders | `usePlayerPlaybackContext` |
| Centralize PlayerPanel skip overlay + next-episode prompt state machine | `usePlayerSkipOverlayState` |
| Centralize PlayerPanel seek + track-switching flow | `usePlayerSeekAndTrackSwitching` |
| Centralize PlayerPanel track-popup `data-track-index` click handlers | `usePlayerTrackPopupHandlers` |
| Centralize PlayerPanel play/pause/retry/end command handlers | `usePlayerPlaybackCommands` |
| Centralize PlayerPanel stop/focus control handlers | `usePlayerCoreControls` |
| Centralize PlayerPanel subtitle decision prompts, including HDR/DV burn-in consent, image-subtitle burn-in fragility consent, no-subtitle fallback consent, and one-shot fallback reloads | `usePlayerSubtitleBurnInConsent` |
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
| Resolve ordered card and panel artwork fallbacks | `getPosterCardImageUrls` / `getLandscapeCardImageUrls` / `getMediaPanelBackdropUrls` |
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
| Classify Player subtitle/burn-in recovery without side effects | `playerRecoveryPolicy` helpers |
| Keep PlayerPanel loader decisions pure/testable | `buildPlayerPlaybackSettingsSnapshot` / `resolveInitialTrackSelection` / `resolvePlaybackVideoUrl` / `selectHlsEnginePreference` |
| Normalize PlayerPanel subtitle renderer failure and fallback status names, and route renderer failures into burn-in/no-subtitle consent decisions | `normalizeSubtitleRendererFailureReason` / `getSubtitleBurnInFallbackStatus` / `runSubtitleBurnInFallbackDecision` |
| Resolve raw subtitle fetch format priority from Jellyfin subtitle codecs | `getRawSubtitleFormats` |
| Fetch subtitle event/raw text/binary payloads and resolve bitmap delivery candidates for client-side rendering | `getSubtitleTrackEvents` / `getSubtitleTrackText` / `getSubtitleTrackBinary` / `getBitmapSubtitleDeliveryCandidates` / `buildSubtitleStreamUrl` |
| Fetch, normalize, place, cache, and render PlayerPanel subtitle cues, including safe SRT/VTT inline formatting, escaped safe subtitle tags, long-running overlapping cue lookup, ASS layer/source render ordering, lightweight ASS/SSA alignment including legacy `\a` codes, margins, wrap style, `\pos(x,y)` / `\move(...)` placement, `\org(x,y)` transform origins for absolute transformed cues, bounded rectangular `\clip(x1,y1,x2,y2)` / `\iclip(x1,y1,x2,y2)`, common vector `\clip(...)` / `\iclip(...)` masks for SVG drawing cues, source-authored absolute/relative font size, colors, fonts, borders, shadows, blur, simple/complex fades, basic karaoke timing/color states, active `\K`/`\kf` sweep approximation, common `\p` vector drawing paths including B-spline `s`/`p` conversion and `\pbo` baseline offsets, style reset, scale, spacing, rotation/skew, and interpolated numeric/color `\t(...)` transforms | `normalizeSubtitleEvents` / `normalizeSubtitleText` / `findActiveSubtitleCues` / `subtitleRendererAss` / `subtitleRendererAssAlignment` / `subtitleRendererAssClip` / `subtitleRendererAssDimensions` / `subtitleRendererAssDrawing` / `subtitleRendererAssFontSize` / `subtitleRendererAssOrigin` / `subtitleRendererAssPosition` / `subtitleRendererAssTransform` / `usePlayerSubtitleRenderer` |
| Normalize numeric Breezyfin subtitle appearance settings shared by Settings and Player overlay | `normalizeNumericSetting` / `adjustNumericSetting` / `SUBTITLE_OVERLAY_FONT_SIZE_RANGE` / `SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE` |
| Render ASS/SSA through stable-visible experimental external renderers using app-fetched subtitle content when Smart Subtitle Handling selects them; Auto still resolves to Breezyfin lightweight rendering, while explicit libass, libass Manual Canvas, JASSUB, JASSUB Manual Canvas, ASS.js, and Burn-in options remain selectable in every release channel; packaging prepares JASSUB static assets, applies version-guarded webOS patches that force Canvas2D and require explicit worker/WASM/font URLs, preserves external-renderer chunks/assets in stable and develop builds, transpiles ASS.js/JASSUB renderer chunks for webOS packaging, validates copied JASSUB static assets, and fails if generated `chunk.jassub-worker.*` or `chunk.em-pthread.*` chunks reappear; external renderer init waits for an attached video source, libass and JASSUB can also run in manual caller-owned canvas diagnostic modes, their intervals share `rendererRuntimeSuspension`, and renderer-layer diagnostics report playback phase, video state, external layer/canvas/ASS.js box visibility, hit-test target, dimensions, JASSUB backend, active DOM node counts, canvas pixel probe state, manual sync counters, and renderer update counters for real-TV debugging | `subtitle-renderers/subtitleRendererRegistry.js` plus `libassRenderer`, `jassubRenderer`, `assJsRenderer`, `manualCanvasLayout`, `rendererRuntimeSuspension`, `videoSourceReady`, and `rendererDiagnostics`; `scripts/prepare-subtitle-package-assets.cjs`; `scripts/copy-subtitle-assets.cjs`; `scripts/subtitle-assets/jassubCanvas2dPatch.cjs` |
| Render PGS/PGSSUB bitmap subtitles through Smart Subtitle Handling before burn-in fallback; image subtitles are detached from Jellyfin playback requests, the selected subtitle index is preserved for client rendering, Auto tries libbitsub first and then libpgs using DeliveryUrl/raw URL candidates before optional binary preflight, and renderer disposal, bitmap diagnostics, warning-gated image subtitle burn-in, and no-subtitle fallback consent stay explicit | `src/utils/bitmapSubtitleRenderers.js`; `subtitle-renderers/libbitsubRenderer.js`; `subtitle-renderers/libpgsRenderer.js`; `getSubtitleTranscodePolicy`; `getBitmapSubtitleDeliveryCandidates`; `getSubtitleTrackBinary`; `PlayerSubtitleBurnInPrompt` |
| Normalize PlayerPanel subtitle overlay appearance, map ASS coordinates onto the visible video stage, group region cues by ASS layer, clamp absolute cues, and apply full-stage rectangular/inverse/vector clips | `getSubtitleOverlayAttributes` / `getSubtitleVideoStageGeometry` / `getAssCoordinatePlane` / `groupSubtitleCuesByPlacement` / `groupSubtitleCuesByLayer` / `getSubtitleAbsolutePositionStyle` / `getSubtitleClipLayerStyle` |

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
  playbackSessionRef,
  appendPlaybackDiagnostic
});
```

### `usePlayerStartupCoordinator`
- File: `src/views/player-panel/hooks/usePlayerStartupCoordinator.js`
- Purpose: keep attached video paused until its media source and selected client subtitle renderer are ready, then start playback once. Client-rendered subtitle preparation times out after 15 seconds and enters the existing explicit fallback/consent flow rather than silently starting without subtitles.

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
- Purpose: standard toast lifecycle with optional fade-out staging and opt-in stacking for player diagnostics.
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
  - Lightweight ASS/SSA parsing and active-cue decoration, including placement, alignment, margins, wrapping, `\pos(x,y)`, `\move(...)`, `\org(x,y)` transform origins for absolute transformed cues, source-authored absolute/relative font size, source colors/fonts/borders/shadows/blur, simple and complex fades, active `\K`/`\kf` sweep approximation, common vector drawing paths, drawing-cue vector clip masks, `\pbo` drawing baseline offsets, style reset, scale, spacing, rotation/skew, and interpolated numeric/color `\t(...)` transforms. It is still an approximation layer, not full ASS parity for advanced vector drawing edge cases, advanced karaoke collision/outline behavior, arbitrary text vector masks, mixed inline `\org` transform-origin cases, collision resolution, or vertical text layout.
- `src/views/player-panel/utils/subtitleRendererAssAlignment.js`
  - ASS/SSA alignment normalization helpers, including ASS numpad `\an1`-`\an9` alignment and legacy SSA `\a` alignment mapping.
- `src/views/player-panel/utils/subtitleRendererAssColors.js`
  - ASS/SSA `&HAABBGGRR` color conversion and alpha application helpers shared by lightweight ASS style parsing.
- `src/views/player-panel/utils/subtitleRendererAssClip.js`
  - Parses bounded rectangular ASS `\clip(x1,y1,x2,y2)` / `\iclip(x1,y1,x2,y2)` and common vector `\clip(...)` / `\iclip(...)` paths. Direct and inverse rectangular clips render through the subtitle overlay clip layer; vector clips render for SVG drawing cues. Arbitrary text vector masks remain explicit future scope because CSS clipping cannot represent them accurately without mask composition.
- `src/views/player-panel/utils/subtitleRendererAssDimensions.js`
  - Shared ASS script-resolution defaults and scaled-value conversion helpers used by baseline ASS parsing and active `\t(...)` transform interpolation.
- `src/views/player-panel/utils/subtitleRendererAssDrawing.js`
  - Parses common ASS `\p` vector drawing payloads into safe SVG path metadata for the Player subtitle overlay. Supports move, line, cubic Bezier, close-path, B-spline `s`/`p` commands by converting splines into SVG cubic segments, and `\pbo` drawing baseline offsets so drawing payload text never leaks into subtitle text. Vector `\clip` / `\iclip` masks are applied inside the SVG drawing layer; full libass-equivalent drawing edge-case behavior remains explicit future scope.
- `src/views/player-panel/utils/subtitleRendererAssFontSize.js`
  - Resolves ASS absolute `\fsN` and relative `\fs+N` / `\fs-N` font-size overrides against the active source style size.
- `src/views/player-panel/utils/subtitleRendererAssOrigin.js`
  - Lifts shared run transforms into cue-level transform metadata when an absolute ASS cue provides `\org(x,y)`, so the overlay can rotate/scale around the authored source-frame origin instead of each text span's center.
- `src/views/player-panel/utils/subtitleRendererAssPosition.js`
  - Normalizes ASS source-frame coordinates into script-resolution metadata and viewport percentages for `\pos(...)`, `\move(...)`, and `\org(...)`.
- `src/views/player-panel/utils/subtitleRendererAssKaraoke.js`
  - Basic lightweight ASS karaoke support for `\k`, `\K`, `\kf`, and `\ko`: tracks syllable timing, source primary/secondary colors, active progress for currently displayed cues, and a CSS text-gradient sweep approximation for active `\K`/`\kf` syllables. Keep advanced collision/outline behavior out of this helper until it can be rendered accurately and cheaply on TV.
- `src/views/player-panel/utils/subtitleRendererAssTransform.js`
  - Parses ASS `\t(...)` timing/acceleration payloads, strips transform target tags from baseline inline styling, and interpolates active numeric/color transform state for scale, rotation, skew, border, shadow, blur, spacing, and font size.
- `src/views/player-panel/utils/subtitleOverlaySettings.js`
  - `getSubtitleOverlayAttributes(settings, controlsVisible)` normalizes subtitle appearance settings into overlay `data-*` attributes.
  - `groupSubtitleCuesByPlacement(cues)` groups active cues into top/middle/bottom and left/center/right render buckets.
  - `getSubtitleAbsolutePositionStyle(cue)` preserves source-authored ASS anchors, including intentional off-screen placement, while the subtitle stage clips output to the visible video surface.
- `src/views/player-panel/utils/subtitleRendererAssStage.js`
  - Maps `PlayResX/Y` coordinates independently across the contained video stage, uses valid `LayoutResX/Y` only for source-layout and pixel-aspect metadata, and calculates bounded containment for unpositioned cues. Source-authored positions, moves, origins, rotations, drawings, and clips bypass Breezyfin fitting; ordinary dialogue and page-style cues use a cached, at-most-two-frame measured fit in `PlayerSubtitleOverlay`.
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
- `src/views/player-panel/components/PlayerSubtitleBurnInPrompt.js`
  - generic subtitle decision popup for HDR/DV burn-in consent, image-subtitle burn-in fragility consent, and no-subtitle fallback consent.
- `src/views/player-panel/components/PlayerToast.js`
  - lightweight player toast shell.
- `src/views/player-panel/components/PlayerControlsOverlay.js`
  - top/bottom player controls shell (back, progress, transport, tracks, volume).

### Player panel local hooks
- `src/views/player-panel/hooks/usePlayerKeyboardShortcuts.js`
  - centralizes player keyboard/media key handling with seek/context guards.
- `src/views/player-panel/hooks/usePlayerVisibilitySync.js`
  - centralizes external/internal controls-visibility synchronization effects.
- `src/views/player-panel/hooks/usePlayerInteractionReveal.js`
  - centralizes wheel and pointer-edge PlayerPanel controls reveal behavior without focus/playback side effects.
- `src/views/player-panel/hooks/usePlayerVideoLoader.js`
  - centralizes playback source/session selection and video load orchestration.
- `src/views/player-panel/hooks/usePlayerStartupCoordinator.js`
  - gates startup on video/client-subtitle readiness and owns the bounded subtitle preparation timeout.
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
- `src/views/player-panel/hooks/usePlayerSubtitleBurnInConsent.js`
  - centralizes subtitle decision prompt state, one-shot bitmap/HDR burn-in override reloads, and user-confirmed no-subtitle fallback.
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
