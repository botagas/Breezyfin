import {act, renderHook} from '@testing-library/react';
import {usePlayerRecoveryHandlers} from '../usePlayerRecoveryHandlers';
import {createPlaybackRuntimeContext} from '../../utils/playbackRuntimeContext';

const createProps = () => {
	const runtimeContext = createPlaybackRuntimeContext({
		generation: 3,
		itemId: 'item-1',
		mediaSourceData: {Id: 'source-1'}
	});
	return {
		runtimeContext,
		props: {
			maxHlsNetworkRecoveryAttempts: 1,
			maxHlsMediaRecoveryAttempts: 1,
			maxPlaySessionRebuildAttempts: 1,
			hlsConfig: {},
			clearStartWatch: jest.fn(),
			playbackOptions: {},
			setToastMessage: jest.fn(),
			setError: jest.fn(),
			setShowControls: jest.fn(),
			setLoading: jest.fn(),
			setLoadingStatusMessage: jest.fn(),
			setPlaying: jest.fn(),
			handleStop: jest.fn(),
			currentAudioTrackRef: {current: 1},
			currentSubtitleTrackRef: {current: -1},
			playbackFailureLockedRef: {current: false},
			hlsNetworkRecoveryAttemptsRef: {current: 0},
			hlsMediaRecoveryAttemptsRef: {current: 0},
			hlsRef: {current: null},
			nativeHlsFallbackCleanupRef: {current: null},
			reloadAttemptedRef: {current: false},
			playSessionRebuildAttemptsRef: {current: 0},
			videoRef: {
				current: {
					currentTime: 14,
					pause: jest.fn(),
					removeAttribute: jest.fn(),
					load: jest.fn()
				}
			},
			seekOffsetRef: {current: 0},
			startupFallbackTimerRef: {current: null},
			playbackOverrideRef: {current: null},
			loadVideoRef: {current: jest.fn()},
			mediaSourceData: {Id: 'source-1'},
			appendPlaybackDiagnostic: jest.fn(),
			playbackSettingsRef: {current: {}},
			transcodeFallbackAttemptedRef: {current: false},
			dynamicRangeFallbackAttemptedRef: {current: false},
			subtitleCompatibilityFallbackAttemptedRef: {current: false},
			setCurrentSubtitleTrack: jest.fn(),
			requestSubtitleBurnInFallback: jest.fn(),
			requestPlaybackDecision: jest.fn(),
			exitInProgressRef: {current: false},
			playbackGenerationRef: {current: 3},
			playbackRuntimeContextRef: {current: runtimeContext}
		}
	};
};

describe('usePlayerRecoveryHandlers runtime isolation', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('does not run a delayed session rebuild after the generation is replaced', () => {
		const {props, runtimeContext} = createProps();
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		act(() => {
			expect(result.current.attemptPlaybackSessionRebuild('test rebuild', {
				runtimeContext
			})).toBe(true);
			props.playbackGenerationRef.current = 4;
			jest.runOnlyPendingTimers();
		});

		expect(props.loadVideoRef.current).not.toHaveBeenCalled();
	});

	it('runs a delayed session rebuild once for the active context', () => {
		const {props, runtimeContext} = createProps();
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		act(() => {
			expect(result.current.attemptPlaybackSessionRebuild('test rebuild', {
				runtimeContext
			})).toBe(true);
			jest.runOnlyPendingTimers();
		});

		expect(props.loadVideoRef.current).toHaveBeenCalledTimes(1);
	});
});
