# Breezyfin TODOs

Backlog for unfinished/planned work only, grouped by estimated implementation scale.

Rules:
- Scale describes expected implementation complexity and regression risk, not priority or release timing.
- Keep validation/test runbooks in `CHECKS.md` after their related implementation is complete.
- Move investigation items into a sized section once their constraints and likely implementation are understood.
- Keep deferred platform-compatibility work in its own section rather than assigning it an active implementation scale.

## Large / cross-cutting changes

Expected scope: architectural work, a new feature surface, or changes spanning services, settings, UI, persistence, and TV validation.

- Use `npm run audit:hotspots` output and growth ceilings to plan incremental decomposition of the largest current hotspots, especially `subtitleRenderer`, `App`, `playbackApi` / `playbackSelection`, and Media Details focus/interaction hooks.
- Add in-app settings help/details UI so users can understand what each option does, expected side effects, and recommended usage.
- After the bounded placement slice passes TV validation, define the next Breezyfin Lightweight ASS/SSA compatibility slice. Candidate gaps are advanced collision behavior, arbitrary text vector masks, mixed inline `\org` transforms, vertical text/layout, and transform/vector edge cases; avoid pursuing full libass parity without representative files and real-TV performance evidence.
- Add VobSub/DVD subtitle delivery and client-rendering support if the Jellyfin raw subtitle endpoints and bitmap renderer libraries provide a reliable path. Keep unsupported image formats on the existing consent-gated burn-in/no-subtitle fallback flow.
- Expand staged panel loading reveal beyond Media Details (background -> branding -> full UI) with data-ready gating so reveal only starts after panel content is loaded.
- Implement Discovery media rows via Seerr integration, likely through Jellyfin plugin support.
- Support plugin-provided Home sections as a future extension or replacement for hard-coded Home section descriptors, while keeping built-in sections as fallback behavior.
- Implement Watchlist support after evaluating Jellyfin Enhanced/KefinTweaks Watchlist compatibility and the integration path.
- Add a Calendar for Sonarr/Radarr release information, likely through a plugin or API integration. Could be a possible integration using Jellyfin Enhanced/KefinTweaks.
- Consider integration with JellyWatchParty using their provided API. This would also mean implementing SyncPlay support via Jellyfin.
- Consider integration with Home Screen Sections, Collection Sections and JS Injector plugins. This means we could use their provided media sections and keep our existing hard-coded structure as a fallback.
- Set up a GitHub Pages demo backed by a safe, maintainable demo Jellyfin environment.

## Needs investigation before sizing

Expected scope: unknown until profiling, API research, dependency analysis, or real-device reproduction establishes the cause and constraints.

- Evaluate Enact 5, Limestone, and React 19 only when Breezyfin can raise its minimum webOS requirement or maintain separate legacy and modern builds. Include Enact CLI/toolchain advisories in that isolated investigation; do not mix it into Enact 4/React 18 release maintenance.
- Investigate server discovery for manual login, including SSDP/webOS constraints and fallback discovery approaches when multicast is unavailable through VPNs or segmented networks.
- Identify the cause of panel loading delay and unintended panel reload behavior when switching panels; confirm whether the bottleneck is client-side before planning implementation work.
- Investigate a proper navbar/search scroll-under overlay using Enact-supported layout and virtual-list insets. Avoid negative-margin, transform, or duplicated-scroll workarounds.

## Deferred compatibility work

Platform-specific cleanup intentionally reserved for the final compatibility phase, after the main application feature set and architecture are stable.

- Improve webOS 6 login/switch-user backdrop reliability in `src/views/LoginPanel.js` and `src/views/login-panel-styles/_login-panel-compat-webos6.less`.
- Fix webOS 6 badge spacing/sizing and missing badge visibility issues in Favorites and Search.
- Fix extra whitespace before the first Library option on webOS 6.
