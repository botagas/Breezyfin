# Breezyfin Checks

This file is the single place for recurring validation commands and test runbooks.

Use this instead of `TODOS.md` for test/check execution tracking.

Rule:
- Do not duplicate active `TODOS.md` entries here.
- Add/update checks in this file only after the related TODO entry is complete.

## Core recurring checks

Run these before merging or publishing:

1. `npm run lint`
2. `npm run test -- --watch=false --runInBand`
3. `npm run audit`

## Release-oriented checks

Run these before packaging a release candidate:

1. `npm run lint`
2. `npm run test -- --watch=false --runInBand`
3. `npm run audit`
4. Require `npm audit --omit=dev --audit-level=high` to pass; review the separate unscoped audit's CLI-only findings using `QUALITY.md` rather than applying broad automatic fixes.
5. Verify `npm run audit:runtime-deps`, `npm run audit:licenses`, and `npm run audit:private-refs` pass as part of the aggregate audit.
6. Production build: `CI=true npm run pack-p`
7. Run `npm run report:package-size` and confirm the package contains `LICENSE` and `THIRD_PARTY_NOTICES.txt` but no production subtitle declarations or unnecessary source maps.
8. Inspect `dist/index.html` and confirm JavaScript/CSS entry assets are relative (`./...`), never `/...` or an HTTP repository path; postpack enforces this for `file://` webOS startup.
9. Stable webOS packaging smoke check when the webOS CLI is available: `ares-package dist`
10. For develop/non-stable release candidates, rebuild production assets with develop flags: `REACT_APP_ENABLE_PERSISTENT_LOGS=1 REACT_APP_RELEASE_CHANNEL=develop CI=true npm run pack-p`
11. For develop/non-stable release candidates, package that flagged `dist/` immediately after step 10: `ares-package dist`

## Focused regression checks

### Shared media presentation

- None.

### Plugin and realtime integration validation

- Verify JellyWatchParty is hidden for `404`, malformed, disabled, or
   `auth_enabled=false` token responses. Test room create/password join/leave,
   reconnect, host transfer, ready/buffering, play/pause/seek, 500-character input,
   50-message history, and `hide_native_sync_button` without persisting JWTs,
   passwords, or chat. Verify token-refresh failure returns to an unavailable Retry state,
   and Back during a pending room-item lookup cannot navigate into Player afterward.
- Open the SyncPlay queue-replacement decision and WatchParty popup with 5-way input.
    Verify the decision and WatchParty surfaces focus their first actions, pending actions
    cannot be submitted twice, failures remain visible, and the suspended-playback
    notification never steals focus.
- Reconnect SyncPlay while a newer `PlayQueue` update is arriving. Verify the delayed
  group lookup cannot restore an older item, queue revision, or participant session.
- Test authenticated plugin artwork on both root-hosted and reverse-proxy-subpath
  Jellyfin servers; image URLs must preserve the server base path and auth parameters.

### Diagnostics/logging validation

- None.

### Playback/path validation

- Force a server-side transcode startup failure and verify the Player reports
  `Server transcoding failed` rather than generic format support. With Diagnostics
  enabled, verify the runtime trail includes the exit-code 159/systemd syscall-policy
  guidance; DirectPlay failures and failures after playback starts must retain their
  existing classifications.
- Start an SDR H.264/AAC item through native playback on TV and verify DirectPlay requests
  playback without waiting for `canplay`. Confirm loading and PlaybackStart commit once
  after `play()`, `playing`, or timeline progress.
- Force a genuine native DirectPlay startup failure. Verify Breezyfin shows
  `Direct playback did not start. Retrying with server transcoding.`, retries once, and
  preserves the existing HDR/DV and subtitle consent prompts where applicable.
- Verify exhausted startup recovery pauses and detaches media before showing one terminal
  error, so audio cannot continue behind the popup. Exercise Back and source replacement
  while startup is pending to confirm old native/HLS events cannot restart recovery.
- During pause, resume, seek, and regular progress ticks, confirm Jellyfin receives one
  serialized reporting request at a time and resume does not send another PlaybackStart.

### Navigation/focus validation

- None.

### Login flow validation

- None.

### Browse and Home regression validation

- None.

### Media Details validation

- None.

### TV performance validation

- None.

### Loading and screensaver validation

- None.
