jest.mock('@jellyfin/sdk/lib/utils/api/playstate-api', () => ({
	getPlaystateApi: jest.fn()
}));
jest.mock('../../utils/platformCapabilities', () => ({
	getRuntimePlatformCapabilities: jest.fn()
}));

import {getPlaystateApi} from '@jellyfin/sdk/lib/utils/api/playstate-api';
import {getRuntimePlatformCapabilities} from '../../utils/platformCapabilities';
import {
	createPlaybackApiTestService,
	resetPlaybackApiTestRuntime,
	withSubtitleStream
} from '../testUtils/playbackApiTestHelpers';
import {createVideoAudioMediaSource} from '../testUtils/playbackFixtures';
import {
	getItemPlaybackInfo,
	getPlaybackStreamUrl,
	getTranscodePlaybackUrl,
	preparePlaybackNegotiation,
	reportPlaybackProgressState,
	reportPlaybackStarted,
	reportPlaybackStoppedState
} from '../jellyfin/playbackApi';

describe('playbackApi', () => {
	const createService = createPlaybackApiTestService;
	const createMediaSource = (videoRangeType, overrides = {}) => createVideoAudioMediaSource({
		id: `source-${videoRangeType}`,
		videoRangeType,
		supportsTranscoding: false,
		...overrides
	});
	const expectClientRenderedSubtitlePlayback = async ({
		videoRangeType,
		sourceId,
		subtitleCodec,
		expectedReason,
		expectedRenderer
	}) => {
		const service = createService();
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [
					withSubtitleStream(createMediaSource(videoRangeType, {
						id: sourceId,
						supportsTranscoding: true
					}), {Codec: subtitleCodec, Index: 2})
				]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			subtitleStreamIndex: 2,
			enableDiagnostics: true
		});
		const initialPayload = JSON.parse(global.fetch.mock.calls[0][1].body);
		const detachedPayload = JSON.parse(global.fetch.mock.calls[1][1].body);

		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(initialPayload.SubtitleStreamIndex).toBe(2);
		expect(initialPayload.SubtitleMethod).toBeUndefined();
		expect(detachedPayload.SubtitleStreamIndex).toBe(-1);
		expect(detachedPayload.SubtitleMethod).toBeUndefined();
		expect(playbackInfo?.__breezyfin?.subtitlePolicy).toEqual(expect.objectContaining({
			mode: 'smart',
			reason: expectedReason,
			renderer: expectedRenderer,
			clientRender: true,
			requiresBurnIn: false,
			forceBurnIn: false
		}));
		expect(playbackInfo?.__breezyfin?.diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({
				scope: 'subtitle-policy',
				stage: 'burn-in-decision',
				status: 'skipped',
				reason: expectedReason
			}),
			expect.objectContaining({
				scope: 'subtitle-policy',
				stage: 'client-render-detach',
				status: 'applied',
				reason: expectedReason
			})
		]));
		expect(playbackInfo?.__breezyfin?.decision).toEqual(expect.objectContaining({
			selectedSubtitleStreamIndex: 2,
			payload: expect.objectContaining({
				subtitleStreamIndex: -1
			})
		}));
	};
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
	const arrangeExplicitDtsAudioFallback = () => {
		const source = createDvSourceWithAudioFallbackCandidate({
			supportsDirectPlay: true,
			supportsDirectStream: true,
			transcodingUrl: '/Videos/item-1/master.m3u8?VideoCodec=copy&TranscodeReasons=AudioCodecNotSupported',
			defaultAudioStreamIndex: 0
		});
		source.MediaStreams[1] = {
			...source.MediaStreams[1],
			Codec: 'dts-hd',
			Language: 'eng',
			Title: 'DTS-HD MA'
		};
		source.MediaStreams[2] = {
			...source.MediaStreams[2],
			Language: 'eng',
			Title: 'Dolby Digital'
		};
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [source]
			})
		});
	};

	beforeEach(() => {
		resetPlaybackApiTestRuntime({
			clearMocks: jest.clearAllMocks,
			createFetchMock: jest.fn,
			getRuntimePlatformCapabilities
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
		expect(parsed.searchParams.get('ApiKey')).toBe('token-1');
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

	it('keeps optional playback diagnostic snapshots dormant by default', async () => {
		const service = createService();
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [createMediaSource('SDR')]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1');

		expect(playbackInfo?.__breezyfin?.diagnostics).toEqual([]);
		expect(playbackInfo?.__breezyfin?.decision).toBeNull();
		expect(playbackInfo?.__breezyfin?.requestDebug).toBeNull();
	});

	it('keeps getItemPlaybackInfo compatible with the prepared negotiation response', async () => {
		const service = createService();
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [createMediaSource('SDR')]
			})
		});

		const negotiation = await preparePlaybackNegotiation(service, 'item-1');
		const playbackInfo = await getItemPlaybackInfo(service, 'item-1');

		expect(negotiation).toEqual(expect.objectContaining({
			playbackInfo: negotiation.playbackInfo,
			selectedSource: negotiation.playbackInfo.MediaSources[0],
			playbackMetadata: negotiation.playbackInfo.__breezyfin
		}));
		expect(playbackInfo).toEqual(negotiation.playbackInfo);
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
			playlistItemId: 'playlist-item-1',
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
				PlaylistItemId: 'playlist-item-1',
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

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			forceDolbyVision: true,
			enableDiagnostics: true
		});
		expect(playbackInfo?.MediaSources?.[0]?.MediaStreams?.[0]?.VideoRangeType).toBe('DOVIWithHDR10');
		expect(playbackInfo?.__breezyfin?.dynamicRange?.id).toBe('DV');
		expect(playbackInfo?.__breezyfin?.decision).toEqual(expect.objectContaining({
			playMethod: 'DirectPlay',
			forceDolbyVision: true,
			dynamicRangeId: 'DV'
		}));
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

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			preferDolbyVisionMp4: true,
			enableDiagnostics: true
		});
		const firstRequestPayload = JSON.parse(global.fetch.mock.calls[0][1].body);
		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(playbackInfo?.__breezyfin?.dynamicRange?.id).toBe('DV');
		expect(playbackInfo?.__breezyfin?.diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({
				scope: 'playback-probe',
				stage: 'fmp4-hls-preference',
				status: 'skipped',
				reason: 'hdr-dv-preserve-range'
			})
		]));
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

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			preferDolbyVisionMp4: true,
			enableDiagnostics: true
		});
		expect(global.fetch).toHaveBeenCalledTimes(2);
		const mp4ProbePayload = JSON.parse(global.fetch.mock.calls[1][1].body);
		expect(
			(mp4ProbePayload?.DeviceProfile?.DirectPlayProfiles || [])
				.filter((profile) => profile?.Type === 'Video')
				.some((profile) => String(profile?.Container || '').toLowerCase().includes('mkv'))
		).toBe(false);
		expect(playbackInfo?.__breezyfin?.dynamicRange?.id).toBe('DV');
		expect(playbackInfo?.__breezyfin?.diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({
				scope: 'playback-probe',
				stage: 'fmp4-hls-preference',
				status: 'applied',
				reason: 'non-mkv-source-selected'
			})
		]));
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

	it('keeps direct-audio probe selection when probing fMP4-HLS sources', async () => {
		const service = createService();
		const sourceWithUnsupportedDefaultAudio = createMediaSource('SDR', {
			id: 'source-audio-probe',
			container: 'mkv',
			supportsDirectPlay: false,
			supportsDirectStream: false,
			supportsTranscoding: true,
			defaultAudioStreamIndex: 0,
			audioStreams: [
				{Codec: 'truehd', Index: 0, IsDefault: true},
				{Codec: 'eac3', Index: 1, IsDefault: false}
			]
		});
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-1',
					MediaSources: [{
						...sourceWithUnsupportedDefaultAudio,
						TranscodingUrl: '/Videos/item-1/master.m3u8?TranscodeReasons=AudioCodecNotSupported',
						TranscodingContainer: 'ts'
					}]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-2',
					MediaSources: [{
						...sourceWithUnsupportedDefaultAudio,
						SupportsDirectPlay: true,
						SupportsDirectStream: true,
						SupportsTranscoding: false,
						DefaultAudioStreamIndex: 1
					}]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-3',
					MediaSources: [createMediaSource('SDR', {
						id: 'source-fmp4',
						container: 'mp4',
						defaultAudioStreamIndex: 1,
						audioStreams: [
							{Codec: 'truehd', Index: 0, IsDefault: true},
							{Codec: 'eac3', Index: 1, IsDefault: false}
						]
					})]
				})
			});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			enableFmp4HlsContainerPreference: true,
			enableDiagnostics: true
		});
		const audioProbePayload = JSON.parse(global.fetch.mock.calls[1][1].body);
		const fmp4ProbePayload = JSON.parse(global.fetch.mock.calls[2][1].body);

		expect(global.fetch).toHaveBeenCalledTimes(3);
		expect(audioProbePayload.AudioStreamIndex).toBe(1);
		expect(fmp4ProbePayload.AudioStreamIndex).toBe(1);
		expect(playbackInfo?.__breezyfin?.selectedAudioStreamIndex).toBe(1);
		expect(playbackInfo?.__breezyfin?.decision).toEqual(expect.objectContaining({
			playMethod: 'DirectPlay',
			selectedAudioStreamIndex: 1,
			selectedMediaSourceId: 'source-fmp4',
			container: 'mp4'
		}));
	});

	it('allows forced fMP4-HLS source selection to explicitly regress dynamic range', async () => {
		const service = createService();
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-1',
					MediaSources: [createMediaSource('DOVIWithHDR10', {id: 'source-dv', container: 'mkv'})]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-2',
					MediaSources: [createMediaSource('SDR', {id: 'source-sdr-mp4', container: 'mp4'})]
				})
			});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			enableFmp4HlsContainerPreference: true,
			forceFmp4HlsContainerPreference: true,
			enableDiagnostics: true
		});

		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(playbackInfo?.__breezyfin?.dynamicRange?.id).toBe('SDR');
		expect(playbackInfo?.__breezyfin?.diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({
				scope: 'playback-probe',
				stage: 'fmp4-hls-preference',
				status: 'applied',
				reason: 'forced-dynamic-range-regression'
			})
		]));
		expect(playbackInfo?.__breezyfin?.decision).toEqual(expect.objectContaining({
			selectedMediaSourceId: 'source-sdr-mp4',
			dynamicRangeId: 'SDR',
			fmp4HlsPreference: {
				enabled: true,
				forced: true
			}
		}));
	});

	it('keeps smart client-renderable text subtitles off the burn-in path', async () => {
		await expectClientRenderedSubtitlePlayback({
			videoRangeType: 'SDR',
			sourceId: 'source-sdr-subtitle',
			subtitleCodec: 'srt',
			expectedReason: 'client-render-text',
			expectedRenderer: 'client-text'
		});
	});

	it('requests subtitle burn-in through PlaybackInfo when smart ASS renderer is burn-in on SDR', async () => {
		const service = createService();
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-1',
					MediaSources: [
						withSubtitleStream(createMediaSource('SDR', {
							id: 'source-sdr-subtitle',
							supportsTranscoding: true
						}), {Codec: 'ass', Index: 2})
					]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-2',
					MediaSources: [
						withSubtitleStream({
							...createMediaSource('SDR', {
								id: 'source-sdr-subtitle',
								supportsDirectPlay: false,
								supportsDirectStream: false,
								supportsTranscoding: true
							}),
							TranscodingUrl: '/Videos/item-1/master.m3u8?SubtitleMethod=Encode&SubtitleStreamIndex=2',
							TranscodingContainer: 'ts'
						}, {Codec: 'ass', Index: 2})
					]
				})
			});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			subtitleStreamIndex: 2,
			assSubtitleRenderer: 'burn-in',
			enableDiagnostics: true
		});
		const transcodePayload = JSON.parse(global.fetch.mock.calls[1][1].body);

		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(transcodePayload.EnableDirectPlay).toBe(false);
		expect(transcodePayload.EnableDirectStream).toBe(false);
		expect(transcodePayload.AllowVideoStreamCopy).toBe(false);
		expect(transcodePayload.AllowAudioStreamCopy).toBe(false);
		expect(transcodePayload.SubtitleStreamIndex).toBe(2);
		expect(transcodePayload.SubtitleMethod).toBeUndefined();
		expect(transcodePayload.AlwaysBurnInSubtitleWhenTranscoding).toBe(true);
		expect(transcodePayload.DeviceProfile.SubtitleProfiles.every((profile) => (
			profile.Method === 'Encode'
		))).toBe(true);
		expect(transcodePayload.DeviceProfile.TranscodingProfiles).toEqual([
			expect.objectContaining({
				Container: 'ts',
				Protocol: 'hls',
				VideoCodec: 'h264',
				AudioCodec: 'aac',
				MaxAudioChannels: '6'
			})
		]);
		expect(playbackInfo?.__breezyfin?.subtitlePolicy).toEqual(expect.objectContaining({
			mode: 'smart',
			reason: 'ass-renderer-burn-in',
			renderer: 'burn-in',
			requiresBurnIn: true,
			forceBurnIn: true
		}));
		expect(playbackInfo?.__breezyfin?.decision).toEqual(expect.objectContaining({
			playMethod: 'Transcode',
			selectedSubtitleStreamIndex: 2,
			forceSubtitleBurnIn: true,
			safeSubtitleBurnInProfile: true,
			subtitleDecision: 'ass-renderer-burn-in'
		}));
		expect(playbackInfo?.__breezyfin?.diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({
				scope: 'subtitle-policy',
				stage: 'burn-in-decision',
				status: 'applied',
				reason: 'ass-renderer-burn-in'
			}),
			expect.objectContaining({
				scope: 'subtitle-policy',
				stage: 'burn-in-safe-profile',
				status: 'applied',
				reason: 'subtitle-burn-in-safe-transcode'
			}),
			expect.objectContaining({
				scope: 'playback-probe',
				stage: 'forced-transcode',
				status: 'applied',
				reason: 'subtitle-burn-in'
			})
		]));
	});

	it('uses lightweight client rendering for ASS/SSA HDR/DV subtitles in smart auto mode', async () => {
		await expectClientRenderedSubtitlePlayback({
			videoRangeType: 'DOVIWithHDR10',
			sourceId: 'source-dv-subtitle',
			subtitleCodec: 'ass',
			expectedReason: 'client-render-ass-lightweight',
			expectedRenderer: 'client-ass-lightweight'
		});
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
			preferDolbyVisionMp4: true,
			enableDiagnostics: true
		});
		expect(playbackInfo?.__breezyfin?.playMethod).toBe('Transcode');
		expect(playbackInfo?.__breezyfin?.decision).toEqual(expect.objectContaining({
			playMethod: 'Transcode',
			forceDolbyVision: true,
			dynamicRangeId: 'DV'
		}));
		expect(
			playbackInfo?.__breezyfin?.adjustments?.some((entry) => entry?.type === 'forceDolbyVisionAudioOnlyTranscode')
		).toBe(true);
	});

	it('skips HDR when preflight cannot produce video-copy playback', async () => {
		const service = createService();
		const source = createTranscodeOnlyDvSource();
		source.TranscodingUrl =
			'/Videos/item-1/master.m3u8?VideoCodec=hevc&TranscodeReasons=ContainerBitrateExceedsLimit';
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [source]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			enableDiagnostics: true
		});

		expect(playbackInfo?.__breezyfin?.requiredDecision).toEqual(expect.objectContaining({
			type: 'dynamic-range-fallback',
			originalRange: 'DV',
			proposedRange: 'sdr',
			reason: 'hdr-video-copy-unavailable'
		}));
		expect(playbackInfo?.__breezyfin?.diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({
				scope: 'dynamic-range',
				stage: 'hdr-copy-preflight',
				status: 'no-match'
			}),
			expect.objectContaining({
				scope: 'dynamic-range',
				stage: 'dolby-vision-path-validation',
				status: 'pending-user-consent'
			})
		]));
	});

	it('offers HDR only after preflight finds a safe video-copy path', async () => {
		const service = createService();
		const unsafeSource = createTranscodeOnlyDvSource();
		unsafeSource.TranscodingUrl =
			'/Videos/item-1/master.m3u8?VideoCodec=hevc&TranscodeReasons=VideoRangeTypeNotSupported';
		const hdrCopySource = {
			...createTranscodeOnlyDvSource(),
			Container: 'mp4',
			SupportsDirectStream: true,
			TranscodingUrl:
				'/Videos/item-1/master.m3u8?VideoCodec=copy&TranscodeReasons=AudioCodecNotSupported'
		};
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-1',
					MediaSources: [unsafeSource]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-2',
					MediaSources: [hdrCopySource]
				})
			});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			maxBitrate: 100,
			enableDiagnostics: true
		});

		expect(playbackInfo?.__breezyfin?.requiredDecision).toEqual(expect.objectContaining({
			type: 'dynamic-range-fallback',
			proposedRange: 'hdr10'
		}));
		expect(playbackInfo?.__breezyfin?.diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({
				scope: 'dynamic-range',
				stage: 'hdr-copy-preflight',
				status: 'applied'
			})
		]));
	});

	it('offers an original-quality retry before range loss for a bitrate-only DV transcode', async () => {
		const service = createService();
		const source = createTranscodeOnlyDvSource();
		source.TranscodingUrl =
			'/Videos/item-1/master.m3u8?VideoCodec=hevc&TranscodeReasons=ContainerBitrateExceedsLimit';
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [source]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			maxBitrate: 40
		});

		expect(playbackInfo?.__breezyfin?.requiredDecision).toEqual(expect.objectContaining({
			type: 'dolby-vision-original-quality',
			proposedBitrateMbps: 120
		}));
	});

	it('offers SDR after original quality and HDR-copy preflight both remain unsafe', async () => {
		const service = createService();
		const source = createTranscodeOnlyDvSource();
		source.TranscodingUrl =
			'/Videos/item-1/master.m3u8?VideoCodec=hevc&TranscodeReasons=ContainerBitrateExceedsLimit';
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [source]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			maxBitrate: 100,
			confirmedDolbyVisionOriginalQuality: true
		});

		expect(playbackInfo?.__breezyfin?.requiredDecision).toEqual(expect.objectContaining({
			type: 'dynamic-range-fallback',
			proposedRange: 'sdr'
		}));
	});

	it('offers SDR when a confirmed HDR fallback still requires a full video encode', async () => {
		const service = createService();
		const source = createTranscodeOnlyDvSource();
		source.TranscodingUrl =
			'/Videos/item-1/master.m3u8?VideoCodec=hevc&hevc-rangetype=SDR,HDR10,HLG&TranscodeReasons=VideoRangeTypeNotSupported';
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [source]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			dynamicRangeCap: 'hdr10',
			avoidDolbyVision: true,
			confirmedDynamicRangeFallback: 'hdr10'
		});

		expect(playbackInfo?.__breezyfin?.requiredDecision).toEqual(expect.objectContaining({
			type: 'dynamic-range-fallback',
			proposedRange: 'sdr'
		}));
	});

	it('accepts a confirmed SDR video encode when source range parameters still mention DV', async () => {
		const service = createService();
		const source = createTranscodeOnlyDvSource();
		source.TranscodingUrl =
			'/Videos/item-1/master.m3u8?VideoCodec=h264&h264-rangetype=SDR,DOVIWithSDR&TranscodeReasons=VideoRangeTypeNotSupported';
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [source]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			dynamicRangeCap: 'sdr',
			avoidDolbyVision: true,
			confirmedDynamicRangeFallback: 'sdr'
		});

		expect(playbackInfo?.__breezyfin?.requiredDecision).toBeNull();
		expect(playbackInfo?.__breezyfin?.playMethod).toBe('Transcode');
		expect(playbackInfo?.__breezyfin?.safeSdrFallbackProfile).toBe(true);
		expect(playbackInfo?.__breezyfin?.dynamicRange).toEqual(expect.objectContaining({
			id: 'SDR',
			displayLabel: 'SDR'
		}));
		expect(playbackInfo?.__breezyfin?.subtitlePolicy).toEqual(expect.objectContaining({
			originalDynamicRangeId: 'DV'
		}));
		const requestPayload = JSON.parse(global.fetch.mock.calls[0][1].body);
		expect(requestPayload.DeviceProfile.TranscodingProfiles).toEqual([
			expect.objectContaining({
				Container: 'ts',
				VideoCodec: 'h264'
			})
		]);
		expect(requestPayload.AllowVideoStreamCopy).toBe(false);
	});

	it('rejects HEVC output after confirmed SDR fallback before playback attachment', async () => {
		const service = createService();
		const source = createTranscodeOnlyDvSource();
		source.TranscodingUrl =
			'/Videos/item-1/master.m3u8?VideoCodec=hevc&hevc-rangetype=SDR,DOVIWithSDR&TranscodeReasons=ContainerBitrateExceedsLimit';
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [source]
			})
		});

		await expect(getItemPlaybackInfo(service, 'item-1', {
			dynamicRangeCap: 'sdr',
			avoidDolbyVision: true,
			confirmedDynamicRangeFallback: 'sdr'
		})).rejects.toThrow('required H.264 SDR transcode');
	});

	it('offers SDR directly when Force Transcoding makes HDR video copy impossible', async () => {
		const service = createService();
		const source = createTranscodeOnlyDvSource();
		source.TranscodingUrl =
			'/Videos/item-1/master.m3u8?VideoCodec=hevc&TranscodeReasons=ContainerBitrateExceedsLimit';
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [source]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			forceTranscoding: true
		});

		expect(playbackInfo?.__breezyfin?.requiredDecision).toEqual(expect.objectContaining({
			type: 'dynamic-range-fallback',
			proposedRange: 'sdr'
		}));
	});

	it('does not require range consent for DV audio-only transcoding', async () => {
		const service = createService();
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [createDvAudioOnlyTranscodeSource()]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1');

		expect(playbackInfo?.__breezyfin?.requiredDecision).toBeNull();
		expect(playbackInfo?.__breezyfin?.playMethod).toBe('Transcode');
	});

	it('requires confirmation before replacing an explicitly selected DTS-HD track', async () => {
		const service = createService();
		arrangeExplicitDtsAudioFallback();

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			audioStreamIndex: 0
		});

		expect(playbackInfo?.__breezyfin?.requiredDecision).toEqual(expect.objectContaining({
			type: 'unsupported-audio-switch',
			selectedTrack: expect.objectContaining({index: 0, codec: 'dts-hd'}),
			proposedTrack: expect.objectContaining({index: 1, codec: 'ac3'})
		}));
	});

	it('does not auto-replace an unsupported audio track remapped from explicit intent', async () => {
		const service = createService();
		arrangeExplicitDtsAudioFallback();

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			audioTrackIntent: {
				index: 0,
				language: 'eng',
				title: 'DTS-HD MA',
				codec: 'dts-hd',
				channels: 8
			}
		});

		expect(playbackInfo?.__breezyfin?.requiredDecision).toEqual(expect.objectContaining({
			type: 'unsupported-audio-switch',
			selectedTrack: expect.objectContaining({index: 0, codec: 'dts-hd'}),
			proposedTrack: expect.objectContaining({index: 1, codec: 'ac3'})
		}));
	});

	it('keeps an explicit audio index authoritative over stale cross-item intent', async () => {
		const service = createService();
		const source = createMediaSource('SDR', {
			defaultAudioStreamIndex: 0,
			audioStreams: [
				{Codec: 'aac', Index: 0, IsDefault: true},
				{Codec: 'aac', Index: 1}
			]
		});
		Object.assign(source.MediaStreams.find((stream) => stream.Index === 0), {
			Language: 'eng',
			DisplayTitle: 'English'
		});
		Object.assign(source.MediaStreams.find((stream) => stream.Index === 1), {
			Language: 'jpn',
			DisplayTitle: 'Japanese'
		});
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [source]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			audioStreamIndex: 1,
			audioTrackIntent: {
				index: 0,
				language: 'eng',
				displayTitle: 'English',
				codec: 'aac'
			}
		});
		const requestPayload = JSON.parse(global.fetch.mock.calls[0][1].body);

		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(requestPayload.AudioStreamIndex).toBe(1);
		expect(playbackInfo?.__breezyfin?.selectedAudioStreamIndex).toBe(1);
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
			preferDolbyVisionMp4: true,
			enableDiagnostics: true
		});
		expect(playbackInfo?.__breezyfin?.playMethod).toBe('DirectPlay');
		expect(playbackInfo?.__breezyfin?.selectedAudioStreamIndex).toBe(1);
		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(playbackInfo?.__breezyfin?.diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({
				scope: 'playback-probe',
				stage: 'direct-audio',
				status: 'applied',
				reason: 'direct-path-found'
			})
		]));
		const audioProbePayload = JSON.parse(global.fetch.mock.calls[1][1].body);
		expect(audioProbePayload.AudioStreamIndex).toBe(1);
		expect(audioProbePayload.EnableTranscoding).toBe(false);
	});

	it('probes compatible audio even when source reports direct-play support but starts in transcoding', async () => {
		const service = createService();
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-1',
					MediaSources: [
						createDvSourceWithAudioFallbackCandidate({
							supportsDirectPlay: true,
							supportsDirectStream: true,
							supportsTranscoding: true,
							transcodingUrl: '/Videos/item-1/master.m3u8?TranscodeReasons=AudioCodecNotSupported',
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
			forceDolbyVision: true
		});

		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(playbackInfo?.__breezyfin?.playMethod).toBe('DirectPlay');
		expect(playbackInfo?.__breezyfin?.selectedAudioStreamIndex).toBe(1);
		expect(playbackInfo?.__breezyfin?.adjustments?.some((entry) => entry?.type === 'audioDirectPathProbe')).toBe(true);
	});
});
