import {act, renderHook} from '@testing-library/react';
import {usePlayerLifecycleEffects} from '../usePlayerLifecycleEffects';

const createProps = (overrides = {}) => ({
	item: null,
	resetRecoveryGuards: jest.fn(),
	playSessionRebuildAttemptsRef: {current: 0},
	transcodeFallbackAttemptedRef: {current: false},
	reloadAttemptedRef: {current: false},
	setSkipOverlayVisible: jest.fn(),
	setCurrentSkipSegment: jest.fn(),
	setSkipCountdown: jest.fn(),
	setDismissedSkipSegmentId: jest.fn(),
	setShowNextEpisodePrompt: jest.fn(),
	setNextEpisodePromptDismissed: jest.fn(),
	nextEpisodePromptStartTicksRef: {current: null},
	loadVideo: jest.fn(),
	getMediaSegmentsForItem: jest.fn(),
	setMediaSegments: jest.fn(),
	appendPlaybackDiagnostic: jest.fn(),
	handleStop: jest.fn(),
	showControls: false,
	playing: true,
	showAudioPopup: false,
	showSubtitlePopup: false,
	lastInteractionRef: {current: 0},
	setShowControls: jest.fn(),
	mediaSourceData: null,
	isCurrentTranscoding: false,
	lastProgressRef: {current: {timestamp: 0, time: 0}},
	videoRef: {current: null},
	attemptTranscodeFallback: jest.fn(),
	skipFocusRetryTimerRef: {current: null},
	seekFeedbackTimerRef: {current: null},
	skipOverlayVisible: true,
	wasSkipOverlayVisibleRef: {current: false},
	focusSkipOverlayAction: jest.fn(),
	focusPlayerWakeAction: jest.fn(),
	playPauseButtonRef: {current: null},
	loadRequestIdRef: {current: 0},
	playbackStartedRef: {current: false},
	...overrides
});

describe('usePlayerLifecycleEffects skip overlay focus', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	});

	it('restores visible player controls and focus after the skip overlay closes', () => {
		const props = createProps();
		const {rerender} = renderHook(
			(nextProps) => usePlayerLifecycleEffects(nextProps),
			{initialProps: props}
		);

		act(() => {
			jest.advanceTimersByTime(20);
		});
		expect(props.focusSkipOverlayAction).toHaveBeenCalledTimes(1);

		rerender({...props, skipOverlayVisible: false});

		expect(props.setShowControls).toHaveBeenCalledWith(true);
		expect(props.focusPlayerWakeAction).toHaveBeenCalledTimes(1);
		expect(props.lastInteractionRef.current).toBeGreaterThan(0);
	});
});
