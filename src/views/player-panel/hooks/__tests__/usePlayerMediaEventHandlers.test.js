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
		engine: 'native'
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
});
