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
- Reuse `MediaPanelBackdrop` for media-driven panel atmosphere. Feed it a representative item and, where available, an explicit provider image URL; it tries low-resolution Jellyfin-preblurred backdrop/parent/primary candidates before the provider image fallback. Authenticated Breezyfin-plugin image URLs receive the same mode-aware width, quality, and server-blur contract. Normal and Performance retain preblurred artwork, while Performance+ uses an unblurred lower-opacity image.
- Reuse `IntegrationPanelLayout` for plugin/provider panels. It owns Toolbar-safe content
  insets, backdrop, loading/empty/error states, retry placement, and Toolbar DOWN entry;
  provider details should use `ProviderItemPopup` so Popup close and Spotlight cleanup
  complete before the item state is cleared.
- Use `MediaCardImage` for shared grid/Home artwork. It owns opacity-only reveal, ordered source fallback through `useImageErrorFallback`, explicit dimensions, eager loading for already-virtualized cards, and opt-in performance metrics without parent-card state updates. Source changes reset visual state in a layout effect so recycled virtual items cannot hide an already-loaded cached image.

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
- `BreezyfinWindMark` owns the bundled transparent logo, shared pulse, and brand/white presentation for screensaver surfaces. `BreezyLoadingOverlay` uses the CSS-only three-stroke gust indicator.
- `ScreensaverOverlay` owns only the moving black-screen presentation, 30 FPS boundary reflection, smooth direction heading, and optional wake message. App-session inactivity belongs to `useAppScreensaver`; paused-player wake/resume behavior belongs to `usePlayerPausedScreensaver`.
- Reuse `MediaFilterControls` with `useMediaFilterState` for Library-like filter popups so selected, draft, reset, apply, and first-focus behavior stay aligned.
- Keep popup-owning components mounted until Sandstone calls `onHide`; do not replace their ancestor with a loading branch during close animations because Spotlight pause/resume cleanup belongs to the Popup lifecycle.
- For uniform, potentially long result grids, use `MediaVirtualGrid` rather than custom row navigation, pointer/5-way mode splitting, DOM card queries, or pagination sentinels. Preserve Enact renderer props (`index`, `data-index`, and remaining item props), and cache loaded pages plus the focused item ID in the owning panel. Keep the grid instance mounted during filter/search reloads; pass an empty item list, disable its Spotlight container, and place loading/empty feedback above it so Sandstone can finish pending scroller callbacks safely.
- For Home rows, `MediaRow` may expose an optional icon-only section action via `onMoreClick` / `sectionKey`; keep this action generic and route destination behavior through the owning panel. It renders explicit `pending`, `loading`, and retryable `error` states for descriptor-first server Home rows through the shared Breezy loading surface; rows that resolve empty are removed by Home rather than left as empty shells. Home activates artwork by row, with the first viewport loaded immediately and later rows activated by row visibility/focus rather than per-image observers.
- Settings rows use `src/views/settings-panel/components/SettingsStaticItems.js`. These are panel-local Sandstone base compositions that deliberately omit the marquee controller and content measurement path while retaining Enact touch, Spotlight, skin, switch, and accessibility behavior; keep their visible labels constrained with ellipsis rather than reintroducing focus marquees.
- `src/views/player-panel/components/PlayerPanelContent.js` owns the Player's presentational surface/overlay composition. Keep playback state machines and side effects in `PlayerPanel` hooks, and add new visual layers to this component instead of regrowing the panel orchestrator's return tree.
- `PlayerSyncPlayPopup` and `PlayerWatchPartyPopup` are panel-local participant/status
  surfaces. Keep native and room protocols isolated, preserve layered Back behavior,
  and expose controls only when the active group/host state permits them.
- Native SyncPlay is a Toolbar utility action, not a primary navigation tab. In Elegant it replaces the duplicate right-side Search icon with a Cast action when available while Search remains in the central pill; Classic keeps Search and places the Cast action with the right-side utilities.

## Related docs

- [`README.md`](./README.md)
- [`DEVELOPING.md`](./DEVELOPING.md)
- [`VIEWS.md`](./VIEWS.md)
- [`CHECKS.md`](./CHECKS.md)
