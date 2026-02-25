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
4. `npm run audit:duplicates`

## Release-oriented checks

Run these before packaging a release candidate:

1. `npm run lint`
2. `npm run test -- --watch=false --runInBand`
3. `npm run audit:styles`
4. `npm run audit:duplicates`
5. `npm run pack-p`

## Focused regression checks

### Runtime capabilities / WebP image fallback

1. Open Settings -> Diagnostics and verify capability rows render (including `WebP Image Decode`).
2. Verify image-heavy views (Login backdrops, Home hero, Media Details, rows/cards, toolbar avatar) still load correctly.
3. On a server/path where WebP is not served, verify images retry and render without `format=Webp` (no persistent broken placeholders).
4. Verify no repeated image error loop occurs (single retry path only).
5. Validate WebP behavior across at least one older Jellyfin server build (fallback path should keep images usable).

### Playback/path validation

1. Validate direct play/direct stream/transcode paths on representative media.
2. Validate subtitle burn-in behavior matches settings.
3. Validate toast diagnostics for dynamic range/play method still appear as expected.
