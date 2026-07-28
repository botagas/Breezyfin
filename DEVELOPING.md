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
- [`WORKAROUNDS.md`](./WORKAROUNDS.md)
- [`HELPERS.md`](./HELPERS.md)
- [`THEMES.md`](./THEMES.md)
- [`COMPONENTS.md`](./COMPONENTS.md)
- [`VIEWS.md`](./VIEWS.md)
- [`CHECKS.md`](./CHECKS.md)
- [`TODOS.md`](./TODOS.md)

## Verification and audits

Use [`CHECKS.md`](./CHECKS.md) as the single source of truth for recurring validation and release gates.
Runtime framework packages are intentionally pinned to Enact 4.9.8, Sandstone 2.9.13, React/ReactDOM 18.3.1, and iLib 14.21.1. Use the repository-local Enact CLI 7.3.3 through npm scripts; do not install or invoke a separate global Enact CLI in CI. Enact 5/Limestone/React 19 remains a compatibility investigation rather than part of routine dependency maintenance.
`npm run pack` and `npm run pack-p` use Enact's supported `--no-linting` build option because CLI 7's embedded Webpack lint configuration enables React 19 compiler-only rules. `npm run lint` remains mandatory and uses the checked-in React 18-aware flat configuration; CI and release workflows run it before every build.
Enact CLI 7.3.2+ aliases `react-is` from its React 19 tool dependency by default. Breezyfin redirects that build alias through the explicitly pinned `react-is-18` npm package alias so React 18 elements remain valid to Sandstone PropTypes in development builds. Keep both aliases together; `npm run audit:runtime-deps` validates the contract.
Keep `package.json` `enact.publicUrl` set to `.` even though `homepage` points to GitHub. webOS loads the application through `file://`, so root-relative or repository-prefixed entry assets produce a black screen. Postpack validates that generated script and stylesheet entry paths remain relative.
After stable `npm run pack-p`, `ares-package dist` is the final webOS CLI smoke check to confirm the production `dist/` can be packaged into an IPK.
For develop/non-stable packaging validation, run `REACT_APP_ENABLE_PERSISTENT_LOGS=1 REACT_APP_RELEASE_CHANNEL=develop npm run pack-p`, then immediately run `ares-package dist` against that flagged `dist/`.
`REACT_APP_ENABLE_PERSISTENT_LOGS=1` provides logging capability only. `enableDiagnostics` remains the runtime authority and defaults off. `REACT_APP_DISABLE_PERSISTENT_LOGS=1` is an absolute build-time disable, including critical crash persistence.

Home currently defaults to the cinematic content prototype. Build with `REACT_APP_HOME_DESIGN_VARIANT=current` to restore the previous Hero/row presentation for A/B performance and navigation testing without maintaining a duplicate panel implementation. Header geometry is theme-owned and is not selected by this flag.

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
- `npm run audit:sensitive-logging` (raw playback URLs or console arguments that bypass shared redaction)
- `npm run audit:portability` (machine-specific paths and unredacted token literals)
- `npm run audit:private-refs` (external-client/test-media references and backup artifacts outside intentional README attribution)
- `npm run audit:runtime-deps` (mixed or unexpected Enact, Sandstone, React, or iLib production generations)
- `npm run audit:licenses` (stale production dependency and copied-asset notices)
- `npm run audit:service-boundaries` (direct Jellyfin API/request-module imports outside services/tests)
- `npm run audit:import-cycles` (local circular imports in production app source)
- `npm run audit:hotspots` (informational file/function hotspot and baseline-growth
  report; only parser or baseline corruption fails)
- `npm run audit:hotspots:update` (explicitly refresh the reviewed hotspot baseline)
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
Before simplifying dependency aliases, package-source patches, internal Sandstone selectors,
mixed scroll ownership, or legacy compatibility styles, check `WORKAROUNDS.md`. Update that
register in the same change whenever an active workaround or its removal condition changes.

Release packaging runs `prepare:release-notices` before either pack command and copies `LICENSE` plus `THIRD_PARTY_NOTICES.txt` into `dist/`. Production packages omit subtitle-engine declarations and source maps that are not needed at runtime; develop packages retain useful source maps. Run `npm run report:package-size` after a build to inspect application, iLib, subtitle-engine, font, and source-map footprint groups.

## Shared building blocks (prefer these first)

- Back handling: `src/hooks/usePanelBackHandler.js`
- Input mode sync (`pointer`/`5way`): `src/hooks/useInputMode.js`
- Popup/menu state: `src/hooks/useDisclosureMap.js`
- Popup/menu handler map: `src/hooks/useDisclosureHandlers.js`
- Popup first-action focus-on-open helper: `src/hooks/usePopupInitialFocus.js`
- Shared Search/Library browse controls and overlay placement: `src/components/MediaBrowseControls.js`, `src/components/MediaBrowseOverlay.js`
- Collapsible Library/Favorites search state: `src/hooks/useCollapsibleBrowseSearch.js`
- Map lookups by id/key: `src/hooks/useMapById.js`
- Item metadata fetch/state: `src/hooks/useItemMetadata.js`
- Toast lifecycle: `src/hooks/useToastMessage.js`
- Linked/external plugin item activation: `src/hooks/usePluginMediaItemActivation.js`
- Provider panel popup/request/scroll/toolbar shell: `src/hooks/useProviderPanelShell.js`
- Provider failures: pass structured request/problem results to
  `useProviderPanelShell().reportProviderFailure`; it is diagnostics-gated and strips
  arbitrary provider payload fields before logging. User-facing empty/error states
  must remain functional while Diagnostics is disabled.
- Shared toast UI primitive (Player/Media Details/Settings): `src/components/BreezyToast.js`
- Track preference persistence: `src/hooks/useTrackPreferences.js`
- Image fallback handling: `src/hooks/useImageErrorFallback.js`
- App panel history snapshots: `src/App/hooks/usePanelHistory.js`
- App panel back handler registry: `src/App/hooks/usePanelBackHandlerRegistry.js`
- App capability-panel cache/invalidation: `src/App/hooks/useIntegrationPanelCache.js`
- App authenticated inactivity/screensaver lifecycle: `src/App/hooks/useAppScreensaver.js` with pure timing/bounce/Spotlight ownership helpers in `src/utils/screensaver.js`
- Paused-player inactivity/wake lifecycle: `src/views/player-panel/hooks/usePlayerPausedScreensaver.js`; keep it separate because ENTER resumes playback while other wake inputs preserve pause.
- Login rotating backdrop orchestration: `src/views/login-panel/hooks/useLoginBackdrops.js`
- Runtime platform/playback capability detection + cache controls: `src/utils/platformCapabilities.js` (+ decomposed internals in `src/utils/platform-capabilities/`)
- Runtime image format preference + fallback helpers: `src/utils/imageFormat.js`
- Player remote/media-key handler: `src/views/player-panel/hooks/usePlayerKeyboardShortcuts.js`
- Player controls-visibility synchronization: `src/views/player-panel/hooks/usePlayerVisibilitySync.js`
- Player wheel/pointer-edge controls reveal: `src/views/player-panel/hooks/usePlayerInteractionReveal.js`
- Player video load/session orchestration: `src/views/player-panel/hooks/usePlayerVideoLoader.js`
- Player video/client-subtitle readiness gate: `src/views/player-panel/hooks/usePlayerStartupCoordinator.js`
- Player playback option/session-context derivation: `src/views/player-panel/hooks/usePlayerPlaybackContext.js`
- Player skip/prompt state machine: `src/views/player-panel/hooks/usePlayerSkipOverlayState.js`
- Player seek/track-switch flow: `src/views/player-panel/hooks/usePlayerSeekAndTrackSwitching.js`
- Player track-popup click handlers: `src/views/player-panel/hooks/usePlayerTrackPopupHandlers.js`
- Player play/pause/retry/end command handlers: `src/views/player-panel/hooks/usePlayerPlaybackCommands.js`
- Player stop/focus control handlers: `src/views/player-panel/hooks/usePlayerCoreControls.js`
- Player subtitle decision prompt/reload handling for HDR/DV burn-in, image-subtitle burn-in fragility, and no-subtitle fallback consent: `src/views/player-panel/hooks/usePlayerSubtitleBurnInConsent.js`
- Player layered back navigation decisions: `src/views/player-panel/hooks/usePlayerBackNavigation.js`
- Player audio/subtitle popup disclosure wiring: `src/views/player-panel/hooks/usePlayerDisclosures.js`
- Player adjacent-episode checks and progress ticker: `src/views/player-panel/hooks/usePlayerEpisodeProgress.js`
- Player optional runtime diagnostic state: `src/views/player-panel/hooks/usePlayerRuntimeDiagnostics.js`
- Player media event callbacks: `src/views/player-panel/hooks/usePlayerMediaEventHandlers.js`
- Player episode/surface interaction handlers: `src/views/player-panel/hooks/usePlayerEpisodeAndSurfaceHandlers.js`
- Player recovery/fallback handlers: `src/views/player-panel/hooks/usePlayerRecoveryHandlers.js`
- Player lifecycle effects: `src/views/player-panel/hooks/usePlayerLifecycleEffects.js`
- Player native SyncPlay/WatchParty composition: `src/views/player-panel/hooks/usePlayerGroupSessions.js`
- App-level SyncPlay membership/queue/navigation coordination:
  `src/App/hooks/useAppSyncPlayCoordinator.js`, composed into App navigation through
  `src/App/hooks/useAppSyncPlayNavigation.js`; Player's native SyncPlay hook is the timing
  adapter for the current video and must not perform cross-item navigation. Coordinator
  commits update React state and live refs together; Leave/reconnect work may clear or
  restore membership only after matching the current authenticated coordinator generation.
- SyncPlay Player startup: `src/views/player-panel/utils/syncPlayStartupBridge.js` joins
  `usePlayerStartupCoordinator` and `useNativeSyncPlay` without transferring queue
  ownership into Player. While following, buffer paused, report Ready only after video,
  subtitle, and clock readiness, and call `video.play()` only for authoritative Unpause.
- Playback runtime isolation: create the immutable context in
  `src/views/player-panel/utils/playbackRuntimeContext.js` before source attachment.
  Every HLS callback and asynchronous recovery continuation must match its bound HLS
  instance, runtime-context identity, and playback generation before taking action.
- Smart/manual subtitle burn-in policy: `src/utils/playbackSelection.js` (`getSubtitleTranscodePolicy`)
- Player client-side subtitle renderer/cue cache: `src/views/player-panel/hooks/usePlayerSubtitleRenderer.js`
- ASS/SSA renderer lifecycle: `src/views/player-panel/utils/subtitle-renderers/`; Breezyfin lightweight parsing is centered in `src/views/player-panel/utils/subtitleRendererAss.js` with focused helpers for alignment, colors, font size, origin/position, karaoke, clipping, common vector drawing paths, `@font` vertical-writing intent, and `\t(...)` transform interpolation, including B-spline `s`/`p` conversion to SVG cubic paths and `\pbo` drawing baseline offsets. Lightweight ASS/SSA must prefer the raw subtitle document over Jellyfin `Stream.js` events because event payloads may omit script-level PlayRes and style metadata; `Stream.js` remains a degraded fallback when raw delivery fails. The lightweight overlay must map ASS coordinates and source dimensions onto the visible `object-fit: contain` video stage rather than the full TV viewport. `PlayResX/Y` remains the authored coordinate plane; valid `LayoutResX/Y` contributes source-layout/pixel-aspect scaling and must not replace PlayRes positioning. Preserve explicit positions, moves, origins, rotations, drawings, clips, and intentionally off-screen positions without applying style margins or safe-area correction. Only ordinary unpositioned cues use the bounded measured containment pass. The stage itself clips all output to the visible video surface. Breezyfin lightweight remains Auto, while libass, libass Manual Canvas, JASSUB, JASSUB Manual Canvas, ASS.js, and Burn-in are explicit experimental/manual renderer options available in every release channel for troubleshooting. The manual-canvas libass and JASSUB modes are diagnostic paths for separating video-attached timing issues from native-video canvas compositor issues. JASSUB's packaged default font, sourcemap source, version-guarded webOS Canvas2D worker patch, and version-guarded static-asset entry patch are prepared by `scripts/prepare-subtitle-package-assets.cjs` and `scripts/subtitle-assets/jassubCanvas2dPatch.cjs`; the Canvas2D patch is required because JASSUB's WebGL path is unreliable on webOS, and the static-asset entry patch prevents Webpack from bundling JASSUB worker/WASM fallback chunks. libass workers, Breezyfin's fallback subtitle font, JASSUB static worker/WASM/font assets, libbitsub/libpgs bitmap subtitle assets, and external renderer chunks are copied into `dist/` by `scripts/copy-subtitle-assets.cjs` after `npm run pack` / `npm run pack-p`. Stable and develop builds preserve external renderer chunks, transpile ASS.js/JASSUB/libbitsub/libpgs renderer chunks for webOS packaging, validate copied JASSUB static assets, and fail if generated `chunk.jassub-worker.*` or `chunk.em-pthread.*` runtime chunks reappear.
- Playback diagnostics: record optional probe/fallback outcomes via `src/utils/playbackDiagnostics.js` and expose them through PlayerPanel debug state instead of adding noisy user-facing toasts. Playback recovery metadata remains operational, but request snapshots, source summaries, decision trails, runtime diagnostic React state, and full external-renderer sampling must only run when `enableDiagnostics` is true. Tests that assert optional snapshots must opt in explicitly.
- Runtime diagnostics/logging: `src/utils/appLogger.js` patches console only while Diagnostics is enabled, batches ordinary records, and writes critical AppCrashBoundary records immediately through a separate bounded path. AppCrashBoundary is the only owner of global error and unhandled-rejection listeners.
- Sensitive-data handling: `src/utils/sensitiveData.js` is the single redaction boundary for URLs, request metadata, errors, objects, and console arguments. Never log raw media URLs or authorization/token headers; pass bounded summaries through this helper instead.
- Runtime diagnostics ownership: `src/hooks/useRuntimeDiagnostics.js` publishes the master collection state and clears shared media metric state when disabled. Collect optional metrics only after checking this context; do not merely hide their UI.
- Rendered integration tests: `src/testUtils/renderWithBreezyfin.js` installs the Sandstone theme and Spotlight root. Use it for Popup lifecycle, Toolbar focus, Player prompt Back, and virtual-grid restoration contracts after pure helper coverage is in place.
- Player recovery policy: pure subtitle/burn-in recovery classification lives in `src/views/player-panel/utils/playerRecoveryPolicy.js`; `usePlayerRecoveryHandlers` owns side effects and must not duplicate policy derivation.
- Runtime suspension: App and paused-Player screensavers publish suspension reasons through `src/hooks/useRuntimeSuspension.js`. Covered animation, clock, optional diagnostic, progress, stall, and manual subtitle-sync work must subscribe to that shared signal rather than adding screen-specific global flags.
- Inactivity handling: App and paused-Player screensavers share deadline scheduling through `src/hooks/useInactivityDeadline.js`; activity extends one deadline instead of rebuilding a timer per input event. Prefer pointer events, use mouse fallback only when Pointer Events are unavailable, and keep idle listeners passive.
- Jellyfin subtitle fetch contract: `src/services/jellyfin/subtitleApi.js` returns structured event and raw text results for client-side rendering.
- Plugin integration preferences: `src/utils/integrationPreferences.js` persists only
  server/user-scoped Home source and Likes-watchlist choices. Capabilities remain
  session memory and provider secrets/URLs never enter client storage.
- Realtime integration rule: one authenticated Jellyfin socket is owned by
  `src/services/jellyfin/websocketApi.js`; native SyncPlay and JellyWatchParty keep
  separate protocol state while sharing player timing/drift policy from
  `src/utils/syncTiming.js`.
- Sandstone Popup lifecycle: keep the Popup and its owning controls mounted through close, commit reload-causing state from `onHide`, and let Sandstone restore Spotlight before replacing result content.
- Shared Sandstone virtual grids: Search, Favorites, Home View More, and Library use `src/components/MediaVirtualGrid.js`. Do not add panel-specific DOM row calculations, manual pointer/5-way Spotlight disabling, app-owned coordinate navigation, or load-more sentinels. Panels own query/results paging and cache loaded pages plus focused item ID; Enact owns rendered-item virtualization and directional grid navigation. Keep the same grid mounted and Spotlight-disabled with empty items during query/filter reloads so pending Sandstone scroll updates cannot target an unmounted scroller. Keep overhang mode-aware and treat mounted virtual items as the image-loading window rather than layering native lazy loading on top.
- Shared media-card images: use `src/components/MediaCardImage.js` with ordered candidates from `src/utils/mediaItemUtils.js`. Keep card reveal opacity-only and advance through tagged/item/parent/untagged candidates before showing a placeholder.
- Toolbar DOWN routing: use Toolbar's explicit `onNavigateDown` contract for panel entry; picker/menu scopes take priority over panel-level navigation and must not be inferred from broad `toolbar-*` prefixes.
- Toolbar Back routing: `usePanelToolbarActions` exposes the same layered Back callback to both App/remote handling and the visible Toolbar action. Nested panel state must get first refusal before Toolbar disclosures and the Home/history fallback.
- Cross-item playback: carry `audioTrackIntent` and `subtitleTrackIntent`, then remap both against the new media source before compatibility probes. Raw stream indices are item-local and must not cross episode boundaries.
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
- Settings rows use the panel-local static variants in `SettingsStaticItems.js`, composed from Sandstone `ItemBase` / `SwitchBase` and standard Enact touch/Spotlight decorators without Sandstone's marquee controller or measurement decorator. Keep stable ellipsis and complete accessible labels/popup values; do not replace these controls with custom HTML focus implementations.

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
- For a uniform grid inside `Panels`, use `MediaVirtualGrid` rather than layering `usePanelScrollState()` over Sandstone. Keep app cache only for query, filters, loaded pages, pagination cursors, and stable focused item ID.
- Home rows load images progressively by row. Do not add one observer or load-state hook per card, and do not perform panel-wide top-chrome/layout scans for every horizontal focus move. Horizontal focus correction uses cached row offsets and immediate, animation-frame-coalesced scrolling; do not reintroduce per-card rectangle measurement or queued smooth scrolling.
- Server-configured Home publishes enabled descriptor titles before row data, represents each row as `pending`, `loading`, `ready`, `empty`, or `error`, and loads at most two rows concurrently near the active viewport. Resolved-empty rows are removed while the loading window advances to later descriptors. Individual row failures remain local and retryable; only descriptor/capability failure may select built-in Home. Keep distant row artwork deferred and expand descriptor rendering ahead of the viewport rather than mounting every configured row's cards at once. Retain fresh mounted Home content across short panel switches and revalidate it on user-data/integration invalidation or bounded staleness.
- Treat `setScrollTop()` as an explicit programmatic restore/reset request. Feed user movement through `handleScroll`/`handleScrollStop`; committing observed movement must not start another restore cycle.
- Consider a Sandstone restore complete only after the actual scroller offset reaches the target or bounded retries determine the reachable clamped offset.
- Only use `useScrollerScrollMemory()` directly when panel behavior is non-standard.

Other shared utilities:
- Reusable media-card overlays: `src/components/MediaCardStatusOverlay.js`
- Shared toolbar focus helper: `src/utils/toolbarFocus.js`
- Shared home row order constant: `src/constants/homeRows.js`
- Shared Jellyfin tick conversion constant: `src/constants/time.js`
- Shared panel toast timing preset: `src/constants/toast.js`
- Shared poster card variants: `src/utils/posterMediaCardVariants.js`; panels select semantic `poster-grid` / `landscape-grid` skins rather than mapping CSS-module class slots.
- Shared integer parser helper: `src/utils/numberParsing.js`
- Shared DOM node debug descriptor helper: `src/utils/domNodeDescription.js`
- Crash-boundary recovery context/action helper: `src/utils/crashRecovery.js`
- Shared player view helpers: `src/views/player-panel/utils/playerPanelHelpers.js`
- Shared episode next/previous helpers: `src/views/player-panel/utils/episodeNavigation.js`
- Shared media details formatting/image helpers: `src/views/media-details-panel/utils/mediaDetailsHelpers.js`

## Panel decomposition conventions

Library panel decomposition paths:
- `src/views/library-panel/hooks/` (`useLibraryPagination`)

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
- `src/App/hooks/` (`usePanelHistory`, `usePanelBackHandlerRegistry`, `useAppScreensaver`)
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
- `src/utils/playbackSelection.js` (pure media-source/audio selection and compatibility logic)
- `src/utils/playbackDiagnostics.js` (generic playback diagnostic construction/appending)
- `src/services/jellyfin/playbackProfileBuilder.js` (playback profile request context)
- `src/services/jellyfin/subtitleApi.js` (subtitle event/raw text fetch helpers for client-side rendering)
- `src/services/jellyfin/requestsApi.js` (session-cached plugin capability discovery,
  plugin-first My Requests paging, strict plugin error handling, and bounded tag fallback)
- `src/services/jellyfin/pluginFeaturesApi.js` (shared capability-gated paging and
  authenticated plugin image URL construction)
- `src/services/jellyfin/requestErrors.js` (bounded Problem Details parsing and safe
  Jellyfin request errors; raw provider bodies must not be embedded in errors/logs)
- `src/services/jellyfin/homeSectionsApi.js` (opaque Home descriptors/items)
- `src/services/jellyfin/discoveryApi.js` and `calendarApi.js` (read-only provider data;
  Discovery is surfaced through enabled HSS Home descriptors rather than a standalone tab)
- `src/services/jellyfin/watchlistApi.js` (native Likes read/mutation and scoped cache)
- `src/services/jellyfin/watchlistInsightsApi.js` (capability-gated Watchlist progress,
  history, and statistics pages supplied by the Breezyfin plugin)
- `src/views/watchlist-panel/` (Watchlist advanced-tab cache, refresh, warming, and
  invalidation behavior)
- `src/services/jellyfin/websocketApi.js` (single authenticated socket lifecycle and typed dispatch)
- `src/services/jellyfin/syncPlayApi.js` (native Jellyfin SyncPlay state and commands)
- `src/services/jellyfin/watchPartyApi.js` (isolated authenticated room protocol and in-memory JWT)

Service rule:
- Keep `jellyfinService` as a thin orchestrator; move domain-specific behavior to `src/services/jellyfin/*` modules.
- Reset capabilities, provider state, sockets, and scoped caches on login, logout,
  server/user switch, and access-token replacement. Never log access tokens, complete
  socket URLs, room passwords, or chat content.
- Cache successful plugin capabilities for the authenticated session, but cache
  transient capability failures only briefly so a plugin that finishes starting after
  the client can recover without logout/restart.

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
