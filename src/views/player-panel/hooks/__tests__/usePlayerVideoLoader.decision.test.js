import {act, renderHook} from '@testing-library/react';
import jellyfinService from '../../../../services/jellyfinService';
import {usePlayerVideoLoader} from '../usePlayerVideoLoader';
import {createPlaybackGenerationAllocator} from '../../utils/playbackGeneration';
import {createPlaybackRecoveryLedger} from '../../utils/playbackRecoveryLedger';

jest.mock('../../../../services/jellyfinService', () => ({
	__esModule: true,
	default: {
		serverUrl: 'https://example.test',
		getPlaybackInfo: jest.fn(),
		getPlaybackUrl: jest.fn(() => 'https://example.test/Videos/item-1/stream')
	}
}));

const createProps = () => {
	const playbackGenerationRef = {current: 0};
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
			playbackGenerationRef,
			playbackGenerationAllocator: createPlaybackGenerationAllocator({
				generationRef: playbackGenerationRef
			}),
			playbackRecoveryLedger: createPlaybackRecoveryLedger({
				getCurrentGeneration: () => playbackGenerationRef.current
			}),
			playbackRuntimeContextRef: {current: null},
			videoMountRetryTimerRef: {current: null}
		}
	};
};

describe('usePlayerVideoLoader blocking playback decisions', () => {
	it('prepares PlaybackInfo without detaching or mutating the active media source', async () => {
		const {props} = createProps();
		const playbackInfo = {MediaSources: [{
			Id: 'source-2',
			SupportsDirectPlay: true,
			Container: 'mp4',
			MediaStreams: []
		}]};
		jellyfinService.getPlaybackInfo.mockResolvedValue(playbackInfo);
		const {result} = renderHook(() => usePlayerVideoLoader(props));

		let prepared;
		await act(async () => {
			prepared = await result.current.preparePlaybackPlan({
				playbackOverride: {audioStreamIndex: 2}
			});
		});

		expect(prepared.playbackInfo).toEqual(playbackInfo);
		expect(prepared.kind).toBe('PlaybackPlan');
		expect(props.detachPlaybackSource).not.toHaveBeenCalled();
		expect(props.attachPlaybackSource).not.toHaveBeenCalled();
		expect(props.setMediaSourceData).not.toHaveBeenCalled();
	});

	it('rejects a prepared plan for another item before detaching the active source', async () => {
		const {props} = createProps();
		jellyfinService.getPlaybackInfo.mockResolvedValue({MediaSources: [{
			Id: 'source-2',
			SupportsDirectPlay: true,
			Container: 'mp4',
			MediaStreams: []
		}]});
		const {result} = renderHook(() => usePlayerVideoLoader(props));
		let prepared;
		await act(async () => {
			prepared = await result.current.preparePlaybackPlan();
		});

		await act(async () => {
			await result.current(false, null, {
				playbackPlan: {...prepared, itemId: 'replacement-item'}
			});
		});

		expect(props.detachPlaybackSource).not.toHaveBeenCalled();
		expect(props.attachPlaybackSource).not.toHaveBeenCalled();
		expect(props.playbackGenerationRef.current).toBe(0);
	});

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

	it('preserves a prepared transition while awaiting the video surface', async () => {
		jest.useFakeTimers();
		const {props, video} = createProps();
		const sourceToken = {sourceGeneration: 1};
		props.attachPlaybackSource.mockReturnValue(sourceToken);
		jellyfinService.getPlaybackInfo.mockResolvedValue({
			PlaySessionId: 'session-2',
			MediaSources: [{
				Id: 'source-2',
				SupportsDirectPlay: true,
				Container: 'mp4',
				MediaStreams: [{Type: 'Audio', Index: 2, Codec: 'aac'}]
			}],
			__breezyfin: {
				playMethod: 'DirectPlay',
				selectedAudioStreamIndex: 2,
				selectedSubtitleStreamIndex: -1
			}
		});
		const {result} = renderHook(() => usePlayerVideoLoader(props));
		let prepared;
		await act(async () => {
			prepared = await result.current.preparePlaybackPlan({
				playbackOverride: {audioStreamIndex: 2}
			});
		});
		props.videoRef.current = null;
		const loadOptions = {
			playbackPlan: prepared,
			transitionId: 'audio-1',
			deferDecisions: true,
			deferTrackState: true,
			suppressErrors: true
		};
		let loadPromise;
		act(() => {
			loadPromise = result.current(false, null, loadOptions);
		});
		expect(props.detachPlaybackSource).not.toHaveBeenCalled();
		expect(props.playbackGenerationRef.current).toBe(0);

		props.videoRef.current = video;
		let outcome;
		await act(async () => {
			jest.advanceTimersByTime(100);
			outcome = await loadPromise;
		});

		expect(outcome).toEqual(expect.objectContaining({status: 'attached', sourceToken}));
		expect(props.attachPlaybackSource).toHaveBeenCalledTimes(1);
		expect(props.setCurrentAudioTrack).not.toHaveBeenCalled();
		expect(props.showPlaybackError).not.toHaveBeenCalled();
		jest.useRealTimers();
	});

	it('settles a suppressed mount failure without allocating or detaching', async () => {
		jest.useFakeTimers();
		const {props} = createProps();
		props.videoRef.current = null;
		const {result} = renderHook(() => usePlayerVideoLoader(props));
		let outcome;
		await act(async () => {
			const loadPromise = result.current(false, null, {suppressErrors: true});
			jest.advanceTimersByTime(2000);
			outcome = await loadPromise;
		});

		expect(outcome).toEqual({status: 'failed', reason: 'video-surface-unavailable'});
		expect(props.detachPlaybackSource).not.toHaveBeenCalled();
		expect(props.playbackGenerationRef.current).toBe(0);
		expect(props.showPlaybackError).not.toHaveBeenCalled();
		jest.useRealTimers();
	});
});
