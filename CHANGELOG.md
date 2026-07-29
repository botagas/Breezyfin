# Changelog

All notable changes to Breezyfin are documented in this file.

## Unreleased

## 0.2.1

### Fixed

- Fixed native webOS DirectPlay startup waiting for `canplay` before requesting playback.
- Unified Player startup timeouts and bounded automatic DirectPlay-to-transcode recovery.
- Isolated native media events and recovery callbacks by playback source generation.
- Serialized Jellyfin playback start, progress, pause, seek, and stop reporting.
- Kept PlaybackInfo-selected audio and subtitle tracks authoritative through Player startup.

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
