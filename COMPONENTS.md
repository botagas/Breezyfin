# Components Guide

This guide covers shared UI components in `src/components/`.

## Component expectations

- Keep components reusable and panel-agnostic unless the component is explicitly panel-local.
- Prefer prop-driven behavior over hidden global state.
- Keep event contracts explicit. Examples include `onClick`, `onClose`, and `onSelect`.
- Keep style overrides token-driven (`var(--bf-...)`) and compatible with Classic/Elegant themes.
- For larger shared components, prefer local decomposition folders (for example `src/components/toolbar/`) to keep root files focused on orchestration.
- Reuse shared feedback primitives (for example `src/components/BreezyToast.js`) instead of panel-specific toast styling/markup.
- Persistent keyed operation toasts reserve stack slots and are removed through targeted
  dismissal. Transient compatibility/recovery feedback may stack beside them, but must
  evict older transient entries or be suppressed rather than removing an active operation
  status such as `Switching audio...`.
- Reuse `src/components/BreezyLoadingOverlay.js` instead of panel-specific loading spinners. It renders the shared three-stroke gust animation in Normal/Performance modes and the same strokes statically in Performance+.
- Keep developer-only diagnostics UI shared (for example `src/components/DebugErrorMenu.js`) instead of per-panel debug menu clones.
- Reuse `MediaFilterControls` for Library-like filter trigger/popup UI instead of duplicating filter popup markup in each panel.
- Reuse `MediaBrowseControls` for browse input and filter-trigger surfaces, and wrap it in `MediaBrowseOverlay` so Search, Library, Home View More, and Favorites share the same overlay placement and reserved-results spacing.
- Reuse `MediaVirtualGrid` for uniform Search, Favorites, Library, and Home View More
  result grids. Panels own server paging and cached query state. The wrapper owns Enact
  item metrics, mode-aware overhang, visible-index and focus prefetch, virtualization,
  stable item-ID restoration, overscroll suppression, and non-scaling focus treatment.
- Reuse `MediaPanelBackdrop` for media-driven panel atmosphere. Pass a representative item
  and, when available, an explicit provider image URL.
- The component tries low-resolution, preblurred Jellyfin backdrop, parent, and primary
  images before the provider fallback.
- Provider-only records must not use their synthetic provider ID for Jellyfin image
  requests. Linked records use `JellyfinImageItemId` or `JellyfinItemId`.
- Normal and Performance use preblurred artwork. Performance+ uses an unblurred image at
  lower opacity.
- Reuse `IntegrationPanelLayout` for plugin/provider panels. It owns Toolbar-safe content
  insets, backdrop, loading/empty/error states, retry placement, and Toolbar DOWN entry;
  pass `scrollable={false}` when a child `VirtualList`/`VirtualGridList` owns the panel's
  vertical viewport so Sandstone has one scroll owner rather than nested vertical scrollers.
  When controls must remain before an empty explanation, render a panel-local contained
  state after those controls rather than using the layout's pre-content `emptyMessage`.
  Provider details should use `ProviderItemPopup` so Popup close and Spotlight cleanup
  complete before the item state is cleared. The popup mounts content inside the shared
  tokenized `popupSurface`, bounds and scrolls long descriptions, and uses
  `PanelActionButton` for its Close action. Pass the provider item so available type,
  year, rating, genre, director, and writer metadata can be shown without fabricating
  fields absent from compact feeds.
- Watchlist intentionally uses mixed, exclusive scroll ownership: native Watchlist and
  populated Statistics use `AppScroller`, while Series Progress, Completed Series, and
  Movie History give the viewport to Sandstone `VirtualList`. Empty/loading Statistics
  uses a static state viewport so its placement matches the other advanced tabs. This is
  tracked as WA-006 in `WORKAROUNDS.md`; do not collapse the branches without validating
  navbar scroll-under behavior and Spotlight focus.
- Reuse `PanelTabNavigation` for Settings-style panel view/filter tabs. It owns the
  shared pill surface, selected/focus styling, tab semantics, and stable Spotlight IDs;
  panels should supply only tab descriptors, the active ID, and an `onSelect` handler.
- Reuse `PanelActionButton` for text actions in integration panels and their popups.
  `BreezyButton` is the low-level Sandstone chrome reset; it does not provide a visible
  surface on its own. `PanelActionButton` adds the shared theme-token border, surface,
  hover, focus, disabled, and non-scaling TV behavior.
- Use `SelectionOptionButton` for audio/subtitle and filter picker controls so they
  retain the shared `BreezyButton` surface, Sandstone's selected state, the persistent
  Selected marker, correct single/multi-select accessibility semantics, and a complete
  rounded active surface instead of relying on focus alone. `SelectionOptionContent`
  remains its presentational child rather than a panel-level composition API.
- Generic buttons use the shared `--bf-theme-button-fg*` text-state tokens so pointer
  hover and Spotlight focus use the active theme accent consistently. Primary, danger,
  warning, favorite, selected, and text-on-light actions keep explicit semantic
  foreground overrides.
- Use `MediaCardImage` for shared grid and Home artwork. It owns opacity-only reveal,
  ordered source fallback through `useImageErrorFallback`, explicit dimensions, and eager
  loading for virtualized cards. It can collect performance metrics without updating
  parent-card state.
- Source changes reset `MediaCardImage` visual state in a layout effect. This prevents a
  recycled virtual item from hiding an image that is already cached.
- Shared card consumers must preserve authenticated provider candidates from the item
  before generated Jellyfin artwork fallbacks.

## Styling

- Co-locate component styles in `*.module.less`.
- Use shared style primitives from:
  - `src/styles/cardStyles.less`
  - `src/styles/popupStyles.module.less`
  - `src/styles/panelLayoutMixins.less`
  - `src/styles/compatMixins.less`
- For status chips/badges, prefer shared badge primitives in `src/styles/cardStyles.less` and theme-token overrides over one-off badge styles.
- Add webOS compatibility rules in `src/components/*-styles/*-compat-webos6.less` when needed.

## Focus and input

- Components that are remote-focusable must be stable in both pointer and 5-way modes.
- Avoid relying on hover-only flows for critical actions.
- Keep focus/selected visuals consistent with toolbar/media-details/player button states.
- For image components, route format and ordered source fallback through `useImageErrorFallback`; do not add per-panel image-error state machines or infer parent artwork by mutating IDs inside URLs.
- Use `PosterMediaCard` with `variant="poster-grid"` for Search and Favorites grids. Use
  `variant="landscape-grid"` for Library-style grids.
- `PanelPosterMediaCard` defaults to the landscape variant and owns watched and progress
  presentation. Panels should not pass CSS-module class-slot maps for shared image,
  placeholder, title, or status styles.
- Put panel-specific status pills in `contextBadgeExtras`. This keeps them in the shared
  top-left badge stack and avoids duplicate offsets.
- `BreezyfinWindMark` owns the bundled transparent logo, optional pulse, and brand/white presentation. The screensaver uses its precomputed white asset without the decorative pulse; `BreezyLoadingOverlay` uses the separate CSS-only three-stroke gust indicator.
- `ScreensaverOverlay` owns the moving black-screen presentation, elapsed-time
  `requestAnimationFrame` boundary reflection, smooth direction heading, and optional wake
  message. `useAppScreensaver` owns app-session inactivity. `usePlayerPausedScreensaver`
  owns paused-Player wake and resume behavior.
- Reuse `MediaFilterControls` with `useMediaFilterState` for Library-like filter popups so selected, draft, reset, apply, and first-focus behavior stay aligned.
- Keep popup-owning components mounted until Sandstone calls `onHide`; do not replace their ancestor with a loading branch during close animations because Spotlight pause/resume cleanup belongs to the Popup lifecycle.
- Toolbar library selection uses the shared `popupSurface` as its only glass/backdrop composition. Keep theme-specific library button states, but do not stack extra distortion or backdrop-filter layers inside the popup because pointer/focus repaint cost is significant on TVs.
- Use `MediaVirtualGrid` for uniform result grids that can become long. Do not add custom
  row navigation, pointer/5-way mode splitting, DOM card queries, or pagination sentinels.
- Preserve Enact renderer props such as `index`, `data-index`, and the remaining item props.
  The owning panel must cache loaded pages and the focused item ID.
- Keep the grid mounted during filter or search reloads. Pass no items, disable its
  Spotlight container, and put loading or empty feedback above it. Sandstone can then
  finish pending scroller callbacks safely.
- `MediaRow` may expose an optional icon-only section action through `onMoreClick` and
  `sectionKey`. Keep the action generic. The owning panel must route its destination.
- `MediaRow` renders `pending`, `loading`, and retryable `error` states for descriptor-first
  server Home rows through the shared loading surface. Home removes rows that resolve
  empty.
- Home activates artwork by row. It loads the first viewport immediately. It activates
  later rows through row visibility or focus, not through per-image observers.
- Settings rows use `src/views/settings-panel/components/SettingsStaticItems.js`. These
  panel-local Sandstone compositions omit the marquee controller and content-measurement
  path. They retain Enact touch, Spotlight, skin, switch, and accessibility behavior.
  Constrain visible labels with ellipsis. Do not restore focus marquees.
- `src/views/player-panel/components/PlayerPanelContent.js` owns the Player's presentational surface/overlay composition. Keep playback state machines and side effects in `PlayerPanel` hooks, and add new visual layers to this component instead of regrowing the panel orchestrator's return tree.
- `PlayerPlaybackDecisionPrompt` owns the shared themed decision surface for blocking
  audio, original-quality DV retry, lower-bitrate SDR transcoding, dynamic-range,
  and subtitle choices. Only one
  decision surface may own a playback generation at a time. It and `PlayerErrorPopup`
  must mark their content as a popup focus scope and use `usePopupInitialFocus`;
  Player-level ENTER/OK/Space handling must defer to the focused popup action.
- `PlayerSyncPlayPopup` and `PlayerWatchPartyPopup` are Player-local participant/status
  surfaces. Keep native and room protocols isolated, preserve layered Back behavior,
  expose controls only when the active group/host state permits them, and mount their
  content inside the shared `popupSurface` rather than styling the transparent
  Sandstone shell directly. WatchParty actions are awaited, deduplicated while pending,
  and report asynchronous failures inside the popup.
- Native SyncPlay is a Toolbar utility action, not a primary navigation tab. In Elegant it replaces the duplicate right-side Search icon with a Cast action when available while Search remains in the central pill; Classic keeps Search and places the Cast action with the right-side utilities.
- The visible Toolbar Back action must run the same layered handler registered by `usePanelToolbarActions` before falling back to panel history/Home. `IntegrationPanelLayout` supplies its current title to the compact Toolbar so nested views such as Watchlist View More identify the layer that Back will close.
- `SyncPlayGlobalOverlays` owns app-level queue-replacement consent and suspended-playback
  notifications. Popup actions run after `onHide` so Sandstone releases Spotlight before
  SyncPlay changes panel/player state. Both the decision popup and non-autofocusing
  suspended-playback notification use the shared themed `popupSurface`; only the decision
  popup uses shared first-action focus.

## Related docs

- [`README.md`](./README.md)
- [`DEVELOPING.md`](./DEVELOPING.md)
- [`VIEWS.md`](./VIEWS.md)
- [`CHECKS.md`](./CHECKS.md)
