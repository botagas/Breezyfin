import {act, renderHook} from '@testing-library/react';
import {usePlayerRecoveryHandlers} from '../usePlayerRecoveryHandlers';
import {createPlaybackRuntimeContext} from '../../utils/playbackRuntimeContext';
import {
	SERVER_TRANSCODING_FAILURE_DIAGNOSTIC,
	SERVER_TRANSCODING_FAILURE_MESSAGE
} from '../../utils/playerRecoveryPolicy';

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
			clearStartupDeadline: jest.fn(),
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
			playbackStartedRef: {current: false},
			playbackGenerationRef: {current: 3},
			playbackRuntimeContextRef: {current: runtimeContext},
			nativeSourceTokenRef: {current: {}},
			detachPlaybackSource: jest.fn()
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

	it('routes terminal playback teardown through the source pipeline', () => {
		const {props} = createProps();
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		act(() => {
			result.current.showPlaybackError('Playback failed');
		});

		expect(props.detachPlaybackSource).toHaveBeenCalledWith(expect.objectContaining({
			clearRuntimeContext: false,
			reason: 'terminal-playback-error'
		}));
		expect(props.setPlaying).toHaveBeenCalledWith(false);
		expect(props.setError).toHaveBeenCalledWith('Playback failed');
	});

	it('detaches and invalidates native media for terminal startup errors', () => {
		const {props} = createProps();
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		act(() => {
			result.current.showPlaybackError('Playback failed', {detachMedia: true});
		});

		expect(props.detachPlaybackSource).toHaveBeenCalledWith(expect.objectContaining({
			clearRuntimeContext: true,
			resetVideo: true,
			reason: 'terminal-startup-error'
		}));
	});

	it('reports an exhausted initial transcode fragment failure as a server startup failure', () => {
		const {props} = createProps();
		const runtimeContext = createPlaybackRuntimeContext({
			generation: 3,
			itemId: 'item-1',
			mediaSourceData: {
				Id: 'source-1',
				TranscodingUrl: '/Videos/item-1/master.m3u8'
			},
			playMethod: 'Transcode'
		});
		const hls = {
			stopLoad: jest.fn(),
			destroy: jest.fn()
		};
		props.hlsRef.current = hls;
		props.reloadAttemptedRef.current = true;
		props.playbackRuntimeContextRef.current = runtimeContext;

		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		act(() => {
			expect(result.current.attemptHlsFatalRecovery(
				hls,
				{
					type: 'networkError',
					details: 'fragLoadError',
					fatal: true,
					response: {code: 500}
				},
				'HLS.js',
				runtimeContext
			)).toBe(true);
		});

		expect(props.setError).toHaveBeenCalledWith(SERVER_TRANSCODING_FAILURE_MESSAGE);
		expect(props.appendPlaybackDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
			reason: 'server-transcoder-startup-failure',
			message: SERVER_TRANSCODING_FAILURE_DIAGNOSTIC
		}));
	});
});
