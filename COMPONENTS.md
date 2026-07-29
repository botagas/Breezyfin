# Components Guide

This guide covers shared UI components in `src/components/`.

## Component expectations

- Keep components reusable and panel-agnostic unless the component is explicitly panel-local.
- Prefer prop-driven behavior over hidden global state.
- Keep event contracts explicit (`onClick`, `onClose`, `onSelect`, etc.).
- Keep style overrides token-driven (`var(--bf-...)`) and compatible with Classic/Elegant themes.
- For larger shared components, prefer local decomposition folders (for example `src/components/toolbar/`) to keep root files focused on orchestration.
- Reuse shared feedback primitives (for example `src/components/BreezyToast.js`) instead of panel-specific toast styling/markup.
- Reuse `src/components/BreezyLoadingOverlay.js` instead of panel-specific loading spinners. It renders the shared three-stroke gust animation in Normal/Performance modes and the same strokes statically in Performance+.
- Keep developer-only diagnostics UI shared (for example `src/components/DebugErrorMenu.js`) instead of per-panel debug menu clones.
- Reuse `MediaFilterControls` for Library-like filter trigger/popup UI instead of duplicating filter popup markup in each panel.
- Reuse `MediaBrowseControls` for browse input and filter-trigger surfaces, and wrap it in `MediaBrowseOverlay` so Search, Library, Home View More, and Favorites share the same overlay placement and reserved-results spacing.
- Reuse `MediaVirtualGrid` for uniform Search, Favorites, Library, and Home View More result grids. Panels own server paging and cached query state; the wrapper owns Enact item metrics, mode-aware overhang, visible-index/focus prefetch, virtualization, stable item-ID restoration, no overscroll, and the shared non-scaling focus treatment.
- Reuse `MediaPanelBackdrop` for media-driven panel atmosphere. Feed it a representative item and, where available, an explicit provider image URL; it tries low-resolution Jellyfin-preblurred backdrop/parent/primary candidates before the provider image fallback. Provider-only records must not use their synthetic provider ID for Jellyfin image requests; linked records use `JellyfinImageItemId`/`JellyfinItemId`. Authenticated Breezyfin-plugin image URLs receive the same mode-aware width, quality, and server-blur contract. Normal and Performance retain preblurred artwork, while Performance+ uses an unblurred lower-opacity image.
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
- Use `SelectionOptionContent` inside audio/subtitle and filter picker controls so they
  retain Sandstone's selected state while sharing the same persistent Selected marker
  and complete rounded active surface instead of relying on focus alone.
- Generic buttons use the shared `--bf-theme-button-fg*` text-state tokens so pointer
  hover and Spotlight focus use the active theme accent consistently. Primary, danger,
  warning, favorite, selected, and text-on-light actions keep explicit semantic
  foreground overrides.
- Use `MediaCardImage` for shared grid/Home artwork. It owns opacity-only reveal, ordered source fallback through `useImageErrorFallback`, explicit dimensions, eager loading for already-virtualized cards, and opt-in performance metrics without parent-card state updates. Source changes reset visual state in a layout effect so recycled virtual items cannot hide an already-loaded cached image. Shared card consumers preserve item-provided authenticated provider candidates before generated Jellyfin artwork fallbacks.

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
- Use `PosterMediaCard` with `variant="poster-grid"` for Search/Favorites-style grids and `variant="landscape-grid"` for Library-like grids. `PanelPosterMediaCard` defaults to the landscape variant and owns watched/progress presentation; panels should not pass CSS-module class-slot maps for shared image, placeholder, title, or status styling. Put panel-specific status pills in `contextBadgeExtras` so they share the card's top-left badge stack instead of reproducing badge offsets.
- `BreezyfinWindMark` owns the bundled transparent logo, optional pulse, and brand/white presentation. The screensaver uses its precomputed white asset without the decorative pulse; `BreezyLoadingOverlay` uses the separate CSS-only three-stroke gust indicator.
- `ScreensaverOverlay` owns only the moving black-screen presentation, elapsed-time `requestAnimationFrame` boundary reflection, smooth direction heading, and optional wake message. App-session inactivity belongs to `useAppScreensaver`; paused-player wake/resume behavior belongs to `usePlayerPausedScreensaver`.
- Reuse `MediaFilterControls` with `useMediaFilterState` for Library-like filter popups so selected, draft, reset, apply, and first-focus behavior stay aligned.
- Keep popup-owning components mounted until Sandstone calls `onHide`; do not replace their ancestor with a loading branch during close animations because Spotlight pause/resume cleanup belongs to the Popup lifecycle.
- Toolbar library selection uses the shared `popupSurface` as its only glass/backdrop composition. Keep theme-specific library button states, but do not stack extra distortion or backdrop-filter layers inside the popup because pointer/focus repaint cost is significant on TVs.
- For uniform, potentially long result grids, use `MediaVirtualGrid` rather than custom row navigation, pointer/5-way mode splitting, DOM card queries, or pagination sentinels. Preserve Enact renderer props (`index`, `data-index`, and remaining item props), and cache loaded pages plus the focused item ID in the owning panel. Keep the grid instance mounted during filter/search reloads; pass an empty item list, disable its Spotlight container, and place loading/empty feedback above it so Sandstone can finish pending scroller callbacks safely.
- For Home rows, `MediaRow` may expose an optional icon-only section action via `onMoreClick` / `sectionKey`; keep this action generic and route destination behavior through the owning panel. It renders explicit `pending`, `loading`, and retryable `error` states for descriptor-first server Home rows through the shared Breezy loading surface; rows that resolve empty are removed by Home rather than left as empty shells. Home activates artwork by row, with the first viewport loaded immediately and later rows activated by row visibility/focus rather than per-image observers.
- Settings rows use `src/views/settings-panel/components/SettingsStaticItems.js`. These are panel-local Sandstone base compositions that deliberately omit the marquee controller and content measurement path while retaining Enact touch, Spotlight, skin, switch, and accessibility behavior; keep their visible labels constrained with ellipsis rather than reintroducing focus marquees.
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
