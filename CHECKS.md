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
3. On HDR/DV content, validate selected subtitle formats from `Subtitle Burn-in Formats` do not trigger subtitle-driven transcode unless `Force Subtitle Burn-in on HDR/DV` is enabled.
4. With `Enable fMP4-HLS container preference` enabled and `Force fMP4-HLS container preference` disabled, verify HDR/DV playback paths remain quality-first (no forced container override).
5. With `Force fMP4-HLS container preference` enabled, verify non-MKV source probing occurs and fallback diagnostics are shown when Jellyfin cannot satisfy the request.
6. With `Force DV (Debug)` enabled, verify playback fails fast when no compatible DV path exists and succeeds only on direct path or audio-only transcode compatible DV sources.
7. Validate `Skip Credits` always resolves to the active credits/outro boundary when intro and credits markers overlap or are malformed.
8. Validate play-next subtitle continuity prefers prior language semantics over raw stream index when next-episode subtitle ordering/naming differs.
9. Validate audio track switching works when multiple audio streams share the same language code (for example many `ru` tracks plus one `en`) and that selecting non-first same-language tracks applies correctly.
10. When Skip Intro / Skip Credits / Play Next overlay appears, verify 5-way LEFT/RIGHT can move focus between the primary action and X dismiss button, ENTER activates the focused button, and BACK dismisses through the normal player back flow.

### Home panel focus regression

1. With Home media bar disabled or unavailable, focus a navbar item and press DOWN; verify focus still falls through to the first available content row.
2. In a Home View More section with more than one page, verify scrolling/focusing near the end loads more items without duplicates.
3. In the My Requests Home row, verify up to 10 unwatched request-tagged items appear when at least 10 are available, watched items are excluded, and plugin-first behavior falls back to tag matching when the plugin endpoint is unavailable.
4. In the My Requests View More section, verify pagination/load-more continues scanning raw Jellyfin pages until matching unwatched request items fill the page or the source is exhausted.
5. In each Home View More section, open the filter popup and verify All/Unplayed/Played/Favorites/My Requests can be selected, combined filters reload the grid from the top, and returning from item details preserves the active filters.
