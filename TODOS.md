# Breezyfin TODOs

This is the current backlog for v0.1.5 release. Should be updated with further releases.

## High priority

- Decompose remaining large panels:
  - `src/views/PlayerPanel.js`
  - `src/views/MediaDetailsPanel.js`
  - `src/App/App.js`
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

## Secondary improvements

- Add a lightweight architecture index in docs mapping:
  - panel-level decomposition folders
  - shared hooks/utilities
  - service domain modules
- Add a small script/report for style token adoption (where raw color usage still remains).
- Run periodic cleanup passes for file size + module boundaries to prevent orchestrator growth regressions.

## Maintenance checks (recurring)

- `npm run lint`
- `npm run test -- --watch=false --runInBand`
- `npm run audit:styles`
- `npm run audit:duplicates`
