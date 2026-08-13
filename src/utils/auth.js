const CLIENT_NAME = 'Breezyfin';
const DEVICE_NAME = 'webOS';

// Jellyfin reads the standard Authorization header on every supported release: 10.x
// falls back to it when X-Emby-Authorization is absent, and 12 accepts nothing else.
export const buildClientAuthHeaders = (deviceId, appVersion) => ({
	Authorization: `MediaBrowser Client="${CLIENT_NAME}", Device="${DEVICE_NAME}", DeviceId="${deviceId}", Version="${appVersion}"`
});

export const buildTokenAuthHeaders = (accessToken) => ({
	Authorization: `MediaBrowser Token="${accessToken}"`
});

// WebSockets and media URLs cannot carry headers, so the token travels as a query
// parameter there. Only this spelling is read unconditionally; the lowercase
// `api_key` sits behind the same legacy flag as the X-Emby-* headers.
export const AUTH_QUERY_PARAM = 'ApiKey';
