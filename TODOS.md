# Breezyfin TODOs

This is the active backlog after the latest refactor cycle. Update it per release.

Rule:
- Keep this file for unfinished / planned tasks only.
- Move validation/test items to `CHECKS.md` only after the related TODO is completed (if needed).

## High priority

- Continue decomposing large panel orchestrators:
  - `src/views/PlayerPanel.js`
  - reduce remaining orchestration weight in `src/views/MediaDetailsPanel.js`
  - reduce remaining orchestration weight in `src/views/SettingsPanel.js`
- Fix webOS 6 login/switch-user backdrop rendering reliability (fallback imagery still does not render reliably on simulator):
  - `src/views/LoginPanel.js`
  - `src/views/login-panel-styles/_login-panel-compat-webos6.less`
- Expand Jellyfin service tests to cover extracted modules directly:
  - `src/services/jellyfin/playbackApi.js`
  - `src/services/jellyfin/libraryApi.js`
  - `src/services/jellyfin/sessionApi.js`
- Add focused test coverage for image format preference/fallback:
  - `src/utils/imageFormat.js`
  - `src/services/jellyfinService.js`
- Decide whether to expose a user-facing setting to disable WebP image preference for problematic server/device combinations.
- Identify the cause for FPS drops in Media Details panel when scrolling. Loading delay in panels might be directly related to the FPS drops since they are not present in Simulator tests. This might cause issues for TVs that were released in 2022 or prior. It could be related to backdrop/cast/episode image quality or complexity as not all media causes this behavior. Performance Mode should be improved in episode list to reduce heavyweight styling.

## Medium priority

- Normalize remaining hardcoded color/rgba values into `--bf-theme-*` tokens where practical, starting with Player/MediaDetails/Toolbar style files.
- Audit and reduce custom per-file CSS variables that overlap with global theme tokens.
- Keep compat behavior isolated in compat files; document intentional exceptions when global shared fallbacks are required.
- Standardize count/status badges to shared badge primitives with tokenized color variants (for example episode-count badges), instead of panel-specific one-off styling:
  - `src/components/MediaRow.module.less`
  - `src/views/library-panel-styles/_library-panel-base.less`
  - `src/views/search-panel-styles/_search-panel-base.less`
- Continue splitting very large style surfaces into smaller units with clearer ownership:
  - `src/views/player-panel-styles/_player-panel-base.less`
  - `src/views/style-debug-panel-styles/_style-debug-panel-snipzy.less`
  - `src/views/login-panel-styles/_login-panel-base.less`
- Fix badge spacing/sizing and missing badge visibility issues on webOS 6 (Favorites/Search).
- Fix extra whitespace before the first library option on webOS 6.

## Secondary improvements

- Add a lightweight architecture index in docs mapping:
  - panel-level decomposition folders
  - shared hooks/utilities
  - service domain modules
- Add a small script/report for style token adoption (where raw color usage still remains).
- Run periodic cleanup passes for file size + module boundaries to prevent orchestrator growth regressions.
- Refactor Favorites button styling to reuse existing shared mixins and align Mark Watched hover background with icon color (and mirror the same treatment in episode list/favorite panels).
