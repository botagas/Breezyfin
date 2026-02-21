import {useCallback} from 'react';
import jellyfinService from '../../../services/jellyfinService';
import {getPlaybackErrorMessage, isFatalPlaybackError} from '../../../utils/errorMessages';

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
	getPlaybackSessionContext,
	startProgressReporting,
	setPlaying,
	setShowControls,
	setError,
	setToastMessage,
	showPlaybackError,
	resetRecoveryGuards,
	playSessionRebuildAttemptsRef,
	transcodeFallbackAttemptedRef,
	reloadAttemptedRef,
	subtitleCompatibilityFallbackAttemptedRef,
	loadVideo,
	attemptTranscodeFallback,
	isCurrentTranscoding
}) => {
	const handleEnded = useCallback(async () => {
		await handleStop();

		if (playbackSettingsRef.current.autoPlayNext && item?.Type === 'Episode' && onPlay) {
			try {
				const nextEpisode = hasNextEpisode ? await getNextEpisode(item) : null;
				if (nextEpisode) {
					onPlay(nextEpisode, buildPlaybackOptions());
					return;
				}
			} catch (err) {
				console.error('Failed to auto-play next episode:', err);
			}
		}

		onBack();
	}, [buildPlaybackOptions, getNextEpisode, handleStop, hasNextEpisode, item, onBack, onPlay, playbackSettingsRef]);

	const handlePlay = useCallback(async ({keepHidden = false} = {}) => {
		if (!videoRef.current) return;
		try {
			const resumeFromPaused = videoRef.current.currentTime > 0;
			await videoRef.current.play();
			setPlaying(true);
			setShowControls(keepHidden ? false : !resumeFromPaused);

			const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
			await jellyfinService.reportPlaybackStart(item.Id, positionTicks, getPlaybackSessionContext());
			startProgressReporting();
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
		getPlaybackSessionContext,
		item,
		setPlaying,
		setShowControls,
		setToastMessage,
		showPlaybackError,
		startProgressReporting,
		videoRef
	]);

	const handlePause = useCallback(async ({keepHidden = false} = {}) => {
		if (!videoRef.current) return;
		videoRef.current.pause();
		setPlaying(false);
		setShowControls(!keepHidden);

		const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
		await jellyfinService.reportPlaybackProgress(item.Id, positionTicks, true, getPlaybackSessionContext());
	}, [getPlaybackSessionContext, item, setPlaying, setShowControls, videoRef]);

	const handleRetryPlayback = useCallback(async () => {
		setError(null);
		setToastMessage('');
		resetRecoveryGuards();
		playSessionRebuildAttemptsRef.current = 0;
		transcodeFallbackAttemptedRef.current = false;
		reloadAttemptedRef.current = false;
		subtitleCompatibilityFallbackAttemptedRef.current = false;
		await handleStop();
		loadVideo();
	}, [
		handleStop,
		loadVideo,
		playSessionRebuildAttemptsRef,
		reloadAttemptedRef,
		resetRecoveryGuards,
		setError,
		setToastMessage,
		subtitleCompatibilityFallbackAttemptedRef,
		transcodeFallbackAttemptedRef
	]);

	const handleBackButton = useCallback(async () => {
		await handleStop();
		onBack();
	}, [handleStop, onBack]);

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
