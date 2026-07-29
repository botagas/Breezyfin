export const MAX_HLS_NETWORK_RECOVERY_ATTEMPTS = 1;
export const MAX_HLS_MEDIA_RECOVERY_ATTEMPTS = 1;
export const MAX_PLAY_SESSION_REBUILD_ATTEMPTS = 1;

export const HLS_PLAYER_CONFIG = Object.freeze({
	enableWorker: true,
	lowLatencyMode: false,
	backBufferLength: 30,
	maxBufferLength: 20,
	maxMaxBufferLength: 90,
	fragLoadingTimeOut: 20000,
	levelLoadingTimeOut: 20000,
	fragLoadingMaxRetry: 4,
	levelLoadingMaxRetry: 4,
	startLevel: -1
});

// HLS.js normalizes and extends the constructor config in place.
export const createHlsPlayerConfig = (baseConfig = HLS_PLAYER_CONFIG) => ({...baseConfig});
