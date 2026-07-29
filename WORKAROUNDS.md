# Active Workarounds

This register documents intentional implementation constraints that can look redundant,
unusual, or safe to simplify but are required by the current webOS, Enact, Sandstone, or
third-party runtime. It is not a list of normal product fallbacks.

## Maintenance

- Add an entry when a change deliberately works around an upstream/runtime limitation.
- Link the concrete implementation and its automated or manual validation.
- State the removal condition. Do not remove or generalize a workaround until that
  condition is met and the listed checks pass on supported TV hardware.
- Update or remove the entry in the same change that alters the workaround.
- Keep ordinary playback recovery, image fallback, subtitle policy, and empty/error
  states in their owning architecture docs unless they depend on a specific upstream
  defect.

## WA-001: React 18 `react-is` build alias

**Status:** Active.

**Constraint:** Breezyfin runs React 18, but Enact CLI 7.3.2 and newer can resolve its
React 19 tool dependency's `react-is` during development builds. Sandstone then reports
valid React 18 children as invalid.

**Implementation:**

- `package.json` maps Enact's `react-is` alias to the explicitly pinned
  `react-is-18` package alias.
- `package-lock.json` locks that alias to React 18.3.1.
- `scripts/code-audit/find-runtime-dependency-drift.cjs` rejects generation drift.

**Removal condition:** Remove only when Breezyfin migrates the complete runtime to a
compatible Enact/React generation, or an Enact CLI release no longer leaks its tool
dependency into application element validation.

**Validation:** Run `npm run audit:runtime-deps`, `npm run lint`, and a development build.
The initial render must not emit invalid-child PropType warnings for valid Breezyfin
components.

## WA-002: Relative webOS package entry assets

**Status:** Active.

**Constraint:** webOS launches the packaged application through `file://`. Root-relative,
repository-prefixed, or HTTP entry assets can therefore produce a black screen even
though browser-hosted development works.

**Implementation:**

- `package.json` keeps `enact.publicUrl` set to `.` independently of `homepage`.
- `scripts/code-audit/find-metadata-drift.cjs` protects the package setting.
- `scripts/copy-subtitle-assets.cjs` validates generated JavaScript and stylesheet entry
  paths after packing.

**Removal condition:** Remove only if the supported webOS package launcher no longer uses
file-based application assets, or the build tool provides an equivalent package-safe
asset contract.

**Validation:** Run `npm run audit:metadata`, `npm run pack-p`, and `ares-package dist`.
Confirm `dist/index.html` uses relative `./...` entry paths and the IPK boots on TV or the
simulator.

## WA-003: Enact CLI embedded lint bypass

**Status:** Active; standalone lint remains mandatory.

**Constraint:** Enact CLI 7's embedded Webpack lint configuration enables React 19
compiler-only rules that are not valid for Breezyfin's React 18 runtime. Running that
embedded lint can therefore reject supported application code for the wrong framework
generation.

**Implementation:**

- `package.json` runs `enact pack` with the supported `--no-linting` option.
- CI and release workflows run `npm run lint` before either pack command.
- `eslint.config.js` is the checked-in React 18-aware lint authority.

This bypass applies only to Enact's embedded build lint. It must never be used to skip
the repository lint gate.

**Removal condition:** Remove when the Enact build tool uses a lint configuration
compatible with Breezyfin's selected React runtime, or after a coherent framework
migration makes the embedded rules applicable.

**Validation:** Run `npm run lint`, then both `npm run pack` and `CI=true npm run pack-p`.
CI must continue to fail on standalone lint errors before packing.

## WA-004: JASSUB static assets and forced Canvas2D backend

**Status:** Active and version-guarded for JASSUB 2.5.6.

**Constraint:** JASSUB's WebGL renderer is unreliable on supported webOS devices. Its
published static fallback imports also cause Enact/Webpack to generate circular worker
chunks, and its package does not include every runtime asset in the shape Breezyfin
needs.

**Implementation:**

- `scripts/prepare-subtitle-package-assets.cjs` prepares the fallback font and package
  sources before packing.
- `scripts/subtitle-assets/jassubCanvas2dPatch.cjs` forces Canvas2D and removes static
  bundler fallback imports with source-shape and version guards.
- `scripts/copy-subtitle-assets.cjs` copies and validates worker, WASM, font, and renderer
  assets.
- `src/views/player-panel/utils/subtitle-renderers/jassubRenderer.js` supplies explicit
  packaged asset URLs and reports the Canvas2D backend.

**Removal condition:** Re-evaluate on every JASSUB upgrade. Remove the backend patch only
after JASSUB WebGL renders reliably during sustained playback on all supported webOS
generations. Remove the static-entry patch only when upstream packaging no longer creates
worker/WASM fallback chunks in Enact builds.

**Validation:** Run the JASSUB patch tests, `CI=true npm run pack-p`, and
`ares-package dist`. Confirm no `chunk.jassub-worker.*` or `chunk.em-pthread.*` file is
generated and JASSUB reports `backend=canvas2d` while rendering on TV.

## WA-005: Sandstone internal focus-scale selectors

**Status:** Active and intentionally narrow.

**Constraint:** Sandstone does not expose a stable public switch for every internal
VirtualList/VirtualGridList focus-scale layer used by the current Enact 4/Sandstone 2
runtime. The scale and shadow materially increase repaint cost and can destabilize fixed
TV grid/list geometry.

**Implementation:**

- `src/components/MediaVirtualGrid.module.less` disables the internal scaled wrapper for
  shared uniform grids.
- `src/views/WatchlistPanel.module.less` applies the same bounded override to Watchlist
  insight lists.

Both selectors intentionally match Sandstone-generated class-name fragments. Do not
broaden them or copy them into panel styles.

**Removal condition:** Replace these selectors when the supported Sandstone version
offers a public non-scaling focus API, or after a framework upgrade provides equivalent
performance and geometry without the override.

**Validation:** Run `npm run audit:styles` and manually verify pointer/5-way focus,
non-scaling card geometry, scrolling, and repaint performance in all virtualized panels.

## WA-006: Watchlist mixed scroll ownership and static state viewport

**Status:** Active, panel-local workaround.

**Constraint:** Watchlist and populated Statistics use `AppScroller` so their content can
move beneath the shared navbar. Series Progress, Completed Series, and Movie History need
exclusive Sandstone `VirtualList` ownership for reliable virtualization and focus. An
empty/loading Statistics state has no scrollable content, and placing that state inside
`AppScroller` gives it different vertical geometry from the other advanced-tab states.

**Implementation:**

- `src/views/WatchlistPanel.js` selects one scroll owner per tab and uses
  `statisticsUsesStaticViewport` while Statistics has no populated result.
- `src/views/WatchlistPanel.module.less` gives Watchlist and advanced-tab state surfaces
  explicit bounded geometry.
- `src/components/IntegrationPanelLayout.js` remains the shared owner of the surrounding
  toolbar-safe layout.

This is why Statistics cannot simply use the same unconditional `scrollable` value as
the populated Statistics view.

**Removal condition:** Replace when the shared integration layout can render loading,
empty, and error states in one consistent viewport independent of whether `AppScroller`
or a Sandstone virtual list owns content scrolling, without regressing navbar scroll-under
behavior or Spotlight navigation.

**Validation:** Verify every Watchlist tab in loading, error, empty, and populated states;
confirm matching state placement, one vertical scroll owner, content-under-navbar
behavior where intended, and stable pointer/5-way focus.

## WA-007: Capability-scoped legacy webOS styles

**Status:** Active for supported legacy TVs.

**Constraint:** Older webOS browser engines have unreliable flex `gap`, implicit
aspect-ratio sizing, backdrop filtering, and scroll metrics. Base-theme behavior cannot
always degrade safely without explicit dimensions or alternate surfaces.

**Implementation:**

- `src/styles/compatMixins.less` contains shared capability fallbacks.
- `src/components/toolbar-styles/_toolbar-compat-webos6.less` owns the legacy toolbar
  path.
- `src/components/media-row-styles/_media-row-compat-webos6.less` stabilizes Home row
  geometry.
- `src/views/search-panel-styles/_search-panel-compat-webos22.less` and
  `src/views/favorites-panel-styles/_favorites-panel-compat-webos22.less` stabilize
  virtual-grid scroll metrics.
- Additional component/panel compatibility files are catalogued in `THEMES.md`.

**Removal condition:** Remove individual rules only after Breezyfin raises its minimum
webOS version beyond the affected engine or capability probes and real-TV tests prove the
base path reliable.

**Validation:** Run the style audits and the legacy checks in `CHECKS.md`, then verify
Classic/Elegant layout, popups, rows, and virtual grids on the affected TV generation.

## WA-008: Split native and HLS.js startup evidence

**Status:** Active for supported webOS media runtimes.

**Constraint:** Native webOS playback may not emit `canplay` until `video.play()` is
requested, while HLS.js must exclusively own its attached MediaSource and can buffer
while playback remains paused. Calling native `video.load()` after HLS.js attachment can
detach or reset that MediaSource. Cold Jellyfin subtitle burn-in can also take longer
than the normal post-`play()` progress deadline before producing its first segment.

**Implementation:**

- `src/views/player-panel/hooks/usePlayerSourcePipeline.js` assigns native sources and
  calls `video.load()` once. It resets native media before HLS.js attachment, does not
  call native lifecycle methods while HLS.js owns the attached MediaSource, and destroys
  HLS.js before resetting media during teardown.
- Native playback becomes engine-ready immediately and requests playback without waiting
  for `canplay`.
- HLS.js becomes engine-ready only after the first current-generation `FRAG_BUFFERED`
  event and uses a separate 30-second bootstrap deadline.
- `src/views/player-panel/hooks/usePlayerStartupCoordinator.js` starts the 12-second
  no-progress deadline only after `video.play()` is requested; its 15-second client
  subtitle deadline remains independent and is not restarted by readiness rerenders.
- Startup evidence is ignored until the current engine is ready and its `play()` request
  has been issued. Media events created before the active source attachment are rejected,
  and HLS.js media errors stay on its generation-bound callback path.

**Removal condition:** Revisit only when all supported webOS generations provide a
consistent pre-play native readiness signal and the selected HLS.js integration can
prove that native media lifecycle calls after attachment no longer reset its
MediaSource. Keep separate engine and playback deadlines unless both adapters expose an
equivalent readiness contract.

**Validation:** Run the source-pipeline/startup tests, then test cold and warm server ASS
burn-in in the Simulator and native DirectPlay/DirectStream/native-HLS on TV. Confirm
HLS.js waits for one buffered fragment, native playback does not wait for `canplay`, and
Back/replacement cannot leave stale HLS callbacks or background audio active.
