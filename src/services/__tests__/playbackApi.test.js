jest.mock('@jellyfin/sdk/lib/utils/api/playstate-api', () => ({
	getPlaystateApi: jest.fn()
}));
jest.mock('../../utils/platformCapabilities', () => ({
	getRuntimePlatformCapabilities: jest.fn()
}));

import {getPlaystateApi} from '@jellyfin/sdk/lib/utils/api/playstate-api';
import {getRuntimePlatformCapabilities} from '../../utils/platformCapabilities';
import {createVideoAudioMediaSource} from '../testUtils/playbackFixtures';
import {
	getItemPlaybackInfo,
	getPlaybackStreamUrl,
	getTranscodePlaybackUrl,
	reportPlaybackProgressState,
	reportPlaybackStarted,
	reportPlaybackStoppedState
} from '../jellyfin/playbackApi';

describe('playbackApi', () => {
	const createService = () => ({
		serverUrl: 'http://media.local',
		accessToken: 'token-1',
		userId: 'user-1',
		getDeviceId: () => 'device-1',
		_handleAuthFailureStatus: jest.fn(),
		api: {id: 'api'}
	});
	const createMediaSource = (videoRangeType, overrides = {}) => createVideoAudioMediaSource({
		id: `source-${videoRangeType}`,
		videoRangeType,
		supportsTranscoding: false,
		...overrides
	});
	const createTranscodeOnlyDvSource = () => ({
		Id: 'source-dv-transcode',
		Container: 'mkv',
		SupportsDirectPlay: false,
		SupportsDirectStream: false,
		SupportsTranscoding: true,
		TranscodingUrl: '/Videos/item-1/master.m3u8',
		TranscodingContainer: 'ts',
		DefaultAudioStreamIndex: 0,
		MediaStreams: [
			{
				Type: 'Video',
				Codec: 'hevc',
				VideoRangeType: 'DOVIWithHDR10'
			},
			{
				Type: 'Audio',
				Codec: 'eac3',
				Index: 0,
				IsDefault: true
			}
			]
		});
	const createDvSourceWithAudioFallbackCandidate = ({
		supportsDirectPlay = false,
		supportsDirectStream = false,
		supportsTranscoding = true,
		transcodingUrl = '/Videos/item-1/master.m3u8',
		defaultAudioStreamIndex = 0
	} = {}) => ({
		Id: 'source-dv-audio-fallback',
		Container: 'mkv',
		SupportsDirectPlay: supportsDirectPlay,
		SupportsDirectStream: supportsDirectStream,
		SupportsTranscoding: supportsTranscoding,
		...(transcodingUrl ? {TranscodingUrl: transcodingUrl, TranscodingContainer: 'ts'} : {}),
		DefaultAudioStreamIndex: defaultAudioStreamIndex,
		MediaStreams: [
			{
				Type: 'Video',
				Codec: 'hevc',
				VideoRangeType: 'DOVIWithHDR10'
			},
			{
				Type: 'Audio',
				Codec: 'truehd',
				Index: 0,
				IsDefault: true
			},
			{
				Type: 'Audio',
				Codec: 'ac3',
				Index: 1,
				IsDefault: false
			}
		]
	});
	const createDvAudioOnlyTranscodeSource = () => ({
		Id: 'source-dv-audio-only-transcode',
		Container: 'mkv',
		SupportsDirectPlay: false,
		SupportsDirectStream: false,
		SupportsTranscoding: true,
		TranscodingUrl: '/Videos/item-1/master.m3u8?VideoCodec=copy&TranscodeReasons=AudioCodecNotSupported',
		TranscodingContainer: 'mp4',
		DefaultAudioStreamIndex: 0,
		MediaStreams: [
			{
				Type: 'Video',
				Codec: 'hevc',
				VideoRangeType: 'DOVIWithHDR10'
			},
			{
				Type: 'Audio',
				Codec: 'truehd',
				Index: 0,
				IsDefault: true
			}
		]
	});

	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
		getRuntimePlatformCapabilities.mockReturnValue({
			playback: {
				supportsDolbyVision: true,
				supportsDolbyVisionInMkv: true
			}
		});
	});

	it('builds playback stream url with optional query parameters', () => {
		const service = createService();

		const url = getPlaybackStreamUrl(
			service,
			'item-1',
			'source-1',
			'session-1',
			'tag-1',
			'mp4',
			'live-1'
		);

		const parsed = new URL(url);
		expect(parsed.origin).toBe('http://media.local');
		expect(parsed.pathname).toBe('/Videos/item-1/stream');
		expect(parsed.searchParams.get('api_key')).toBe('token-1');
		expect(parsed.searchParams.get('static')).toBe('true');
		expect(parsed.searchParams.get('container')).toBe('mp4');
		expect(parsed.searchParams.get('mediaSourceId')).toBe('source-1');
		expect(parsed.searchParams.get('playSessionId')).toBe('session-1');
		expect(parsed.searchParams.get('tag')).toBe('tag-1');
		expect(parsed.searchParams.get('liveStreamId')).toBe('live-1');
		expect(parsed.searchParams.get('deviceId')).toBe('device-1');
		expect(parsed.searchParams.get('Static')).toBe(null);
	});

	it('returns transcode url only when media source includes transcoding path', () => {
		const service = createService();

		expect(getTranscodePlaybackUrl(service, 'session-1', {TranscodingUrl: '/Videos/xyz/master.m3u8'}))
			.toBe('http://media.local/Videos/xyz/master.m3u8');
		expect(getTranscodePlaybackUrl(service, 'session-1', {})).toBe(null);
	});

	it('reports playback start/progress/stop with merged session metadata', async () => {
		const service = createService();
		const reportPlaybackStart = jest.fn().mockResolvedValue(undefined);
		const reportPlaybackProgress = jest.fn().mockResolvedValue(undefined);
		const reportPlaybackStopped = jest.fn().mockResolvedValue(undefined);
		getPlaystateApi.mockReturnValue({
			reportPlaybackStart,
			reportPlaybackProgress,
			reportPlaybackStopped
		});

		await reportPlaybackStarted(service, 'item-1', 100, {
			playMethod: 'Transcode',
			playSessionId: 'session-1',
			mediaSourceId: 'source-1',
			audioStreamIndex: 2,
			subtitleStreamIndex: -1
		});
		await reportPlaybackProgressState(service, 'item-1', 200, true, {
			playMethod: 'DirectPlay',
			playSessionId: 'session-1'
		});
		await reportPlaybackStoppedState(service, 'item-1', 300, {
			mediaSourceId: 'source-1'
		});

		expect(getPlaystateApi).toHaveBeenCalledWith(service.api);
		expect(reportPlaybackStart).toHaveBeenCalledWith({
			playbackStartInfo: expect.objectContaining({
				ItemId: 'item-1',
				PositionTicks: 100,
				PlayMethod: 'Transcode',
				PlaySessionId: 'session-1',
				MediaSourceId: 'source-1',
				AudioStreamIndex: 2,
				SubtitleStreamIndex: -1
			})
		});
		expect(reportPlaybackProgress).toHaveBeenCalledWith({
			playbackProgressInfo: expect.objectContaining({
				ItemId: 'item-1',
				PositionTicks: 200,
				IsPaused: true,
				PlayMethod: 'DirectPlay',
				PlaySessionId: 'session-1'
			})
		});
		expect(reportPlaybackStopped).toHaveBeenCalledWith({
			playbackStopInfo: expect.objectContaining({
				ItemId: 'item-1',
				PositionTicks: 300,
				PlayMethod: 'DirectStream',
				MediaSourceId: 'source-1'
			})
		});
	});

	it('rejects force DV mode when Jellyfin only returns HDR sources', async () => {
		const service = createService();
		const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-1',
					MediaSources: [createMediaSource('HDR10')]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-2',
					MediaSources: [createMediaSource('HDR10')]
				})
			});
		try {
			await expect(
				getItemPlaybackInfo(service, 'item-1', {forceDolbyVision: true})
			).rejects.toThrow('no Dolby Vision source');
		} finally {
			consoleErrorSpy.mockRestore();
		}
	});

	it('keeps playback info in force DV mode when a DV source is available', async () => {
		const service = createService();
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [createMediaSource('DOVIWithHDR10')]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {forceDolbyVision: true});
		expect(playbackInfo?.MediaSources?.[0]?.MediaStreams?.[0]?.VideoRangeType).toBe('DOVIWithHDR10');
		expect(playbackInfo?.__breezyfin?.dynamicRange?.id).toBe('DV');
	});

	it('keeps default DV source when Prefer fMP4-HLS container is enabled', async () => {
		const service = createService();
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [createMediaSource('DOVIWithHDR10')]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {preferDolbyVisionMp4: true});
		const firstRequestPayload = JSON.parse(global.fetch.mock.calls[0][1].body);
		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(playbackInfo?.__breezyfin?.dynamicRange?.id).toBe('DV');
		expect(
			(firstRequestPayload?.DeviceProfile?.DirectPlayProfiles || [])
				.filter((profile) => profile?.Type === 'Video')
				.some((profile) => String(profile?.Container || '').toLowerCase().includes('mkv'))
		).toBe(true);
	});

	it('probes non-MKV profiles when Enable fMP4-HLS container preference is on for SDR source', async () => {
		const service = createService();
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-1',
					MediaSources: [createMediaSource('SDR', {id: 'source-sdr', container: 'mkv'})]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-2',
					MediaSources: [createMediaSource('DOVIWithHDR10', {id: 'source-dv', container: 'mp4'})]
				})
			});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {preferDolbyVisionMp4: true});
		expect(global.fetch).toHaveBeenCalledTimes(2);
		const mp4ProbePayload = JSON.parse(global.fetch.mock.calls[1][1].body);
		expect(
			(mp4ProbePayload?.DeviceProfile?.DirectPlayProfiles || [])
				.filter((profile) => profile?.Type === 'Video')
				.some((profile) => String(profile?.Container || '').toLowerCase().includes('mkv'))
		).toBe(false);
		expect(playbackInfo?.__breezyfin?.dynamicRange?.id).toBe('DV');
	});

	it('probes non-MKV profiles for HDR source when Force fMP4-HLS container preference is enabled', async () => {
		const service = createService();
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-1',
					MediaSources: [createMediaSource('HDR10', {id: 'source-hdr', container: 'mkv'})]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-2',
					MediaSources: [createMediaSource('DOVIWithHDR10', {id: 'source-dv', container: 'mp4'})]
				})
			});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			enableFmp4HlsContainerPreference: true,
			forceFmp4HlsContainerPreference: true
		});
		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(playbackInfo?.__breezyfin?.dynamicRange?.id).toBe('DV');
	});

	it('rejects Force DV when Jellyfin only provides full transcoding output', async () => {
		const service = createService();
		const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [createTranscodeOnlyDvSource()]
			})
		});
		try {
			await expect(
				getItemPlaybackInfo(service, 'item-1', {
					forceDolbyVision: true,
					preferDolbyVisionMp4: true
				})
			).rejects.toThrow('Force DV requires direct playback or audio-only transcode');
		} finally {
			consoleErrorSpy.mockRestore();
		}
	});

	it('allows Force DV when Jellyfin reports audio-only transcoding with video copy', async () => {
		const service = createService();
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [createDvAudioOnlyTranscodeSource()]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			forceDolbyVision: true,
			preferDolbyVisionMp4: true
		});
		expect(playbackInfo?.__breezyfin?.playMethod).toBe('Transcode');
		expect(
			playbackInfo?.__breezyfin?.adjustments?.some((entry) => entry?.type === 'forceDolbyVisionAudioOnlyTranscode')
		).toBe(true);
	});

	it('probes compatible audio tracks to keep Force DV on a direct playback path', async () => {
		const service = createService();
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-1',
					MediaSources: [
						createDvSourceWithAudioFallbackCandidate({
							supportsDirectPlay: false,
							supportsDirectStream: false,
							supportsTranscoding: true,
							transcodingUrl: '/Videos/item-1/master.m3u8',
							defaultAudioStreamIndex: 0
						})
					]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-2',
					MediaSources: [
						createDvSourceWithAudioFallbackCandidate({
							supportsDirectPlay: true,
							supportsDirectStream: true,
							supportsTranscoding: false,
							transcodingUrl: null,
							defaultAudioStreamIndex: 1
						})
					]
				})
			});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			forceDolbyVision: true,
			preferDolbyVisionMp4: true
		});
		expect(playbackInfo?.__breezyfin?.playMethod).toBe('DirectPlay');
		expect(playbackInfo?.__breezyfin?.selectedAudioStreamIndex).toBe(1);
		expect(global.fetch).toHaveBeenCalledTimes(2);
		const audioProbePayload = JSON.parse(global.fetch.mock.calls[1][1].body);
		expect(audioProbePayload.AudioStreamIndex).toBe(1);
		expect(audioProbePayload.EnableTranscoding).toBe(false);
	});
});
