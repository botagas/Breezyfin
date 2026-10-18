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
4. `npm audit --omit=dev --audit-level=high`

The repository audit and npm security audit are separate checks. Contributors must run both.

## Release-oriented checks

Run these before packaging a release candidate:

1. `npm run lint`
2. `npm run test -- --watch=false --runInBand`
3. `npm run audit`
4. Require `npm audit --omit=dev --audit-level=high` to pass; review the separate unscoped audit's CLI-only findings using `QUALITY.md` rather than applying broad automatic fixes.
5. Verify `npm run audit:runtime-deps`, `npm run audit:licenses`, and `npm run audit:repository-hygiene` pass as part of the aggregate audit.
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

- Return a `404`, malformed, disabled, or `auth_enabled=false` token response. Verify
  JellyWatchParty remains hidden.
- Test room creation, password-protected join, leave, reconnect, and host transfer.
- Test ready, buffering, Play, Pause, and Seek synchronization.
- Verify the room accepts 500-character input and retains at most 50 messages.
- Enable `hide_native_sync_button`. Verify Breezyfin hides the native SyncPlay action.
- Verify Breezyfin does not persist JWTs, passwords, or chat messages.
- Cause token refresh to fail. Verify the panel shows an unavailable state with Retry.
- Press Back during a pending room-item lookup. Verify the completed lookup cannot open
  Player.
- Open the SyncPlay queue-replacement decision and WatchParty popup with 5-way input.
    Verify the decision and WatchParty surfaces focus their first actions, pending actions
    cannot be submitted twice, failures remain visible, and the suspended-playback
    notification never steals focus.
- Reconnect SyncPlay while a newer `PlayQueue` update is arriving. Verify the delayed
  group lookup cannot restore an older item, queue revision, or participant session.
- Fail same-item SyncPlay resume after selecting explicit tracks. Verify a later resume does
  not reuse those failed local track options.
- Delay a SyncPlay resume request, then leave the group, switch users, replace the server
  session, or receive a newer reconnect. Verify the stale completion does not enter follow
  mode or clear newer notices and playback options.

### Diagnostics/logging validation

- None.

### Playback/path validation

- After initial native-audio fallback has been used, select Retry for the same item. Verify
  the fallback is available once again and remains limited across automatic replacement
  generations.
- Force a server-side transcode startup failure and verify the Player reports
  `Server transcoding failed` rather than generic format support. With Diagnostics
  enabled, verify the runtime trail includes the exit-code 159/systemd syscall-policy
  guidance; DirectPlay failures and failures after playback starts must retain their
  existing classifications.
- Force a genuine native DirectPlay startup failure. Verify Breezyfin shows
  `Direct playback did not start. Retrying with server transcoding.`, retries once, and
  preserves the existing HDR/DV and subtitle consent prompts where applicable.
- Delay the paused progress report for more than five seconds. Verify the persistent
  switching status appears immediately, negotiation continues after the deadline, and Back
  cancels the wait without a later transition.

### Navigation/focus validation

- None.

### Login flow validation

- Return a non-JSON `400` or `401` response from the authentication endpoint. Verify the
  Login panel reports the HTTP failure instead of a JSON parser error.

### Browse and Home regression validation

- Configure more than eight server Home rows. Scroll with the pointer or wheel while
  the cursor stays between cards. Verify pending rows load and later rows appear.
  Repeat with 5-way input. Verify rows do not reload repeatedly after entering the
  viewport and native lazy artwork loading remains active.

- Log out and sign in with the same account. Verify Home reloads the current rows.
- Fail a built-in Home row request, then restore the connection and return to Home.
  Verify Home retries the request and retains prior successful content during the failure.
- Return with Back after the two-minute freshness period. Verify Home refreshes the rows.
  Verify a successful empty response does not trigger repeated reloads.

- With plugin My Requests unavailable, fail the tag-filtered Items request while the
  unfiltered request succeeds. Verify My Requests uses the bounded fallback scan.
  Return a valid empty filtered response and verify no fallback scan starts.

### Media Details validation

- None.

### TV performance validation

- None.

### Loading and screensaver validation

- None.
