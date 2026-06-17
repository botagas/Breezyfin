import {
	buildPlayerPlaybackSettingsSnapshot,
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
				subtitleBurnInTextCodecs: ['ASS', '']
			},
			playbackOptions: {dynamicRangeCap: 'auto'},
			playbackOverride: {
				dynamicRangeCap: 'hdr10',
				forceSubtitleBurnIn: true
			},
			forceTranscodeOverride: true
		});

		expect(snapshot).toEqual(expect.objectContaining({
			forceTranscoding: true,
			enableFmp4HlsContainerPreference: true,
			forceFmp4HlsContainerPreference: true,
			preferredAudioLanguage: 'en',
			smartSubtitleTranscoding: false,
			forceSubtitleBurnInOnHdr: true,
			forceSubtitleBurnIn: true,
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
});
