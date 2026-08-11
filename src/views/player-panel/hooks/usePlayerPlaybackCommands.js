import {useCallback} from 'react';
import {useSyncPlay} from '../../../contexts/SyncPlayContext';
import {getPlaybackErrorMessage, isFatalPlaybackError} from '../../../utils/errorMessages';
import {runSyncPlayQueueAction} from '../utils/syncPlayQueueAction';

export const usePlayerPlaybackCommands = ({
	item,
	onBack,
	onPlay,
	hasNextEpisode,
	getNextEpisode,
	buildPlaybackOptions,
	playbackSettingsRef,
	videoRef,
	handleStop,
	reportPlaybackProgressNow,
	setPlaying,
	setShowControls,
	setError,
	setLoadingStatusMessage,
	setToastMessage,
	showPlaybackError,
	resetRecoveryGuards,
	playSessionRebuildAttemptsRef,
	transcodeFallbackAttemptedRef,
	reloadAttemptedRef,
	subtitleCompatibilityFallbackAttemptedRef,
	loadVideo,
	attemptTranscodeFallback,
	isCurrentTranscoding,
	exitInProgressRef,
	loadRequestIdRef,
	isActionsLocked,
	onBeforeBack,
	playbackStartedRef,
	playbackRecoveryLedger,
	requestPlaybackStart
}) => {
	const syncPlay = useSyncPlay();
	const syncPlayNext = syncPlay.group && syncPlay.followMode === 'following' ? syncPlay.next : null;
	const handleEnded = useCallback(async () => {
		if (isActionsLocked?.()) return;
		await handleStop();
		if (await runSyncPlayQueueAction({
			action: syncPlayNext,
			logMessage: 'Failed to advance the SyncPlay queue:',
			toastMessage: 'SyncPlay could not advance to the next item.',
			setToastMessage
		})) return;

		if (playbackSettingsRef.current.autoPlayNext && item?.Type === 'Episode' && onPlay) {
			try {
				const nextEpisode = hasNextEpisode ? await getNextEpisode(item) : null;
				if (nextEpisode) {
					onPlay(nextEpisode, buildPlaybackOptions({remapTrackIntents: true}));
					return;
				}
			} catch (err) {
				console.error('Failed to auto-play next episode:', err);
			}
		}

		onBack();
	}, [
		buildPlaybackOptions,
		getNextEpisode,
		handleStop,
		hasNextEpisode,
		item,
		isActionsLocked,
		onBack,
		onPlay,
		playbackSettingsRef,
		setToastMessage,
		syncPlayNext
	]);

	const handlePlay = useCallback(async ({keepHidden = false} = {}) => {
		if (isActionsLocked?.()) return;
		if (!videoRef.current) return;
		if (!playbackStartedRef.current && requestPlaybackStart) {
			await requestPlaybackStart();
			return;
		}
		try {
			const resumeFromPaused = videoRef.current.currentTime > 0;
			await videoRef.current.play();
			setPlaying(true);
			setShowControls(keepHidden ? false : !resumeFromPaused);
			reportPlaybackProgressNow(false);
		} catch (err) {
			console.error('Play failed:', err);
			const errorMessage = getPlaybackErrorMessage(err);
			if (isFatalPlaybackError(err)) {
				showPlaybackError(errorMessage);
			} else {
				setToastMessage(errorMessage);
			}
		}
	}, [
		reportPlaybackProgressNow,
		playbackStartedRef,
		requestPlaybackStart,
		setPlaying,
		setShowControls,
		setToastMessage,
		showPlaybackError,
		videoRef,
		isActionsLocked
	]);

	const handlePause = useCallback(async ({keepHidden = false} = {}) => {
		if (isActionsLocked?.()) return;
		if (!videoRef.current) return;
		videoRef.current.pause();
		setPlaying(false);
		setShowControls(!keepHidden);

		reportPlaybackProgressNow(true);
	}, [isActionsLocked, reportPlaybackProgressNow, setPlaying, setShowControls, videoRef]);

	const handleRetryPlayback = useCallback(async () => {
		if (isActionsLocked?.()) return;
		setError(null);
		setLoadingStatusMessage('Loading...');
		setToastMessage('');
		playbackRecoveryLedger?.resetForRetry(item?.Id);
		resetRecoveryGuards();
		playSessionRebuildAttemptsRef.current = 0;
		transcodeFallbackAttemptedRef.current = false;
		reloadAttemptedRef.current = false;
		subtitleCompatibilityFallbackAttemptedRef.current = false;
		await handleStop();
		loadVideo();
	}, [
		handleStop,
		isActionsLocked,
		loadVideo,
		item?.Id,
		playSessionRebuildAttemptsRef,
		playbackRecoveryLedger,
		reloadAttemptedRef,
		resetRecoveryGuards,
		setError,
		setLoadingStatusMessage,
		setToastMessage,
		subtitleCompatibilityFallbackAttemptedRef,
		transcodeFallbackAttemptedRef
	]);

	const handleBackButton = useCallback(() => {
		if (exitInProgressRef.current) return;
		onBeforeBack?.();
		exitInProgressRef.current = true;
		loadRequestIdRef.current += 1;
		let didNavigate = false;
		const navigateBack = () => {
			if (didNavigate) return;
			didNavigate = true;
			onBack();
		};

		const navigationTimeout = setTimeout(() => {
			navigateBack();
		}, 1400);

		Promise.resolve(handleStop())
			.catch((stopError) => {
				console.warn('Failed to fully stop playback before navigating back:', stopError);
			})
			.finally(() => {
				clearTimeout(navigationTimeout);
				navigateBack();
			});
	}, [exitInProgressRef, handleStop, loadRequestIdRef, onBack, onBeforeBack]);

	const tryPlaybackFallbackOnCanPlayError = useCallback(async (errorMessage) => {
		if (!isCurrentTranscoding) {
			const didFallback = await attemptTranscodeFallback(errorMessage);
			if (didFallback) {
				return true;
			}
		}
		return false;
	}, [attemptTranscodeFallback, isCurrentTranscoding]);

	return {
		handleEnded,
		handlePlay,
		handlePause,
		handleRetryPlayback,
		handleBackButton,
		tryPlaybackFallbackOnCanPlayError
	};
};
