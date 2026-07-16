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
4. Require `npm audit --omit=dev --audit-level=high` to pass; review the separate unscoped audit's CLI-only findings using `QUALITY.md` rather than applying broad automatic fixes.
5. Verify `npm run audit:runtime-deps`, `npm run audit:licenses`, and `npm run audit:private-refs` pass as part of the aggregate audit.
6. Production build: `CI=true npm run pack-p`
7. Run `npm run report:package-size` and confirm the package contains `LICENSE` and `THIRD_PARTY_NOTICES.txt` but no production subtitle declarations or unnecessary source maps.
8. Inspect `dist/index.html` and confirm JavaScript/CSS entry assets are relative (`./...`), never `/...` or an HTTP repository path; postpack enforces this for `file://` webOS startup.
9. Stable webOS packaging smoke check when the webOS CLI is available: `ares-package dist`
10. For develop/non-stable release candidates, rebuild production assets with develop flags: `REACT_APP_ENABLE_PERSISTENT_LOGS=1 REACT_APP_RELEASE_CHANNEL=develop CI=true npm run pack-p`
11. For develop/non-stable release candidates, package that flagged `dist/` immediately after step 10: `ares-package dist`

## Focused regression checks

### Diagnostics/logging validation

1. Verify `Enable Diagnostics` defaults off in stable, develop, and local production builds; all child diagnostic choices retain their saved state but are disabled and perform no work.
2. With Diagnostics off, verify ordinary console warn/error/log/info traffic is not persisted, while AppCrashBoundary render failures, global errors, and unhandled rejections remain available in Logs when persistent-log capability is packaged.
3. Enable Diagnostics and verify warn/error capture begins. Enable `Verbose App Logs` and verify log/info capture is added; disabling Diagnostics must restore native console methods without duplicate entries after repeated toggles.
4. Verify Logs can still be opened and cleared while Diagnostics is off, and `REACT_APP_DISABLE_PERSISTENT_LOGS=1` suppresses even critical persistence.
5. Verify Performance, Focus, extended Player, and debug error overlays remain unmounted/inactive while the master is off even if their child settings are selected.
6. With extended Player metrics visible, verify the 1.5-second external-renderer canvas/layout sampler runs; hide it or disable Diagnostics and verify sampling stops while the bounded startup empty-output watchdog still detects renderer failure.
7. Compare Performance Overlay cadence on 30 Hz and 60 Hz delivery. Verify `Slow` estimates missed refreshes, `Next` is labeled as next-frame delay rather than true input-to-paint latency, and the surface has no backdrop blur.

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
15. Validate PGS/PGSSUB subtitle selection in Smart mode detaches image subtitles from Jellyfin playback requests, preserves the selected subtitle index for client rendering, resolves bitmap subtitle delivery candidates (`DeliveryUrl`, then `Stream.sup`, `Stream.pgs`, `Stream.pgssub`), tries client bitmap rendering first (`Auto` -> libbitsub, then libpgs), shows delivery/fetch/canvas diagnostics in the extended player debug overlay, does not let raw endpoint 400 responses block URL-based rendering attempts, prompts before any image-subtitle server burn-in attempt, and prompts before continuing without selected subtitles if rendering/burn-in fails.
16. Validate empty or unsupported subtitle event responses show explicit renderer states and follow SDR fallback vs HDR/DV preservation rules.
17. With `Enable fMP4-HLS container preference` enabled and `Force fMP4-HLS container preference` disabled, verify HDR/DV playback paths remain quality-first (no forced container override).
18. With `Force fMP4-HLS container preference` enabled, verify non-MKV source probing occurs, any accepted dynamic-range regression is shown in the extended debug overlay diagnostics, and Jellyfin fallback failures remain debug-only.
19. With `Force DV (Debug)` enabled, verify playback fails fast when no compatible DV path exists and succeeds only on direct path or audio-only transcode compatible DV sources.
20. Validate the extended player debug overlay `Decision` row reports selected source, play method, dynamic range, container, requested/selected audio and subtitle indices, dynamic-range cap, fMP4 state, Force DV, Avoid DV, and subtitle burn-in flags.
21. Validate HLS engine diagnostics report native HLS selection for HDR/DV paths, HLS.js selection where applicable, and native-HLS fallback attempts/errors on non-HDR paths without noisy toasts.
22. When Skip Intro / Skip Credits / Play Next overlay appears, verify 5-way LEFT/RIGHT can move focus between the primary action and X dismiss button, ENTER activates the focused button, and BACK dismisses through the normal player back flow.
23. Validate SRT/VTT subtitles preserve safe inline formatting (`<i>`, `<b>`, `<u>`, safe color-only `<font>`/`<span>`) and decode escaped safe tags such as `&lt;i&gt;` without rendering unsafe HTML/script content.
24. Validate selected PGSSUB/image subtitle continuity across Next Episode / Previous Episode / autoplay. The next item should remap the previous episode subtitle intent to the new episode’s real stream index instead of reusing the old raw index.
25. Validate forced/confirmed subtitle burn-in PlaybackInfo requests include `SubtitleStreamIndex`, `AlwaysBurnInSubtitleWhenTranscoding=true`, encode-only subtitle profiles, and debug diagnostics confirming the returned transcode URL preserves `SubtitleMethod=Encode`.
26. Validate encoded image-subtitle fragment 4xx/5xx failures stop restart loops and show a no-subtitle fallback consent prompt with a warning toast instead of silently continuing without subtitles.
27. Validate HLS.js runtime diagnostics classify fragment-load, buffer-pressure, append-buffer, gap, and stall failures separately from subtitle-renderer fallback failures.
28. Validate Breezyfin-rendered ASS subtitles use a centered, uniformly scaled `PlayRes` plane and stay inside the visible video stage for 16:9, ultrawide/letterboxed, and 4:3/pillarboxed media. Cover `PlayRes`/`LayoutRes`, top/bottom/absolute `\pos` and `\move` cues, rectangular/inverse/vector clips, long page-style signs, and overlapping cues on the same and different ASS layers.
29. Validate nonfatal `bufferSeekOverHole`/nudge events remain diagnostic-only recovered events, do not trigger media recovery, and never log unredacted API tokens.
30. Validate bitmap burn-in fragility consent appears before source assignment/HLS attachment and starts playback only after confirmation.
31. During Next/Previous Episode transitions, verify successful playback does not show the stale `Playback failed to start` toast when the previous media element's play promise is interrupted during source replacement.

### Navigation/focus validation

1. In the Error panel, verify 5-way ENTER/OK/Space activates the focused Back or Return Home action, pointer click still works, and Back key still follows crash recovery.
2. In Library, Home View More, and Favorites filter popups, verify 5-way navigation stays inside the popup while it is open, applying filters restores focus predictably, and closing returns to the filter trigger or grid without breaking navigation. In Library, verify the compact Search/Filter bar expands while search is focused, retains the query, and retracts after focus leaves it.
3. In Library, Home View More, Favorites, and Search grids with more than 30 results, verify pointer scrolling near the end and 5-way navigation near/beyond the bottom row both load the next page without skipped or duplicate items. Also verify DOWN from toolbar/filter controls enters the expected grid and RIGHT from the right-most Library item reaches Search before Filter.
4. Apply and clear Library/Home View More/Favorites filters repeatedly, including rapid changes while results reload, then navigate across Home/Search/Favorites. Verify Spotlight is not left paused, no stale popup key handler captures directional keys, and no Sandstone `scrollHeight`/scroller exception is raised.
5. Open the Elegant Libraries picker and verify the first entry is focused, immediate DOWN/LEFT/RIGHT stays in the picker, Back/toggle close restores the Libraries trigger, and selection/outside dismissal does not steal focus.
6. In Library, reveal search, combine a parent-scoped search term with filters, load another page, open details, and verify Back restores the term, filters, loaded results, and scroll position.
7. In Search, restore results after opening Media Details using both pointer and 5-way input. Verify Sandstone `VirtualGridList` restores the last scroll/focus state, pointer-only scrolling is not pulled back to an older focused tile, UP/DOWN moves through adjacent visual rows including a one-item final row, and visible-index pagination stops once Jellyfin reports no next page.

### Login flow validation

1. With multiple saved servers, verify `Add User` opens server selection first, then credentials for the selected server.
2. On startup with a restorable account, verify Login backdrop `Items`/`Resume` probes do not run while automatic session validation is pending. After choosing Switch User, verify saved-account backdrops load normally.

### Browse and Home regression validation

1. In the My Requests Home row, verify plugin-first behavior falls back to tag matching when the plugin endpoint is unavailable, expected plugin-missing failures are not repeatedly retried in the same app session, and production builds load Home without `p is not a function`.
2. In the My Requests View More section, verify pagination/load-more requests subsequent service pages without duplicates or production-only crashes.
3. In Favorites with more than one page, verify the first page loads about 30 items, scrolling/focusing near the end loads more items, keyword search composes with the selected type filter across pages, and returning from item details preserves the query, filter, loaded page, and scroll position.
4. Verify HeroBanner image logos and text fallback titles use a stable branding slot and do not jump vertically when rotating between items.
5. Verify text-only HeroBanner branding remains readable on bright and dark backdrops in Classic and Elegant, while image logos remain visually unchanged.
6. Verify Search/Favorites poster cards and Library/Home View More landscape cards preserve their ratios, placeholders, watched/progress overlays, image fallback, pointer focus, 5-way focus, and pagination.
7. Verify Library/Home View More retain the intended three-column landscape density on TV, empty-result messages are centered, applied filter counts remain visible, and Favorites stacks `SxxExx`, favorite, and watched pills without overlap or inset drift.
8. Search for Episodes and verify their cards show the parent Series title and `SxxExx`; opening an Episode must expose its Series/Season/Episode breadcrumbs. Search must not return unfiltered Season containers, and stale Season results must open their parent Series instead of requesting playback for the Season item.
9. In Elegant, verify the compact pill header preserves centered tab focus, panel back/title visibility, Libraries/User popup placement, and right-side action navigation across Home, Library, Home View More, Search, Favorites, and Settings. Verify Classic retains its existing toolbar layout.

### Media Details validation

1. On a fully watched season, use the season-card watched action to mark it unwatched, then activate it again. Verify the button state, toast, season state, and episode states transition back to watched rather than repeating the unwatched action.

### Loading and screensaver validation

1. Verify the shared Breezyfin three-stroke gust loading indicator appears in Home, Search, Favorites, Media Details, Library/Home View More, and Player loading states.
2. Verify Normal and Performance modes animate the three clean rounded strokes, while Performance+ renders the same strokes statically with the loading label.
3. With the timeout at `1 minute`, verify the App screensaver activates only after authentication and never on Login, Switch User, active playback, or crash/error surfaces.
4. Verify key, pointer, mouse, and wheel activity reset inactivity; the first wake input dismisses the screensaver without activating or navigating the underlying focused control.
5. Verify the pre-sized white Breezyfin wind mark remains within the black viewport, points along its movement direction with smooth heading changes, reflects at resize boundaries, and advances smoothly on every delivered frame at both 30 Hz and 60 Hz, including Performance+ mode.
6. Verify activation pauses Home Hero/CSS animation, Toolbar clock updates, optional diagnostics, paused playback progress/stall work, and manual subtitle synchronization. On wake, verify one immediate subtitle synchronization occurs, Home resumes, and Spotlight is restored only when the screensaver paused it.
7. Verify logout, switch user, session expiry, view changes, and app unmount clean up inactivity timers, animation frames, listeners, and stored focus.
8. Pause established playback for the configured timeout and verify the separate Player screensaver fades `Press the scroll wheel button to resume playback` between random, fully visible positions; ENTER/OK/Space resumes, while pointer, wheel, directional, or Back wakes to paused controls without activating or navigating underneath. Verify each wake input dismisses once without rapidly hiding/revealing the Player controls.
9. Verify Player loading, playback errors, track popups, subtitle decisions, skip/next prompts, and the extended debug overlay suppress the paused-player screensaver.
