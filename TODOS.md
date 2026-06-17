# Breezyfin TODOs

Backlog for unfinished/planned work only.

Rule:
- Keep this file for unfinished / planned tasks only.
- Move validation/test items to `CHECKS.md` only after the related TODO is completed (if needed).

## Next-release changes (High priority)

- Validate the production-only minified Home crash after the production-safe My Requests filled-page pagination redesign.
- Fix Media Bar media title placement (teleporting up/down) when the logo is text instead of image.
- Implement pagination/scroll-loading in View More panel. Current large queries can cause memory leaks or high memory usage which can result in app restarts.
- Transcoding ASS/SSA subtitles with MKV source can lead to playback crashes.

## Near-term improvements (Medium priority)

- Run a post-decomposition style analysis pass to identify remaining hotspots/overlap and prioritize practical style cleanup improvements.
- Evaluate replacing or augmenting custom code-quality audits with tooling such as JSCPD for duplication analysis and JSLint for style rules where compatible with Enact/webOS constraints.
- Add in-app settings help/details UI so users can understand what each option does, expected side effects, and recommended usage.
- Inspect style token usage for potential over-tokenization and simplify cases where indirection adds noise without practical reuse.
- Expand staged panel loading reveal beyond Media Details (background -> branding -> full UI) with data-ready gating so reveal only starts after panel content is loaded.
- Add a screensaver (think DVD-like) that would trigger after a minute of inactivity (configurable). The screensaver logo could be the transparent logo in white + text BF (short for Breezyfin).
- Create new loading animation. 

## Long-term goals

- After V2 subtitle renderer validation, evaluate an explicit experimental ASS renderer via libass only for files where lightweight parsing is insufficient (karaoke, collision handling, fonts, transforms, complex positioning), and separately evaluate whether PGS/image subtitles can be rendered without burn-in.
- Implement server discovery for manual login so compatible local servers can be detected and selected without manually entering full server details (SSDP discovery).
- Some text titles seem to be glitching position (for example, Culinary Class Wars), where it jumps up and down. Some images pair poorly with the next, which creates visibility issues and poor contrast. That decreases readability. 
- Run periodic cleanup passes for file size + module boundaries to prevent orchestrator growth regressions.
- Investigate a stronger shared poster-card skin API (for example `variant="libraryGrid"` plus optional overrides) so Library-like panels do not need CSS-module class mapping helpers long-term.
- Consider adding dedicated Library search UX in future.
- Identify and fix panel loading delay and unintended panel reload behavior when switching between panels. Needs inspection as it might not be caused by the app.
- Implement Discovery media rows via Seerr integration (likely requires Jellyfin plugin support).
- Investigate plugin-provided Home sections as a future replacement/extension for hard-coded Home section descriptors, while keeping current built-in sections as fallback behavior.
- Implement Watchlist support (evaluate Jellyfin Enhanced/KefinTweaks Watchlist compatibility and integration path).
- Add a Calendar for Sonarr/Radarr release information (likely via plugin/API integration).
- Set up a GitHub Pages demo connected to a resettable Jellyfin demo instance.
- Investigate Media Details FPS drops during scrolling on real devices; verify whether panel loading delay and heavy image/styling paths are contributing factors.
- INVESTIGATE: During playback, after some time using fMP4 has a possibility to raise error 500. Also, some playback can still fail with format not supported even though transcoding is enabled. We need to rethink the transcoding pipeline.

## Compatibility goals

- Improve webOS 6 login/switch-user backdrop reliability in `src/views/LoginPanel.js` and `src/views/login-panel-styles/_login-panel-compat-webos6.less`.
- Fix webOS 6 badge spacing/sizing and missing badge visibility issues (Favorites/Search).
- Fix extra whitespace before the first library option on webOS 6.
