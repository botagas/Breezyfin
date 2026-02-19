<p align="center">
<img src="./images/Breezyfin_main.png">
</p>

# Breezyfin for webOS

Breezyfin is a Jellyfin client for LG webOS TVs, built with Enact Sandstone.
It focuses on TV-first navigation, themeable UI, and resilient playback handling for webOS constraints.

The app was inspired by other great apps and themes, like JellySee, AndroidTV-FireTV, Moonfin, ElegantFin and more. Check them out.

In case of an issue, please report it on GitHub in as much detail as possible.

## Current capabilities

- Multi-server, multi-user saved sessions with quick account switching
- Session restore on startup, with automatic redirect to Login when token/session is expired
- Home, Library, Search, Favorites, Media Details, and Player panels
- Elegant (default) and Classic navigation themes
- Performance Mode and Performance+ Mode (animation reduction options)
- Rich Media Details workflows (favorites, watched status, track pickers, episodes/seasons, side list toggle)
- Player with direct play, direct stream, and transcode handling
- Subtitle/audio compatibility fallbacks for webOS playback paths
- Diagnostics tools (logs, performance overlay, cache wipe, style debug panel)

## Install on TV (IPK)

Watch repository releases for prebuilt IPK artifacts.

1. Download the latest IPK from Releases.
2. Install it with webOS Dev Manager (or your preferred webOS install tool).

## Install on TV (Homebrew dev repo)

Breezyfin is not yet listed in the main Homebrew catalog, but you can add the dev feed now.

1. Open Homebrew Channel on your TV.
2. Go to Repositories / Manage Repositories.
3. Add this repo URL:
`https://raw.githubusercontent.com/botagas/Breezyfin/develop/homebrew-dev.json`
4. Refresh repositories.
5. Install `Breezyfin` from the newly added source.

## Local development

Clone the repository and install dependencies:

```sh
git clone https://github.com/botagas/Breezyfin.git
cd Breezyfin
npm install
```

Start the development server:

```sh
npm run serve
```
Visit [http://localhost:8080](http://localhost:8080) in your browser.

## Developer guidelines

Before adding new panel logic, prefer shared building blocks first:

- Back handling: `src/hooks/usePanelBackHandler.js`
- Popup/menu state: `src/hooks/useDisclosureMap.js`
- Map lookups by id/key: `src/hooks/useMapById.js`
- Item metadata fetch/state: `src/hooks/useItemMetadata.js`
- Toast lifecycle: `src/hooks/useToastMessage.js`
- Track preference persistence: `src/hooks/useTrackPreferences.js`
- Image fallback handling: `src/hooks/useImageErrorFallback.js`
- Settings sync listeners: `src/hooks/useBreezyfinSettingsSync.js`
- Reusable media-card overlays: `src/components/MediaCardStatusOverlay.js`
- Shared toolbar focus helper: `src/utils/toolbarFocus.js`
- Shared home row order constant: `src/constants/homeRows.js`
- Shared poster card class helper: `src/utils/posterCardClassProps.js`

Styling and theme references:

- Theme tokens: `src/styles/themes/classic.css`, `src/styles/themes/elegant.css`
- Shared popup surface styles: `src/styles/popupStyles.module.less`, `src/styles/popupStyles.js`
- Panel styling pattern: `src/views/*-panel-styles/` split files (base + per-theme + shared tail)

## Debug flags

The app supports build-time/runtime debug behavior through environment flags:

Defaults:

- In non-production builds, Style Debug features are enabled by default.
- Persistent app logging follows the same default as Style Debug.
- In production builds, both are off unless explicitly enabled by flags.

Flags:

- `REACT_APP_ENABLE_STYLE_DEBUG=1`
  - Forces Styling Debug panel/features on.
- `REACT_APP_DISABLE_STYLE_DEBUG=1`
  - Forces Styling Debug panel/features off.
- `REACT_APP_ENABLE_PERSISTENT_LOGS=1`
  - Forces persistent app log capture on (stored in `localStorage`).
- `REACT_APP_DISABLE_PERSISTENT_LOGS=1`
  - Forces persistent app log capture off.

Examples:

```sh
# Development server with persistent logs enabled
REACT_APP_ENABLE_PERSISTENT_LOGS=1 npm run serve

# Production build with Style Debug enabled and persistent logs on
REACT_APP_ENABLE_STYLE_DEBUG=1 REACT_APP_ENABLE_PERSISTENT_LOGS=1 npm run pack-p
```

Media Details focus tracing (runtime toggle):

- Query param: `?bfFocusDebug=1`
- Or from browser console:

```js
localStorage.setItem('breezyfinFocusDebug', '1');
```

## Runtime diagnostics (Settings panel)

Diagnostics currently include:

- Performance Overlay (`FPS`, `Input`, `Mode`)
- Relaxed Playback Profile toggle (debug-only visibility)
- Styling Debug Panel shortcut (debug-only visibility)
- Logs viewer and clear action
- Wipe App Cache (clears local/session storage, cache storage, IndexedDB, unregisters service workers, then reloads)

## Production build

```sh
npm run pack-p
```
Output will be in the `dist/` folder.

## Code quality audits

- Dead CSS module audit: `npm run audit:styles`
- Mixed JS/LESS duplicate snippet audit: `npm run audit:duplicates`

## Possible improvements

- Stabilize playback across edge-case media by improving server capability checks and fallback messaging.
- Expand hardware / software compatibility by testing across multiple webOS versions and TV chipsets.
- Continue reducing remote-input latency and focus jitter in dense UI views.
- Improve consistency of themed components and shared style tokens across all panels.
- Expand diagnostics with actionable playback telemetry export for issue reports.
- Add automated test coverage for panel navigation, playback recovery paths, and settings persistence.
- Add CI quality gates for lint/test/build plus release artifact checks.
- Improve accessibility/readability options (larger text mode, stronger contrast presets, clearer focus indicators).

## Release automation

This repository supports automated prerelease/stable publishing for webOS Homebrew distribution:

- `develop` branch -> prerelease assets under tag `nightly`
- `main` branch -> stable release under tag `v<appinfo.json version>`

See `docs/homebrew-release-flow.md` for the full branch/release/version workflow.

## Contributing

Pull requests and issues are welcome! Please follow the code style and add tests for new features. See the [components/README.md](src/components/README.md) for reusable UI guidelines.

## Credits

- Built with [Enact Sandstone](https://github.com/enactjs/sandstone)
- Uses [Jellyfin SDK](https://github.com/jellyfin/sdk)
- AI-assisted development was used; please review changes carefully and report regressions/issues.
