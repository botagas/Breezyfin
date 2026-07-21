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

- `src/views/HomeSectionPanel.js` expands Home rows into paged section-result grids using shared panel scroll/cache behavior.
- `src/views/DiscoveryPanel.js` renders five capability-gated read-only provider feeds
  progressively (Trending first, then two bounded workers), retaining successful rows
  and exposing per-row retry/paging failures. Interrupted cached loads resume unfinished
  rows instead of preserving a stale loading state. Linked Jellyfin artwork feeds the
  shared media backdrop before authenticated provider artwork is used as fallback.
- `src/views/CalendarPanel.js` groups capability-gated Movie/Episode events by the
  client-local date and opts into provider-partial results while surfacing warnings.
  Filter replacement clears old-query results before loading the new query. Event cards
  preserve real episode numbering and prefer authenticated Arr artwork with linked
  Jellyfin Movie/Series artwork as fallback. The active implementation is an Agenda;
  Day/Week/Month Calendar views remain planned work.
- `src/views/SyncPlayPanel.js` browses, creates, joins, and leaves native Jellyfin groups before playback, using the active queue item for the shared media backdrop when available.
- `src/views/WatchPartyPanel.js` browses, creates, and password-joins authenticated rooms before playback.
- `src/views/library-panel/` (`hooks/`)
- `src/views/login-panel/` (`components/`, `hooks/`, `utils/`)
- `src/views/player-panel/`
- `src/views/media-details-panel/`
- `src/views/settings-panel/` (`components/`, `hooks/`, `constants.js`, `labels.js`, panel-local formatting helpers)

## Conventions

- Prefer shared hooks from `src/hooks/` before adding panel-local hooks.
- Use `usePanelToolbarActions` for toolbar + layered back flow.
- Use `usePanelScrollState` for panel scroll restore/cache.
- Keep section snap/focus orchestration in panel-local hooks when a panel has multi-section directional navigation behavior.
- Keep callbacks event-driven (`data-*` payloads) and avoid ad-hoc DOM querying unless focus orchestration requires it.
- Prefer shared badge primitives from `src/styles/cardStyles.less` for watched/favorite/count overlays across panels.
- Keep comments minimal and only for non-obvious constraints.
- Keep provider failure states retryable and separate from authoritative empty results;
  never replace Calendar failures with unfiltered data or infer server visibility mode.
- In-flight provider and group requests must use a panel/session generation guard so
  stale completions cannot repopulate inactive panels.

## Related docs

- [`README.md`](./README.md)
- [`DEVELOPING.md`](./DEVELOPING.md)
- [`COMPONENTS.md`](./COMPONENTS.md)
- [`CHECKS.md`](./CHECKS.md)
