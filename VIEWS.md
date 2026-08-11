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

- `src/views/HomeSectionPanel.js` expands Home rows into paged section-result grids using
  shared panel scroll/cache behavior. Panel-local paging normalization and bounded
  filtered collection live in `src/views/home-section-panel/utils/`. HSS My Requests
  descriptors retain their HSS Home preview but use the plugin's complete ownership
  paging endpoint in View More.
- `src/views/HomePanel.js` treats enabled HSS descriptors as authoritative. Ordinary
  descriptors load Jellyfin items; Discovery descriptors load the named provider feed,
  preserve HSS ordering/layout, and use the shared linked/external activation path.
- `src/views/WatchlistPanel.js` provides the native Likes Watchlist plus plugin-backed
  Series Progress, Completed Series, Movie History, and Statistics views. Discovery
  feeds render only as enabled server-provided HSS Home sections. Its advanced result
  tabs give Sandstone `VirtualList` exclusive vertical-scroll ownership, use fixed
  scaled item metrics, and suppress the generic list focus zoom for full-width rows.
  Main insight rows open their embedded Jellyfin item while nested actions stop
  propagation. Each advanced tab has an independent 60-second cache; stale content
  remains visible during refresh and remaining first pages warm sequentially after the
  first successful advanced request. Watchlist and Statistics retain `AppScroller`.
  Per-tab cache and warming behavior lives in `src/views/watchlist-panel/`.
- `src/views/CalendarPanel.js` groups capability-gated Movie/Episode events by the
  client-local date and opts into provider-partial results while surfacing warnings.
  Filter replacement clears old-query results before loading the new query. Event cards
  preserve real episode numbering and prefer authenticated Arr artwork with linked
  Jellyfin Movie/Series artwork as fallback. Its media-type filter and Watchlist's view
  selector reuse the Settings-style `PanelTabNavigation`. The active Calendar
  implementation remains a single paged Agenda request; independent/staged date-range
  loading belongs to the planned Day/Week/Month architecture rather than a temporary
  Discovery-style feed loader.
- `src/views/SyncPlayPanel.js` browses, creates, resumes, suspends, and leaves native
  Jellyfin groups. App-level coordination owns queue/navigation state while Player owns
  timing against the currently attached video.
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
- Keep callbacks event-driven with `data-*` payloads. Use direct DOM queries only when
  focus orchestration requires them.
- Prefer shared badge primitives from `src/styles/cardStyles.less` for watched/favorite/count overlays across panels.
- Keep comments minimal and only for non-obvious constraints.
- Keep provider failure states retryable and separate from authoritative empty results;
  never replace Calendar failures with unfiltered data or infer server visibility mode.
- In-flight provider and group requests must use a panel or session generation guard.
  Stale completions must not repopulate inactive panels.

## Related docs

- [`README.md`](./README.md)
- [`DEVELOPING.md`](./DEVELOPING.md)
- [`COMPONENTS.md`](./COMPONENTS.md)
- [`CHECKS.md`](./CHECKS.md)
