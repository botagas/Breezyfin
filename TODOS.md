# Breezyfin TODOs

Backlog for unfinished/planned work only, grouped by estimated implementation scale.

Rules:
- Scale describes expected implementation complexity and regression risk, not priority or release timing.
- Keep validation/test runbooks in `CHECKS.md` after their related implementation is complete.
- Move investigation items into a sized section once their constraints and likely implementation are understood.
- Keep deferred platform-compatibility work in its own section rather than assigning it an active implementation scale.

## Next release focus

- Complete native SyncPlay playback coordination. Move queue/item command ownership above
  `PlayerPanel` so a remote `PlayQueue` update can resolve the selected Jellyfin item and
  enter Player from Home/SyncPlay, then keep queue replacement, current-item changes,
  play/pause/seek/stop, next/previous, reconnect, and host transitions synchronized in
  both directions without duplicate playback starts.
- Build the next-release Watchlist hub as a primary tab with `Watchlist`, `Series
  Progress`, `Movie History`, and `Statistics` subviews. Match the useful
  kefinTweaks/Jellyfin Enhanced semantics rather than introducing a second unrelated
  watchlist model: split Watchlist into Shows and Movies rows with View More; page
  per-series progress with watched/remaining counts, last-watched episode/date, Mark
  All Watched, and View Unwatched actions; page completed-movie history with year,
  runtime, and watched date; and show bounded statistics tiles plus a Top 5 Shows list.
  Define the plugin/client data contract before implementing the Enact surfaces. Replace
  the primary Discovery tab with this hub. Keep Discovery feeds available only through
  server-configured Home sections that HSS marks enabled and places on Home; do not retain
  an independent client-owned Discovery placement or fetch disabled HSS sections.

## Large / cross-cutting changes

Expected scope: architectural work, a new feature surface, or changes spanning services, settings, UI, persistence, and TV validation.

- Replace the initial Calendar agenda-only surface with a TV-native Calendar experience.
  Keep Agenda as an alternate view, default Calendar to a Monday-first week, add Day/Week/
  Month range navigation, and make Month day selection open Week while Week day selection
  opens Day. Query and cache only the active date range, share Movie/Episode filtering,
  preserve provider warnings and paging, and implement Spotlight navigation with Breezyfin/
  Enact primitives rather than adopting a browser calendar's independent focus model.
- Use `npm run audit:hotspots` output and growth ceilings to plan incremental decomposition of the largest current hotspots, especially `subtitleRenderer`, `App`, `playbackApi` / `playbackSelection`, and Media Details focus/interaction hooks.
- Add in-app settings help/details UI so users can understand what each option does, expected side effects, and recommended usage.
- After the bounded placement slice passes TV validation, define the next Breezyfin Lightweight ASS/SSA compatibility slice. Candidate gaps are advanced collision behavior, arbitrary text vector masks, mixed inline `\org` transforms, advanced vertical layout/collision behavior, and transform/vector edge cases; avoid pursuing full libass parity without representative files and real-TV performance evidence.
- Add VobSub/DVD subtitle delivery and client-rendering support if the Jellyfin raw subtitle endpoints and bitmap renderer libraries provide a reliable path. Keep unsupported image formats on the existing consent-gated burn-in/no-subtitle fallback flow.
- Expand staged panel loading reveal beyond Media Details (background -> branding -> full UI) with data-ready gating so reveal only starts after panel content is loaded.
- Set up a GitHub Pages demo backed by a safe, maintainable demo Jellyfin environment.

## Needs investigation before sizing

Expected scope: unknown until profiling, API research, dependency analysis, or real-device reproduction establishes the cause and constraints.

- Investigate jagged large-glyph outlines in the Breezyfin Lightweight ASS renderer on
  webOS. The synchronized effect/fill layers now preserve wrapping and keep outlines out
  of the source-colored fill, but large dialogue text still aliases more visibly than
  smaller positioned signs. Compare authored font availability/fallback, webOS text
  rasterization, device-pixel scaling, and bounded shadow/stroke alternatives without
  regressing line wrapping, source colors, or TV performance.
- Evaluate Enact 5, Limestone, and React 19 only when Breezyfin can raise its minimum webOS requirement or maintain separate legacy and modern builds. Include Enact CLI/toolchain advisories in that isolated investigation; do not mix it into Enact 4/React 18 release maintenance.
- Investigate server discovery for manual login, including SSDP/webOS constraints and fallback discovery approaches when multicast is unavailable through VPNs or segmented networks.
- Investigate a proper navbar/search scroll-under overlay using Enact-supported layout and virtual-list insets. Avoid negative-margin, transform, or duplicated-scroll workarounds.
- Investigate Jellyfin Plugin Pages support for the Breezyfin plugin. Confirm the
  supported server-version registration and authorization model, then decide which
  configuration/status pages belong in Jellyfin without coupling the TV client to
  injected scripts or making Plugin Pages a prerequisite for REST capabilities.

## Deferred compatibility work

Platform-specific cleanup intentionally reserved for the final compatibility phase, after the main application feature set and architecture are stable.

- Improve webOS 6 login/switch-user backdrop reliability in `src/views/LoginPanel.js` and `src/views/login-panel-styles/_login-panel-compat-webos6.less`.
- Fix webOS 6 badge spacing/sizing and missing badge visibility issues in Favorites and Search.
- Fix extra whitespace before the first Library option on webOS 6.
