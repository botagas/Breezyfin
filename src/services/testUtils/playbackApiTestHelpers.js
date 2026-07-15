export const createPlaybackApiTestService = ({
	handleAuthFailureStatus = () => undefined
} = {}) => ({
	serverUrl: 'http://media.local',
	accessToken: 'token-1',
	userId: 'user-1',
	getDeviceId: () => 'device-1',
	_handleAuthFailureStatus: handleAuthFailureStatus,
	api: {id: 'api'}
});

export const withSubtitleStream = (source, subtitle = {Codec: 'srt', Index: 2}) => ({
	...source,
	MediaStreams: [
		...(source.MediaStreams || []),
		{
			Type: 'Subtitle',
			...subtitle
		}
	]
});

export const resetPlaybackApiTestRuntime = ({
	clearMocks = null,
	createFetchMock = null,
	getRuntimePlatformCapabilities
} = {}) => {
	clearMocks?.();
	global.fetch = typeof createFetchMock === 'function'
		? createFetchMock()
		: () => Promise.reject(new Error('fetch mock not configured'));
	getRuntimePlatformCapabilities.mockReturnValue({
		playback: {
			supportsDolbyVision: true,
			supportsDolbyVisionInMkv: true
		}
	});
};
