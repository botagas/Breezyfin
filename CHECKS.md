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

### CSS token normalization + compat boundaries

1. Run `rg -n --glob '!src/styles/themes/*' "var\\([^\\)]*," src` and verify no fallback-chain `var()` usage remains outside theme token files.
2. Verify both Elegant and Classic themes still render expected colors/surfaces in Player, Media Details, Toolbar, Login, and Settings.
3. Verify webOS-legacy compatibility overrides remain isolated to compat files (`*-compat-webos6.less` and shared compat style files), not base theme files.
4. Run `npm run audit:styles` and manually review CSS-module dead-class output for true positives vs composition false-positives (notably split Login panel styles).

### Runtime capabilities / WebP image fallback

1. Open Settings -> Diagnostics and verify capability rows render (including `WebP Image Decode`).
2. Verify image-heavy views (Login backdrops, Home hero, Media Details, rows/cards, toolbar avatar) still load correctly.
3. On a server/path where WebP is not served, verify images retry and render without `format=Webp` (no persistent broken placeholders).
4. Verify no repeated image error loop occurs (single retry path only).
5. Validate WebP behavior across at least one older Jellyfin server build (fallback path should keep images usable).

### Panel image load-reveal UX (Home/Library/Search/Favorites)

1. Verify Home hero and panel cards (Home rows, Library grid, Search grid, Favorites grid) do not show granular/chunky image paint while loading.
2. Verify a blur/loading hint is visible before image load and disappears once image decode completes.
3. Verify image-load fallback still works on error paths (placeholder surfaces render; no permanent broken-image tiles).
4. Verify `disableAnimations` / `disableAllAnimations` still behaves correctly (no unwanted transition artifacts).

### Media Details section navigation (5-way)

1. From Cast/Seasons/Episodes, press `UP` and verify focus returns to first section controls (not favorite/watched action buttons unexpectedly).
2. From header/first-section controls, press `DOWN` and verify focus enters the intended first content row (then continues through section chain predictably).
3. Verify section switch hints and scroll snapping still move between first and second section predictably.

### Popup first-option autofocus behavior

1. Open Audio/Subtitles popup in Player and verify the first actionable row is focused immediately.
2. Open Audio/Subtitles/Episode picker popup in Media Details and verify focus lands on the first option without extra directional input.
3. Spot-check Settings/Search/Toolbar popups and verify focus does not remain on the trigger button/body after popup open.

### Popup duplication guard

1. Run `npm run audit:duplicates` and verify no cross-file duplicate snippets are reported for Media Details popup picker components.

### Global image load-reveal + lazy-loading coverage

1. Spot-check Login (backdrops + saved avatars), Media Details (backdrop + header logo + season/episode cards), and Toolbar avatar for blur-hint/load-reveal behavior (no granular/chunky paint).
2. Verify all app `<img>` surfaces still use `loading=\"lazy\"` and `decoding=\"async\"` where appropriate (no sync main-thread image stalls).
3. Verify critical hero/backdrop experiences still feel responsive after lazy-loading/reveal updates (no visible blank flashes during normal navigation).

### Playback/path validation

1. Validate direct play/direct stream/transcode paths on representative media.
2. Validate subtitle burn-in behavior matches settings.
3. Validate toast diagnostics for dynamic range/play method still appear as expected.
4. With `Enable Subtitle Burn-in` off, validate subtitle selection does not trigger subtitle-driven transcode.
5. With `Enable Subtitle Burn-in` on and `Subtitle Burn-in Formats` containing ASS/SSA, validate ASS/SSA selection triggers burn-in/transcode on SDR content.
6. On HDR/DV content, validate ASS/SSA selection does not trigger subtitle-driven transcode unless `Force Subtitle Burn-in on HDR/DV` is enabled.
7. On an item where Jellyfin reports malformed long intro/recap segments, verify skip overlay does not remain active for most/all of runtime (guarded segment filtering path).

### Jellyfin service module unit checks

1. `npm run test -- --watch=false --runInBand --runTestsByPath src/services/__tests__/sessionApi.test.js src/services/__tests__/libraryApi.test.js src/services/__tests__/playbackApi.test.js`
2. `npm run test -- --watch=false --runInBand --runTestsByPath src/utils/__tests__/imageFormat.test.js src/services/__tests__/jellyfinService.test.js`

### Docs alignment / architecture map sanity

1. Verify `README.md`, `DEVELOPING.md`, and `HELPERS.md` include any newly added shared hooks/helpers/constants (for example popup focus helpers or debug utilities).
2. Verify referenced `src/...` paths in docs still resolve to existing files (no stale paths after refactors/decomposition moves).
