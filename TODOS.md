# Breezyfin TODOs

Backlog for unfinished/planned work only, grouped by estimated implementation scale.

Rules:
- Scale describes expected implementation complexity and regression risk, not priority or release timing.
- Keep validation/test runbooks in `CHECKS.md` after their related implementation is complete.
- Move investigation items into a sized section once their constraints and likely implementation are understood.
- Keep deferred platform-compatibility work in its own section rather than assigning it an active implementation scale.
- When the section is empty after work has been completed, keep the section for future use.

## Small changes / issues

Expected scope: minimal corrective improvements, UI/UX changes, etc.

- None.

## Medium changes / issues

Expected scope: bounded work spanning a small number of services, scripts, tests, or UI surfaces.

- Add an opt-in, non-blocking `test:demo` integration smoke suite against the controlled
  Jellyfin/plugin development container. Cover public server discovery, passwordless or
  configured authentication, bounded library paging, image delivery, PlaybackInfo
  response contracts, and Breezyfin plugin capability endpoints without coupling normal
  Jest or release CI gates to a live server. Use isolated test-user state, strict
  timeouts, token redaction, and explicit cleanup for any unavoidable mutations. Until
  the development container has suitable media fixtures, the official Jellyfin demo
  server may provide optional read-only playback compatibility checks, but it must not
  become the authoritative or blocking integration environment.

## Large / cross-cutting changes

Expected scope: architectural work, a new feature surface, or changes spanning services, settings, UI, persistence, and TV validation.

- Replace the initial Calendar agenda-only surface with a TV-native Calendar experience.
  Keep Agenda as an alternate view, default Calendar to a Monday-first week, add Day/Week/
  Month range navigation, and make Month day selection open Week while Week day selection
  opens Day. Query and cache only the active date range, share Movie/Episode filtering,
  preserve provider warnings and paging, and implement Spotlight navigation with Breezyfin/
  Enact primitives rather than adopting a browser calendar's independent focus model.
- Use the advisory `npm run audit:hotspots` file/function rankings and baseline growth
  to plan incremental decomposition of the largest current hotspots, especially
  `subtitleRenderer`, `App`, `playbackApi` / `playbackSelection`, and Media Details
  focus/interaction hooks. Metric growth alone must not block otherwise correct work.
- Add in-app settings help/details UI so users can understand what each option does, expected side effects, and recommended usage.
- After the bounded placement slice passes TV validation, define the next Breezyfin Lightweight ASS/SSA compatibility slice. Candidate gaps are advanced collision behavior, arbitrary text vector masks, mixed inline `\org` transforms, advanced vertical layout/collision behavior, and transform/vector edge cases; avoid pursuing full libass parity without representative files and real-TV performance evidence.
- Add VobSub/DVD subtitle delivery and client-rendering support if the Jellyfin raw subtitle endpoints and bitmap renderer libraries provide a reliable path. Keep unsupported image formats on the existing consent-gated burn-in/no-subtitle fallback flow.
- Expand staged panel loading reveal beyond Media Details (background -> branding -> full UI) with data-ready gating so reveal only starts after panel content is loaded.
- Set up a GitHub Pages demo backed by a safe, maintainable demo Jellyfin environment.
- Add advanced SyncPlay queue management after the core coordinator is validated on TV:
  queue editing/reordering, repeat, shuffle, and host-oriented queue controls.
- Add Seerr-backed `Plan to Watch` only as a distinct request-planning surface; do not
  merge it with the native Jellyfin Likes Watchlist source.
- Add the planned authenticated Seerr Request action to `ProviderItemPopup`.
  Keep compact Discovery feed loading paged and fetch bounded enriched details only
  when the popup opens; do not add one upstream detail request per Home card.

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
- Discovery pop-up should include an image on the left and the title at the top of the pop-up. The rest of the existing content would be on the right. The image could be an image gallery. Different images could be viewed using left/right buttons which would be rendered inside the image. Limit to 3 images at most. Do not display as image gallery if only 1 image is available. If no image is available, then the right content would take up the space of the image as well. Discovery pop-up's title should be the title of the movie/show. If it's a show, it should allow selecting seasons to request (if multiple are available). 


## Deferred compatibility work

Platform-specific cleanup intentionally reserved for the final compatibility phase, after the main application feature set and architecture are stable.

- Improve webOS 6 login/switch-user backdrop reliability in `src/views/LoginPanel.js` and `src/views/login-panel-styles/_login-panel-compat-webos6.less`.
- Fix webOS 6 badge spacing/sizing and missing badge visibility issues in Favorites and Search.
- Fix extra whitespace before the first Library option on webOS 6.
