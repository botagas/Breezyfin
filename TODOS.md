# Breezyfin TODOs

This is the most recent TO-DO backlog file. It is updated actively with changes.

Rule:
- Keep this file for unfinished / planned tasks only.
- Move validation/test items to `CHECKS.md` only after the related TODO is completed (if needed).

## Next-release changes (High priority)

- Add a small script/report for style token adoption (remaining raw color usage).
- Align episode/season watched-action styling in Media Details with the shared token/mixin approach used in Favorites and other panels.

## Near-term improvements (Medium priority)

- Run periodic cleanup passes for file size + module boundaries to prevent orchestrator growth regressions.
- Continue opportunistic style decomposition for remaining larger style files where ownership boundaries are still mixed.

## Long-term goals

- Identify and fix panel loading delay and unintended panel reload behavior when switching between panels.
- Improve webOS 6 login/switch-user backdrop reliability in `src/views/LoginPanel.js` and `src/views/login-panel-styles/_login-panel-compat-webos6.less`.
- Fix webOS 6 badge spacing/sizing and missing badge visibility issues (Favorites/Search).
- Fix extra whitespace before the first library option on webOS 6.
- Implement Discovery media rows via Seerr integration (likely requires Jellyfin plugin support).
- Implement Watchlist support (evaluate Jellyfin Enhanced/KefinTweaks Watchlist compatibility and integration path).
- Add a Calendar for Sonarr/Radarr release information (likely via plugin/API integration).
- Set up a GitHub Pages demo connected to a resettable Jellyfin demo instance.
- Investigate Media Details FPS drops during scrolling on real devices; verify whether panel loading delay and heavy image/styling paths are contributing factors.
