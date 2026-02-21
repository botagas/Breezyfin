# Breezyfin Themes Guide

This file documents how theming works in Breezyfin, which files own each part, and how to extend themes safely.

## 1) Overview

Breezyfin uses a layered theme model:

1. Global tokens and behavior in `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/global.css`.
2. Theme token packs in:
   - `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/styles/themes/classic.css`
   - `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/styles/themes/elegant.css`
3. Panel/component local styles in module LESS files and split subfiles.
4. Runtime capability + mode attributes set by the app root.

All theme files are loaded from `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/index.js`.

## 2) Runtime attributes

The app sets the theme/mode/platform attributes in `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/App/App.js`.

These attributes are what CSS listens to:

- `data-bf-nav-theme`: `classic` or `elegant`
- `data-bf-animations`: `on` or `off` (Performance Mode)
- `data-bf-all-animations`: `on` or `off` (Performance+ Mode)
- `data-bf-input-mode`: `pointer` or `5way`
- `data-bf-platform-webos`: `on` or `off`
- `data-bf-webos-version`: detected major webOS version
- `data-bf-webos-v6-compat`: `on` or `off`
- `data-bf-webos-v22-compat`: `on` or `off`
- `data-bf-webos-legacy`: `on` or `off`
- `data-bf-flex-gap`: `on` or `off`
- `data-bf-aspect-ratio`: `on` or `off`
- `data-bf-backdrop-filter`: `on` or `off`

Version/capability detection is implemented in `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/utils/platformCapabilities.js`.

## 3) Core theme files

### Token files

- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/styles/themes/classic.css`
  - Defines Classic tokens and classic baseline surfaces.
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/styles/themes/elegant.css`
  - Defines Elegant tokens and elegant-specific typography/chrome overrides.

### Global behavior

- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/global.css`
  - Shared layout tokens (`--bf-header-height`, `--bf-toolbar-height`, panel offsets).
  - Sandstone chrome normalization.
  - Performance mode and Performance+ global behavior.
  - Root overscroll behavior, scrollbar hiding rules, shared input/button behavior.

### Shared style primitives

- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/styles/cardStyles.less`
  - Reusable card shells, focus effects, image shells, status badges.
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/styles/popupStyles.module.less`
  - Shared popup surface skin with Classic/Elegant token usage.
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/styles/popupStyles.js`
  - JS export for popup style class wiring.
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/styles/popup-styles/_popup-styles-compat-webos6.less`
  - webOS 6 popup fallback behaviors (solid-surface compatibility path).
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/styles/panelLayoutMixins.less`
  - Shared panel fill container mixin.
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/styles/compatMixins.less`
  - Shared compatibility mixins (gap fallbacks, scroll metric stabilization).

## 4) Panel styles split pattern

Most panels use split files under `*-panel-styles/`:

- `_...-base.less`: default/base structure
- `_...-elegant.less`: Elegant-only overrides
- `_...-shared-tail.less`: shared cleanup/performance tail rules
- `_...-compat-webos6.less` or `_...-compat-webos22.less` (when needed)

Examples:

- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/views/MediaDetailsPanel.module.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/views/SearchPanel.module.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/views/LibraryPanel.module.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/views/FavoritesPanel.module.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/views/LoginPanel.module.less`

### Component-level split/compat examples

- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/components/Toolbar.module.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/components/toolbar-styles/_toolbar-compat-webos6.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/components/HeroBanner.module.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/components/hero-banner-styles/_hero-banner-compat-webos6.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/components/MediaRow.module.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/components/media-row-styles/_media-row-compat-webos6.less`

## 5) Theme features by mode

### Classic

- Simpler chrome and stronger opaque surfaces.
- Uses Classic token set and shared global behavior.
- Native panel header is hidden via Classic theme selector.

### Elegant

- Uses liquid/glass layers for navbar, popups, and selected surfaces.
- Stronger tokenized gradients and blur/saturation behavior.
- Elegant toolbar can use SVG distortion when supported.

### Performance Mode (`data-bf-animations='off'`)

- Reduces expensive transforms/animations.
- Keeps readability and key visual structure.
- Selective blur reductions happen in global and panel-specific shared tails.

### Performance+ Mode (`data-bf-all-animations='off'`)

- Disables transitions/animations globally.
- Forces lower-cost surfaces (often less blur and simpler backgrounds).
- Used as maximum stability/performance mode.

## 6) Compatibility patches

Compatibility is capability-driven and scoped by root attributes.

### webOS 6 compatibility

- Gap fallbacks for engines without reliable `gap` support.
- Legacy navbar rendering path in toolbar compat file.
- Panel-specific spacing/layout fallbacks.
- Prefer concrete dimensions for unstable card/media layouts on legacy engines:
  - define explicit `width`/`height` in compat files when `aspect-ratio` and implicit flex sizing produce whitespace or stretched media.
  - keep these overrides scoped to webOS6/legacy selectors only.

Key files:

- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/components/toolbar-styles/_toolbar-compat-webos6.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/views/media-details-styles/_media-details-compat-webos6.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/views/login-panel-styles/_login-panel-compat-webos6.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/components/media-row-styles/_media-row-compat-webos6.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/components/hero-banner-styles/_hero-banner-compat-webos6.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/styles/popup-styles/_popup-styles-compat-webos6.less`

### webOS 22 compatibility

- Scroll metric stabilization for panel grids.

Key files:

- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/views/search-panel-styles/_search-panel-compat-webos22.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/views/favorites-panel-styles/_favorites-panel-compat-webos22.less`
- `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/views/library-panel-styles/_library-panel-compat-webos22.less`

## 7) Settings storage

Theme-related settings are managed from `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/views/SettingsPanel.js` and persisted via `/Users/patrikas/Desktop/IT/Development/Breezyfin/src/utils/settingsStorage.js`.

Relevant settings:

- `navbarTheme` (`classic` or `elegant`)
- `disableAnimations` (Performance Mode)
- `disableAllAnimations` (Performance+ Mode)

Default theme is Elegant unless settings explicitly switch to Classic.

## 8) Adding new theme features

Use this sequence to keep maintainability high:

1. Add/extend a token first in theme token files (Classic + Elegant as needed).
2. Consume the token with `var(--token, fallback)` in panel/component styles.
3. Put structural/default rules in `_base.less`.
4. Put Elegant-only styling in `_elegant.less` behind `:global([data-bf-nav-theme='elegant'])` when necessary.
5. Add capability-specific fallbacks only in compat files keyed by `data-bf-webos-*` / `data-bf-flex-gap` / `data-bf-backdrop-filter`.
6. Put performance reductions in `_shared-tail.less` for `data-bf-animations` / `data-bf-all-animations` so they apply last.
7. Avoid hardcoded colors in panel files when a token exists or should exist.

## 9) Validation procedures

Before merging theme changes, test:

1. Classic + normal mode
2. Elegant + normal mode
3. Elegant + Performance Mode
4. Elegant + Performance+ Mode
5. webOS 6 compat path (gap/layout/nav fallback)
6. webOS 22 compat path (grid scroll metrics)

Also verify:

- Focus/hover states are readable in both pointer and 5-way input.
- Popup surfaces and toasts still use tokenized colors.
- No panel uses fixed offsets that bypass shared layout tokens.

## 10) Related docs

- [`README.md`](./README.md)
- [`HELPERS.md`](./HELPERS.md)
- [`DEVELOPING.md`](./DEVELOPING.md)
- [`COMPONENTS.md`](./COMPONENTS.md)
- [`VIEWS.md`](./VIEWS.md)
