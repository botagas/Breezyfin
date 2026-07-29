import {useCallback, useEffect, useRef, useState} from 'react';

import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import jellyfinService from '../../../services/jellyfinService';
import {getPlaybackErrorMessage, isFatalPlaybackError} from '../../../utils/errorMessages';
import {
	PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS,
	getPlayerStartupState,
	isInterruptedPlaybackStartError
} from '../utils/playerStartupState';

export const usePlayerStartupCoordinator = ({
	item,
	playbackGeneration,
	videoRef,
	currentSubtitleTrack,
	subtitleRendererPolicy,
	subtitleRendererState,
	exitInProgressRef,
	playbackStartedRef,
	playbackOverrideRef,
	pendingOverrideClearRef,
	startupFallbackTimerRef,
	clearStartWatch,
	getPlaybackSessionContext,
	startProgressReporting,
	syncPlayStartupBridge,
	setLoading,
	setLoadingStatusMessage,
	setPlaying,
	setToastMessage,
	showPlaybackError,
	attemptTranscodeFallback,
	isCurrentTranscoding,
	onSubtitleTimeout
}) => {
	const [videoReady, setVideoReady] = useState(false);
	const [status, setStatus] = useState('waiting-video');
	const startInFlightRef = useRef(false);
	const startAttemptRef = useRef(0);
	const timeoutHandledRef = useRef(false);
	const syncPlayReadyRequestedRef = useRef(false);

	useEffect(() => {
		setVideoReady(false);
		setStatus('waiting-video');
		startInFlightRef.current = false;
		startAttemptRef.current += 1;
		timeoutHandledRef.current = false;
		syncPlayReadyRequestedRef.current = false;
	}, [item?.Id, playbackGeneration]);

	const markVideoReady = useCallback(() => {
		if (exitInProgressRef.current) return;
		setVideoReady(true);
	}, [exitInProgressRef]);

	const completePlaybackStart = useCallback(async () => {
		if (exitInProgressRef.current || playbackStartedRef.current || startInFlightRef.current) {
			return false;
		}
		const video = videoRef.current;
		if (!video) return false;
		startInFlightRef.current = true;
		const startAttempt = ++startAttemptRef.current;
		setLoadingStatusMessage('Starting playback...');

		try {
			await video.play();
			if (exitInProgressRef.current || startAttemptRef.current !== startAttempt) return false;
			playbackStartedRef.current = true;
			setLoading(false);
			setPlaying(true);
			if (pendingOverrideClearRef.current) {
				playbackOverrideRef.current = null;
				pendingOverrideClearRef.current = false;
			}
			clearStartWatch();
			if (startupFallbackTimerRef.current) {
				clearTimeout(startupFallbackTimerRef.current);
				startupFallbackTimerRef.current = null;
			}
			const positionTicks = Math.floor((video.currentTime || 0) * JELLYFIN_TICKS_PER_SECOND);
			try {
				await jellyfinService.reportPlaybackStart(item.Id, positionTicks, getPlaybackSessionContext());
			} catch (error) {
				console.warn('Failed to report playback start:', error);
			}
			startProgressReporting();
			return true;
		} catch (playError) {
			if (
				exitInProgressRef.current ||
				startAttemptRef.current !== startAttempt ||
				isInterruptedPlaybackStartError(playError)
			) return false;
			playbackStartedRef.current = false;
			const errorMessage = getPlaybackErrorMessage(playError, 'Playback failed to start');
			setPlaying(false);
			if (isFatalPlaybackError(playError) && !isCurrentTranscoding) {
				const didFallback = await attemptTranscodeFallback(errorMessage);
				if (didFallback) return false;
			}
			if (isFatalPlaybackError(playError)) {
				showPlaybackError(errorMessage);
			} else {
				setToastMessage('Playback failed to start. Press Play/Retry.');
			}
			return false;
		} finally {
			if (startAttemptRef.current === startAttempt) {
				startInFlightRef.current = false;
			}
		}
	}, [
		attemptTranscodeFallback,
		clearStartWatch,
		exitInProgressRef,
		getPlaybackSessionContext,
		isCurrentTranscoding,
		item,
		pendingOverrideClearRef,
		playbackOverrideRef,
		playbackStartedRef,
		setLoading,
		setLoadingStatusMessage,
		setPlaying,
		setToastMessage,
		showPlaybackError,
		startProgressReporting,
		startupFallbackTimerRef,
		videoRef
	]);

	useEffect(() => {
		if (!syncPlayStartupBridge) return undefined;
		return syncPlayStartupBridge.registerStartupHandler(completePlaybackStart);
	}, [completePlaybackStart, syncPlayStartupBridge]);

	useEffect(() => {
		if (exitInProgressRef.current || playbackStartedRef.current || startInFlightRef.current) return undefined;
		const nextStatus = getPlayerStartupState({
			videoReady,
			currentSubtitleTrack,
			subtitleRendererPolicy,
			subtitleRendererStatus: subtitleRendererState?.status
		});
		setStatus(nextStatus);

		if (nextStatus === 'waiting-subtitles') {
			setLoading(true);
			setLoadingStatusMessage('Preparing subtitles...');
			const timeoutId = setTimeout(() => {
				if (exitInProgressRef.current || playbackStartedRef.current || timeoutHandledRef.current) return;
				timeoutHandledRef.current = true;
				setStatus('timed-out');
				Promise.resolve(onSubtitleTimeout?.()).catch((error) => {
					console.warn('Failed to apply subtitle startup timeout fallback:', error);
				});
			}, PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS);
			return () => clearTimeout(timeoutId);
		}

		if (nextStatus !== 'ready') return undefined;
		if (syncPlayStartupBridge?.shouldBlockAutomaticStart()) {
			setStatus('waiting-syncplay');
			setLoading(true);
			setLoadingStatusMessage('Waiting for SyncPlay...');
			if (!syncPlayReadyRequestedRef.current) {
				syncPlayReadyRequestedRef.current = true;
				Promise.resolve(syncPlayStartupBridge.reportVideoReady()).catch(() => {
					syncPlayReadyRequestedRef.current = false;
				});
			}
			return undefined;
		}
		completePlaybackStart();
		return undefined;
	}, [
		completePlaybackStart,
		currentSubtitleTrack,
		exitInProgressRef,
		onSubtitleTimeout,
		playbackStartedRef,
		setLoading,
		setLoadingStatusMessage,
		subtitleRendererPolicy,
		subtitleRendererState?.status,
		syncPlayStartupBridge,
		videoReady
	]);

	return {
		status,
		markVideoReady,
		completePlaybackStart
	};
};
