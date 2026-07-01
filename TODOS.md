# Breezyfin TODOs

Backlog for unfinished/planned work only.

Rule:
- Keep this file for unfinished / planned tasks only.
- Move validation/test items to `CHECKS.md` only after the related TODO is completed (if needed).

## Next-release changes (High priority)

- Fix Media Bar media title placement (teleporting up/down) when the logo is text instead of image. Some text titles seem to be glitching position (for example, Culinary Class Wars), where it jumps up and down. Some images pair poorly with the next, which creates visibility issues and poor contrast. That decreases readability. 

## Near-term improvements (Medium priority)

- Run a post-decomposition style analysis pass to identify remaining hotspots/overlap and prioritize practical style cleanup improvements.
- Reduce the `audit:style-tokens` raw-color baseline over time. The audit now blocks new/increased raw colors, but existing visual-effect literals still need deliberate tokenization or justified cleanup.
- Use `npm run audit:hotspots` output and growth ceilings to prioritize practical follow-up splits/tests for the largest current hotspots, especially `subtitleRenderer`, `App`, `playbackApi` / `playbackSelection`, and Media Details focus/interaction hooks.
- Evaluate moving shared playback policy/diagnostic helpers such as `playbackSelection` and playback diagnostics out of `src/services/jellyfin/` into a neutral runtime utility namespace, so service boundaries distinguish API requests from reusable playback decisions more clearly.
- Investigate current `npm audit --omit=dev --audit-level=high` findings before adding dependency security audit to the standard gate. Current findings include `@jellyfin/sdk`'s Axios chain and Enact CLI/build-tool transitive dependencies; decide whether safe updates, overrides, or upstream tracking are appropriate.
- Add in-app settings help/details UI so users can understand what each option does, expected side effects, and recommended usage.
- Continue ASS/SSA renderer validation after the lightweight renderer expansion. Lightweight now covers source colors, fonts, borders, shadows, blur, simple/complex fades, basic `\k`/`\K`/`\kf`/`\ko` karaoke timing, primary/secondary color states, active `\K`/`\kf` sweep approximation, interpolated numeric/color `\t(...)` transforms, margins, ASS `\an` and legacy SSA `\a` alignment, wrap style, `\pos(x,y)`, `\move(...)`, `\org(x,y)` transform origins for absolute transformed cues, long-running overlapping cue lookup, active-cue ASS layer/source render ordering, direct/inverse rectangular `\clip(x1,y1,x2,y2)` / `\iclip(x1,y1,x2,y2)`, common vector `\clip(...)` / `\iclip(...)` masks for SVG drawing cues, style reset, scale, spacing, rotation/skew, source-authored absolute/relative font size, and common `\p` vector drawing paths including B-spline `s`/`p` conversion and `\pbo` drawing baseline offsets; remaining scope is advanced karaoke collision/outline behavior, libass-equivalent vector drawing edge cases, arbitrary text vector masks, mixed inline `\org` transform-origin cases, full collision handling, vertical text/layout, transform edge cases beyond the supported numeric/color subset, and safe performance limits on LG TVs.
- Inspect style token usage for potential over-tokenization and simplify cases where indirection adds noise without practical reuse.
- Expand staged panel loading reveal beyond Media Details (background -> branding -> full UI) with data-ready gating so reveal only starts after panel content is loaded.
- Add a screensaver (think DVD-like) that would trigger after a minute of inactivity (configurable). The screensaver logo could be the transparent logo in white + text BF (short for Breezyfin).
- Create new loading animation. 

## Long-term goals

- Investigate JASSUB's remaining build warning: `Circular dependency between chunks with runtime (jassub-worker, em-pthread, main)`. Determine whether it is harmless for our packaged webOS app, should be documented as acceptable while JASSUB is experimental, or should be addressed by externalizing/patching JASSUB's worker loading path.
- Implement server discovery for manual login so compatible local servers can be detected and selected without manually entering full server details (SSDP discovery).
- Run periodic cleanup passes for file size + module boundaries to prevent orchestrator growth regressions.
- Investigate a stronger shared poster-card skin API (for example `variant="libraryGrid"` plus optional overrides) so Library-like panels do not need CSS-module class mapping helpers long-term.
- Consider adding SearchPanel-like Library search UX in future.
- Identify and fix panel loading delay and unintended panel reload behavior when switching between panels. Needs inspection as it might not be caused by the app.
- Implement Discovery media rows via Seerr integration (likely requires Jellyfin plugin support).
- Investigate plugin-provided Home sections as a future replacement/extension for hard-coded Home section descriptors, while keeping current built-in sections as fallback behavior.
- Implement Watchlist support (evaluate Jellyfin Enhanced/KefinTweaks Watchlist compatibility and integration path).
- Add a Calendar for Sonarr/Radarr release information (likely via plugin/API integration). Consider integration with third-party plugins that provide this functionality.
- Set up a GitHub Pages demo connected to a demo Jellyfin instance.
- Investigate Media Details FPS drops during scrolling on real devices; verify whether panel loading delay and heavy image/styling paths are contributing factors.

## Compatibility goals

- Improve webOS 6 login/switch-user backdrop reliability in `src/views/LoginPanel.js` and `src/views/login-panel-styles/_login-panel-compat-webos6.less`.
- Fix webOS 6 badge spacing/sizing and missing badge visibility issues (Favorites/Search).
- Fix extra whitespace before the first library option on webOS 6.
