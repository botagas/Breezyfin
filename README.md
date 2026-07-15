<p align="center">
<img src="./images/Breezyfin_main.png">
</p>


<h1>
  <img src="./images/Breezyfin_logo_transparent.png" width="32px" alt="Logo of Breezyfin">
  Breezyfin for webOS
</h1>

Breezyfin is a Jellyfin client for LG webOS TVs, built with Enact Sandstone.
It focuses on TV-first navigation (best suited for usage with the Magic Remote), themeable UI, and resilient playback handling for webOS constraints.

The app was inspired by other great apps and themes, like JellySee, AndroidTV-FireTV, Moonfin, ElegantFin and more. Check them out.

In case of an issue, please report it on GitHub in as much detail as possible.

## Current capabilities

> [!NOTE]
> The app has undergone major refactoring efforts. If you upgrade from an older build, run **Wipe Cache and Reload (Keep Login)** once, and report issues you encounter.

- Multi-server, multi-user saved sessions with quick account switching
- Session restore on startup, with automatic redirect to Login when token/session is expired
- TV-first navigation tuned for LG Magic Remote (5-way and pointer flows)
- Elegant (default) and Classic navigation themes
- Performance Mode and Performance+ Mode (animation reduction options)
- Configurable inactivity screensaver for authenticated browsing views
- Playback that adapts to TV/media compatibility (Direct Play / Direct Stream / Transcode, DV -> HDR -> SDR)
- Smart subtitle and audio handling, including configurable client-rendered text and experimental bitmap subtitles where possible to preserve video quality
- Adaptive image loading (WebP when supported, with automatic fallback on load failure)
- Built-in diagnostics, logs, and cache tools for easier troubleshooting

## Install on TV (IPK)

Watch repository releases for prebuilt IPK artifacts.

1. Download the latest IPK from Releases.
2. Install it with webOS Dev Manager (or your preferred webOS install tool).

## Install on TV via Homebrew Channel

Breezyfin is listed in the main Homebrew catalog. You can install it from the official catalog.

You may also install the app using the `develop` branch:
1. Open Homebrew Channel on your TV.
2. Go to Repositories / Manage Repositories.
3. Add this repo URL:
`https://raw.githubusercontent.com/botagas/Breezyfin/develop/homebrew-dev.json`
4. Refresh repositories.
5. Install `Breezyfin` from the newly added source.

Beware, `develop` may include breaking changes.

## Screenshots
> [!NOTE]
> Provided images use a sample library.

<img alt="Home Screen View" src="/images/HomeView.png" />
<img alt="Library Screen View" src="/images/LibraryView.png" />
<img alt="Media Details Overview" src="/images/MediaDetails_1.png" />
<img alt="Media Details Overview 2" src="/images/MediaDetails_2.png" />
<img alt="Media Details Overview 3" src="/images/MediaDetails_3.png" />
<img alt="Player Screen View" src="/images/PlayerView.png" />
<img alt="Switch User View" src="/images/SwitchUserView.png" />

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
- [`HELPERS.md`](./HELPERS.md), [`THEMES.md`](./THEMES.md), [`COMPONENTS.md`](./COMPONENTS.md), [`VIEWS.md`](./VIEWS.md) for focused references
- [`CHECKS.md`](./CHECKS.md) for recurring validation and pre-release verification
- [`TODOS.md`](./TODOS.md) for prioritized planned work

## Diagnostics and debug

Optional diagnostics are controlled by **Settings > Diagnostics > Enable Diagnostics** and default off in every release channel. The Performance Overlay, Extended Player Debug Metrics, Focus Debug Overlay, Verbose App Logs, and non-stable Debug Error Menu retain their saved values but stay inactive while the master switch is off. Logs remain accessible so critical or previously captured entries can still be reviewed and cleared.

With Diagnostics off, normal console traffic is not patched or persisted and optional playback/source/canvas metrics are not collected. App crashes, global errors, and unhandled rejections still use a bounded critical-log path when persistent logging capability is present. Playback recovery and the bounded subtitle-renderer health watchdog remain active because they are correctness features. Force DV, Relaxed Playback Profile, and other explicit playback behavior settings are independent of the diagnostics master switch.

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
Output will be in the `dist/` folder.

Production packages include Breezyfin's `LICENSE` and generated
`THIRD_PARTY_NOTICES.txt`. The Git tag matching a published release is the
corresponding source reference for that package.

## Roadmap and validation

Planned work is tracked in [`TODOS.md`](./TODOS.md).
Recurring validation and release checks are tracked in [`CHECKS.md`](./CHECKS.md).

## Release automation

This repository supports automated prerelease/stable publishing for webOS Homebrew distribution:

- `develop` branch -> prerelease assets under tag `nightly`
- `main` branch -> stable release under tag `v<appinfo.json version>`

See `docs/homebrew-release-flow.md` for the full branch/release/version workflow.

## Contributing

Pull requests and issues are welcome! Please follow the code style and add tests for new features. See [`COMPONENTS.md`](./COMPONENTS.md) and [`VIEWS.md`](./VIEWS.md) for architecture and UI conventions.

## License

Breezyfin is licensed under [`GPL-3.0-only`](./LICENSE). Third-party components
and packaged assets remain under their respective licenses, listed in
[`THIRD_PARTY_NOTICES.txt`](./THIRD_PARTY_NOTICES.txt).

## Project statistics

<a href="https://www.star-history.com/?repos=botagas%2FBreezyfin&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=botagas/Breezyfin&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=botagas/Breezyfin&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=botagas/Breezyfin&type=date&legend=top-left" />
 </picture>
</a>

## Credits

- Built with [Enact Sandstone](https://github.com/enactjs/sandstone)
- Uses [Jellyfin SDK](https://github.com/jellyfin/sdk)

## Disclaimer
- A large set of the latest code is written with AI-assistance. The initial project was mostly drafted by me, but over time, both the scope and the complexity grew too much for me to handle on my free time. That includes the web interface and underlying systems. While I have learnt and had experience with Python, and have some basic knowledge in HTML/CSS, I am far from being highly proficient. As my time is very limited, I'm often finding myself guiding the AI to do various tasks, verifying and testing the changes, and trying to prevent it from conquering the world. As such, please be aware of the state of the code and feel free to point out areas of improvement. This is for the most part a personal project aimed towards providing a performant Jellyfin client for webOS.

## FAQ

<details>
<summary>
<b>Do you plan to release the client on other platforms besides webOS?</b>
</summary>

No. As of now, webOS has too many quirks that will not be applicable to other platforms. I have a TV that I can test the app with extensively, and as such, it will remain a webOS exclusive.
</details>

<details>
<summary>
<b>Is the app vibecoded?</b>
</summary>
I would say the current state of it is. While the initial versions where mostly me speeding up the workflow, my current circumstances lack the time and mental capacity to do manual labor on the app.
My current workflow consists of making sure the app is not monolithic so I could edit and track changes more easily. I've established strict guidelines for myself and any agents that may interact with the repository, because I know how I want the app to work, what the structure has to be, and what kind of code and design decisions should be made (if possible) within webOS constraints. This is my first and only webOS project and let me tell you, it is nothing like working on a simple webapp. Even some simple CSS options often simply break depending on the webOS version.
</details>

<details>
<summary>
<b>How long do you continue developing the app? Won't you just abandon and forget it?</b>
</summary>
Considering I mostly use LG TVs, I will continue supporting it as long as I keep using it. Regardless if AI is used or not, the most important part when developing an application is to make something that you will find a use for, and this is exactly that.
</details>

<details>
<summary>
<b>Have you even tested your app yourself? Seems broken on my TV.</b>
</summary>
Before each release, the app is tested regarding each change using webOS Simulator. After that succeeds and works as intended, it is then tested using the same determined checks on a TV. After that proves to be stable, a release is pushed to the dev branch. Once dev branch proves to be stable for some time while testing on my own TV as well as other testers, it is then pushed to stable for release. There are some exceptions.

If you encounter issues, please report them in the Issues section in as much detail as possible.
</details>
