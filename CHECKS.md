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

### Playback/path validation

1. Validate direct play/direct stream/transcode paths on representative media.
2. Validate subtitle burn-in behavior matches settings.
3. Validate toast diagnostics for dynamic range/play method still appear as expected.
4. With `Enable Subtitle Burn-in` off, validate subtitle selection does not trigger subtitle-driven transcode.
5. With `Enable Subtitle Burn-in` on and `Subtitle Burn-in Formats` containing a selected text format (for example ASS/SSA/SRT), validate selecting that subtitle format triggers burn-in/transcode on SDR content.
6. On HDR/DV content, validate selected subtitle formats from `Subtitle Burn-in Formats` do not trigger subtitle-driven transcode unless `Force Subtitle Burn-in on HDR/DV` is enabled.
7. On an item where Jellyfin reports malformed long intro/recap segments, verify skip overlay does not remain active for most/all of runtime (guarded segment filtering path).
8. With `Enable fMP4-HLS container preference` enabled and `Force fMP4-HLS container preference` disabled, verify HDR/DV playback paths remain quality-first (no forced container override).
9. With `Force fMP4-HLS container preference` enabled, verify non-MKV source probing occurs and fallback diagnostics are shown when Jellyfin cannot satisfy the request.
10. With `Force DV (Debug)` enabled, verify playback fails fast when no compatible DV path exists and succeeds only on direct path or audio-only transcode compatible DV sources.
11. Validate skip overlay hides cleanly when intro/recap/preview windows expire without action (no stale overlay after window exit, seek, or item transition).
12. Validate `Skip Credits` always resolves to the active credits/outro boundary when intro and credits markers overlap or are malformed.
13. Validate play-next subtitle continuity prefers prior language semantics over raw stream index when next-episode subtitle ordering/naming differs.
14. In Media Details, validate staged reveal order (`backdrop -> header logo/title -> full controls/content`) starts only after data load completion and does not expose half-loaded title surfaces.

### Library panel scroll/focus regression

1. In Library, scroll deep using pointer, open an item, then go back; verify return position restores to the same depth.
2. In Library, with cached deep position beyond first page, go back into panel and verify progressive restore reaches deep target (not clamped to first-page max).
3. In Library, switch between pointer and 5-way after scrolling; verify no snap-to-top occurs.
4. In Library 5-way mode, navigate cards with directional keys and verify focused card remains in viewport (focus-driven scroll works).
5. In Library, scroll down and interact with the page using 5-way or pointer. Verify that snap back to top of the page does not occur.
