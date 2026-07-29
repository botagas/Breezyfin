# Changelog

All notable changes to Breezyfin are documented in this file.

## Unreleased

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
