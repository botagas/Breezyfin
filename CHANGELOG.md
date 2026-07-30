# Changelog

All notable changes to Breezyfin are documented in this file.

## Unreleased

## 0.2.1

### Changed

- Migrated successful authentication and session restoration to the managed multi-server
  store while retaining the bounded legacy-session migration path for older installs.
- Hardened generated managed-server identifiers with Web Crypto when available and a
  uniqueness-only fallback for legacy webOS runtimes.
- Made selected audio, subtitle, and filter options use one persistent Selected marker
  and consistent active styling.
- Kept explicit in-player audio and subtitle choices authoritative over cross-episode
  track intent, with verified HLS.js switching and a bounded native audio settling pause.

### Fixed

- Fixed native webOS DirectPlay startup waiting for `canplay` before requesting playback,
  with one communicated DirectPlay-to-transcode recovery attempt when startup makes no
  progress.
- Separated native and HLS.js source ownership so HLS.js is not reset after attachment,
  waits for a current buffered fragment, and gives cold server subtitle transcodes an
  independent bootstrap deadline.
- Isolated native media events, HLS.js events, timers, and recovery callbacks by playback
  source generation.
- Serialized Jellyfin playback start, progress, pause, seek, and stop reporting.
- Kept PlaybackInfo-selected audio and subtitle tracks authoritative through Player startup.
- Fixed same-item audio reloads being remapped back to a previous episode's semantic
  language intent, and restored the complete selected surface in track pickers.
- Allowed SyncPlay readiness after source preparation without waiting for native media
  readiness events that may require authoritative group playback to begin first.
- Replaced ambiguous startup format errors on confirmed transcodes with bounded
  server-transcoding guidance and optional systemd/FFmpeg diagnostics.
- Aligned Watchlist loading and empty states across native and plugin-backed tabs.

## 0.2.0

### Added

- Breezyfin plugin capability discovery with per-session invalidation.
- Optional server-defined Home rows and a native Jellyfin Likes watchlist.
- Discovery and Calendar panels backed by authenticated plugin contracts.
- A shared Jellyfin WebSocket lifecycle with user-data cache invalidation.
- Native Jellyfin SyncPlay group browsing, playback synchronization, participant state, and queue controls.
- Authenticated JellyWatchParty room browsing, host-controlled playback synchronization, participants, and bounded chat.

### Changed

- Prepared client metadata for the coordinated `0.2.0` release candidate.
- Kept provider communication server-side so the TV client only uses Jellyfin and authenticated plugin URLs.
