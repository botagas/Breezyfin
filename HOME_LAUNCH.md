# Home playback launch contract

Breezyfin Home can launch `com.breezyfin.app` through Application Manager.
Breezyfin advertises `breezyfinLaunchVersion: 1` in its application manifest.
The launcher must check this marker before sending a playback request.

The launch parameters contain a `breezyfinHome` object:

| Field | Required value |
| --- | --- |
| `version` | `1` |
| `action` | `play` |
| `requestId` | Unique activation identifier; 1–100 letters, digits, underscores or hyphens |
| `itemId` | Jellyfin Movie or Episode GUID |
| `serverId` | Jellyfin server GUID from `/System/Info/Public`; not a local saved-server key |
| `serverUrl` | HTTP(S) server base URL without credentials, query or fragment |
| `userId` | Jellyfin user GUID for the displayed Home card |

The launcher must not send access tokens, playback URLs, track selections or cached positions.
Breezyfin uses its own authenticated session. It verifies the server ID through that session's
server endpoint and verifies the active user ID before fetching the item.
The address in the request is an account-selection hint; the request does not authorize an
automatic connection, account switch or credential transfer.

The early inbox captures initial platform parameters before React mounts and accepts
`webOSLaunch` and `webOSRelaunch` events. It keeps only the latest request and remembers
the most recent 128 request IDs in memory and session storage. Only opaque request IDs
are stored; request bodies, account IDs and credentials are not stored in the receipt ledger.
The listener writes the receipts again before page unload because Settings clears session
storage before reloading. Retained platform parameters cannot replay an accepted request
after an ordinary reload or a Settings cache wipe. Storage failures retain in-memory
deduplication without preventing new launches. Ordinary launches do not start playback.
Pending requests do not survive a page reload, application restart or crash recovery.

Missing or mismatched authentication opens an account notice. Choose account closes the
notice before opening the existing account-selection flow. Cancel or Back abandons the
request. Completing sign-in to the matching account continues the request.

Breezyfin fetches fresh item metadata and progress. It stages the item's Details view and
then calls the existing playback entry point without explicit track overrides.
Player owns audio/subtitle preferences, source negotiation, resume, quality and required
consent. SyncPlay retains its existing queue and participation decisions.
An already-playing matching item only reveals the player controls.

Cancellation, a newer request, session replacement, hiding during preparation and unmount
invalidate asynchronous preparation. After the existing playback coordinator accepts the
request, normal Player and SyncPlay lifecycle behavior owns playback.
An initial request received while already hidden waits for foreground before preparation.
A completion that observes hidden state cancels only its own pending request and loading
notice, even if the visibility event has not arrived. It cannot clear a newer request.
Leaving Player retains layered Back handling and returns to the item Details page, then
Breezyfin Home. The TV Home button remains a platform action.

Errors do not launch another client or account. The Home launcher owns its separate
Jellyfin Native option and must preserve that client's existing launch behavior.
