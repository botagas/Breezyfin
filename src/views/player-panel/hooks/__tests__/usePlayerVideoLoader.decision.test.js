import {act, renderHook} from '@testing-library/react';
import jellyfinService from '../../../../services/jellyfinService';
import {usePlayerVideoLoader} from '../usePlayerVideoLoader';

jest.mock('../../../../services/jellyfinService', () => ({
	__esModule: true,
	default: {
		serverUrl: 'https://example.test',
		getPlaybackInfo: jest.fn()
	}
}));

const createProps = () => {
	const video = {
		src: '',
		currentTime: 0,
		canPlayType: jest.fn(() => ''),
		load: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn()
	};
	return {
		video,
		props: {
			item: {Id: 'item-1', RunTimeTicks: 10000000},
			videoRef: {current: video},
			loadVideoRef: {current: null},
			loadRequestIdRef: {current: 0},
			playbackStartedRef: {current: false},
			resetRecoveryGuards: jest.fn(),
			setLoading: jest.fn(),
			setLoadingStatusMessage: jest.fn(),
			reloadAttemptedRef: {current: false},
			subtitleCompatibilityFallbackAttemptedRef: {current: false},
			lastProgressRef: {current: null},
			setError: jest.fn(),
			seekOffsetRef: {current: 0},
			loadTrackPreferences: jest.fn(),
			playbackOverrideRef: {current: null},
			playbackOptions: {},
			playbackSettingsRef: {current: {}},
			setToastMessage: jest.fn(),
			setMediaSourceData: jest.fn(),
			setDuration: jest.fn(),
			setAudioTracks: jest.fn(),
			setSubtitleTracks: jest.fn(),
			pickPreferredAudio: jest.fn(() => 0),
			pickPreferredSubtitle: jest.fn(() => -1),
			setCurrentAudioTrack: jest.fn(),
			setCurrentSubtitleTrack: jest.fn(),
			attachPlaybackSource: jest.fn(),
			detachPlaybackSource: jest.fn(),
			pendingOverrideClearRef: {current: false},
			showPlaybackError: jest.fn(),
			playbackSessionRef: {current: null},
			appendPlaybackDiagnostic: jest.fn(),
			requestPlaybackDecision: jest.fn().mockResolvedValue(undefined),
			exitInProgressRef: {current: false},
			playbackGenerationRef: {current: 0},
			playbackRuntimeContextRef: {current: null},
			videoMountRetryTimerRef: {current: null},
			setPlaybackGeneration: jest.fn()
		}
	};
};

describe('usePlayerVideoLoader blocking playback decisions', () => {
	it('does not attach or load a source before a required decision is resolved', async () => {
		const {props, video} = createProps();
		jellyfinService.getPlaybackInfo.mockResolvedValue({
			PlaySessionId: 'session-1',
			MediaSources: [{
				Id: 'source-1',
				RunTimeTicks: 10000000,
				SupportsTranscoding: true,
				TranscodingUrl: '/Videos/item-1/master.m3u8',
				MediaStreams: [
					{Type: 'Video', Codec: 'hevc', VideoRangeType: 'DOVIWithHDR10'},
					{Type: 'Audio', Index: 0, Codec: 'eac3'}
				]
			}],
			__breezyfin: {
				playMethod: 'Transcode',
				dynamicRange: {id: 'DV', displayLabel: 'Dolby Vision'},
				requiredDecision: {
					type: 'dynamic-range-fallback',
					mediaSourceId: 'source-1',
					proposedRange: 'hdr10',
					reason: 'video-codec-not-copy'
				}
			}
		});
		const {result} = renderHook(() => usePlayerVideoLoader(props));

		await act(async () => {
			await result.current();
		});

		expect(props.requestPlaybackDecision).toHaveBeenCalledWith(expect.objectContaining({
			type: 'dynamic-range-fallback',
			itemId: 'item-1',
			mediaSourceId: 'source-1',
			generation: 1
		}));
		expect(video.src).toBe('');
		expect(video.load).not.toHaveBeenCalled();
		expect(props.attachPlaybackSource).not.toHaveBeenCalled();
		expect(props.detachPlaybackSource).toHaveBeenCalledWith(expect.objectContaining({
			reason: 'new-playback-load'
		}));
		expect(props.playbackSessionRef.current).toEqual(expect.objectContaining({
			playSessionId: 'session-1'
		}));
		expect(props.appendPlaybackDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
			scope: 'dynamic-range',
			stage: 'required-decision'
		}));
	});

	it('hands a resolved HLS burn-in source to the source pipeline without loading media itself', async () => {
		const {props, video} = createProps();
		props.attachPlaybackSource.mockReturnValue({sourceGeneration: 1});
		jellyfinService.getPlaybackInfo.mockResolvedValue({
			PlaySessionId: 'session-1',
			MediaSources: [{
				Id: 'source-1',
				RunTimeTicks: 10000000,
				SupportsTranscoding: true,
				TranscodingUrl: '/Videos/item-1/master.m3u8?SubtitleMethod=Encode',
				MediaStreams: [
					{Type: 'Video', Codec: 'h264', VideoRangeType: 'SDR'},
					{Type: 'Audio', Index: 0, Codec: 'aac'},
					{Type: 'Subtitle', Index: 3, Codec: 'ass'}
				]
			}],
			__breezyfin: {
				playMethod: 'Transcode',
				selectedAudioStreamIndex: 0,
				selectedSubtitleStreamIndex: 3,
				subtitlePolicy: {
					requiresBurnIn: true,
					clientRender: false
				}
			}
		});
		const {result} = renderHook(() => usePlayerVideoLoader(props));

		await act(async () => {
			await result.current();
		});

		expect(props.attachPlaybackSource).toHaveBeenCalledWith(expect.objectContaining({
			url: expect.stringContaining('master.m3u8'),
			isHls: true,
			playMethod: 'Transcode',
			serverBurnIn: true,
			runtimeContext: expect.objectContaining({
				generation: 1,
				mediaSourceId: 'source-1'
			})
		}));
		expect(video.load).not.toHaveBeenCalled();
	});
});
