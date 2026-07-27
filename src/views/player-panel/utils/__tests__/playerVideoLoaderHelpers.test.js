import {
	buildMediaSourceDebugData,
	buildPlayerPlaybackSettingsSnapshot,
	getPlaybackStartupFailureMessage,
	resolveInitialTrackSelection,
	resolvePlaybackVideoUrl,
	selectHlsEnginePreference
} from '../playerVideoLoaderHelpers';

describe('playerVideoLoaderHelpers', () => {
	it('builds playback settings from persisted settings and playback override', () => {
		const snapshot = buildPlayerPlaybackSettingsSnapshot({
			settings: {
				forceTranscoding: false,
				forceDolbyVision: false,
				enableFmp4HlsContainerPreference: true,
				forceFmp4HlsContainerPreference: true,
				preferredAudioLanguage: ' EN ',
				smartSubtitleTranscoding: false,
				enableSubtitleBurnIn: true,
				forceTranscodingWithSubtitles: true,
				enableDiagnostics: true,
				bitmapSubtitleRenderer: 'libpgs',
				subtitleBurnInTextCodecs: ['ASS', '']
			},
			playbackOptions: {dynamicRangeCap: 'auto'},
			playbackOverride: {
				dynamicRangeCap: 'hdr10',
				forceSubtitleBurnIn: true,
				disableDirectPlay: true
			},
			forceTranscodeOverride: true
		});

		expect(snapshot).toEqual(expect.objectContaining({
			forceTranscoding: true,
			enableFmp4HlsContainerPreference: true,
			forceFmp4HlsContainerPreference: true,
			preferredAudioLanguage: 'en',
			smartSubtitleTranscoding: false,
			disableDirectPlay: true,
			forceSubtitleBurnInOnHdr: true,
			forceSubtitleBurnIn: true,
			enableDiagnostics: true,
			bitmapSubtitleRenderer: 'libpgs',
			subtitleBurnInTextCodecs: ['ass'],
			dynamicRangeCap: 'hdr10'
		}));
	});

	it('resolves override tracks before preference-picked tracks', () => {
		const selection = resolveInitialTrackSelection({
			audioStreams: [{Index: 1}],
			subtitleStreams: [{Index: 2}],
			playbackOverride: {
				audioStreamIndex: 7,
				subtitleStreamIndex: -1
			},
			pickPreferredAudio: () => 1,
			pickPreferredSubtitle: () => 2
		});

		expect(selection).toEqual({
			selectedAudio: 7,
			selectedSubtitle: -1
		});
	});

	it('remaps subtitle intent before preference-picked subtitle tracks', () => {
		const selection = resolveInitialTrackSelection({
			audioStreams: [{Index: 1}],
			subtitleStreams: [
				{Index: 2, Type: 'Subtitle', Language: 'eng', Codec: 'pgssub', IsForced: true, DisplayTitle: 'Signs'},
				{Index: 3, Type: 'Subtitle', Language: 'eng', Codec: 'pgssub', DisplayTitle: 'Full Dialogue'}
			],
			playbackOptions: {
				subtitleTrackIntent: {
					language: 'eng',
					codec: 'pgssub',
					isForced: false,
					languageCodecOrdinal: 1
				}
			},
			pickPreferredAudio: () => 1,
			pickPreferredSubtitle: (streams, providedSubtitle) => providedSubtitle
		});

		expect(selection).toEqual({
			selectedAudio: 1,
			selectedSubtitle: 3
		});
	});

	it('builds shared media source debug metadata consistently', () => {
		const result = buildMediaSourceDebugData({
			mediaSource: {Id: 'source-1'},
			playbackInfo: {
				MediaSources: [
					{
						Id: 'source-1',
						Container: 'mkv',
						SupportsDirectPlay: true,
						DefaultAudioStreamIndex: '2',
						MediaStreams: [
							{
								Type: 'Video',
								Codec: 'hevc',
								VideoRangeType: 'DOVIWithHDR10',
								VideoRange: 'HDR'
							}
						]
					}
				]
			},
			playbackMeta: {
				dynamicRangeCap: 'hdr10',
				decision: {playMethod: 'DirectPlay'},
				subtitlePolicy: {decision: 'client-render'},
				diagnostics: [{scope: 'playback', status: 'applied'}]
			},
			resolvedPlayMethod: 'DirectPlay',
			dynamicRangeInfo: {id: 'DV'},
			dynamicRangeLabel: 'Dolby Vision',
			requestedDynamicRangeCap: 'auto',
			playbackRequestDebug: {directPlay: true},
			diagnosticsEnabled: true,
			videoStream: {
				Codec: 'hevc',
				VideoRangeType: 'DOVIWithHDR10',
				VideoRange: 'HDR'
			}
		});

		expect(result).toEqual({
			__selectedPlayMethod: 'DirectPlay',
			__dynamicRangeInfo: {id: 'DV'},
			__dynamicRangeLabel: 'Dolby Vision',
			__requestedDynamicRangeCap: 'hdr10',
			__debugVideoRangeType: 'DOVIWithHDR10',
			__debugVideoRange: 'HDR',
			__debugVideoCodec: 'hevc',
			__debugRequest: {directPlay: true},
			__debugDecision: {playMethod: 'DirectPlay'},
			__safeSubtitleBurnInProfile: false,
			__requiredDecision: null,
			__debugSubtitlePolicy: {decision: 'client-render'},
			__debugDiagnostics: [{scope: 'playback', status: 'applied'}],
			__debugAvailableSources: [
				{
					id: 'source-1',
					container: 'mkv',
					videoCodec: 'hevc',
					videoRangeType: 'DOVIWithHDR10',
					videoRange: 'HDR',
					supportsDirectPlay: true,
					supportsDirectStream: false,
					supportsTranscoding: false,
					defaultAudioStreamIndex: 2
				}
			],
			__debugSelectedSourceId: 'source-1'
		});
	});

	it('retains operational playback metadata without optional diagnostics', () => {
		const result = buildMediaSourceDebugData({
			mediaSource: {Id: 'source-1'},
			playbackInfo: {MediaSources: [{Id: 'source-1'}]},
			playbackMeta: {
				subtitlePolicy: {decision: 'client-render'},
				requiredDecision: {type: 'subtitle-consent'},
				safeSubtitleBurnInProfile: true,
				decision: {payload: 'large'},
				diagnostics: [{scope: 'playback'}]
			},
			resolvedPlayMethod: 'Transcode',
			dynamicRangeInfo: {id: 'SDR'},
			dynamicRangeLabel: 'SDR',
			diagnosticsEnabled: false
		});

		expect(result).toEqual(expect.objectContaining({
			__selectedPlayMethod: 'Transcode',
			__requiredDecision: {type: 'subtitle-consent'},
			__debugSubtitlePolicy: {decision: 'client-render'},
			__safeSubtitleBurnInProfile: true,
			__debugDecision: null,
			__debugDiagnostics: [],
			__debugAvailableSources: []
		}));
	});

	it('resolves direct playback URLs through the Jellyfin service helper', () => {
		const service = {
			getPlaybackUrl: jest.fn(() => 'http://media.local/video')
		};
		const result = resolvePlaybackVideoUrl({
			service,
			itemId: 'item-1',
			playbackInfo: {PlaySessionId: 'session-1'},
			resolvedPlayMethod: 'DirectPlay',
			mediaSource: {
				Id: 'source-1',
				ETag: 'tag-1',
				Container: 'mkv',
				SupportsDirectPlay: true
			}
		});

		expect(result).toEqual({
			videoUrl: 'http://media.local/video',
			isHls: false,
			useTranscoding: false
		});
		expect(service.getPlaybackUrl).toHaveBeenCalledWith(
			'item-1',
			'source-1',
			'session-1',
			'tag-1',
			'mkv',
			undefined
		);
	});

	it('detects HLS transcode URLs', () => {
		expect(resolvePlaybackVideoUrl({
			service: {serverUrl: 'http://media.local'},
			resolvedPlayMethod: 'Transcode',
			mediaSource: {
				TranscodingUrl: '/Videos/item-1/master.m3u8',
				TranscodingContainer: 'mp4'
			}
		})).toEqual({
			videoUrl: 'http://media.local/Videos/item-1/master.m3u8',
			isHls: true,
			useTranscoding: true
		});
	});

	it('uses Jellyfin direct-stream remux URLs when returned', () => {
		const service = {
			serverUrl: 'http://media.local',
			getPlaybackUrl: jest.fn(() => 'http://media.local/static')
		};

		expect(resolvePlaybackVideoUrl({
			service,
			resolvedPlayMethod: 'DirectStream',
			mediaSource: {
				SupportsDirectStream: true,
				TranscodingUrl: '/Videos/item-1/master.m3u8',
				TranscodingContainer: 'ts'
			}
		})).toEqual({
			videoUrl: 'http://media.local/Videos/item-1/master.m3u8',
			isHls: true,
			useTranscoding: false
		});
		expect(service.getPlaybackUrl).not.toHaveBeenCalled();
	});

	it('selects native HLS for HDR streams when native HLS is available', () => {
		expect(selectHlsEnginePreference({
			isHls: true,
			isHdrLikeStream: true,
			nativeHlsSupported: true,
			hlsJsSupported: true
		})).toEqual({
			engine: 'native',
			allowNativeFallback: false,
			reason: 'native-hdr'
		});
	});

	it('selects HLS.js when native HLS is unavailable', () => {
		expect(selectHlsEnginePreference({
			isHls: true,
			nativeHlsSupported: false,
			hlsJsSupported: true
		})).toEqual({
			engine: 'hls.js',
			allowNativeFallback: false,
			reason: 'hlsjs-available'
		});
	});

	it.each([
		['DV', 'Dolby Vision'],
		['HDR10', 'HDR'],
		['HDR10_PLUS', 'HDR'],
		['HLG', 'HDR']
	])('explains runtime startup failures for %s streams', (id, expectedLabel) => {
		expect(getPlaybackStartupFailureMessage({id})).toContain(
			`${expectedLabel} playback did not become ready`
		);
		expect(getPlaybackStartupFailureMessage({id})).toContain('test on TV hardware');
	});

	it('keeps the generic startup failure for SDR playback', () => {
		expect(getPlaybackStartupFailureMessage({id: 'SDR'})).toBe(
			'Playback failed after session rebuild attempt. Please retry or go back.'
		);
	});
});
