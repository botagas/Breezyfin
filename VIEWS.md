# Views Guide

This guide covers top-level panels and panel-local modules in `src/views/`.

## Structure

- Keep each major panel in `src/views/<PanelName>.js`.
- Keep panel-specific decomposition in `src/views/<panel-name>/` using:
  - `components/` for presentational sections
  - `hooks/` for orchestrated behavior and side effects
  - `utils/` for pure panel-local helpers
- Keep styling in `src/views/*-panel-styles/` split files:
  - `_...-base.less`
  - `_...-elegant.less` (theme-specific)
  - `_...-shared-tail.less` (final overrides/perf)
  - compat files where needed

## Current panel-local decompositions

- `src/views/player-panel/`
- `src/views/media-details-panel/`
- `src/views/settings-panel/` (`components/`, `constants.js`, `labels.js`)

## Conventions

- Prefer shared hooks from `src/hooks/` before adding panel-local hooks.
- Use `usePanelToolbarActions` for toolbar + layered back flow.
- Use `usePanelScrollState` for panel scroll restore/cache.
- Keep callbacks event-driven (`data-*` payloads) and avoid ad-hoc DOM querying unless focus orchestration requires it.
- Prefer shared badge primitives from `src/styles/cardStyles.less` for watched/favorite/count overlays across panels.
- Keep comments minimal and only for non-obvious constraints.

## Related docs

- [`README.md`](./README.md)
- [`DEVELOPING.md`](./DEVELOPING.md)
- [`COMPONENTS.md`](./COMPONENTS.md)
