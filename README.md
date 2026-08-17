<p align="center">
<img src="./images/Breezyfin_main.png" alt="Breezyfin">
</p>

<p align="center">
  <a href="https://github.com/botagas/Breezyfin/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/botagas/Breezyfin?style=flat-square&logo=github&label=Stars"></a>
  <a href="https://github.com/botagas/Breezyfin/releases"><img alt="GitHub release downloads" src="https://img.shields.io/github/downloads/botagas/Breezyfin/total?style=flat-square&logo=github&label=Downloads"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/botagas/Breezyfin?style=flat-square&label=License"></a>
  <a href="https://github.com/botagas/Breezyfin/releases/latest"><img alt="Latest stable version" src="https://img.shields.io/github/v/release/botagas/Breezyfin?style=flat-square&label=Stable&sort=semver"></a>
  <a href="https://github.com/botagas/Breezyfin/blob/develop/package.json"><img alt="Develop version" src="https://img.shields.io/github/package-json/v/botagas/Breezyfin/develop?style=flat-square&label=Develop"></a>
</p>


<h1>
  <img src="./images/Breezyfin_logo_transparent.png" width="32px" alt="Logo of Breezyfin">
  Breezyfin for webOS
</h1>

Breezyfin is a Jellyfin client for LG webOS TVs. It is built with Enact Sandstone.
The app provides TV-first navigation for 5-way and Magic Remote input, configurable
themes, and playback handling designed for webOS constraints.

Other Jellyfin clients and themes, including JellySee, AndroidTV-FireTV, Moonfin, and
ElegantFin, inspired parts of Breezyfin's design. Check them out.

If you find a problem, open a GitHub issue and include the steps to reproduce it, the
affected media or feature, the TV model, and relevant sanitized logs.

## Current capabilities

- Multi-server, multi-user saved sessions with quick account switching
- Automatic session restoration and credential recovery for expired saved accounts
- Password and Jellyfin Quick Connect sign-in after a server connection is established
- TV-first navigation tuned for LG Magic Remote (5-way and pointer flows)
- Elegant (default) and Classic navigation themes
- Performance Mode and Performance+ Mode (animation reduction options)
- Configurable inactivity screensaver for authenticated browsing views
- Playback that adapts to TV/media compatibility through Direct Play, Direct Stream, or Transcode, with explicit consent before Dolby Vision/HDR quality downgrades
- Smart subtitle and audio handling, including configurable client-rendered text subtitles and client-rendered bitmap subtitles
- Adaptive image loading (WebP when supported, with automatic fallback on load failure)
- Optional Breezyfin plugin Home sections, with built-in Home fallback when the server Home provider is unavailable
- Native Jellyfin Likes Watchlist with optional plugin-backed progress, history, and statistics
- HSS-controlled Discovery feeds and a Calendar view when advertised by the Breezyfin plugin
- App-coordinated native Jellyfin SyncPlay and authenticated JellyWatchParty rooms
- Built-in diagnostics, logs, and cache tools for easier troubleshooting

## Install on TV (IPK)

> [!NOTE]
> If the app does not start or behaves incorrectly after a major update, clear the cache
> once in **Settings > Diagnostics** before you report the problem.

Download prebuilt IPK files from the repository Releases page.

1. Download the latest IPK from Releases.
2. Install it with webOS Dev Manager (or your preferred webOS install tool).

## Install on TV via Homebrew Channel

Breezyfin is listed in the main Homebrew catalog. You can install it from the official catalog.

You can also install a prerelease build from the `develop` branch:
1. Open Homebrew Channel on your TV.
2. Open **Repositories > Manage Repositories**.
3. Add this repo URL:
`https://raw.githubusercontent.com/botagas/Breezyfin/develop/homebrew-dev.json`
4. Refresh repositories.
5. Install `Breezyfin` from the newly added source.

> [!WARNING]
> The `develop` branch can contain unstable or breaking changes.

## Screenshots

<img alt="Home Screen View" src="/images/HomeView.png" />
<img alt="Library Screen View" src="/images/LibraryView.png" />
<img alt="Watchlist Progress" src="/images/Watchlist-Progress.png">
<img alt="Media Details Overview" src="/images/MediaDetails_1.png" />
<img alt="Media Details Overview 2" src="/images/MediaDetails_2.png" />
<img alt="Media Details Overview 3" src="/images/MediaDetails_3.png" />
<img alt="Player Screen View" src="/images/PlayerView.png" />
<img alt="Switch User View" src="/images/SwitchUserView.png" />

> [!NOTE]
> Images shown in Breezyfin are sourced from a sample media library and are used solely to demonstrate the application’s functionality and user interface. Breezyfin and the Jellyfin project are not affiliated with, sponsored by, or endorsed by the owners, creators, distributors, or other rights holders of the featured media. All trademarks, artwork, images, and other featured content remain the property of their respective rights holders. Their inclusion does not imply any association with or endorsement of Breezyfin or the Jellyfin project.

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

## Developer docs

For implementation and workflow details, use:

- [`DEVELOPING.md`](./DEVELOPING.md) for architecture conventions, decomposition rules, shared hooks/utilities, and style patterns
- [`QUALITY.md`](./QUALITY.md) for lint/test/audit coverage and external tooling evaluation notes
- [`WORKAROUNDS.md`](./WORKAROUNDS.md) for active upstream/runtime workarounds, their validation, and removal conditions
- [`HELPERS.md`](./HELPERS.md), [`THEMES.md`](./THEMES.md), [`COMPONENTS.md`](./COMPONENTS.md), [`VIEWS.md`](./VIEWS.md) for focused references
- [`CHECKS.md`](./CHECKS.md) for recurring validation and pre-release verification
- [`TODOS.md`](./TODOS.md) for planned work grouped by implementation scale

## Diagnostics and debug

**Settings > Diagnostics > Enable Diagnostics** controls optional diagnostics. The
setting is off by default in every release channel. Breezyfin preserves the saved values
of child debug options, but those options remain inactive while Diagnostics is off. You
can still review or clear critical and previously captured log entries.

Build-time log capture flags:

- `REACT_APP_ENABLE_PERSISTENT_LOGS=1` includes persistent-log capability; it does not enable runtime diagnostics
- `REACT_APP_DISABLE_PERSISTENT_LOGS=1` removes all persistent logging, including critical records

```sh
# Development server with logging capability; enable Diagnostics in Settings to capture normal logs
REACT_APP_ENABLE_PERSISTENT_LOGS=1 npm run serve
```

## Production build

```sh
npm run pack-p
```
The command writes the production build to `dist/`.

Production packages include Breezyfin's `LICENSE` and generated
`THIRD_PARTY_NOTICES.txt`. The Git tag matching a published release is the
corresponding source reference for that package.

## Roadmap and validation

Planned work is tracked in [`TODOS.md`](./TODOS.md).
Recurring validation and release checks are tracked in [`CHECKS.md`](./CHECKS.md).

## Release automation

This repository supports automated prerelease and stable publishing for webOS Homebrew
distribution:

- `develop` branch -> prerelease assets under tag `nightly`
- `main` branch -> stable release under tag `v<appinfo.json version>`

See `docs/homebrew-release-flow.md` for the full branch/release/version workflow.

## Contributing

Pull requests and issues are welcome! Please follow the code style and add tests for new features. See [`COMPONENTS.md`](./COMPONENTS.md) and [`VIEWS.md`](./VIEWS.md) for architecture and UI conventions.

## License

Breezyfin is licensed under [`GPL-3.0-only`](./LICENSE). Third-party components
and packaged assets remain under their respective licenses, listed in
[`THIRD_PARTY_NOTICES.txt`](./THIRD_PARTY_NOTICES.txt).

## Credits

- Built with [Enact Sandstone](https://github.com/enactjs/sandstone)
- Uses [Jellyfin SDK](https://github.com/jellyfin/sdk)

## Disclaimer

Nowadays, I use AI assistance for a significant part of Breezyfin's development. I created the
initial versions myself, but the project's scope and complexity eventually exceeded the
time that I could give to manual implementation. I now direct the work, review the code,
and test the resulting behavior on the webOS Simulator and real TVs.

I have experience with Python and basic HTML/CSS, but I do not claim expert knowledge of
every system in this project. Breezyfin remains primarily a personal project that aims to
provide a responsive Jellyfin client for webOS. As such, I'm often finding myself guiding the AI, verifying and testing the changes, and trying to prevent it from conquering the world.Reports, reviews, and specific improvement
suggestions are welcome.

## FAQ

<details>
<summary>
<b>Do you plan to release the client on other platforms besides webOS?</b>
</summary>

No. webOS has platform-specific behavior that does not apply to most other targets. I can
test Breezyfin extensively on an LG TV, so the project will remain exclusive to webOS.
</details>

<details>
<summary>
<b>Is the app vibecoded?</b>
</summary>
AI assistance is now a substantial part of the development process. I use it because I do
not have enough time to implement the entire application by hand.

I keep the application modular so that I can review and track changes. The repository also
contains strict architecture, testing, and design rules for every contributor, including
AI agents. This is my first webOS project, and the platform has many constraints that need
explicit handling. Limiting the project to webOS keeps that scope manageable.
</details>

<details>
<summary>
<b>How long will you continue to develop the app?</b>
</summary>
I primarily use LG TVs, so I plan to support Breezyfin while it remains useful to me. AI
assistance does not change that motivation.
</details>

<details>
<summary>
<b>How do you test Breezyfin before a release?</b>
</summary>
Before each release, I test the affected behavior in the webOS Simulator. I then run the
same checks on a TV. A successful candidate is published to the `develop` branch for
continued testing. After the `develop` build remains stable on my TV and testers' TVs, I
promote it to the stable release channel. Some urgent fixes can use a shorter validation
cycle.

If you find a problem, report it in GitHub Issues and include enough information to
reproduce it.
</details>
