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

After updating dependencies, repeat `npm ci` before the production security audit.
Confirm `audit:runtime-deps` rejects unclassified extraneous Enact CLI entries.
Those entries must be pruned by lockfile regeneration or remain development-only;
do not exclude an application dependency to suppress a security finding.

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

- Start DirectPlay with an explicit non-default audio track that the runtime does
  not expose. Confirm the delayed fallback uses the current media source and position.
  Replace playback before discovery times out and confirm the old source cannot restart.

- Start lightweight styled subtitles and let a subtitle gap pass. Verify the first
  dialogue cue after each gap remains fitted inside its stage. Repeat with whole-layer
  offsets enabled. Verify authored clipped signs and drawings retain their geometry.

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

- Set subtitle X/Y offsets, then toggle `Apply Offsets to Entire Styled Layer`. Compare
  lightweight ASS, an external ASS renderer, and PGS. Verify authored signs and dialogue
  move together only when enabled. Verify clips remain aligned and offsets are not doubled.
  Ordinary top and middle captions must retain their positions. Repeat with Player
  controls shown and hidden in Classic and Elegant themes on supported webOS versions.
- Fail an audio replacement, then press Back while restoration is pending. Verify the
  cancelled restoration does not publish a fatal playback error.
- Supersede an audio replacement with playback recovery. Verify the stale replacement
  does not restore an older source or stop the active recovery session.

### Navigation/focus validation

- Launch a Home card with the client closed, browsing and already playing. Confirm a matching
  item is not restarted. Confirm Player Back returns to Details, then Breezyfin Home.
- Compare Home and in-app playback for resume, multiple audio languages, subtitles Off,
  forced/preferred subtitles, source versions and HDR/DV or subtitle consent.
- Use mismatched server/user sessions and expired credentials. Confirm Choose account closes
  the popup before sign-in; matching sign-in continues playback. Cancel and Back must abandon it.
- Delay server/item requests, then cancel, hide the app, change account or launch a newer card.
  Confirm stale results cannot open Player. Repeat with an existing SyncPlay group and preserve
  its normal queue-replacement decision.
- Verify launch requests contain no credentials or media URLs. Test malformed parameters,
  duplicate request IDs, unavailable items and ordinary app-icon launches.
- Receive a Home relaunch while Breezyfin is already hidden. Confirm preparation waits for
  foreground. Hide during server/item lookup and return; no loading notice may remain stuck.
- Open a Home item, then use Settings cache wipe with and without keeping login. Confirm the
  reload cannot replay the old Home request or reopen its account notice. A new Home card
  activation must still work.
- Recover from a crash with missing or expired saved credentials. Complete manual sign-in,
  then activate a fresh Home card. The old crash action must not block playback or restore
  another account's navigation. Repeat with an unavailable user lookup and Return Home recovery.

### Login flow validation

- Resume an expired saved account, then return from credentials with Back. Verify the
  saved account no longer shows `Opening...`.

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

- Change Favorite, Watched, and Watchlist state outside the current card, then open
  that card. Verify fresh details update all three buttons and the next action uses
  the refreshed state. Repeat with a movie, episode, and series.
- Delay details loading and complete a local item action. Verify the late details
  response cannot revert that action and can still refresh the other flags.

- Delay a season request and select an old episode with pointer and 5-way input.
  Verify the new season owns the selected episode and audio/subtitle track metadata.
- Switch seasons twice and let the earlier request finish last. Verify the latest
  season remains selected.
- Toggle watched or favorite state twice while episode or season lists load. Verify
  the lists remain populated and the next visit retrieves current user data.

- On a standalone episode page, change watched and favorite status, then open the
  parent series immediately. Verify badges, season state, and resume selection refresh
  without waiting for the cache TTL. Repeat when navigating away before the save ends.
- In the sideways episode layout, hover a clipped card at each row edge. Verify the row
  reveals the card without selecting an episode or changing vertical scroll. Keep the
  pointer stationary during the animation and verify scrolling stops. Move between card
  actions and verify the row does not repeatedly scroll. Repeat with pointer and 5-way
  input in both themes and all performance modes.
- Switch between saved users while opening the same series. Verify watched badges and
  resume selection belong to the current user. After playback, reopen the series and
  verify updated progress without waiting for the request-cache TTL.
- Open Media Details with 5-way input and return from a picker. Verify initial and forced
  focus uses `Audio -> Subtitle -> Play` and never selects Favorite or Watched as fallback.
- Use a file whose default subtitle language differs from the preferred language. Verify
  the file default is selected when no saved or preferred-language choice matches. Verify
  saved and global `None` still turn subtitles off.

### TV performance validation

- None.

### Loading and screensaver validation

- None.
