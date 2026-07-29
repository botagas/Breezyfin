import {useCallback, useEffect, useRef, useState} from 'react';

import {getPlaybackErrorMessage, isFatalPlaybackError} from '../../../utils/errorMessages';
import {
	PLAYER_PLAYBACK_START_TIMEOUT_MS,
	PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS,
	getPlayerStartupState,
	isInterruptedPlaybackStartError
} from '../utils/playerStartupState';
import {isNativePlaybackSourceTokenCurrent} from '../utils/playbackRuntimeContext';

export const usePlayerStartupCoordinator = ({
	videoRef,
	nativeSourceTokenRef,
	playbackRuntimeContextRef,
	playbackGenerationRef,
	currentSubtitleTrack,
	subtitleRendererPolicy,
	subtitleRendererState,
	exitInProgressRef,
	playbackStartedRef,
	playbackOverrideRef,
	pendingOverrideClearRef,
	startupDeadlineTimerRef,
	reportPlaybackStartedOnce,
	startProgressReporting,
	syncPlayStartupBridge,
	appendPlaybackDiagnostic,
	setLoading,
	setLoadingStatusMessage,
	setPlaying,
	setToastMessage,
	showPlaybackError,
	attemptTranscodeFallback,
	isCurrentTranscoding,
	onSubtitleTimeout
}) => {
	const [sourceVersion, setSourceVersion] = useState(0);
	const [status, setStatus] = useState('waiting-source');
	const sourceTokenRef = useRef(null);
	const engineReadyRef = useRef(false);
	const startupGatesReadyRef = useRef(false);
	const startInFlightRef = useRef(false);
	const startAttemptRef = useRef(0);
	const timeoutHandledRef = useRef(false);
	const syncPlayReadyRequestedRef = useRef(false);
	const subtitleDeadlineRef = useRef({key: '', timer: null});
	const subtitleTimeoutCallbackRef = useRef(onSubtitleTimeout);
	subtitleTimeoutCallbackRef.current = onSubtitleTimeout;

	const clearStartupDeadline = useCallback(() => {
		if (startupDeadlineTimerRef.current) {
			clearTimeout(startupDeadlineTimerRef.current);
			startupDeadlineTimerRef.current = null;
		}
	}, [startupDeadlineTimerRef]);

	const clearSubtitleDeadline = useCallback(() => {
		if (subtitleDeadlineRef.current.timer) {
			clearTimeout(subtitleDeadlineRef.current.timer);
		}
		subtitleDeadlineRef.current = {key: '', timer: null};
	}, []);

	const isTokenCurrent = useCallback((sourceToken = sourceTokenRef.current) => (
		isNativePlaybackSourceTokenCurrent({
			sourceToken,
			activeSourceToken: nativeSourceTokenRef.current,
			activeRuntimeContext: playbackRuntimeContextRef.current,
			generation: playbackGenerationRef.current,
			exitInProgress: exitInProgressRef.current
		})
	), [
		exitInProgressRef,
		nativeSourceTokenRef,
		playbackGenerationRef,
		playbackRuntimeContextRef
	]);

	const invalidatePlaybackSource = useCallback(() => {
		startAttemptRef.current += 1;
		startInFlightRef.current = false;
		sourceTokenRef.current = null;
		engineReadyRef.current = false;
		startupGatesReadyRef.current = false;
		clearStartupDeadline();
		clearSubtitleDeadline();
		setStatus('waiting-source');
		setSourceVersion((current) => current + 1);
	}, [clearStartupDeadline, clearSubtitleDeadline]);

	const registerPlaybackSource = useCallback((sourceToken, {engineReady = true} = {}) => {
		if (!sourceToken || exitInProgressRef.current) return false;
		sourceTokenRef.current = sourceToken;
		engineReadyRef.current = engineReady === true;
		startupGatesReadyRef.current = false;
		startAttemptRef.current += 1;
		startInFlightRef.current = false;
		timeoutHandledRef.current = false;
		syncPlayReadyRequestedRef.current = false;
		playbackStartedRef.current = false;
		clearStartupDeadline();
		clearSubtitleDeadline();
		setStatus(engineReady ? 'waiting-subtitles' : 'waiting-engine');
		setSourceVersion((current) => current + 1);
		appendPlaybackDiagnostic?.({
			scope: 'startup',
			stage: 'source-assigned',
			status: engineReady ? 'ready' : 'pending',
			reason: sourceToken.engine,
			message: `Playback source generation ${sourceToken.sourceGeneration || sourceToken.generation} is attached.`
		});
		return true;
	}, [
		appendPlaybackDiagnostic,
		clearStartupDeadline,
		clearSubtitleDeadline,
		exitInProgressRef,
		playbackStartedRef
	]);

	const reportPlaybackEngineReady = useCallback((
		sourceToken = sourceTokenRef.current,
		signal = 'engine-ready'
	) => {
		if (!isTokenCurrent(sourceToken) || engineReadyRef.current) return false;
		engineReadyRef.current = true;
		appendPlaybackDiagnostic?.({
			scope: 'startup',
			stage: 'engine-ready',
			status: 'ready',
			reason: signal,
			message: `Playback engine ${sourceToken.engine} is ready for source generation ${sourceToken.sourceGeneration || sourceToken.generation}.`
		});
		setSourceVersion((current) => current + 1);
		return true;
	}, [appendPlaybackDiagnostic, isTokenCurrent]);

	const commitPlaybackStarted = useCallback((signal = 'unknown', sourceToken = sourceTokenRef.current) => {
		if (
			!isTokenCurrent(sourceToken) ||
			!engineReadyRef.current ||
			!startInFlightRef.current ||
			playbackStartedRef.current
		) return false;
		playbackStartedRef.current = true;
		startInFlightRef.current = false;
		clearStartupDeadline();
		clearSubtitleDeadline();
		setStatus('started');
		setLoading(false);
		setPlaying(true);
		if (pendingOverrideClearRef.current) {
			playbackOverrideRef.current = null;
			pendingOverrideClearRef.current = false;
		}
		appendPlaybackDiagnostic?.({
			scope: 'startup',
			stage: 'confirmed',
			status: 'ready',
			reason: signal,
			message: `Playback startup confirmed by ${signal}.`
		});
		reportPlaybackStartedOnce();
		startProgressReporting();
		return true;
	}, [
		appendPlaybackDiagnostic,
		clearStartupDeadline,
		clearSubtitleDeadline,
		isTokenCurrent,
		pendingOverrideClearRef,
		playbackOverrideRef,
		playbackStartedRef,
		reportPlaybackStartedOnce,
		setLoading,
		setPlaying,
		startProgressReporting
	]);

	const attemptSafeTranscodeFallback = useCallback(async (reason) => {
		try {
			return await attemptTranscodeFallback(reason);
		} catch {
			appendPlaybackDiagnostic?.({
				scope: 'startup',
				stage: 'transcode-fallback',
				status: 'failed',
				reason: 'request-failed',
				message: 'The server transcoding retry could not be started.'
			});
			return false;
		}
	}, [appendPlaybackDiagnostic, attemptTranscodeFallback]);

	const handleStartupTimeout = useCallback(async (sourceToken, startAttempt) => {
		if (
			startAttemptRef.current !== startAttempt ||
			playbackStartedRef.current ||
			!isTokenCurrent(sourceToken)
		) return false;
		setStatus('timed-out');
		appendPlaybackDiagnostic?.({
			scope: 'startup',
			stage: 'timeout',
			status: 'failed',
			reason: 'startup-no-progress',
			message: 'Playback made no progress after the play request.'
		});
		if (!isCurrentTranscoding) {
			const didFallback = await attemptSafeTranscodeFallback('startup-no-progress');
			if (didFallback || !isTokenCurrent(sourceToken)) return didFallback;
		}
		showPlaybackError(
			'The media did not begin loading or playing. Please retry or go back.',
			{detachMedia: true}
		);
		return false;
	}, [
		appendPlaybackDiagnostic,
		attemptSafeTranscodeFallback,
		isCurrentTranscoding,
		isTokenCurrent,
		playbackStartedRef,
		showPlaybackError
	]);

	const requestPlaybackStart = useCallback(async () => {
		const sourceToken = sourceTokenRef.current;
		if (
			!isTokenCurrent(sourceToken) ||
			!engineReadyRef.current ||
			!startupGatesReadyRef.current ||
			playbackStartedRef.current ||
			startInFlightRef.current
		) return false;
		const video = sourceToken.video || videoRef.current;
		if (!video) return false;
		startInFlightRef.current = true;
		const startAttempt = ++startAttemptRef.current;
		setStatus('starting');
		setLoading(true);
		setLoadingStatusMessage('Starting playback...');
		appendPlaybackDiagnostic?.({
			scope: 'startup',
			stage: 'play-request',
			status: 'requested',
			reason: sourceToken.playMethod,
			message: 'Requesting playback without waiting for canplay.'
		});
		clearStartupDeadline();
		startupDeadlineTimerRef.current = setTimeout(() => {
			startupDeadlineTimerRef.current = null;
			handleStartupTimeout(sourceToken, startAttempt).catch(() => {
				if (!isTokenCurrent(sourceToken)) return;
				setStatus('failed');
				showPlaybackError(
					'The media did not begin loading or playing. Please retry or go back.',
					{detachMedia: true}
				);
			});
		}, PLAYER_PLAYBACK_START_TIMEOUT_MS);

		try {
			await video.play();
			if (startAttemptRef.current !== startAttempt) return false;
			return commitPlaybackStarted('play-promise', sourceToken);
		} catch (playError) {
			if (
				startAttemptRef.current !== startAttempt ||
				playbackStartedRef.current ||
				!isTokenCurrent(sourceToken) ||
				isInterruptedPlaybackStartError(playError)
			) return false;
			clearStartupDeadline();
			startInFlightRef.current = false;
			const errorMessage = getPlaybackErrorMessage(playError, 'Playback failed to start');
			if (isFatalPlaybackError(playError) && !isCurrentTranscoding) {
				const didFallback = await attemptSafeTranscodeFallback(errorMessage);
				if (didFallback || !isTokenCurrent(sourceToken)) return false;
			}
			if (isFatalPlaybackError(playError)) {
				setStatus('failed');
				showPlaybackError(errorMessage, {detachMedia: true});
			} else {
				setToastMessage('Playback failed to start. Press Play/Retry.');
			}
			return false;
		}
	}, [
		appendPlaybackDiagnostic,
		attemptSafeTranscodeFallback,
		clearStartupDeadline,
		commitPlaybackStarted,
		handleStartupTimeout,
		isCurrentTranscoding,
		isTokenCurrent,
		playbackStartedRef,
		setLoading,
		setLoadingStatusMessage,
		setToastMessage,
		showPlaybackError,
		startupDeadlineTimerRef,
		videoRef
	]);

	const reportPlaybackEvidence = useCallback((signal, sourceToken = sourceTokenRef.current) => (
		commitPlaybackStarted(signal, sourceToken)
	), [commitPlaybackStarted]);

	const getSubtitleDeadlineKey = useCallback((sourceToken, selectedTrack) => {
		if (!sourceToken || !Number.isInteger(selectedTrack) || selectedTrack < 0) return '';
		return [
			sourceToken.generation,
			sourceToken.sourceGeneration,
			sourceToken.itemId,
			sourceToken.mediaSourceId,
			selectedTrack
		].join(':');
	}, []);

	const getSubtitleStartupContext = useCallback((sourceToken) => {
		const runtimeContext = sourceToken?.runtimeContext;
		const selectedTrack = Number.isInteger(runtimeContext?.selectedSubtitleTrack)
			? runtimeContext.selectedSubtitleTrack
			: currentSubtitleTrack;
		const policy = runtimeContext?.subtitlePolicy || subtitleRendererPolicy;
		const expectedRendererKey = (
			runtimeContext?.itemId &&
			runtimeContext?.mediaSourceId &&
			Number.isInteger(selectedTrack) &&
			selectedTrack >= 0
		)
			? `${runtimeContext.itemId}:${runtimeContext.mediaSourceId}:${runtimeContext.generation}:${selectedTrack}`
			: '';
		const readyRendererKey = String(subtitleRendererState?.debug?.cacheKey || '');
		return {
			selectedTrack,
			policy,
			readyForSource: !expectedRendererKey || readyRendererKey === expectedRendererKey
		};
	}, [
		currentSubtitleTrack,
		subtitleRendererPolicy,
		subtitleRendererState?.debug?.cacheKey
	]);

	useEffect(() => {
		if (!syncPlayStartupBridge) return undefined;
		return syncPlayStartupBridge.registerStartupHandler(requestPlaybackStart);
	}, [requestPlaybackStart, syncPlayStartupBridge]);

	useEffect(() => {
		const sourceToken = sourceTokenRef.current;
		if (!isTokenCurrent(sourceToken) || playbackStartedRef.current || startInFlightRef.current) {
			return undefined;
		}
		const subtitleStartup = getSubtitleStartupContext(sourceToken);
		const nextStatus = getPlayerStartupState({
			sourceAttached: true,
			engineReady: engineReadyRef.current,
			currentSubtitleTrack: subtitleStartup.selectedTrack,
			subtitleRendererPolicy: subtitleStartup.policy,
			subtitleRendererStatus: subtitleRendererState?.status,
			subtitleRendererReadyForSource: subtitleStartup.readyForSource
		});
		startupGatesReadyRef.current = nextStatus === 'starting';
		setStatus(nextStatus);

		if (nextStatus === 'waiting-engine') {
			setLoading(true);
			setLoadingStatusMessage(
				sourceToken.serverBurnIn
					? 'Preparing server subtitle transcode...'
					: 'Preparing video stream...'
			);
			return undefined;
		}

		if (nextStatus === 'waiting-subtitles') {
			setLoading(true);
			setLoadingStatusMessage('Preparing subtitles...');
			return undefined;
		}

		if (nextStatus !== 'starting') return undefined;
		if (syncPlayStartupBridge?.shouldBlockAutomaticStart()) {
			setStatus('waiting-syncplay');
			setLoading(true);
			setLoadingStatusMessage('Waiting for SyncPlay...');
			if (!syncPlayReadyRequestedRef.current) {
				syncPlayReadyRequestedRef.current = true;
				Promise.resolve(syncPlayStartupBridge.reportVideoReady()).then((ready) => {
					if (!ready) syncPlayReadyRequestedRef.current = false;
				}).catch(() => {
					syncPlayReadyRequestedRef.current = false;
				});
			}
			return undefined;
		}
		requestPlaybackStart();
		return undefined;
	}, [
		getSubtitleStartupContext,
		isTokenCurrent,
		onSubtitleTimeout,
		playbackStartedRef,
		requestPlaybackStart,
		setLoading,
		setLoadingStatusMessage,
		sourceVersion,
		subtitleRendererState?.status,
		syncPlayStartupBridge
	]);

	useEffect(() => {
		const sourceToken = sourceTokenRef.current;
		const subtitleStartup = getSubtitleStartupContext(sourceToken);
		const subtitleGateState = getPlayerStartupState({
			sourceAttached: true,
			engineReady: true,
			currentSubtitleTrack: subtitleStartup.selectedTrack,
			subtitleRendererPolicy: subtitleStartup.policy,
			subtitleRendererStatus: subtitleRendererState?.status,
			subtitleRendererReadyForSource: subtitleStartup.readyForSource
		});
		if (
			!isTokenCurrent(sourceToken) ||
			subtitleGateState !== 'waiting-subtitles' ||
			playbackStartedRef.current ||
			timeoutHandledRef.current
		) {
			clearSubtitleDeadline();
			return undefined;
		}
		const deadlineKey = getSubtitleDeadlineKey(sourceToken, subtitleStartup.selectedTrack);
		if (
			subtitleDeadlineRef.current.key === deadlineKey &&
			subtitleDeadlineRef.current.timer
		) {
			return undefined;
		}
		clearSubtitleDeadline();
		const timeoutId = setTimeout(() => {
			if (subtitleDeadlineRef.current.key !== deadlineKey) return;
			subtitleDeadlineRef.current = {key: '', timer: null};
			if (
				!isTokenCurrent(sourceToken) ||
				playbackStartedRef.current ||
				timeoutHandledRef.current
			) return;
			timeoutHandledRef.current = true;
			setStatus('timed-out');
			Promise.resolve(subtitleTimeoutCallbackRef.current?.()).catch((error) => {
				console.warn('Failed to apply subtitle startup timeout fallback:', error);
			});
		}, PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS);
		subtitleDeadlineRef.current = {key: deadlineKey, timer: timeoutId};
		return undefined;
	}, [
		clearSubtitleDeadline,
		getSubtitleDeadlineKey,
		getSubtitleStartupContext,
		isTokenCurrent,
		playbackStartedRef,
		sourceVersion,
		subtitleRendererState?.status
	]);

	useEffect(() => () => {
		startAttemptRef.current += 1;
		clearStartupDeadline();
		clearSubtitleDeadline();
	}, [clearStartupDeadline, clearSubtitleDeadline]);

	return {
		status,
		registerPlaybackSource,
		invalidatePlaybackSource,
		reportPlaybackEngineReady,
		reportPlaybackEvidence,
		requestPlaybackStart
	};
};
