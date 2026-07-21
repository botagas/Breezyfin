# Breezyfin TODOs

Backlog for unfinished/planned work only, grouped by estimated implementation scale.

Rules:
- Scale describes expected implementation complexity and regression risk, not priority or release timing.
- Keep validation/test runbooks in `CHECKS.md` after their related implementation is complete.
- Move investigation items into a sized section once their constraints and likely implementation are understood.
- Keep deferred platform-compatibility work in its own section rather than assigning it an active implementation scale.

## Large / cross-cutting changes

Expected scope: architectural work, a new feature surface, or changes spanning services, settings, UI, persistence, and TV validation.

- Complete native SyncPlay playback coordination. Move queue/item command ownership above
  `PlayerPanel` so a remote `PlayQueue` update can resolve the selected Jellyfin item and
  enter Player from Home/SyncPlay, then keep queue replacement, current-item changes,
  play/pause/seek/stop, next/previous, reconnect, and host transitions synchronized in
  both directions without duplicate playback starts.
- Replace the initial Calendar agenda-only surface with a TV-native Calendar experience.
  Keep Agenda as an alternate view, default Calendar to a Monday-first week, add Day/Week/
  Month range navigation, and make Month day selection open Week while Week day selection
  opens Day. Query and cache only the active date range, share Movie/Episode filtering,
  preserve provider warnings and paging, and implement Spotlight navigation with Breezyfin/
  Enact primitives rather than adopting a browser calendar's independent focus model.
- Build the next-release Watchlist hub as a primary tab with `Watchlist`, `Series
  Progress`, `Movie History`, and `Statistics` subviews. Match the useful
  kefinTweaks/Jellyfin Enhanced semantics rather than introducing a second unrelated
  watchlist model: split Watchlist into Shows and Movies rows with View More; page
  per-series progress with watched/remaining counts, last-watched episode/date, Mark
  All Watched, and View Unwatched actions; page completed-movie history with year,
  runtime, and watched date; and show bounded statistics tiles plus a Top 5 Shows list.
  Define the plugin/client data contract before implementing the Enact surfaces.
- Discovery tab would be replaced with Watchlist. Discovery rows would appear in Home Panel if their placement is provided by HSS.
- Use `npm run audit:hotspots` output and growth ceilings to plan incremental decomposition of the largest current hotspots, especially `subtitleRenderer`, `App`, `playbackApi` / `playbackSelection`, and Media Details focus/interaction hooks.
- Add in-app settings help/details UI so users can understand what each option does, expected side effects, and recommended usage.
- After the bounded placement slice passes TV validation, define the next Breezyfin Lightweight ASS/SSA compatibility slice. Candidate gaps are advanced collision behavior, arbitrary text vector masks, mixed inline `\org` transforms, vertical text/layout, and transform/vector edge cases; avoid pursuing full libass parity without representative files and real-TV performance evidence.
- Add VobSub/DVD subtitle delivery and client-rendering support if the Jellyfin raw subtitle endpoints and bitmap renderer libraries provide a reliable path. Keep unsupported image formats on the existing consent-gated burn-in/no-subtitle fallback flow.
- Expand staged panel loading reveal beyond Media Details (background -> branding -> full UI) with data-ready gating so reveal only starts after panel content is loaded.
- Set up a GitHub Pages demo backed by a safe, maintainable demo Jellyfin environment.

## Needs investigation before sizing

Expected scope: unknown until profiling, API research, dependency analysis, or real-device reproduction establishes the cause and constraints.

- Skip Intro disrupts navigation flow, similar to screensaver issue from before. Needs investigation.
- Evaluate Enact 5, Limestone, and React 19 only when Breezyfin can raise its minimum webOS requirement or maintain separate legacy and modern builds. Include Enact CLI/toolchain advisories in that isolated investigation; do not mix it into Enact 4/React 18 release maintenance.
- Investigate server discovery for manual login, including SSDP/webOS constraints and fallback discovery approaches when multicast is unavailable through VPNs or segmented networks.
- Identify the cause of panel loading delay and unintended panel reload behavior when switching panels; confirm whether the bottleneck is client-side before planning implementation work.
- Investigate server-configured Home scalability with large HSS configurations. Reproduce
  the apparent Home reload after many rows settle and distinguish a React remount,
  all-or-nothing server-Home fallback, repeated content bootstrap, and a webOS
  memory/process restart. Record batch/row settlement, fallback reason, mounted-card and
  image counts, and memory before changing policy. Then decide whether isolated row
  failures should remain local, whether loaded rows need a retention/windowing bound,
  and whether Home row artwork/card mounting needs further virtualization.
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
