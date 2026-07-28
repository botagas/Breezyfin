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

- For a bitrate-limited Dolby Vision source, confirm `Try original quality` uses the
  runtime capability's maximum streaming bitrate as a one-shot override without changing
  the saved quality setting.

### Navigation/focus validation

- None.

### Login flow validation

- None.

### Browse and Home regression validation

- Open My Requests View More and verify `All`, `Unplayed`, `Played`, and combined
  Favorites filters retain plugin-provided items and continue loading across multiple
  server pages without duplicates or a premature empty state.
- With server-provided HSS Home enabled, verify the My Requests row remains ordered and
  previewed by HSS while View More can paginate beyond the HSS row's item count.

### Media Details validation

- None.

### TV performance validation

- None.

### Loading and screensaver validation

- None.
