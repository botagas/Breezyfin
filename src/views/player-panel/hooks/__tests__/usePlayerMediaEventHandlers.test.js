import {act, renderHook} from '@testing-library/react';

import {usePlayerMediaEventHandlers} from '../usePlayerMediaEventHandlers';

const createProps = () => {
	const video = document.createElement('video');
	Object.defineProperty(video, 'currentTime', {configurable: true, writable: true, value: 0});
	Object.defineProperty(video, 'paused', {configurable: true, writable: true, value: true});
	const runtimeContext = Object.freeze({
		generation: 4,
		itemId: 'item-1',
		mediaSourceId: 'source-1',
		playMethod: 'DirectPlay'
	});
	const sourceToken = Object.freeze({
		generation: 4,
		itemId: 'item-1',
		mediaSourceId: 'source-1',
		playMethod: 'DirectPlay',
		runtimeContext,
		video,
		sourceUrl: 'video.mkv',
		engine: 'native',
		attachedAtEpochMs: 2000,
		attachedAtEventTime: 200
	});
	return {
		video,
		sourceToken,
		props: {
			item: {Id: 'item-1'},
			loading: true,
			videoRef: {current: video},
			playbackStartedRef: {current: false},
			playbackOverrideRef: {current: null},
			setCurrentTime: jest.fn(),
			showPlaybackError: jest.fn(),
			checkSkipSegments: jest.fn(),
			seekOffsetRef: {current: 0},
			lastProgressRef: {current: {time: 0, timestamp: 0}},
			playbackFailureLockedRef: {current: false},
			playbackSettingsRef: {current: {}},
			isSubtitleCompatibilityError: jest.fn(() => false),
			attemptSubtitleCompatibilityFallback: jest.fn().mockResolvedValue(false),
			isCurrentTranscoding: false,
			attemptTranscodeFallback: jest.fn().mockResolvedValue(false),
			handleStop: jest.fn().mockResolvedValue(undefined),
			mediaSourceData: {},
			audioTracks: [],
			currentAudioTrack: -1,
			currentSubtitleTrack: -1,
			appendPlaybackDiagnostic: jest.fn(),
			onNativeAudioSwitchFallback: jest.fn(),
			onPlaybackEvidence: jest.fn(),
			setPlaying: jest.fn(),
			exitInProgressRef: {current: false},
			nativeSourceTokenRef: {current: sourceToken},
			playbackRuntimeContextRef: {current: runtimeContext},
			playbackGenerationRef: {current: 4}
		}
	};
};

describe('usePlayerMediaEventHandlers', () => {
	it('accepts only genuine unpaused timeline progress as startup evidence', () => {
		const view = createProps();
		const {result} = renderHook(() => usePlayerMediaEventHandlers(view.props));

		view.video.currentTime = 12;
		act(() => {
			result.current.handleTimeUpdate({currentTarget: view.video});
		});
		expect(view.props.onPlaybackEvidence).not.toHaveBeenCalled();

		view.video.paused = false;
		view.video.currentTime = 13;
		act(() => {
			result.current.handleTimeUpdate({currentTarget: view.video});
		});
		expect(view.props.onPlaybackEvidence).toHaveBeenCalledWith(
			'timeline-progress',
			view.sourceToken
		);
	});

	it('ignores events from a replaced video source', () => {
		const view = createProps();
		const oldVideo = document.createElement('video');
		const {result} = renderHook(() => usePlayerMediaEventHandlers(view.props));

		act(() => {
			result.current.handleVideoPlaying({currentTarget: oldVideo});
		});
		expect(view.props.setPlaying).not.toHaveBeenCalled();
		expect(view.props.onPlaybackEvidence).not.toHaveBeenCalled();
	});

	it('ignores queued events created before the active source was attached', async () => {
		const view = createProps();
		const {result} = renderHook(() => usePlayerMediaEventHandlers(view.props));

		view.video.paused = false;
		view.video.currentTime = 12;
		await act(async () => {
			result.current.handleVideoPlaying({
				type: 'playing',
				currentTarget: view.video,
				timeStamp: 199
			});
			result.current.handleTimeUpdate({
				type: 'timeupdate',
				currentTarget: view.video,
				timeStamp: 199
			});
			await result.current.handleVideoError({
				type: 'error',
				currentTarget: view.video,
				timeStamp: 199
			});
		});

		expect(view.props.setPlaying).not.toHaveBeenCalled();
		expect(view.props.setCurrentTime).not.toHaveBeenCalled();
		expect(view.props.onPlaybackEvidence).not.toHaveBeenCalled();
		expect(view.props.attemptSubtitleCompatibilityFallback).not.toHaveBeenCalled();
		expect(view.props.attemptTranscodeFallback).not.toHaveBeenCalled();
	});

	it('leaves HLS.js media errors to the generation-bound HLS error handler', async () => {
		const view = createProps();
		view.sourceToken = Object.freeze({...view.sourceToken, engine: 'hls.js'});
		view.props.nativeSourceTokenRef.current = view.sourceToken;
		const {result} = renderHook(() => usePlayerMediaEventHandlers(view.props));

		await act(async () => {
			await result.current.handleVideoError({
				type: 'error',
				currentTarget: view.video,
				timeStamp: 201
			});
		});

		expect(view.props.attemptSubtitleCompatibilityFallback).not.toHaveBeenCalled();
		expect(view.props.attemptTranscodeFallback).not.toHaveBeenCalled();
		expect(view.props.showPlaybackError).not.toHaveBeenCalled();
	});
});
