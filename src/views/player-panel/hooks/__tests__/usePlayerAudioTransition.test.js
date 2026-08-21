import {act, renderHook} from '@testing-library/react';

import {
	AUDIO_TRANSITION_PROGRESS_BARRIER_TIMEOUT_MS,
	usePlayerAudioTransition
} from '../usePlayerAudioTransition';

const createDeferred = () => {
	let resolve;
	let reject;
	const promise = new Promise((next, fail) => {
		resolve = next;
		reject = fail;
	});
	return {promise, resolve, reject};
};

const createProps = () => {
	const video = {
		currentTime: 42,
		paused: false,
		ended: false,
		pause: jest.fn(() => {
			video.paused = true;
		})
	};
	const props = {
		itemId: 'item-1',
		videoRef: {current: video},
		playbackOptions: {},
		playbackOverrideRef: {current: null},
		playbackGenerationRef: {current: 3},
		loadRequestIdRef: {current: 1},
		nativeSourceTokenRef: {current: {itemId: 'item-1', generation: 3}},
		exitInProgressRef: {current: false},
		mediaSourceData: {Id: 'source-1'},
		currentAudioTrack: 1,
		currentSubtitleTrack: 4,
		audioTracks: [{Index: 1}, {Index: 2}],
		subtitleTracks: [{Index: 4, Codec: 'ass'}],
		playbackSessionRef: {current: {playSessionId: 'session-1'}},
		preparePlaybackPlan: jest.fn().mockResolvedValue({
			mediaSource: {},
			session: {playSessionId: 'session-2'},
			tracks: {audio: [], selectedAudioStreamIndex: 2},
			decision: {required: null}
		}),
		requestPlaybackDecision: jest.fn().mockResolvedValue(true),
		loadVideo: null,
		captureSourceDescriptor: jest.fn(() => ({url: 'old-source', playMethod: 'DirectPlay'})),
		restorePlaybackSnapshot: jest.fn().mockResolvedValue(true),
		reportPlaybackProgressNow: jest.fn().mockResolvedValue(true),
		reportPlaybackSessionStopped: jest.fn().mockResolvedValue(true),
		saveAudioSelection: jest.fn(),
		setCurrentAudioTrack: jest.fn(),
		setToastMessage: jest.fn(),
		dismissToast: jest.fn(),
		appendPlaybackDiagnostic: jest.fn(),
		onTerminalFailure: jest.fn()
	};
	props.loadVideo = jest.fn().mockImplementation((force, retry, options) => {
		const sourceToken = {
			itemId: 'item-1',
			generation: 4,
			runtimeContext: {audioTransition: {id: options.transitionId}}
		};
		props.nativeSourceTokenRef.current = sourceToken;
		props.playbackSessionRef.current = {playSessionId: 'session-2'};
		return Promise.resolve({status: 'attached', sourceToken});
	});
	return props;
};

describe('usePlayerAudioTransition', () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it('continues after the paused progress barrier reaches its deadline', async () => {
		jest.useFakeTimers();
		const props = createProps();
		const progress = createDeferred();
		props.reportPlaybackProgressNow.mockReturnValue(progress.promise);
		const {result} = renderHook(() => usePlayerAudioTransition(props));
		let transition;

		await act(async () => {
			transition = result.current.requestAudioTransition(2);
			await Promise.resolve();
		});

		expect(props.setToastMessage).toHaveBeenCalledWith(expect.objectContaining({
			key: 'audio-track-switch',
			persistent: true
		}));
		expect(props.preparePlaybackPlan).not.toHaveBeenCalled();

		await act(async () => {
			jest.advanceTimersByTime(AUDIO_TRANSITION_PROGRESS_BARRIER_TIMEOUT_MS);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(props.preparePlaybackPlan).toHaveBeenCalledTimes(1);
		expect(props.appendPlaybackDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
			stage: 'paused-progress-barrier',
			reason: 'report-timeout'
		}));
		const transitionId = props.loadVideo.mock.calls[0][2].transitionId;
		await act(async () => {
			result.current.handleAudioTransitionReady({
				runtimeContext: {audioTransition: {id: transitionId}}
			});
			await transition;
		});
	});

	it('cancels the paused progress barrier without preparing playback', async () => {
		jest.useFakeTimers();
		const props = createProps();
		props.reportPlaybackProgressNow.mockReturnValue(createDeferred().promise);
		const {result} = renderHook(() => usePlayerAudioTransition(props));
		let transition;

		await act(async () => {
			transition = result.current.requestAudioTransition(2);
			await Promise.resolve();
		});
		act(() => result.current.cancelAudioTransition());
		await act(async () => {
			await transition;
		});

		expect(props.preparePlaybackPlan).not.toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);
	});

	it('prepares before committing and updates selection only after startup readiness', async () => {
		const props = createProps();
		const preparation = createDeferred();
		props.preparePlaybackPlan.mockReturnValue(preparation.promise);
		const {result} = renderHook(() => usePlayerAudioTransition(props));
		let transition;

		await act(async () => {
			transition = result.current.requestAudioTransition(2);
			await Promise.resolve();
		});

		expect(props.videoRef.current.pause).toHaveBeenCalledTimes(1);
		expect(props.loadVideo).not.toHaveBeenCalled();
		expect(props.setCurrentAudioTrack).not.toHaveBeenCalled();

		await act(async () => {
			preparation.resolve({
				mediaSource: {},
				session: {playSessionId: 'session-2'},
				tracks: {audio: [], selectedAudioStreamIndex: 2},
				decision: {required: null}
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const transitionId = props.loadVideo.mock.calls[0][2].transitionId;
		await act(async () => {
			result.current.handleAudioTransitionReady({
				runtimeContext: {audioTransition: {id: transitionId}}
			});
			await transition;
		});

		expect(props.setCurrentAudioTrack).toHaveBeenCalledWith(2);
		expect(props.saveAudioSelection).toHaveBeenCalledWith(2, props.audioTracks);
		expect(props.reportPlaybackSessionStopped).toHaveBeenCalledWith({
			itemId: 'item-1',
			positionTicks: 420000000,
			session: {playSessionId: 'session-1'}
		});
		expect(props.restorePlaybackSnapshot).not.toHaveBeenCalled();
	});

	it('keeps the previous source attached when preparation fails', async () => {
		const props = createProps();
		props.preparePlaybackPlan.mockRejectedValue(new Error('negotiation failed'));
		const {result} = renderHook(() => usePlayerAudioTransition(props));

		await act(async () => {
			await result.current.requestAudioTransition(2);
		});

		expect(props.loadVideo).not.toHaveBeenCalled();
		expect(props.restorePlaybackSnapshot).not.toHaveBeenCalled();
		expect(props.setCurrentAudioTrack).not.toHaveBeenCalled();
		expect(props.setToastMessage).toHaveBeenLastCalledWith(expect.objectContaining({
			message: expect.stringContaining('Previous track restored')
		}));
	});

	it('cancels deferred preparation when the active item changes', async () => {
		const props = createProps();
		const preparation = createDeferred();
		props.preparePlaybackPlan.mockReturnValue(preparation.promise);
		const {result, rerender} = renderHook(() => usePlayerAudioTransition(props));

		let transition;
		await act(async () => {
			transition = result.current.requestAudioTransition(2);
			await Promise.resolve();
		});
		props.itemId = 'item-2';
		rerender();

		await act(async () => {
			preparation.resolve({
				mediaSource: {},
				session: {playSessionId: 'session-2'},
				tracks: {audio: [], selectedAudioStreamIndex: 2},
				decision: {required: null}
			});
			await transition;
		});

		expect(props.loadVideo).not.toHaveBeenCalled();
		expect(props.reportPlaybackSessionStopped).toHaveBeenCalledWith(expect.objectContaining({
			session: {playSessionId: 'session-2'}
		}));
		expect(result.current.active).toBe(false);
	});

	it('uses the authoritative SyncPlay position when preparing a replacement', async () => {
		const props = createProps();
		props.resolveTransitionPosition = jest.fn(() => 55);
		const {result} = renderHook(() => usePlayerAudioTransition(props));
		let transition;

		await act(async () => {
			transition = result.current.requestAudioTransition(2);
			await Promise.resolve();
			await Promise.resolve();
		});
		const preparedOverride = props.preparePlaybackPlan.mock.calls[0][0].playbackOverride;
		expect(preparedOverride.seekSeconds).toBe(55);
		expect(preparedOverride.audioTransition.seekSeconds).toBe(55);

		const transitionId = props.loadVideo.mock.calls[0][2].transitionId;
		await act(async () => {
			result.current.handleAudioTransitionReady({
				runtimeContext: {audioTransition: {id: transitionId}}
			});
			await transition;
		});
	});

	it('queues a prepared playback decision without replacing the active source', async () => {
		const props = createProps();
		props.preparePlaybackPlan.mockResolvedValue({
			mediaSource: {Id: 'source-2'},
			session: {playSessionId: 'session-2'},
			tracks: {audio: [], selectedAudioStreamIndex: 2},
			decision: {
				required: {type: 'dynamic-range-fallback', proposedRange: 'sdr'}
			}
		});
		const {result} = renderHook(() => usePlayerAudioTransition(props));

		await act(async () => {
			await result.current.requestAudioTransition(2);
		});

		expect(props.loadVideo).not.toHaveBeenCalled();
		expect(props.reportPlaybackSessionStopped).toHaveBeenCalledWith(expect.objectContaining({
			session: {playSessionId: 'session-2'}
		}));
		expect(props.requestPlaybackDecision).toHaveBeenCalledWith(expect.objectContaining({
			type: 'dynamic-range-fallback',
			audioStreamIndex: 2,
			pendingAudioSelection: true,
			generation: 3,
			mediaSourceId: 'source-2',
			resumeTicks: 420000000,
			runtime: false
		}));
	});

	it('rolls a committed replacement back to the previous source and leaves it paused', async () => {
		const props = createProps();
		const {result} = renderHook(() => usePlayerAudioTransition(props));
		let transition;

		await act(async () => {
			transition = result.current.requestAudioTransition(2);
			await Promise.resolve();
			await Promise.resolve();
		});
		const transitionId = props.loadVideo.mock.calls[0][2].transitionId;
		await act(async () => {
			result.current.handleAudioTransitionFailed({
				runtimeContext: {audioTransition: {id: transitionId}}
			}, 'replacement-failed');
			await Promise.resolve();
		});
		expect(props.restorePlaybackSnapshot).toHaveBeenCalledWith(
			expect.objectContaining({
				currentAudioTrack: 1,
				position: 42,
				subtitleTracks: props.subtitleTracks
			}),
			transitionId
		);

		await act(async () => {
			result.current.handleAudioTransitionReady({
				runtimeContext: {audioTransition: {id: transitionId, rollback: true}}
			});
			await transition;
		});

		expect(props.setCurrentAudioTrack).not.toHaveBeenCalled();
		expect(props.reportPlaybackSessionStopped).toHaveBeenCalledWith({
			itemId: 'item-1',
			positionTicks: 420000000,
			session: {playSessionId: 'session-2'}
		});
		expect(props.reportPlaybackSessionStopped).not.toHaveBeenCalledWith(expect.objectContaining({
			session: {playSessionId: 'session-1'}
		}));
		expect(props.onTerminalFailure).not.toHaveBeenCalled();
		expect(props.setToastMessage).toHaveBeenLastCalledWith(expect.objectContaining({
			message: expect.stringContaining('Previous track restored')
		}));
	});

	it('queues the captured old session for closure when cancelled after swapping', async () => {
		const props = createProps();
		const {result} = renderHook(() => usePlayerAudioTransition(props));
		let transition;

		await act(async () => {
			transition = result.current.requestAudioTransition(2);
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(props.loadVideo).toHaveBeenCalledTimes(1);

		act(() => result.current.cancelAudioTransition());
		await act(async () => {
			await transition;
		});

		expect(props.reportPlaybackSessionStopped).toHaveBeenCalledWith({
			itemId: 'item-1',
			positionTicks: 420000000,
			session: {playSessionId: 'session-1'}
		});
	});

	it('closes an unused replacement session when cancelled before source attachment', async () => {
		const props = createProps();
		const attachment = createDeferred();
		props.loadVideo.mockReturnValue(attachment.promise);
		const {result} = renderHook(() => usePlayerAudioTransition(props));
		let transition;

		await act(async () => {
			transition = result.current.requestAudioTransition(2);
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(props.loadVideo).toHaveBeenCalledTimes(1);
		act(() => result.current.cancelAudioTransition());
		await act(async () => {
			attachment.resolve({status: 'stale', reason: 'cancelled'});
			await transition;
		});

		expect(props.reportPlaybackSessionStopped).toHaveBeenCalledWith({
			itemId: 'item-1',
			positionTicks: 420000000,
			session: {playSessionId: 'session-2'}
		});
		expect(props.reportPlaybackSessionStopped).not.toHaveBeenCalledWith(expect.objectContaining({
			session: {playSessionId: 'session-1'}
		}));
	});

	it('does not stop an ambiguous session reused by the replacement', async () => {
		const props = createProps();
		props.preparePlaybackPlan.mockResolvedValue({
			mediaSource: {},
			session: {playSessionId: 'session-1'},
			tracks: {audio: [], selectedAudioStreamIndex: 2},
			decision: {required: null}
		});
		props.loadVideo.mockImplementation((force, retry, options) => {
			const sourceToken = {
				itemId: 'item-1',
				generation: 4,
				runtimeContext: {audioTransition: {id: options.transitionId}}
			};
			props.nativeSourceTokenRef.current = sourceToken;
			return Promise.resolve({status: 'attached', sourceToken});
		});
		const {result} = renderHook(() => usePlayerAudioTransition(props));
		let transition;

		await act(async () => {
			transition = result.current.requestAudioTransition(2);
			await Promise.resolve();
			await Promise.resolve();
		});
		const transitionId = props.loadVideo.mock.calls[0][2].transitionId;
		await act(async () => {
			result.current.handleAudioTransitionReady({
				runtimeContext: {audioTransition: {id: transitionId}}
			});
			await transition;
		});

		expect(props.reportPlaybackSessionStopped).not.toHaveBeenCalled();
	});
});
