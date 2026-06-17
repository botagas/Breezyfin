# Breezyfin Checks

This file is the single place for recurring validation commands and test runbooks.

Use this instead of `TODOS.md` for test/check execution tracking.

Rule:
- Do not duplicate active `TODOS.md` entries here.
- Add/update checks in this file only after the related TODO entry is complete.

## Core recurring checks

Run these before merging or publishing:

1. `npm run lint`
2. `npm run test -- --watch=false --runInBand`
3. `npm run audit:styles`
4. `npm run audit:style-tokens`
5. `npm run audit:duplicates`

## Release-oriented checks

Run these before packaging a release candidate:

1. `npm run lint`
2. `npm run test -- --watch=false --runInBand`
3. `npm run audit:styles`
4. `npm run audit:style-tokens`
5. `npm run audit:duplicates`
6. `npm run pack-p`

## Focused regression checks

### Diagnostics/logging validation

1. Toggle `Verbose App Logs` under Settings > Diagnostics and verify Recent Logs captures `log`/`info` entries in addition to `warn`/`error`.
2. Set `localStorage.breezyfinVerboseLogs = '1'` before startup and verify Settings reflects verbose logging as enabled after settings load.

### Playback/path validation

1. Validate direct play/direct stream/transcode paths on representative media.
2. Validate Smart Subtitle Transcoding is enabled by default and the extended player debug overlay reports subtitle policy `mode`, `burn`, `codec`, and `reason`.
3. Validate client-rendered SRT/SubRip/WebVTT subtitles show through the PlayerPanel subtitle overlay without subtitle-driven transcoding.
4. Validate the extended player debug overlay reports subtitle renderer state (`renderer`, `status`, `events`, `cues`, `active`, `shape`, `fetch`, endpoint `path`, fallback reason, and `error` when applicable).
5. Validate the extended player debug overlay `Diagnostics` row reports optional playback probe outcomes, session rebuild/fallback decisions, subtitle burn-in fallback decisions, and media-segment load failures without extra user-facing toasts.
6. Validate subtitle burn-in behavior matches settings: Smart mode uses client rendering for supported text subtitles, while manual mode follows `Manual Subtitle Burn-in` and `Subtitle Burn-in Formats`.
7. On HDR/DV content, validate Smart text subtitle rendering preserves HDR/DV and does not fall back to burn-in unless `Force Subtitle Burn-in on HDR/DV` is enabled.
8. Validate empty or unsupported subtitle event responses show explicit renderer states and follow SDR fallback vs HDR/DV preservation rules.
9. Validate failed intro/credits segment loading does not show skip overlays and that the debug `Diagnostics` row reports `media-segments/load=failed`.
10. Validate client-rendered subtitle size, position, background, font weight, text color, border style, border color, and border strength settings affect only the PlayerPanel subtitle overlay.
11. With `Enable fMP4-HLS container preference` enabled and `Force fMP4-HLS container preference` disabled, verify HDR/DV playback paths remain quality-first (no forced container override).
12. With `Force fMP4-HLS container preference` enabled, verify non-MKV source probing occurs, any accepted dynamic-range regression is shown in the extended debug overlay diagnostics, and Jellyfin fallback failures remain debug-only.
13. With `Force DV (Debug)` enabled, verify playback fails fast when no compatible DV path exists and succeeds only on direct path or audio-only transcode compatible DV sources.
14. Validate the extended player debug overlay `Decision` row reports selected source, play method, dynamic range, container, requested/selected audio and subtitle indices, dynamic-range cap, fMP4 state, Force DV, Avoid DV, and subtitle burn-in flags.
15. Validate HLS engine diagnostics report native HLS selection for HDR/DV paths, HLS.js selection where applicable, and native-HLS fallback attempts/errors on non-HDR paths without noisy toasts.
16. Validate scroll-wheel movement reveals PlayerPanel controls during playback without triggering play/pause, focus changes, or seek behavior.
17. Validate pointer/mouse movement reveals PlayerPanel controls only near the top/bottom edge zones and does not reveal controls from middle-screen movement.
18. Validate repeated PlayerPanel open/back/retry/track-switch flows do not leave stale HLS playback, native-HLS fallback listeners, or startup/stall timers active after leaving playback.
19. Validate `Skip Credits` always resolves to the active credits/outro boundary when intro and credits markers overlap or are malformed.
20. Validate play-next subtitle continuity prefers prior language semantics over raw stream index when next-episode subtitle ordering/naming differs.
21. Validate audio track switching works when multiple audio streams share the same language code (for example many `ru` tracks plus one `en`) and that selecting non-first same-language tracks applies correctly.
22. When Skip Intro / Skip Credits / Play Next overlay appears, verify 5-way LEFT/RIGHT can move focus between the primary action and X dismiss button, ENTER activates the focused button, and BACK dismisses through the normal player back flow.
23. Validate client-rendered subtitles strip visible ASS/SSA override blocks such as `{\an8}`, preserve dialogue text, render ASS `\an7/\an8/\an9` cues at the top, `\an4/\an5/\an6` cues in the middle, and keep source-driven left/center/right alignment without shifting normal dialogue.
24. Validate basic ASS/SSA inline styling hints (`\b`, `\i`, `\u`) do not leak raw override tags and remain readable under user-selected subtitle appearance settings.

### Home panel focus regression

1. With Home media bar disabled or unavailable, focus a navbar item and press DOWN; verify focus still falls through to the first available content row.
2. In a Home View More section with more than one page, verify the first page loads about 30 items and scrolling/focusing near the end loads more items without duplicates.
3. In the My Requests Home row, verify plugin-first behavior falls back to tag matching when the plugin endpoint is unavailable, expected plugin-missing failures are not repeatedly retried in the same app session, and production builds load Home without `p is not a function`.
4. In the My Requests View More section, verify pagination/load-more requests subsequent service pages without duplicates or production-only crashes.
5. In each Home View More section, verify the panel shows a visible vertical scrollbar when content overflows, open the filter popup, and verify All/Unplayed/Played/Favorites/My Requests can be selected, combined filters reload the grid from the top, and returning from item details preserves the active filters.
6. Validate duplicate Jellyfin items in Home, Home View More, Library, Search, and Favorites do not produce duplicate React key warnings.
7. In Favorites with more than one page, verify the first page loads about 30 items, scrolling/focusing near the end loads more items, filters reload from the top, and returning from item details preserves the loaded page/scroll position.

### Toolbar/avatar regression

1. Validate Home loads in a production build without `h is not a function` while Toolbar user info is loading.
2. Validate Toolbar avatar shows when available and falls back to initials without crashing when the avatar URL is missing, WebP fallback fails, or the user has no `PrimaryImageTag`.

### Media Details focus/restore regression

1. In Media Details first section, verify 5-way LEFT/RIGHT moves through `Audio -> Subtitle -> Play -> Favorite -> Watched`, skipping controls that are unavailable.
2. From Media Details second section, navigate into item/episode details and press Back; verify the previous Media Details panel restores the prior scroll position.
3. From a scrolled Media Details panel, press Back before scroll has visibly settled; verify returning to the same item restores the committed scroll position.
