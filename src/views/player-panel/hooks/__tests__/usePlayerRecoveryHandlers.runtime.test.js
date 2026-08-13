import {act, renderHook} from '@testing-library/react';
import {usePlayerRecoveryHandlers} from '../usePlayerRecoveryHandlers';
import {createPlaybackRuntimeContext} from '../../utils/playbackRuntimeContext';
import {
	SERVER_TRANSCODING_FAILURE_DIAGNOSTIC,
	SERVER_TRANSCODING_FAILURE_MESSAGE
} from '../../utils/playerRecoveryPolicy';

const createDeferred = () => {
	let resolve;
	const promise = new Promise((next) => {
		resolve = next;
	});
	return {promise, resolve};
};

const createProps = () => {
	const runtimeContext = createPlaybackRuntimeContext({
		generation: 3,
		itemId: 'item-1',
		mediaSourceData: {Id: 'source-1'}
	});
	return {
		runtimeContext,
		props: {
			itemId: 'item-1',
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
			loadRequestIdRef: {current: 1},
			mediaSourceData: {Id: 'source-1', SupportsTranscoding: true},
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

	it('rejects a session rebuild from a replaced runtime generation', async () => {
		const {props, runtimeContext} = createProps();
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));
		props.playbackGenerationRef.current = 4;

		await act(async () => {
			expect(await result.current.attemptPlaybackSessionRebuild('test rebuild', {
				runtimeContext
			})).toBe(false);
		});

		expect(props.loadVideoRef.current).not.toHaveBeenCalled();
		expect(props.playbackOverrideRef.current).toBeNull();
	});

	it('awaits one admitted session rebuild for the active context', async () => {
		const {props, runtimeContext} = createProps();
		const loaded = createDeferred();
		props.loadVideoRef.current.mockReturnValue(loaded.promise);
		props.playbackRecoveryLedger = {
			claimMany: jest.fn(() => ({
				accepted: true,
				claims: [
					{key: 'playSessionRebuild', attempt: 1},
					{key: 'reload', attempt: 1}
				]
			}))
		};
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));
		let rebuildPromise;

		act(() => {
			rebuildPromise = result.current.attemptPlaybackSessionRebuild('test rebuild', {
				runtimeContext
			});
		});

		expect(props.loadVideoRef.current).toHaveBeenCalledTimes(1);
		let settled = false;
		rebuildPromise.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		loaded.resolve({status: 'attached'});
		await act(async () => {
			expect(await rebuildPromise).toBe(true);
		});
	});

	it('consumes a stale transcode continuation without publishing or loading it', async () => {
		const {props} = createProps();
		const stopped = createDeferred();
		props.handleStop.mockReturnValue(stopped.promise);
		props.playbackRecoveryLedger = {
			get: jest.fn(() => null),
			claim: jest.fn(() => ({accepted: true}))
		};
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		let fallbackPromise;
		act(() => {
			fallbackPromise = result.current.attemptTranscodeFallback('Playback stalled');
		});
		expect(props.playbackOverrideRef.current).toBeNull();

		props.exitInProgressRef.current = true;
		props.loadRequestIdRef.current += 1;
		stopped.resolve();
		await act(async () => {
			expect(await fallbackPromise).toBe(true);
		});

		expect(props.playbackRecoveryLedger.claim).not.toHaveBeenCalled();
		expect(props.playbackOverrideRef.current).toBeNull();
		expect(props.loadVideoRef.current).not.toHaveBeenCalled();
		expect(props.setLoading).not.toHaveBeenCalledWith(true);
	});

	it('does not continue a transcode recovery after unmount', async () => {
		const {props} = createProps();
		const stopped = createDeferred();
		props.handleStop.mockReturnValue(stopped.promise);
		props.playbackRecoveryLedger = {
			get: jest.fn(() => null),
			claim: jest.fn(() => ({accepted: true}))
		};
		const {result, unmount} = renderHook(() => usePlayerRecoveryHandlers(props));

		let fallbackPromise;
		act(() => {
			fallbackPromise = result.current.attemptTranscodeFallback('Playback stalled');
		});
		unmount();
		stopped.resolve();
		await act(async () => {
			expect(await fallbackPromise).toBe(true);
		});

		expect(props.playbackRecoveryLedger.claim).not.toHaveBeenCalled();
		expect(props.playbackOverrideRef.current).toBeNull();
		expect(props.loadVideoRef.current).not.toHaveBeenCalled();
	});

	it('does not continue a transcode recovery for a replacement item', async () => {
		const {props} = createProps();
		const stopped = createDeferred();
		props.handleStop.mockReturnValue(stopped.promise);
		props.playbackRecoveryLedger = {
			get: jest.fn(() => null),
			claim: jest.fn(() => ({accepted: true}))
		};
		const {result, rerender} = renderHook(
			({hookProps}) => usePlayerRecoveryHandlers(hookProps),
			{initialProps: {hookProps: props}}
		);

		let fallbackPromise;
		act(() => {
			fallbackPromise = result.current.attemptTranscodeFallback('Playback stalled');
		});
		props.itemId = 'item-2';
		rerender({hookProps: props});
		stopped.resolve();
		await act(async () => {
			expect(await fallbackPromise).toBe(true);
		});

		expect(props.playbackRecoveryLedger.claim).not.toHaveBeenCalled();
		expect(props.playbackOverrideRef.current).toBeNull();
		expect(props.loadVideoRef.current).not.toHaveBeenCalled();
	});

	it('awaits and commits one current transcode recovery', async () => {
		const {props} = createProps();
		const stopped = createDeferred();
		const loaded = createDeferred();
		props.handleStop.mockReturnValue(stopped.promise);
		props.loadVideoRef.current.mockReturnValue(loaded.promise);
		props.playbackRecoveryLedger = {
			get: jest.fn(() => null),
			claim: jest.fn(() => ({accepted: true}))
		};
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		let fallbackPromise;
		act(() => {
			fallbackPromise = result.current.attemptTranscodeFallback('Playback stalled');
		});
		stopped.resolve();
		await act(async () => {
			await Promise.resolve();
		});

		expect(props.playbackOverrideRef.current).toEqual(expect.objectContaining({
			forceNewSession: true,
			mediaSourceId: 'source-1'
		}));
		expect(props.loadVideoRef.current).toHaveBeenCalledWith(true);
		expect(props.loadVideoRef.current).toHaveBeenCalledTimes(1);
		let settled = false;
		fallbackPromise.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		loaded.resolve({status: 'attached'});
		await act(async () => {
			expect(await fallbackPromise).toBe(true);
		});
	});

	it('allows only the newest overlapping recovery to publish an override', async () => {
		const {props} = createProps();
		const firstStop = createDeferred();
		const secondStop = createDeferred();
		props.handleStop
			.mockReturnValueOnce(firstStop.promise)
			.mockReturnValueOnce(secondStop.promise);
		props.loadVideoRef.current.mockResolvedValue({status: 'attached'});
		props.playbackRecoveryLedger = {
			get: jest.fn(() => null),
			claim: jest.fn(() => ({accepted: true}))
		};
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		let firstPromise;
		let secondPromise;
		act(() => {
			firstPromise = result.current.attemptTranscodeFallback('first failure');
			secondPromise = result.current.attemptTranscodeFallback('second failure');
		});
		firstStop.resolve();
		await act(async () => {
			expect(await firstPromise).toBe(true);
		});
		expect(props.loadVideoRef.current).not.toHaveBeenCalled();

		secondStop.resolve();
		await act(async () => {
			expect(await secondPromise).toBe(true);
		});
		expect(props.loadVideoRef.current).toHaveBeenCalledTimes(1);
		expect(props.playbackRecoveryLedger.claim).toHaveBeenCalledTimes(1);
	});

	it('does not publish a stale safe subtitle burn-in retry', async () => {
		const {props} = createProps();
		const stopped = createDeferred();
		props.handleStop.mockReturnValue(stopped.promise);
		props.currentSubtitleTrackRef.current = 3;
		props.mediaSourceData = {
			Id: 'source-1',
			SupportsTranscoding: true,
			__debugSubtitlePolicy: {forceBurnIn: true, codec: 'ass'},
			MediaStreams: [{Type: 'Subtitle', Index: 3, Codec: 'ass'}]
		};
		const runtimeContext = createPlaybackRuntimeContext({
			generation: 3,
			itemId: 'item-1',
			mediaSourceData: props.mediaSourceData
		});
		props.playbackRuntimeContextRef.current = runtimeContext;
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		let fallbackPromise;
		act(() => {
			fallbackPromise = result.current.attemptSubtitleCompatibilityFallback({
				details: 'fragLoadError',
				fatal: true,
				response: {code: 500},
				frag: {url: '/Videos/item/master.m3u8?SubtitleMethod=Encode&SubtitleStreamIndex=3'}
			}, runtimeContext);
		});
		props.loadRequestIdRef.current += 1;
		stopped.resolve();
		await act(async () => {
			expect(await fallbackPromise).toBe(true);
		});

		expect(props.playbackOverrideRef.current).toBeNull();
		expect(props.loadVideoRef.current).not.toHaveBeenCalled();
		expect(props.setToastMessage).not.toHaveBeenCalledWith(expect.objectContaining({
			message: expect.stringContaining('safer transcode profile')
		}));
	});

	it('commits one current safe subtitle burn-in retry', async () => {
		const {props} = createProps();
		props.handleStop.mockResolvedValue(undefined);
		props.loadVideoRef.current.mockResolvedValue({status: 'attached'});
		props.currentSubtitleTrackRef.current = 3;
		props.mediaSourceData = {
			Id: 'source-1',
			SupportsTranscoding: true,
			__debugSubtitlePolicy: {forceBurnIn: true, codec: 'ass'},
			MediaStreams: [{Type: 'Subtitle', Index: 3, Codec: 'ass'}]
		};
		const runtimeContext = createPlaybackRuntimeContext({
			generation: 3,
			itemId: 'item-1',
			mediaSourceData: props.mediaSourceData
		});
		props.playbackRuntimeContextRef.current = runtimeContext;
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		await act(async () => {
			expect(await result.current.attemptSubtitleCompatibilityFallback({
				details: 'fragLoadError',
				fatal: true,
				response: {code: 500},
				frag: {url: '/Videos/item/master.m3u8?SubtitleMethod=Encode&SubtitleStreamIndex=3'}
			}, runtimeContext)).toBe(true);
		});

		expect(props.playbackOverrideRef.current).toEqual(expect.objectContaining({
			forceSubtitleBurnIn: true,
			safeSubtitleBurnInProfile: true,
			subtitleStreamIndex: 3
		}));
		expect(props.loadVideoRef.current).toHaveBeenCalledTimes(1);
	});

	it('does not publish a stale no-subtitle restart', async () => {
		const {props} = createProps();
		const stopped = createDeferred();
		props.handleStop.mockReturnValue(stopped.promise);
		props.currentSubtitleTrackRef.current = 4;
		props.mediaSourceData = {
			Id: 'source-1',
			SupportsTranscoding: true,
			__safeSubtitleBurnInProfile: true,
			__debugSubtitlePolicy: {forceBurnIn: true, codec: 'pgssub'},
			MediaStreams: [{Type: 'Subtitle', Index: 4, Codec: 'pgssub'}]
		};
		const runtimeContext = createPlaybackRuntimeContext({
			generation: 3,
			itemId: 'item-1',
			mediaSourceData: props.mediaSourceData
		});
		props.playbackRuntimeContextRef.current = runtimeContext;
		props.requestSubtitleBurnInFallback = null;
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		let fallbackPromise;
		act(() => {
			fallbackPromise = result.current.attemptSubtitleCompatibilityFallback({
				details: 'fragLoadError',
				fatal: true,
				response: {code: 500},
				frag: {url: '/Videos/item/master.m3u8?SubtitleMethod=Encode&SubtitleStreamIndex=4'}
			}, runtimeContext);
		});
		props.loadRequestIdRef.current += 1;
		stopped.resolve();
		await act(async () => {
			expect(await fallbackPromise).toBe(true);
		});

		expect(props.currentSubtitleTrackRef.current).toBe(4);
		expect(props.setCurrentSubtitleTrack).not.toHaveBeenCalled();
		expect(props.playbackOverrideRef.current).toBeNull();
		expect(props.loadVideoRef.current).not.toHaveBeenCalled();
	});

	it('commits one current no-subtitle restart', async () => {
		const {props} = createProps();
		props.handleStop.mockResolvedValue(undefined);
		props.loadVideoRef.current.mockResolvedValue({status: 'attached'});
		props.currentSubtitleTrackRef.current = 4;
		props.mediaSourceData = {
			Id: 'source-1',
			SupportsTranscoding: true,
			__safeSubtitleBurnInProfile: true,
			__debugSubtitlePolicy: {forceBurnIn: true, codec: 'pgssub'},
			MediaStreams: [{Type: 'Subtitle', Index: 4, Codec: 'pgssub'}]
		};
		const runtimeContext = createPlaybackRuntimeContext({
			generation: 3,
			itemId: 'item-1',
			mediaSourceData: props.mediaSourceData
		});
		props.playbackRuntimeContextRef.current = runtimeContext;
		props.requestSubtitleBurnInFallback = null;
		const {result} = renderHook(() => usePlayerRecoveryHandlers(props));

		await act(async () => {
			expect(await result.current.attemptSubtitleCompatibilityFallback({
				details: 'fragLoadError',
				fatal: true,
				response: {code: 500},
				frag: {url: '/Videos/item/master.m3u8?SubtitleMethod=Encode&SubtitleStreamIndex=4'}
			}, runtimeContext)).toBe(true);
		});

		expect(props.currentSubtitleTrackRef.current).toBe(-1);
		expect(props.setCurrentSubtitleTrack).toHaveBeenCalledWith(-1);
		expect(props.playbackOverrideRef.current).toEqual(expect.objectContaining({
			subtitleFallbackConsent: 'no-subtitles',
			subtitleStreamIndex: -1
		}));
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

	it('reports an exhausted initial transcode fragment failure as a server startup failure', async () => {
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

		await act(async () => {
			expect(await result.current.attemptHlsFatalRecovery(
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
