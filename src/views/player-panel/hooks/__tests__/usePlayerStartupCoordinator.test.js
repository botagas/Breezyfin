import {act, renderHook, waitFor} from '@testing-library/react';

import {usePlayerStartupCoordinator} from '../usePlayerStartupCoordinator';
import {
	PLAYER_PLAYBACK_START_TIMEOUT_MS,
	PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS,
	getPlayerStartupState,
	isInterruptedPlaybackStartError
} from '../../utils/playerStartupState';
import {
	createNativePlaybackSourceToken,
	createPlaybackRuntimeContext
} from '../../utils/playbackRuntimeContext';
import {createSyncPlayStartupBridge} from '../../utils/syncPlayStartupBridge';

const createDeferred = () => {
	let resolve;
	let reject;
	const promise = new Promise((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return {promise, resolve, reject};
};

const createCoordinatorProps = ({syncPlayStartupBridge = createSyncPlayStartupBridge()} = {}) => {
	const video = document.createElement('video');
	video.play = jest.fn().mockResolvedValue(undefined);
	const runtimeContext = createPlaybackRuntimeContext({
		generation: 1,
		itemId: 'item-1',
		mediaSourceData: {Id: 'source-1'},
		playMethod: 'DirectPlay'
	});
	const sourceToken = createNativePlaybackSourceToken({
		runtimeContext,
		video,
		sourceUrl: 'video.mkv'
	});
	return {
		video,
		sourceToken,
		props: {
			item: {Id: 'item-1'},
			playbackGeneration: 1,
			videoRef: {current: video},
			nativeSourceTokenRef: {current: sourceToken},
			playbackRuntimeContextRef: {current: runtimeContext},
			playbackGenerationRef: {current: 1},
			currentSubtitleTrack: -1,
			subtitleRendererPolicy: null,
			subtitleRendererState: null,
			exitInProgressRef: {current: false},
			playbackStartedRef: {current: false},
			playbackOverrideRef: {current: null},
			pendingOverrideClearRef: {current: false},
			startupDeadlineTimerRef: {current: null},
			reportPlaybackStartedOnce: jest.fn().mockResolvedValue(true),
			startProgressReporting: jest.fn(),
			syncPlayStartupBridge,
			appendPlaybackDiagnostic: jest.fn(),
			setLoading: jest.fn(),
			setLoadingStatusMessage: jest.fn(),
			setPlaying: jest.fn(),
			setToastMessage: jest.fn(),
			showPlaybackError: jest.fn(),
			attemptTranscodeFallback: jest.fn().mockResolvedValue(false),
			isCurrentTranscoding: false,
			onSubtitleTimeout: jest.fn()
		}
	};
};

describe('usePlayerStartupCoordinator state', () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it('recognizes stale browser play interruptions without hiding real failures', () => {
		expect(isInterruptedPlaybackStartError({name: 'AbortError'})).toBe(true);
		expect(isInterruptedPlaybackStartError(new Error('The play() request was interrupted because the media was removed from the document.'))).toBe(true);
		expect(isInterruptedPlaybackStartError(new Error('NotSupportedError: format is unsupported'))).toBe(false);
	});

	it('waits for source assignment before evaluating subtitle readiness', () => {
		expect(getPlayerStartupState({
			sourceAttached: false,
			currentSubtitleTrack: 2,
			subtitleRendererPolicy: {clientRender: true},
			subtitleRendererStatus: 'ready'
		})).toBe('waiting-source');
	});

	it('waits for a selected client renderer but starts native and subtitle-off paths', () => {
		expect(getPlayerStartupState({
			sourceAttached: true,
			currentSubtitleTrack: 2,
			subtitleRendererPolicy: {clientRender: true},
			subtitleRendererStatus: 'loading'
		})).toBe('waiting-subtitles');
		expect(getPlayerStartupState({sourceAttached: true, currentSubtitleTrack: -1})).toBe('starting');
		expect(getPlayerStartupState({
			sourceAttached: true,
			currentSubtitleTrack: 2,
			subtitleRendererPolicy: {clientRender: false},
			subtitleRendererStatus: 'loading'
		})).toBe('starting');
	});

	it('reports starting, failed, and timed-out client renderer states explicitly', () => {
		const baseState = {
			sourceAttached: true,
			currentSubtitleTrack: 2,
			subtitleRendererPolicy: {clientRender: true}
		};
		expect(getPlayerStartupState({...baseState, subtitleRendererStatus: 'ready'})).toBe('starting');
		expect(getPlayerStartupState({...baseState, subtitleRendererStatus: 'fetch-failed'})).toBe('failed');
		expect(getPlayerStartupState({...baseState, subtitleRendererStatus: 'timed-out'})).toBe('timed-out');
		expect(PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS).toBe(15000);
		expect(PLAYER_PLAYBACK_START_TIMEOUT_MS).toBe(12000);
	});

	it('requests normal playback after source assignment without waiting for canplay', async () => {
		const view = createCoordinatorProps();
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken);
		});

		await waitFor(() => expect(view.video.play).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(result.current.status).toBe('started'));
		expect(view.props.reportPlaybackStartedOnce).toHaveBeenCalledTimes(1);
		expect(view.props.startProgressReporting).toHaveBeenCalledTimes(1);
	});

	it('keeps client-rendered subtitles as the only readiness gate before play', async () => {
		const view = createCoordinatorProps();
		view.props.currentSubtitleTrack = 2;
		view.props.subtitleRendererPolicy = {clientRender: true};
		view.props.subtitleRendererState = {status: 'loading'};
		const {result, rerender} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken);
		});
		await waitFor(() => expect(result.current.status).toBe('waiting-subtitles'));
		expect(view.video.play).not.toHaveBeenCalled();

		view.props.subtitleRendererState = {status: 'ready'};
		rerender();
		await waitFor(() => expect(view.video.play).toHaveBeenCalledTimes(1));
	});

	it('accepts playback evidence while play is pending and ignores its late rejection', async () => {
		const deferredPlay = createDeferred();
		const view = createCoordinatorProps();
		view.video.play.mockReturnValue(deferredPlay.promise);
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken);
		});
		await waitFor(() => expect(view.video.play).toHaveBeenCalledTimes(1));

		act(() => {
			result.current.reportPlaybackEvidence('playing-event', view.sourceToken);
		});
		expect(view.props.reportPlaybackStartedOnce).toHaveBeenCalledTimes(1);
		expect(view.props.startProgressReporting).toHaveBeenCalledTimes(1);

		await act(async () => {
			deferredPlay.reject(new Error('late failure'));
			await Promise.resolve();
		});
		expect(view.props.showPlaybackError).not.toHaveBeenCalled();
		expect(view.props.attemptTranscodeFallback).not.toHaveBeenCalled();
	});

	it('uses one post-play deadline before attempting DirectPlay fallback', async () => {
		jest.useFakeTimers();
		const deferredPlay = createDeferred();
		const view = createCoordinatorProps();
		view.video.play.mockReturnValue(deferredPlay.promise);
		view.props.attemptTranscodeFallback.mockResolvedValue(true);
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken);
		});
		await act(async () => {
			await Promise.resolve();
		});
		expect(view.video.play).toHaveBeenCalledTimes(1);

		await act(async () => {
			jest.advanceTimersByTime(PLAYER_PLAYBACK_START_TIMEOUT_MS);
			await Promise.resolve();
		});
		expect(view.props.attemptTranscodeFallback).toHaveBeenCalledTimes(1);
		expect(view.props.attemptTranscodeFallback).toHaveBeenCalledWith('startup-no-progress');
		expect(view.props.showPlaybackError).not.toHaveBeenCalled();
	});

	it('waits for authoritative SyncPlay start and completes playback exactly once', async () => {
		const syncPlayStartupBridge = createSyncPlayStartupBridge();
		const reportVideoReady = jest.fn().mockResolvedValue(true);
		syncPlayStartupBridge.registerSyncPlayHandlers({
			shouldBlockAutomaticStart: () => true,
			reportVideoReady
		});
		const view = createCoordinatorProps({syncPlayStartupBridge});
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken);
		});
		await waitFor(() => expect(result.current.status).toBe('waiting-syncplay'));
		expect(reportVideoReady).toHaveBeenCalledTimes(1);
		expect(view.video.play).not.toHaveBeenCalled();

		await act(async () => {
			await expect(syncPlayStartupBridge.startAuthoritativePlayback()).resolves.toBe(true);
			await expect(syncPlayStartupBridge.startAuthoritativePlayback()).resolves.toBe(false);
		});

		expect(view.video.play).toHaveBeenCalledTimes(1);
		expect(view.props.reportPlaybackStartedOnce).toHaveBeenCalledTimes(1);
		expect(view.props.startProgressReporting).toHaveBeenCalledTimes(1);
	});
});
