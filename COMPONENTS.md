# Components Guide

This guide covers shared UI components in `src/components/`.

## Component expectations

- Keep components reusable and panel-agnostic unless the component is explicitly panel-local.
- Prefer prop-driven behavior over hidden global state.
- Keep event contracts explicit (`onClick`, `onClose`, `onSelect`, etc.).
- Keep style overrides token-driven (`var(--bf-...)`) and compatible with Classic/Elegant themes.
- For larger shared components, prefer local decomposition folders (for example `src/components/toolbar/`) to keep root files focused on orchestration.
- Reuse shared feedback primitives (for example `src/components/BreezyToast.js`) instead of panel-specific toast styling/markup.
- Reuse shared loading primitives (for example `src/components/BreezyLoadingOverlay.js`) instead of panel-specific loading spinners.

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
- Avoid relying on hover-only affordances for critical actions.
- Keep focus/selected visuals consistent with toolbar/media-details/player button states.
- For image components, route fallback behavior through `useImageErrorFallback` unless panel-specific fallback chains are required.

## Related docs

- [`README.md`](./README.md)
- [`DEVELOPING.md`](./DEVELOPING.md)
- [`VIEWS.md`](./VIEWS.md)
- [`CHECKS.md`](./CHECKS.md)
