import {act, renderHook, waitFor} from '@testing-library/react';

import {usePlayerStartupCoordinator} from '../usePlayerStartupCoordinator';
import {
	PLAYER_PLAYBACK_START_TIMEOUT_MS,
	PLAYER_HLS_ENGINE_STARTUP_TIMEOUT_MS,
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

const configureClientSubtitleSource = (
	view,
	subtitleRendererState = {status: 'loading'}
) => {
	const runtimeContext = createPlaybackRuntimeContext({
		generation: 1,
		itemId: 'item-1',
		mediaSourceData: {Id: 'source-1'},
		playMethod: 'DirectPlay',
		subtitlePolicy: {clientRender: true},
		selectedSubtitleTrack: 2
	});
	view.sourceToken = createNativePlaybackSourceToken({
		runtimeContext,
		video: view.video,
		sourceUrl: 'video.mkv'
	});
	view.props.playbackRuntimeContextRef.current = runtimeContext;
	view.props.nativeSourceTokenRef.current = view.sourceToken;
	view.props.currentSubtitleTrack = 2;
	view.props.subtitleRendererPolicy = {clientRender: true};
	view.props.subtitleRendererState = subtitleRendererState;
	return view;
};

const markClientSubtitleReady = (view) => {
	view.props.subtitleRendererState = {
		status: 'ready',
		debug: {cacheKey: 'item-1:source-1:1:2'}
	};
};

const expectClientSubtitleGateThenStart = async ({view, result, rerender}) => {
	act(() => {
		result.current.registerPlaybackSource(view.sourceToken);
	});
	await waitFor(() => expect(result.current.status).toBe('waiting-subtitles'));
	expect(view.video.play).not.toHaveBeenCalled();

	markClientSubtitleReady(view);
	rerender();
	await waitFor(() => expect(view.video.play).toHaveBeenCalledTimes(1));
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
			audioSelectionReady: false,
			currentSubtitleTrack: -1
		})).toBe('waiting-audio');
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
		expect(getPlayerStartupState({
			...baseState,
			subtitleRendererStatus: 'ready',
			subtitleRendererReadyForSource: false
		})).toBe('waiting-subtitles');
		expect(getPlayerStartupState({...baseState, subtitleRendererStatus: 'fetch-failed'})).toBe('failed');
		expect(getPlayerStartupState({...baseState, subtitleRendererStatus: 'timed-out'})).toBe('timed-out');
		expect(PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS).toBe(15000);
		expect(PLAYER_PLAYBACK_START_TIMEOUT_MS).toBe(12000);
		expect(PLAYER_HLS_ENGINE_STARTUP_TIMEOUT_MS).toBe(30000);
	});

	it('waits for HLS.js engine readiness before requesting playback', async () => {
		const view = createCoordinatorProps();
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken, {engineReady: false});
		});
		await waitFor(() => expect(result.current.status).toBe('waiting-engine'));
		expect(view.video.play).not.toHaveBeenCalled();

		act(() => {
			result.current.reportPlaybackEngineReady(
				view.sourceToken,
				'first-fragment-buffered'
			);
		});
		await waitFor(() => expect(view.video.play).toHaveBeenCalledTimes(1));
	});

	it('applies an explicit native audio selection before initial playback', async () => {
		const view = createCoordinatorProps();
		const nativeTracks = [
			{language: 'en', label: 'English', enabled: true},
			{language: 'ja', label: 'Japanese', enabled: false}
		];
		nativeTracks.addEventListener = jest.fn();
		nativeTracks.removeEventListener = jest.fn();
		Object.defineProperty(view.video, 'audioTracks', {
			configurable: true,
			value: nativeTracks
		});
		const runtimeContext = createPlaybackRuntimeContext({
			generation: 1,
			itemId: 'item-1',
			mediaSourceData: {
				Id: 'source-1',
				MediaStreams: [
					{Type: 'Audio', Index: 1, Language: 'eng'},
					{Type: 'Audio', Index: 2, Language: 'jpn'}
				]
			},
			playMethod: 'DirectPlay',
			selectedAudioTrack: 2,
			requiresInitialNativeAudioSelection: true
		});
		view.sourceToken = createNativePlaybackSourceToken({
			runtimeContext,
			video: view.video,
			sourceUrl: 'video.mkv'
		});
		view.props.playbackRuntimeContextRef.current = runtimeContext;
		view.props.nativeSourceTokenRef.current = view.sourceToken;
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken);
		});

		await waitFor(() => expect(view.video.play).toHaveBeenCalledTimes(1));
		expect(nativeTracks[0].enabled).toBe(false);
		expect(nativeTracks[1].enabled).toBe(true);
		expect(view.props.onInitialAudioSelectionFallback).toBeUndefined();
	});

	it('restores the audio replacement position before releasing a paused transition', async () => {
		const view = createCoordinatorProps();
		let readyState = 0;
		Object.defineProperty(view.video, 'readyState', {
			configurable: true,
			get: () => readyState
		});
		const runtimeContext = createPlaybackRuntimeContext({
			generation: 1,
			itemId: 'item-1',
			mediaSourceData: {Id: 'source-1'},
			playMethod: 'DirectStream',
			audioTransition: {id: 'audio-1', startPaused: true, seekSeconds: 42}
		});
		view.sourceToken = createNativePlaybackSourceToken({
			runtimeContext,
			video: view.video,
			sourceUrl: 'video.mkv'
		});
		view.props.playbackRuntimeContextRef.current = runtimeContext;
		view.props.nativeSourceTokenRef.current = view.sourceToken;
		view.props.onAudioTransitionReady = jest.fn();
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken);
		});
		await waitFor(() => expect(result.current.status).toBe('waiting-audio'));
		expect(view.props.onAudioTransitionReady).not.toHaveBeenCalled();

		act(() => {
			readyState = 1;
			view.video.dispatchEvent(new Event('loadedmetadata'));
		});

		await waitFor(() => expect(view.props.onAudioTransitionReady).toHaveBeenCalledWith(
			view.sourceToken,
			{started: false}
		));
		expect(view.video.currentTime).toBe(42);
		expect(view.video.play).not.toHaveBeenCalled();
	});

	it('restores a non-default native audio track and position before completing rollback', async () => {
		const view = createCoordinatorProps();
		let readyState = 0;
		Object.defineProperty(view.video, 'readyState', {
			configurable: true,
			get: () => readyState
		});
		const nativeTracks = [
			{language: 'en', label: 'English', enabled: true},
			{language: 'ja', label: 'Japanese', enabled: false}
		];
		nativeTracks.addEventListener = jest.fn();
		nativeTracks.removeEventListener = jest.fn();
		Object.defineProperty(view.video, 'audioTracks', {
			configurable: true,
			value: nativeTracks
		});
		const runtimeContext = createPlaybackRuntimeContext({
			generation: 1,
			itemId: 'item-1',
			mediaSourceData: {
				Id: 'source-1',
				MediaStreams: [
					{Type: 'Audio', Index: 1, Language: 'eng'},
					{Type: 'Audio', Index: 2, Language: 'jpn'}
				]
			},
			playMethod: 'DirectPlay',
			selectedAudioTrack: 2,
			requiresInitialNativeAudioSelection: true,
			audioTransition: {id: 'audio-1', startPaused: true, rollback: true, seekSeconds: 42}
		});
		view.sourceToken = createNativePlaybackSourceToken({
			runtimeContext,
			video: view.video,
			sourceUrl: 'video.mkv'
		});
		view.props.playbackRuntimeContextRef.current = runtimeContext;
		view.props.nativeSourceTokenRef.current = view.sourceToken;
		view.props.onAudioTransitionReady = jest.fn();
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => result.current.registerPlaybackSource(view.sourceToken));
		await waitFor(() => expect(result.current.status).toBe('waiting-audio'));
		act(() => {
			readyState = 1;
			view.video.dispatchEvent(new Event('loadedmetadata'));
		});

		await waitFor(() => expect(view.props.onAudioTransitionReady).toHaveBeenCalled());
		expect(view.video.currentTime).toBe(42);
		expect(nativeTracks[0].enabled).toBe(false);
		expect(nativeTracks[1].enabled).toBe(true);
		expect(view.video.play).not.toHaveBeenCalled();
	});

	it('fails an active audio transition before attempting generic startup recovery', async () => {
		const view = createCoordinatorProps();
		const error = new Error('codec not supported');
		error.name = 'NotSupportedError';
		view.video.play.mockRejectedValue(error);
		view.props.onAudioTransitionFailed = jest.fn().mockResolvedValue(true);
		view.sourceToken = Object.freeze({
			...view.sourceToken,
			runtimeContext: Object.freeze({
				...view.sourceToken.runtimeContext,
				audioTransition: Object.freeze({id: 'audio-1'})
			})
		});
		view.props.nativeSourceTokenRef.current = view.sourceToken;
		view.props.playbackRuntimeContextRef.current = view.sourceToken.runtimeContext;
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => result.current.registerPlaybackSource(view.sourceToken));
		await waitFor(() => expect(view.props.onAudioTransitionFailed).toHaveBeenCalledWith(
			view.sourceToken,
			'Format not supported'
		));
		expect(view.props.attemptTranscodeFallback).not.toHaveBeenCalled();
	});

	it('rejects playback evidence and direct start requests before engine readiness', async () => {
		const view = createCoordinatorProps();
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken, {engineReady: false});
		});
		await waitFor(() => expect(result.current.status).toBe('waiting-engine'));

		await act(async () => {
			expect(result.current.reportPlaybackEvidence(
				'playing-event',
				view.sourceToken
			)).toBe(false);
			await expect(result.current.requestPlaybackStart()).resolves.toBe(false);
		});

		expect(view.video.play).not.toHaveBeenCalled();
		expect(view.props.reportPlaybackStartedOnce).not.toHaveBeenCalled();
	});

	it('identifies server subtitle transcode preparation while HLS.js is bootstrapping', async () => {
		const view = createCoordinatorProps();
		view.sourceToken = Object.freeze({
			...view.sourceToken,
			engine: 'hls.js',
			serverBurnIn: true
		});
		view.props.nativeSourceTokenRef.current = view.sourceToken;
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken, {engineReady: false});
		});

		await waitFor(() => {
			expect(view.props.setLoadingStatusMessage).toHaveBeenCalledWith(
				'Preparing server subtitle transcode...'
			);
		});
		expect(view.video.play).not.toHaveBeenCalled();
	});

	it('keeps client subtitle readiness independent from HLS engine readiness', async () => {
		const view = configureClientSubtitleSource(createCoordinatorProps());
		const {result, rerender} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken, {engineReady: false});
		});
		act(() => {
			result.current.reportPlaybackEngineReady(
				view.sourceToken,
				'first-fragment-buffered'
			);
		});
		await waitFor(() => expect(result.current.status).toBe('waiting-subtitles'));
		expect(view.video.play).not.toHaveBeenCalled();

		markClientSubtitleReady(view);
		rerender();
		await waitFor(() => expect(view.video.play).toHaveBeenCalledTimes(1));
	});

	it('does not let a previous source renderer satisfy the new subtitle gate', async () => {
		const view = configureClientSubtitleSource(createCoordinatorProps(), {
			status: 'ready',
			debug: {cacheKey: 'old-item:old-source:0:2'}
		});
		const {result, rerender} = renderHook(() => usePlayerStartupCoordinator(view.props));

		await expectClientSubtitleGateThenStart({view, result, rerender});
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
		const view = configureClientSubtitleSource(createCoordinatorProps());
		const {result, rerender} = renderHook(() => usePlayerStartupCoordinator(view.props));

		await expectClientSubtitleGateThenStart({view, result, rerender});
	});

	it('rejects authoritative start requests while client subtitles are pending', async () => {
		const syncPlayStartupBridge = createSyncPlayStartupBridge();
		syncPlayStartupBridge.registerSyncPlayHandlers({
			shouldBlockAutomaticStart: () => true,
			reportVideoReady: jest.fn().mockResolvedValue(true)
		});
		const view = configureClientSubtitleSource(
			createCoordinatorProps({syncPlayStartupBridge})
		);
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken);
		});
		await waitFor(() => expect(result.current.status).toBe('waiting-subtitles'));

		await act(async () => {
			await expect(syncPlayStartupBridge.startAuthoritativePlayback()).resolves.toBe(false);
		});

		expect(view.video.play).not.toHaveBeenCalled();
		expect(view.props.reportPlaybackStartedOnce).not.toHaveBeenCalled();
	});

	it('keeps one subtitle deadline when engine readiness rerenders startup', async () => {
		jest.useFakeTimers();
		const view = configureClientSubtitleSource(createCoordinatorProps());
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken, {engineReady: false});
		});
		await act(async () => {
			jest.advanceTimersByTime(10000);
			await Promise.resolve();
		});
		expect(view.props.onSubtitleTimeout).not.toHaveBeenCalled();

		act(() => {
			result.current.reportPlaybackEngineReady(
				view.sourceToken,
				'first-fragment-buffered'
			);
		});
		await act(async () => {
			jest.advanceTimersByTime(PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS - 10000);
			await Promise.resolve();
		});

		expect(view.props.onSubtitleTimeout).toHaveBeenCalledTimes(1);
		expect(view.video.play).not.toHaveBeenCalled();
	});

	it('cancels the subtitle deadline when renderer preparation fails explicitly', async () => {
		jest.useFakeTimers();
		const view = configureClientSubtitleSource(createCoordinatorProps());
		const {result, rerender} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken);
		});
		await act(async () => {
			jest.advanceTimersByTime(10000);
			await Promise.resolve();
		});

		view.props.subtitleRendererState = {status: 'fetch-failed'};
		rerender();
		await act(async () => {
			jest.advanceTimersByTime(PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS);
			await Promise.resolve();
		});

		expect(view.props.onSubtitleTimeout).not.toHaveBeenCalled();
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

	it('contains rejected DirectPlay fallback requests and shows one terminal error', async () => {
		jest.useFakeTimers();
		const deferredPlay = createDeferred();
		const view = createCoordinatorProps();
		view.video.play.mockReturnValue(deferredPlay.promise);
		view.props.attemptTranscodeFallback.mockRejectedValue(new Error('fallback failed'));
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken);
		});
		await act(async () => {
			await Promise.resolve();
		});

		await act(async () => {
			jest.advanceTimersByTime(PLAYER_PLAYBACK_START_TIMEOUT_MS);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(view.props.attemptTranscodeFallback).toHaveBeenCalledTimes(1);
		expect(view.props.showPlaybackError).toHaveBeenCalledTimes(1);
		expect(view.props.showPlaybackError).toHaveBeenCalledWith(
			'The media did not begin loading or playing. Please retry or go back.',
			{detachMedia: true}
		);
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

	it('ignores playback evidence while SyncPlay is waiting for authoritative start', async () => {
		const syncPlayStartupBridge = createSyncPlayStartupBridge();
		syncPlayStartupBridge.registerSyncPlayHandlers({
			shouldBlockAutomaticStart: () => true,
			reportVideoReady: jest.fn().mockResolvedValue(true)
		});
		const view = createCoordinatorProps({syncPlayStartupBridge});
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken);
		});
		await waitFor(() => expect(result.current.status).toBe('waiting-syncplay'));

		act(() => {
			expect(result.current.reportPlaybackEvidence(
				'playing-event',
				view.sourceToken
			)).toBe(false);
		});

		expect(view.props.reportPlaybackStartedOnce).not.toHaveBeenCalled();
		expect(view.props.startProgressReporting).not.toHaveBeenCalled();
	});

	it('does not report SyncPlay ready before the HLS engine is ready', async () => {
		const syncPlayStartupBridge = createSyncPlayStartupBridge();
		const reportVideoReady = jest.fn().mockResolvedValue(true);
		syncPlayStartupBridge.registerSyncPlayHandlers({
			shouldBlockAutomaticStart: () => true,
			reportVideoReady
		});
		const view = createCoordinatorProps({syncPlayStartupBridge});
		const {result} = renderHook(() => usePlayerStartupCoordinator(view.props));

		act(() => {
			result.current.registerPlaybackSource(view.sourceToken, {engineReady: false});
		});
		await waitFor(() => expect(result.current.status).toBe('waiting-engine'));
		expect(reportVideoReady).not.toHaveBeenCalled();

		act(() => {
			result.current.reportPlaybackEngineReady(
				view.sourceToken,
				'first-fragment-buffered'
			);
		});
		await waitFor(() => expect(result.current.status).toBe('waiting-syncplay'));
		expect(reportVideoReady).toHaveBeenCalledTimes(1);
		expect(view.video.play).not.toHaveBeenCalled();
	});
});
