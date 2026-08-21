import {useCallback, useEffect, useReducer, useRef, useState} from 'react';

import {getPlaybackErrorMessage, isFatalPlaybackError} from '../../../utils/errorMessages';
import {
	PLAYER_PLAYBACK_START_TIMEOUT_MS,
	PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS,
	getPlayerStartupState,
	isInterruptedPlaybackStartError
} from '../utils/playerStartupState';
import {isNativePlaybackSourceTokenCurrent} from '../utils/playbackRuntimeContext';
import {applyNativeAudioTrackSelection} from '../../../utils/trackMatching';
import {
	createInitialPlayerLifecycleState,
	playerLifecycleReducer
} from '../utils/playbackLifecycleReducer';

const INITIAL_NATIVE_AUDIO_DISCOVERY_TIMEOUT_MS = 1800;
const AUDIO_TRANSITION_RESTORE_TIMEOUT_MS = 5000;

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
	onSubtitleTimeout,
	onInitialAudioSelectionFallback,
	onAudioTransitionReady,
	onAudioTransitionFailed
}) => {
	const [sourceVersion, setSourceVersion] = useState(0);
	const [lifecycle, dispatchLifecycle] = useReducer(
		playerLifecycleReducer,
		{generation: playbackGenerationRef.current},
		createInitialPlayerLifecycleState
	);
	const sourceTokenRef = useRef(null);
	const engineReadyRef = useRef(false);
	const audioSelectionReadyRef = useRef(true);
	const audioSelectionCleanupRef = useRef(null);
	const startupGatesReadyRef = useRef(false);
	const startInFlightRef = useRef(false);
	const startAttemptRef = useRef(0);
	const timeoutHandledRef = useRef(false);
	const syncPlayReadyRequestedRef = useRef(false);
	const subtitleDeadlineRef = useRef({key: '', timer: null});
	const subtitleTimeoutCallbackRef = useRef(onSubtitleTimeout);
	subtitleTimeoutCallbackRef.current = onSubtitleTimeout;
	const setStatus = useCallback((phase, sourceToken = sourceTokenRef.current) => {
		dispatchLifecycle({
			type: 'PHASE_UPDATED',
			generation: sourceToken?.generation ?? playbackGenerationRef.current,
			sourceGeneration: sourceToken?.sourceGeneration ?? null,
			phase
		});
	}, [playbackGenerationRef]);

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

	const clearAudioSelectionGate = useCallback(() => {
		audioSelectionCleanupRef.current?.();
		audioSelectionCleanupRef.current = null;
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
		const invalidatedToken = sourceTokenRef.current;
		if (invalidatedToken) {
			dispatchLifecycle({
				type: 'SOURCE_INVALIDATED',
				generation: invalidatedToken.generation,
				sourceGeneration: invalidatedToken.sourceGeneration
			});
		}
		startAttemptRef.current += 1;
		startInFlightRef.current = false;
		sourceTokenRef.current = null;
		engineReadyRef.current = false;
		audioSelectionReadyRef.current = true;
		startupGatesReadyRef.current = false;
		clearStartupDeadline();
		clearSubtitleDeadline();
		clearAudioSelectionGate();
		setSourceVersion((current) => current + 1);
	}, [clearAudioSelectionGate, clearStartupDeadline, clearSubtitleDeadline]);

	const registerPlaybackSource = useCallback((sourceToken, {engineReady = true} = {}) => {
		if (!sourceToken || exitInProgressRef.current) return false;
		dispatchLifecycle({type: 'GENERATION_ALLOCATED', generation: sourceToken.generation});
		sourceTokenRef.current = sourceToken;
		engineReadyRef.current = engineReady === true;
		clearAudioSelectionGate();
		const requiresAudioSelection = sourceToken.runtimeContext?.requiresInitialNativeAudioSelection === true &&
			sourceToken.engine !== 'hls.js';
		const audioTransition = sourceToken.runtimeContext?.audioTransition || null;
		const requiresTransitionRestore = Boolean(audioTransition?.id) &&
			Number.isFinite(Number(audioTransition?.seekSeconds));
		audioSelectionReadyRef.current = !(requiresAudioSelection || requiresTransitionRestore);
		dispatchLifecycle({
			type: 'SOURCE_ATTACHED',
			generation: sourceToken.generation,
			sourceGeneration: sourceToken.sourceGeneration,
			engineReady,
			audioSelectionReady: audioSelectionReadyRef.current,
			subtitleReady: false
		});
		startupGatesReadyRef.current = false;
		startAttemptRef.current += 1;
		startInFlightRef.current = false;
		timeoutHandledRef.current = false;
		syncPlayReadyRequestedRef.current = false;
		playbackStartedRef.current = false;
		clearStartupDeadline();
		clearSubtitleDeadline();
		if (requiresTransitionRestore) {
			const video = sourceToken.video;
			const targetSeconds = Math.max(0, Number(audioTransition.seekSeconds));
			const mediaTracks = sourceToken.runtimeContext?.mediaSourceData?.MediaStreams?.filter(
				(stream) => stream?.Type === 'Audio'
			) || [];
			const selectedTrackIndex = sourceToken.runtimeContext?.selectedAudioTrack;
			let timer = null;
			let finished = false;
			let seekRequested = false;
			let positionRestored = false;
			let audioApplied = !requiresAudioSelection;
			let audioSelectionMethod = requiresAudioSelection ? 'pending' : 'not-required';
			const cleanup = () => {
				if (timer) clearTimeout(timer);
				video?.removeEventListener?.('loadedmetadata', restorePosition);
				video?.removeEventListener?.('seeked', confirmPosition);
				video?.audioTracks?.removeEventListener?.('addtrack', tryAudioSelection);
				video?.audioTracks?.removeEventListener?.('change', tryAudioSelection);
			};
			const finish = (restored, reason) => {
				if (finished) return;
				finished = true;
				cleanup();
				audioSelectionCleanupRef.current = null;
				if (!isTokenCurrent(sourceToken)) return;
				appendPlaybackDiagnostic?.({
					scope: 'audio-track',
					stage: 'transition-source-restore',
					status: restored ? 'ready' : 'failed',
					reason,
					message: restored
						? `Restored the source to ${targetSeconds.toFixed(3)} seconds with audio selection ${audioSelectionMethod}.`
						: 'The source did not restore its playback position and selected audio track.'
				});
				if (restored) {
					audioSelectionReadyRef.current = true;
					dispatchLifecycle({
						type: 'AUDIO_GATE_READY',
						generation: sourceToken.generation,
						sourceGeneration: sourceToken.sourceGeneration
					});
					setSourceVersion((current) => current + 1);
					return;
				}
				Promise.resolve(onAudioTransitionFailed?.(sourceToken, reason)).catch(() => undefined);
			};
			function confirmRestoreReady (reason) {
				if (positionRestored && audioApplied) finish(true, reason);
			}
			function confirmPosition () {
				if (!isTokenCurrent(sourceToken)) return finish(false, 'source-replaced');
				if (Math.abs((Number(video?.currentTime) || 0) - targetSeconds) <= 0.35) {
					positionRestored = true;
					confirmRestoreReady(seekRequested ? 'seeked' : 'already-positioned');
				}
			}
			function tryAudioSelection () {
				if (!requiresAudioSelection || audioApplied) return;
				if (!isTokenCurrent(sourceToken)) return finish(false, 'source-replaced');
				const result = applyNativeAudioTrackSelection({
					video,
					mediaTracks,
					selectedTrackIndex
				});
				if (!result.applied) return;
				audioApplied = true;
				audioSelectionMethod = result.method;
				confirmRestoreReady(result.method);
			}
			function restorePosition () {
				if (!isTokenCurrent(sourceToken)) return finish(false, 'source-replaced');
				if (!video || video.readyState < 1) return;
				tryAudioSelection();
				confirmPosition();
				if (finished) return;
				seekRequested = true;
				try {
					video.currentTime = targetSeconds;
				} catch (_) {
					return;
				}
				confirmPosition();
			}
			video?.addEventListener?.('loadedmetadata', restorePosition);
			video?.addEventListener?.('seeked', confirmPosition);
			if (requiresAudioSelection) {
				video?.audioTracks?.addEventListener?.('addtrack', tryAudioSelection);
				video?.audioTracks?.addEventListener?.('change', tryAudioSelection);
			}
			timer = setTimeout(
				() => finish(false, audioApplied ? 'position-restore-timeout' : 'native-track-discovery-timeout'),
				AUDIO_TRANSITION_RESTORE_TIMEOUT_MS
			);
			audioSelectionCleanupRef.current = () => {
				finished = true;
				cleanup();
			};
			restorePosition();
		} else if (requiresAudioSelection) {
			const video = sourceToken.video;
			const mediaTracks = sourceToken.runtimeContext?.mediaSourceData?.MediaStreams?.filter(
				(stream) => stream?.Type === 'Audio'
			) || [];
			const selectedTrackIndex = sourceToken.runtimeContext?.selectedAudioTrack;
			let timer = null;
			let finished = false;
			const cleanup = () => {
				if (timer) clearTimeout(timer);
				video?.removeEventListener?.('loadedmetadata', trySelection);
				video?.audioTracks?.removeEventListener?.('addtrack', trySelection);
				video?.audioTracks?.removeEventListener?.('change', trySelection);
			};
			const finish = (applied, reason) => {
				if (finished) return;
				finished = true;
				cleanup();
				audioSelectionCleanupRef.current = null;
				if (!isTokenCurrent(sourceToken)) return;
				appendPlaybackDiagnostic?.({
					scope: 'audio-track',
					stage: 'initial-native-selection',
					status: applied ? 'applied' : 'failed',
					reason,
					message: applied
						? `Selected native audio track ${selectedTrackIndex} before playback startup.`
						: 'The selected native audio track was not exposed before startup.'
				});
				if (applied) {
					audioSelectionReadyRef.current = true;
					dispatchLifecycle({
						type: 'AUDIO_GATE_READY',
						generation: sourceToken.generation,
						sourceGeneration: sourceToken.sourceGeneration
					});
					setSourceVersion((current) => current + 1);
					return;
				}
				Promise.resolve(onInitialAudioSelectionFallback?.({
					sourceToken,
					reason,
					audioStreamIndex: selectedTrackIndex,
					subtitleStreamIndex: sourceToken.runtimeContext?.selectedSubtitleTrack
				})).catch(() => undefined);
			};
			function trySelection () {
				if (!isTokenCurrent(sourceToken)) return finish(false, 'source-replaced');
				const result = applyNativeAudioTrackSelection({
					video,
					mediaTracks,
					selectedTrackIndex
				});
				if (result.applied) finish(true, result.method);
			}
			video?.addEventListener?.('loadedmetadata', trySelection);
			video?.audioTracks?.addEventListener?.('addtrack', trySelection);
			video?.audioTracks?.addEventListener?.('change', trySelection);
			timer = setTimeout(
				() => finish(false, 'native-track-discovery-timeout'),
				INITIAL_NATIVE_AUDIO_DISCOVERY_TIMEOUT_MS
			);
			audioSelectionCleanupRef.current = () => {
				finished = true;
				cleanup();
			};
			trySelection();
		}
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
		clearAudioSelectionGate,
		clearStartupDeadline,
		clearSubtitleDeadline,
		exitInProgressRef,
		isTokenCurrent,
		onAudioTransitionFailed,
		onInitialAudioSelectionFallback,
		playbackStartedRef,
		setStatus
	]);

	const reportPlaybackEngineReady = useCallback((
		sourceToken = sourceTokenRef.current,
		signal = 'engine-ready'
	) => {
		if (!isTokenCurrent(sourceToken) || engineReadyRef.current) return false;
		engineReadyRef.current = true;
		dispatchLifecycle({
			type: 'ENGINE_READY',
			generation: sourceToken.generation,
			sourceGeneration: sourceToken.sourceGeneration
		});
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
		dispatchLifecycle({
			type: 'PLAY_CONFIRMED',
			generation: sourceToken.generation,
			sourceGeneration: sourceToken.sourceGeneration
		});
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
		onAudioTransitionReady?.(sourceToken, {started: true});
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
		startProgressReporting,
		onAudioTransitionReady
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
		if (await onAudioTransitionFailed?.(sourceToken, 'startup-no-progress')) return true;
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
		showPlaybackError,
		onAudioTransitionFailed,
		setStatus
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
		dispatchLifecycle({
			type: 'PLAY_REQUESTED',
			generation: sourceToken.generation,
			sourceGeneration: sourceToken.sourceGeneration
		});
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
			if (await onAudioTransitionFailed?.(sourceToken, errorMessage)) return false;
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
		setStatus,
		showPlaybackError,
		startupDeadlineTimerRef,
		videoRef,
		onAudioTransitionFailed
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
		dispatchLifecycle({
			type: 'SUBTITLE_GATE_UPDATED',
			generation: sourceToken.generation,
			sourceGeneration: sourceToken.sourceGeneration,
			status: subtitleRendererState?.status || 'ready',
			readyForSource: subtitleStartup.readyForSource
		});
		const nextStatus = getPlayerStartupState({
			sourceAttached: true,
			engineReady: engineReadyRef.current,
			audioSelectionReady: audioSelectionReadyRef.current,
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

		if (nextStatus === 'waiting-audio') {
			setLoading(true);
			setLoadingStatusMessage('Preparing selected audio...');
			return undefined;
		}

		if (nextStatus !== 'starting') return undefined;
		if (syncPlayStartupBridge?.shouldBlockAutomaticStart()) {
			dispatchLifecycle({
				type: 'SYNCPLAY_WAITING',
				generation: sourceToken.generation,
				sourceGeneration: sourceToken.sourceGeneration
			});
			setStatus('waiting-syncplay');
			setLoading(true);
			setLoadingStatusMessage('Waiting for SyncPlay...');
			if (!syncPlayReadyRequestedRef.current) {
				syncPlayReadyRequestedRef.current = true;
				Promise.resolve(syncPlayStartupBridge.reportVideoReady()).then((ready) => {
					if (!isTokenCurrent(sourceToken)) return;
					if (!ready) {
						syncPlayReadyRequestedRef.current = false;
						return;
					}
					if (
						sourceToken.runtimeContext?.audioTransition?.id &&
						pendingOverrideClearRef.current
					) {
						playbackOverrideRef.current = null;
						pendingOverrideClearRef.current = false;
					}
					onAudioTransitionReady?.(sourceToken, {
						started: false,
						syncPlayReady: true
					});
				}).catch(() => {
					syncPlayReadyRequestedRef.current = false;
				});
			}
			return undefined;
		}
		if (sourceToken.runtimeContext?.audioTransition?.startPaused === true) {
			dispatchLifecycle({
				type: 'AUDIO_TRANSITION_READY',
				generation: sourceToken.generation,
				sourceGeneration: sourceToken.sourceGeneration,
				started: false
			});
			setStatus('started');
			setLoading(false);
			setPlaying(false);
			if (pendingOverrideClearRef.current) {
				playbackOverrideRef.current = null;
				pendingOverrideClearRef.current = false;
			}
			onAudioTransitionReady?.(sourceToken, {started: false});
			return undefined;
		}
		requestPlaybackStart();
		return undefined;
	}, [
		getSubtitleStartupContext,
		isTokenCurrent,
		onSubtitleTimeout,
		playbackStartedRef,
		playbackOverrideRef,
		pendingOverrideClearRef,
		requestPlaybackStart,
		setLoading,
		setLoadingStatusMessage,
		setPlaying,
		sourceVersion,
		subtitleRendererState?.status,
		syncPlayStartupBridge,
		onAudioTransitionReady,
		setStatus
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
		subtitleRendererState?.status,
		setStatus
	]);

	useEffect(() => () => {
		startAttemptRef.current += 1;
		clearStartupDeadline();
		clearSubtitleDeadline();
		clearAudioSelectionGate();
	}, [clearAudioSelectionGate, clearStartupDeadline, clearSubtitleDeadline]);

	return {
		status: lifecycle.phase,
		registerPlaybackSource,
		invalidatePlaybackSource,
		reportPlaybackEngineReady,
		reportPlaybackEvidence,
		requestPlaybackStart
	};
};
