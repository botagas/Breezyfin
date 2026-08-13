# Changelog

All notable changes to Breezyfin are documented in this file.

## Unreleased

## 0.2.1

### Changed

- Replaced legacy Jellyfin authentication headers and lowercase API-key query parameters
  with the standard forms required by Jellyfin 12 while retaining Jellyfin 10 compatibility.
- Migrated successful authentication and session restoration to the managed multi-server
  store while retaining the bounded legacy-session migration path for older installs.
- Hardened generated managed-server identifiers with Web Crypto when available and a
  uniqueness-only fallback for legacy webOS runtimes.
- Made selected audio, subtitle, and filter options use one persistent Selected marker
  and consistent active styling.
- Kept explicit in-player audio and subtitle choices authoritative over cross-episode
  track intent. HLS.js commits changes only after its switch event; native runtime audio
  changes prepare and swap a server-selected source instead of guessing decoder readiness.
- Rewrote repository documentation in controlled technical English and verified the
  documented architecture, commands, checks, and plugin terminology against current
  behavior.

### Fixed

- Added status-aware login failures for non-JSON Jellyfin responses so reverse proxies and
  incompatible servers do not surface an unrelated JSON parser error.
- Stopped native webOS Direct Play startup from waiting for `canplay` before requesting
  playback. When startup makes no progress, Breezyfin communicates one Direct Play to
  Transcode recovery attempt.
- Separated native and HLS.js source ownership. HLS.js is no longer reset after
  attachment, waits for a current buffered fragment, and gives cold server subtitle
  transcodes an independent bootstrap deadline.
- Isolated native media events, HLS.js events, timers, and recovery callbacks by playback
  source generation.
- Serialized Jellyfin playback start, progress, pause, seek, and stop reporting.
- Kept PlaybackInfo-selected audio and subtitle tracks authoritative through Player startup.
- Fixed same-item audio reloads being remapped back to a previous episode's semantic
  language intent, and restored the complete selected surface in track pickers.
- Prevented Media Details from displaying an explicit audio choice before native webOS
  selected the requested track. Initial Direct Play now discovers the native
  track before startup or falls back to a communicated server remux/transcode.
- Added generation-bound native audio replacement with position restoration, rollback to
  a paused state, persistent switching feedback, control locking, and SyncPlay clock
  authority.
- Hardened audio replacement handoff so paused progress is a real reporting barrier,
  prepared mount waits are cancellable, superseded/failed Jellyfin sessions close once,
  and transient toasts cannot evict the persistent switching status.
- Bound transcode and subtitle recovery restarts to their originating item, playback
  generation, and load request so stale teardown continuations cannot restart newer media.
- Allowed SyncPlay readiness after source preparation without waiting for native media
  readiness events that may require authoritative group playback to begin first.
- Replaced ambiguous startup format errors on confirmed transcodes with bounded
  server-transcoding guidance and optional systemd/FFmpeg diagnostics.
- Aligned Watchlist loading and empty states across native and plugin-backed tabs.

## 0.2.0

### Added

- Added Breezyfin plugin capability discovery with per-session invalidation.
- Added optional server-defined Home rows and a native Jellyfin Likes Watchlist.
- Added Discovery and Calendar panels backed by authenticated plugin contracts.
- Added a shared Jellyfin WebSocket lifecycle with user-data cache invalidation.
- Added native Jellyfin SyncPlay group browsing, playback synchronization, participant
  state, and queue controls.
- Added authenticated JellyWatchParty room browsing, host-controlled playback
  synchronization, participant state, and bounded chat.

### Changed

- Prepared client metadata for the coordinated `0.2.0` release candidate.
- Kept provider communication on the server. The TV client uses only Jellyfin URLs and
  authenticated plugin URLs.
