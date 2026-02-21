# Breezyfin TODOs

This is the current backlog for v0.1.5 release. Should be updated with further releases.

## High priority

- Decompose remaining large panels:
  - `src/views/PlayerPanel.js`
  - `src/views/MediaDetailsPanel.js`
  - `src/App/App.js`
- Investigate webOS 6 login/switch-user backdrop rendering (requests now avoid hard failures, but fallback imagery still does not render reliably on sim):
  - `src/views/LoginPanel.js`
  - `src/views/login-panel-styles/_login-panel-compat-webos6.less`
- Continue splitting very large style surfaces into smaller units with clearer ownership:
  - `src/views/media-details-styles/_media-details-base.less`
  - `src/components/Toolbar.module.less`
  - `src/views/player-panel-styles/_player-panel-base.less`
- Expand Jellyfin service tests to cover extracted modules directly:
  - `src/services/jellyfin/playbackApi.js`
  - `src/services/jellyfin/libraryApi.js`
  - `src/services/jellyfin/sessionApi.js`

## Medium priority

- Normalize remaining hardcoded color/rgba values into `--bf-theme-*` tokens where practical, starting with Player/MediaDetails/Toolbar style files.
- Audit and reduce custom per-file CSS variables that overlap with global theme tokens.
- Keep compat behavior isolated in compat files; document intentional exceptions when global shared fallbacks are required.
- Standardize watched-status badge usage across all item-card panels so watched state uses the same badge system everywhere it is shown:
  - `src/views/HomePanel.js`
  - `src/views/LibraryPanel.js`
  - `src/views/SearchPanel.js`
- Standardize count/status badges to shared badge primitives with tokenized color variants (for example episode-count badges), instead of panel-specific one-off styling:
  - `src/components/MediaRow.module.less`
  - `src/views/library-panel-styles/_library-panel-base.less`
  - `src/views/search-panel-styles/_search-panel-base.less`

## Secondary improvements

- Add a lightweight architecture index in docs mapping:
  - panel-level decomposition folders
  - shared hooks/utilities
  - service domain modules
- Add a small script/report for style token adoption (where raw color usage still remains).
- Run periodic cleanup passes for file size + module boundaries to prevent orchestrator growth regressions.
- Inspect button styling in Favorites panel to ensure we're using already existing mixins. Alter Mark Watched button hover background color to match the icon color (already done for Favorite button) via shared styles or mixins and ensure that is also used in episode list and favorite panels. 
- Fix badge spacing and sizing on webOS 6. We also need to make sure badges actually appear in Favorites and Search panel on webOS 6.
- Inspect the cause for the first library option having extra whitespace separating it from the second option in webOS 6. 

## Maintenance checks (recurring)

- `npm run lint`
- `npm run test -- --watch=false --runInBand`
- `npm run audit:styles`
- `npm run audit:duplicates`
