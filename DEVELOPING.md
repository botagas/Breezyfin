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

The cinematic Home design is the default. Set
`REACT_APP_HOME_DESIGN_VARIANT=current` only to load the legacy Hero and row design for
A/B performance and navigation tests. Despite its name, `current` identifies the legacy
comparison path. The flag does not select header geometry; the active theme owns that
geometry.

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
- `npm run audit:repository-hygiene` (backup/temporary artifacts plus optional local-only literal checks)
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
- Player playback negotiation and resolved-source descriptors: `src/views/player-panel/hooks/usePlayerVideoLoader.js`
- Player native/native-HLS/HLS.js source ownership: `src/views/player-panel/hooks/usePlayerSourcePipeline.js`
- Player engine/client-subtitle/SyncPlay readiness gate: `src/views/player-panel/hooks/usePlayerStartupCoordinator.js`
- Player native runtime audio replacement coordinator: `src/views/player-panel/hooks/usePlayerAudioTransition.js`
- Player generation-aware serialized reporting: `src/views/player-panel/hooks/usePlayerPlaybackReporter.js`
- Player playback option/session-context derivation: `src/views/player-panel/hooks/usePlayerPlaybackContext.js`
- Player skip/prompt state machine: `src/views/player-panel/hooks/usePlayerSkipOverlayState.js`
- Player seek/track-switch flow: `src/views/player-panel/hooks/usePlayerSeekAndTrackSwitching.js`
- Player track-popup click handlers: `src/views/player-panel/hooks/usePlayerTrackPopupHandlers.js`
- Player play/pause/retry/end command handlers: `src/views/player-panel/hooks/usePlayerPlaybackCommands.js`
- Player stop/focus control handlers: `src/views/player-panel/hooks/usePlayerCoreControls.js`
- Player playback decision prompt/reload handling for explicit unsupported-audio switches,
  preflight-validated DV-to-HDR video-copy fallback, deterministic H.264 SDR fallback,
  bitrate-limited original-quality versus SDR choices, HDR/DV subtitle burn-in,
  image-subtitle burn-in fragility, and no-subtitle fallback consent:
  `src/views/player-panel/hooks/usePlayerPlaybackDecision.js`
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
  ownership into Player. While following, prepare the source paused, report Ready only
  after engine, subtitle, and clock readiness, and call `video.play()` only for
  authoritative Unpause. Normal native playback requests `video.play()` after source
  assignment and client-subtitle readiness; `canplay` is diagnostic evidence, not a gate.
- Source ownership belongs to `usePlayerSourcePipeline`. `usePlayerVideoLoader` negotiates
  and supplies an immutable descriptor but must not assign `video.src`, call
  `video.load()`, or construct HLS.js directly. During an admitted commit, the loader may
  request detach/attach operations through the source pipeline; only that pipeline mutates
  the media element or HLS.js lifecycle. HLS.js resets native media before
  attachment, receives no native lifecycle reset while it owns the attached MediaSource,
  calls `loadSource` from `MEDIA_ATTACHED`, and becomes engine-ready only after the first
  current-generation `FRAG_BUFFERED`. Recovery hooks choose bounded policy actions
  through the pipeline instead of owning source adapters.
- Playback negotiation now has an explicit prepare/commit boundary. Jellyfin networking
  remains in `src/services/jellyfin/playbackApi.js`; `preparePlaybackNegotiation` decorates
  the unchanged PlaybackInfo response, `buildPlaybackPlan` converts it into a pure frozen
  plan, and `usePlayerVideoLoader` validates the admitted request/item/override before
  delegating commit to `playerPlaybackPlanCommit.js`. Preparing a plan must not mutate
  the active video; commit publishes negotiated state and attaches exactly one source,
  while a required decision attaches no source.
- Video-surface availability is an awaitable admission barrier before commit. The admitted
  request retains its exact prepared plan and transition options while waiting; replacement,
  Back, unmount, timeout, or exit settles that same caller without allocating a playback
  generation or detaching the current source.
- Playback identity has three intentionally separate domains. `loadRequestId` cancels
  request and mount work, `playbackGeneration` identifies a logical playback attempt, and
  `sourceGeneration` identifies a physical adapter attachment. Only
  `createPlaybackGenerationAllocator` may advance the playback generation; callers
  invalidate or allocate through that boundary instead of mutating its ref.
- Recovery attempts are admitted through a recovery transaction before intentional
  teardown. The transaction captures item, playback-generation, and load-request ownership;
  after teardown it must still be current before publishing an override or starting a load.
  Runtime Transcode, subtitle, initial native-audio fallback, and session-rebuild paths
  share the same transaction manager so a newer recovery supersedes older pending work.
  A session rebuild must await load admission instead of scheduling an untracked restart.
  Recovery budgets are then claimed atomically through `createPlaybackRecoveryLedger`
  before replacement side effects. HLS, subtitle, dynamic-range, reload, and terminal state reset per
  generation. Session rebuild, transcode fallback, and native-audio fallback carry across
  replacement generations for the same item and reset only for a new item or explicit
  Retry.
- Player startup authority belongs to `usePlayerStartupCoordinator`. Source and loader
  hooks must not add competing playback-start timers. Engine bootstrap, client-subtitle
  preparation, and post-`play()` progress have independent deadlines. The subtitle
  deadline is keyed to the source/track and must not restart when engine readiness or
  renderer diagnostics rerender. Playback startup completion and Jellyfin `PlaybackStart`
  reporting are committed once from the active generation after its engine is ready,
  its `play()` request has been issued, and that request resolves or produces `playing`
  or genuine timeline advancement.
- The startup coordinator's reducer is authority only for visible lifecycle phase and
  legal generation/source transitions. Media objects, source tokens, timers, current
  time, and final event-validity checks remain in refs. `sourceVersion` remains an effect
  trigger and is not lifecycle authority.
- Runtime native audio selection belongs to `usePlayerAudioTransition`. Preparation may
  request PlaybackInfo while the paused old source/frame remains attached, but only
  `usePlayerVideoLoader` may commit the prepared result through `usePlayerSourcePipeline`.
  A committed replacement must restore metadata position before startup, preserve the
  previous play state, and roll back in a new paused generation on failure. Fixed delays,
  `loadeddata`, and `canplay` do not prove audible-track readiness. HLS.js may switch in
  place only after the matching current-instance `AUDIO_TRACK_SWITCHED` event.
  Forced paused-progress reporting is a best-effort barrier before negotiation. The audio
  transition continues after five seconds if Jellyfin does not settle the report. Once a
  replacement is ready, close the superseded Jellyfin PlaySession without affecting active reporting;
  on rollback close the failed replacement first, and on cancellation close whichever
  non-active prepared/superseded session normal Player teardown will not own.
- Initial explicit DirectPlay audio selection is a separate pre-start exception: the
  startup coordinator may inspect `AudioTrackList` through metadata/addtrack/change and
  apply it before playback. Its bounded discovery deadline triggers a communicated
  server remux/transcode; it must never be treated as audible readiness.
- The SyncPlay startup bridge also exposes the current server-clock playback target for
  local source replacement. A transition reports Ready after restoration and waits for
  authoritative Unpause rather than starting playback locally.
- Playback runtime isolation: create the immutable context in
  `src/views/player-panel/utils/playbackRuntimeContext.js` before source attachment.
  Every adapter replacement creates a new immutable source token. Native media events
  must match that token, video element, and attachment time; HLS.js media errors stay
  on its generation-bound `Hls.Events.ERROR` path. HLS callbacks, timers, and renderer-ready
  state must match the active token, runtime context, and playback generation. A recovery
  continuation that intentionally invalidated its source token must instead retain its
  recovery transaction across teardown and revalidate item/generation/request ownership
  before changing playback.
- SyncPlay resume requests must revalidate coordinator activity, group ID, reconnect
  generation, and authenticated service session after the server request settles. An
  obsolete completion must not change follow mode, participation, navigation, or notices.
- Playback reporting is serialized by `usePlayerPlaybackReporter`; direct reporting calls
  from controls, seek handlers, or timers would bypass pause-state coalescing and are not
  allowed. Forced callers await the queued snapshot they contributed. Explicit immutable
  session-stop reporting is reserved for handoff cleanup and must not stop the active
  replacement's progress interval.
- Playback safety decisions must be returned from PlaybackInfo negotiation and handled
  before source URL resolution or attachment. Dolby Vision video transcoding is blocked
  unless it is validated video-copy/audio-only work. A bitrate-only DV encode may first
  offer a one-shot retry at the runtime playback capability's maximum streaming bitrate
  so Jellyfin can select DirectPlay or video-copy DirectStream; this does not force remux.
  Full video encoding is not accepted as preserved HDR, while a confirmed SDR video
  encode is valid because Jellyfin tone maps the source and `*-rangetype` URL values
  describe accepted source capabilities.
  Playback decisions are serialized per generation so subtitle, audio, and range prompts
  cannot replace one another while teardown or Popup presentation is pending.
- Smart and manual subtitle burn-in policy:
  `src/utils/playbackSelection.js` (`getSubtitleTranscodePolicy`).
- Player client-side subtitle renderer and cue cache:
  `src/views/player-panel/hooks/usePlayerSubtitleRenderer.js`.

### Subtitle delivery

- Breezyfin Lightweight must prefer the raw ASS/SSA document. Jellyfin `Stream.js`
  events can omit script-level PlayRes and style metadata.
- If raw ASS/SSA delivery fails, `Stream.js` provides a degraded fallback.
- SRT and VTT retain event-first delivery.

### Lightweight ASS geometry

- `src/views/player-panel/utils/subtitleRendererAss.js` coordinates focused helpers for
  alignment, color, font size, origin, position, karaoke, clipping, drawings, and
  `\t(...)` transforms.
- Map ASS coordinates and source dimensions to the visible `object-fit: contain` video
  stage. Do not map them to the full TV viewport.
- `PlayResX/Y` is the authored coordinate plane. Valid `LayoutResX/Y` contributes
  source-layout and pixel-aspect scaling, but it must not replace PlayRes positioning.
- Preserve authored positions, moves, origins, rotations, drawings, clips, and intentional
  off-screen placement. Do not apply style margins or safe-area correction to those cues.
- Apply the bounded measured containment pass only to ordinary unpositioned cues.
- Clip all subtitle output to the visible video stage.

### Renderer options and diagnostics

- Auto selects Breezyfin Lightweight.
- libass, libass Manual Canvas, JASSUB, JASSUB Manual Canvas, ASS.js, and Burn-in remain
  explicit experimental or diagnostic options in every release channel.
- The manual-canvas libass and JASSUB modes distinguish video-attached timing problems
  from native-video canvas compositor problems.

### Subtitle renderer packaging

- `scripts/prepare-subtitle-package-assets.cjs` prepares JASSUB's default font and
  package sources.
- `scripts/subtitle-assets/jassubCanvas2dPatch.cjs` applies version-guarded patches. The
  patches force Canvas2D on webOS and prevent Webpack from bundling JASSUB worker/WASM
  fallback chunks.
- `scripts/copy-subtitle-assets.cjs` copies libass workers, the Breezyfin fallback font,
  JASSUB worker/WASM/font assets, libbitsub/libpgs assets, and external renderer chunks to
  `dist/` after `npm run pack` or `npm run pack-p`.
- Stable and develop builds must preserve and transpile the external renderer assets for
  webOS. Packaging must fail if `chunk.jassub-worker.*` or `chunk.em-pthread.*` runtime
  chunks reappear.
- Playback diagnostics: record optional probe and fallback outcomes through
  `src/utils/playbackDiagnostics.js`. Expose these outcomes through PlayerPanel debug state
  instead of user-facing toasts.
- Playback recovery metadata remains operational when Diagnostics is off. Request snapshots,
  source summaries, decision trails, runtime diagnostic React state, and full
  external-renderer sampling must run only when `enableDiagnostics` is true. Tests that
  assert optional snapshots must enable Diagnostics explicitly.
- HLS startup characterization is source-token and diagnostics gated. It records bounded
  first-fragment/buffer/start evidence and early recovery only while Diagnostics is on;
  disabling Diagnostics must allocate no measurement timers or trails. One current-source
  `FRAG_BUFFERED` remains the readiness rule until TV evidence justifies changing it.
- Runtime diagnostics and logging: `src/utils/appLogger.js` patches the console only while
  Diagnostics is enabled. It batches ordinary records. It writes critical
  AppCrashBoundary records immediately through a separate bounded path. AppCrashBoundary
  is the only owner of global error and unhandled-rejection listeners.
- Sensitive-data handling: `src/utils/sensitiveData.js` is the single redaction boundary for
  URLs, request metadata, errors, objects, and console arguments. Never log raw media URLs
  or authorization and token headers. Pass bounded summaries through this helper.
- Runtime diagnostics ownership: `src/hooks/useRuntimeDiagnostics.js` publishes the master
  collection state and clears shared media metrics when Diagnostics is disabled. Check this
  context before collecting optional metrics. Hiding the diagnostics UI is not sufficient.
- Rendered integration tests: `src/testUtils/renderWithBreezyfin.js` installs the Sandstone theme and Spotlight root. Use it for Popup lifecycle, Toolbar focus, Player prompt Back, and virtual-grid restoration contracts after pure helper coverage is in place.
- Player recovery policy: pure subtitle/burn-in recovery classification lives in `src/views/player-panel/utils/playerRecoveryPolicy.js`; `usePlayerRecoveryHandlers` owns side effects and must not duplicate policy derivation.
- Initial failures on a confirmed Transcode path are reported as probable server-transcoder
  startup failures only when playback has not started and the client receives an HLS
  fragment `5xx` or native media code 4. The user-facing message must not assert an exact
  FFmpeg cause; exit-code 159/systemd guidance belongs in diagnostics because Jellyfin
  does not normally expose the FFmpeg exit reason through the media response.
- Runtime suspension: App and paused-Player screensavers publish suspension reasons through
  `src/hooks/useRuntimeSuspension.js`. Covered animation, clock, optional diagnostic,
  progress, stall, and manual subtitle-sync work must subscribe to that shared signal. Do
  not add screen-specific global flags.
- Inactivity handling: App and paused-Player screensavers share deadline scheduling through
  `src/hooks/useInactivityDeadline.js`. Activity extends one deadline instead of rebuilding
  a timer for each input event. Prefer pointer events. Use mouse events only when Pointer
  Events are unavailable. Keep idle listeners passive.
- Jellyfin subtitle fetch contract: `src/services/jellyfin/subtitleApi.js` returns structured event and raw text results for client-side rendering.
- Plugin integration preferences: `src/utils/integrationPreferences.js` persists only
  server/user-scoped Home source and Likes-watchlist choices. Capabilities remain
  session memory and provider secrets/URLs never enter client storage.
- Realtime integration rule: one authenticated Jellyfin socket is owned by
  `src/services/jellyfin/websocketApi.js`; native SyncPlay and JellyWatchParty keep
  separate protocol state while sharing player timing/drift policy from
  `src/utils/syncTiming.js`.
- Sandstone Popup lifecycle: keep the Popup and its owning controls mounted through close, commit reload-causing state from `onHide`, and let Sandstone restore Spotlight before replacing result content.
- Shared Sandstone virtual grids: Search, Favorites, Home View More, and Library use
  `src/components/MediaVirtualGrid.js`.
  - Panels own queries, result paging, loaded-page caches, and the focused item ID.
  - Enact owns rendered-item virtualization and directional grid navigation.
  - Do not add panel-specific DOM row calculations, manual pointer/5-way Spotlight
    disabling, app-owned coordinate navigation, or load-more sentinels.
  - Keep the grid mounted and Spotlight-disabled with no items during query or filter
    reloads. This prevents pending Sandstone scroll updates from targeting an unmounted
    scroller.
  - Keep overhang mode-aware. Treat mounted virtual items as the image-loading window. Do
    not add native lazy loading to these items.
- Home View More normalizes both array responses and plugin page envelopes through
  `src/views/home-section-panel/utils/homeSectionPaging.js`. Filtered scans must carry
  the server-provided cursor and `hasMore` state forward; when a bounded scan window has
  no matches, continue to the next window before presenting a terminal empty state.
- HSS remains authoritative for Home row order and preview content. A descriptor with
  `Kind: MyRequests` is the semantic exception for View More: route its paged grid
  through `myRequests.v1` rather than inheriting HSS's bounded row result.
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
- Settings rows use the panel-local static variants in `SettingsStaticItems.js`. These
  variants combine Sandstone `ItemBase` or `SwitchBase` with standard Enact touch and
  Spotlight decorators. They omit Sandstone's marquee controller and measurement
  decorator. Keep stable ellipsis and complete accessible labels and popup values. Do not
  replace these controls with custom HTML focus implementations.

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
- Home rows load images progressively by row. Do not add an observer or load-state hook for
  each card. Do not perform panel-wide top-chrome or layout scans for each horizontal focus
  move. Horizontal correction uses cached row offsets and immediate scrolling that is
  coalesced by animation frame. Do not restore per-card rectangle measurement or queued
  smooth scrolling.
- Server-configured Home publishes enabled descriptor titles before row data. Each row has
  one of these states: `pending`, `loading`, `ready`, `empty`, or `error`.
  - Load at most two rows concurrently near the active viewport.
  - Remove rows that resolve empty, then advance the loading window.
  - Keep individual row failures local and retryable.
  - Use built-in Home only after a descriptor or capability failure.
  - Defer distant row artwork. Expand descriptor rendering ahead of the viewport instead of
    mounting all configured cards.
  - Retain fresh mounted Home content across short panel switches. Revalidate it after
    user-data or integration invalidation, or after the bounded freshness period.
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
  - explicit same-item `audioStreamIndex` selections are authoritative; semantic
    `audioTrackIntent` remapping is reserved for cross-item transitions where callers
    intentionally omit the previous item's raw stream index
- `src/utils/playbackSelection.js` (pure media-source/audio selection and compatibility logic)
- `src/utils/playbackDiagnostics.js` (generic playback diagnostic construction/appending)
- `src/services/jellyfin/playbackProfileBuilder.js` (playback profile request context)
  - Confirmed DV-to-SDR fallback uses a dedicated HLS TS/H.264 profile with video
    stream copy disabled. Do not broaden it back to HEVC: HEVC Main 10 can retain a
    DV fallback signal even when the requested cap is SDR.
- `src/services/jellyfin/subtitleApi.js` (subtitle event/raw text fetch helpers for client-side rendering)
- `src/services/jellyfin/requestsApi.js` (session-cached plugin capability discovery,
  plugin-first My Requests paging, strict plugin error handling, and bounded tag fallback)
- `src/services/jellyfin/pluginFeaturesApi.js` (shared capability-gated paging and
  authenticated plugin image URL construction; image paths must join against the
  normalized server base so reverse-proxy prefixes such as `/jellyfin` survive)
- `src/services/jellyfin/requestErrors.js` (bounded Problem Details parsing and safe
  Jellyfin request errors; raw provider bodies must not be embedded in errors/logs)
- `src/utils/auth.js` (single source for outbound auth headers, shared by services
  and login-panel utils; every authenticated request must go through it. Do not reintroduce
  the legacy `X-Emby-Authorization`/`X-Emby-Token` spellings: 10.x already falls back to
  the standard `Authorization` header and 12 rejects the old ones)
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
