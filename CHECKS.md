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

- With Diagnostics disabled, start HLS.js playback. Verify Breezyfin creates no HLS
  startup measurement trail or timer.
- With Diagnostics enabled, start HLS.js playback. Verify one bounded current-source trail
  records the first fragment type, buffered seconds, engine-ready-to-`playing` latency,
  engine-ready-to-first-timeline-progress latency, and early recovery.
- Replace the source. Verify the previous HLS measurement trail does not remain active.
- Open each required subtitle, audio, and dynamic-range decision. Verify a prepared plan
  attaches no source before consent.
- Exercise Retry, next episode, Back, and native audio replacement. Verify each committed
  plan attaches exactly one source.
- Verify stale plans cannot commit and old source events cannot update current playback.
- Verify playback generations advance only through the allocator's invalidate and allocate
  operations.
- Force repeated HLS network and media errors, session rebuild, Direct Play Transcode
  fallback, subtitle fallback, and dynamic-range fallback.
- Verify generation-scoped attempts reset when the source is replaced.
- Verify item-scoped attempts remain for replacement generations of the same item.
- Select Retry. Verify Retry resets the ledger.
- After initial native-audio fallback has been used, select Retry for the same item. Verify
  the fallback is available once again and remains limited across automatic replacement
  generations.
- Verify no recovery exceeds its configured budget.
- Delay recovery teardown. During the delay, separately trigger Back, item replacement,
  episode replacement, a newer load, and a newer recovery.
- Verify each stale Transcode, safe-burn-in, or no-subtitle continuation publishes no
  override, loading state, terminal error, or delayed attachment.
- Verify the current recovery remains valid after its intentional source-token
  invalidation and loads exactly once.
- Delay session-rebuild admission, then trigger Back, Retry, item replacement, or a newer
  recovery. Verify the obsolete rebuild cannot attach a source or show a terminal error.

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
- Start native playback from Media Details with an explicit non-default audio track.
  Verify the requested language is audible before playback starts; if webOS does not
  expose it, verify Breezyfin communicates the server remux/transcode replacement.
- During native DirectPlay, DirectStream, and native HLS, change audio while playing and
  paused. Verify `Switching audio...` remains visible, only Back is actionable, the old
  frame remains during preparation, position and prior play state are restored, and a
  failed replacement restores the previous track paused without background audio.
- Delay the Player video surface during an audio replacement. Verify the original
  transition waits, retains its prepared plan/options, commits once after mount, and Back
  or unmount settles the wait without a delayed attachment or generation allocation.
- While an audio replacement is preparing, emit compatibility and recovery toasts. Verify
  the persistent `Switching audio...` status remains visible and independently dismisses
  only after success, rollback, or cancellation.
- Inspect Jellyfin sessions during successful replacement, rollback, and Back after swap.
  Verify the paused progress barrier is attempted before negotiation, the superseded or
  failed session is stopped exactly once, and the active replacement remains reportable.
- Delay the paused progress report for more than five seconds. Verify the persistent
  switching status appears immediately, negotiation continues after the deadline, and Back
  cancels the wait without a later transition.
- Trigger initial native-audio fallback, then use Back, replace the item, or begin another
  recovery while teardown is pending. Verify no stale override, source, or compatibility
  toast reaches the replacement playback.
- In HLS.js, verify audio selection commits only after `AUDIO_TRACK_SWITCHED`, stale
  events cannot update the UI, and timeout falls back to controlled source replacement.
  Repeat during SyncPlay and confirm the server-clock position and authoritative Unpause
  remain in control.
- Open Filter, Media Details track, and Player track popups. Verify each active option
  has the same complete rounded selected surface, Sandstone selected state, Selected
  marker, and correct `aria-pressed`/`aria-current` semantics in pointer and 5-way modes.

### Navigation/focus validation

- None.

### Login flow validation

- Sign in to Jellyfin 10 with legacy authorization disabled. Verify login, image loading,
  WebSocket updates, subtitles, and playback use the standard authorization forms.
- Sign in to Jellyfin 12. Verify login, image loading, WebSocket updates, subtitles, and
  playback succeed without legacy `X-Emby-*` headers or lowercase `api_key` parameters.
- Return a non-JSON `400` or `401` response from the authentication endpoint. Verify the
  Login panel reports the HTTP failure instead of a JSON parser error.
- Expire one saved account. Verify that account displays `Sign in again`, opens with its
  username filled in, clears the password, and focuses the password field. Verify other
  saved accounts still resume with their tokens.
- Start Add User or expired-account recovery after an expiration. Verify the old session
  notice clears and does not reappear after authentication starts.
- Start a request with an old token, authenticate another account, then complete the old
  request with `401` or `403`. Verify the new session remains active.
- Start a request from an expired runtime, reauthenticate through Quick Connect with the
  same returned device token, then complete the old request with `401` or `403`. Verify
  Breezyfin keeps the new session active.
- On Jellyfin 10.11 and 12, verify `Use Quick Connect` appears only when enabled. Approve
  a code from another signed-in client and verify Breezyfin saves and activates the
  approved user.
- While Quick Connect waits, verify requests do not overlap and Back returns to credentials.
  Verify Retry creates a new code after failure or five-minute expiry. Verify Back,
  server change, panel deactivation, and app exit cannot complete an old sign-in.
- Verify the Quick Connect Back and Retry actions receive initial 5-way focus and remain
  usable with pointer input.

### Browse and Home regression validation

- None.

### Media Details validation

- None.

### TV performance validation

- None.

### Loading and screensaver validation

- None.
