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
3. `npm run audit`

## Release-oriented checks

Run these before packaging a release candidate:

1. `npm run lint`
2. `npm run test -- --watch=false --runInBand`
3. `npm run audit`
4. `npm run pack-p`
5. Stable webOS packaging smoke check when the webOS CLI is available: `ares-package dist`
6. For develop/non-stable release candidates, rebuild production assets with develop flags: `REACT_APP_ENABLE_PERSISTENT_LOGS=1 REACT_APP_RELEASE_CHANNEL=develop npm run pack-p`
7. For develop/non-stable release candidates, package that flagged `dist/` immediately after step 6: `ares-package dist`

## Focused regression checks

### Diagnostics/logging validation

1. Toggle `Verbose App Logs` under Settings > Diagnostics and verify Recent Logs captures `log`/`info` entries in addition to `warn`/`error`.
2. Set `localStorage.breezyfinVerboseLogs = '1'` before startup and verify Settings reflects verbose logging as enabled after settings load.

### Playback/path validation

1. Validate direct play/direct stream/transcode paths on representative media.
2. Validate Smart Subtitle Handling is enabled by default and the extended player debug overlay reports subtitle policy `mode`, `burn`, `renderer`, `codec`, and `reason`.
3. Validate client-rendered SRT/SubRip/WebVTT subtitles show through the PlayerPanel subtitle overlay without subtitle-driven transcoding.
4. Validate embedded text subtitles first try Jellyfin `Stream.js` events, then raw/converted endpoints such as `Stream.vtt`, `Stream.srt`, `Stream.ass`, or `Stream.ssa`, and that the debug overlay reports `raw`, `tried`, `rawPath`, fallback reason, and `error` when applicable.
5. Validate Breezyfin Lightweight ASS renders common `\p` vector drawing payloads as subtitle SVG paths, converts B-spline `s`/`p` commands into cubic SVG segments, applies `\pbo` drawing baseline offsets, applies common vector `\clip(...)` / `\iclip(...)` masks to drawing cues, does not leak path text into subtitles, and still preserves visible text after drawing mode ends.
6. Validate Breezyfin Lightweight ASS honors source-authored placement/alignment, including ASS `\an` alignment, legacy SSA `\a` alignment, absolute `\pos(x,y)` anchors for top/middle/bottom alignments, and `\org(x,y)` origins for absolute transformed cues.
7. Validate Breezyfin Lightweight ASS applies rectangular `\clip(x1,y1,x2,y2)` and `\iclip(x1,y1,x2,y2)` bounds without rendering the clipped cue a second time through normal region grouping.
8. Validate Breezyfin Lightweight ASS applies absolute `\fsN` and relative `\fs+N` / `\fs-N` font-size overrides from the active source style.
9. Validate Breezyfin Lightweight ASS basic karaoke cues (`\k`, `\K`, `\kf`, `\ko`) use source primary/secondary colors as playback time advances, with active `\K`/`\kf` syllables showing a sweep approximation rather than whole-syllable color switching.
10. Validate Breezyfin Lightweight ASS interpolates `\t(...)` transforms over time, including border/shadow/blur, scale/rotation/skew, font size, and source colors, instead of applying transform targets immediately.
11. Validate long-running overlapping ASS signs remain active after later short dialogue cues end, and validate overlapping active cues render in ASS layer/source order so higher layers stack above lower layers.
12. Validate the extended player debug overlay reports subtitle renderer state (`renderer`, `status`, `events`, `cues`, `active`, libass `mode`, `render` such as `js-blend`, `fps`, `scale`, `maxH`, `canvasMode`, external renderer `videoSource`/`videoWait`, JASSUB `backend=canvas2d`/`rvfc`, ASS.js `timing`, libass/JASSUB Manual Canvas `syncEvery`/`syncs`/`syncAge`, playback `phase`/`video`, external `layer`/`hit`, `canvasBox`, `canvasParent`, `assBox`, `layerChildren`, `assNodes`, canvas pixel probe `pixels`/`alpha`/`maxA`, renderer update counters such as `lastRender`/`frame`/`media`/`busy`, `shape`, `fetch`, endpoint `path`, fallback reason, and `error` when applicable).
13. Validate the extended player debug overlay `Diagnostics` row reports optional playback probe outcomes, session rebuild/fallback decisions, subtitle burn-in fallback decisions, and media-segment load failures without extra user-facing toasts.
14. On HDR/DV content, validate Smart text subtitle rendering preserves HDR/DV and does not fall back to burn-in unless `Force Subtitle Burn-in on HDR/DV` is enabled.
15. Validate empty or unsupported subtitle event responses show explicit renderer states and follow SDR fallback vs HDR/DV preservation rules.
16. With `Enable fMP4-HLS container preference` enabled and `Force fMP4-HLS container preference` disabled, verify HDR/DV playback paths remain quality-first (no forced container override).
17. With `Force fMP4-HLS container preference` enabled, verify non-MKV source probing occurs, any accepted dynamic-range regression is shown in the extended debug overlay diagnostics, and Jellyfin fallback failures remain debug-only.
18. With `Force DV (Debug)` enabled, verify playback fails fast when no compatible DV path exists and succeeds only on direct path or audio-only transcode compatible DV sources.
19. Validate the extended player debug overlay `Decision` row reports selected source, play method, dynamic range, container, requested/selected audio and subtitle indices, dynamic-range cap, fMP4 state, Force DV, Avoid DV, and subtitle burn-in flags.
20. Validate HLS engine diagnostics report native HLS selection for HDR/DV paths, HLS.js selection where applicable, and native-HLS fallback attempts/errors on non-HDR paths without noisy toasts.
21. When Skip Intro / Skip Credits / Play Next overlay appears, verify 5-way LEFT/RIGHT can move focus between the primary action and X dismiss button, ENTER activates the focused button, and BACK dismisses through the normal player back flow.
22. Validate SRT/VTT subtitles preserve safe inline formatting (`<i>`, `<b>`, `<u>`, safe color-only `<font>`/`<span>`) and decode escaped safe tags such as `&lt;i&gt;` without rendering unsafe HTML/script content.

### Login flow validation

1. With multiple saved servers, verify `Add User` opens server selection first, then credentials for the selected server.

### Home panel focus regression

1. In a Home View More section with more than one page, verify the first page loads about 30 items and scrolling/focusing near the end loads more items without duplicates.
2. In the My Requests Home row, verify plugin-first behavior falls back to tag matching when the plugin endpoint is unavailable, expected plugin-missing failures are not repeatedly retried in the same app session, and production builds load Home without `p is not a function`.
3. In the My Requests View More section, verify pagination/load-more requests subsequent service pages without duplicates or production-only crashes.
4. In Favorites with more than one page, verify the first page loads about 30 items, scrolling/focusing near the end loads more items, filters reload from the top, and returning from item details preserves the loaded page/scroll position.
