import {useCallback} from 'react';

import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import jellyfinService from '../../../services/jellyfinService';
import {getPlaybackErrorMessage, isFatalPlaybackError} from '../../../utils/errorMessages';

export const usePlayerMediaEventHandlers = ({
	item,
	loading,
	videoRef,
	playbackStartedRef,
	playbackOverrideRef,
	setCurrentTime,
	setLoading,
	showPlaybackError,
	setPlaying,
	pendingOverrideClearRef,
	clearStartWatch,
	startupFallbackTimerRef,
	getPlaybackSessionContext,
	startProgressReporting,
	setToastMessage,
	tryPlaybackFallbackOnCanPlayError,
	checkSkipSegments,
	seekOffsetRef,
	lastProgressRef,
	playbackFailureLockedRef,
	playbackSettingsRef,
	isSubtitleCompatibilityError,
	attemptSubtitleCompatibilityFallback,
	isCurrentTranscoding,
	attemptTranscodeFallback,
	handleStop
}) => {
	const handleLoadedMetadata = useCallback(() => {
		if (videoRef.current) {
			const overrideSeek = playbackOverrideRef.current?.seekSeconds;
			if (typeof overrideSeek === 'number') {
				videoRef.current.currentTime = overrideSeek;
				setCurrentTime(overrideSeek);
			} else if (item?.UserData?.PlaybackPositionTicks) {
				const startPosition = item.UserData.PlaybackPositionTicks / JELLYFIN_TICKS_PER_SECOND;
				videoRef.current.currentTime = startPosition;
				setCurrentTime(startPosition);
			}
		}
	}, [item, playbackOverrideRef, setCurrentTime, videoRef]);

	const handleLoadedData = useCallback(() => {
		if (!videoRef.current || !loading) return;
		// `canplay` owns startup finalization. `loadeddata` can fire too early on webOS.
		lastProgressRef.current = {
			time: videoRef.current.currentTime || 0,
			timestamp: Date.now()
		};
	}, [lastProgressRef, loading, videoRef]);

	const handleCanPlay = useCallback(async () => {
		if (!videoRef.current || playbackStartedRef.current) return;

		playbackStartedRef.current = true;

		try {
			await videoRef.current.play();
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

			const positionTicks = Math.floor(videoRef.current.currentTime * JELLYFIN_TICKS_PER_SECOND);
			await jellyfinService.reportPlaybackStart(item.Id, positionTicks, getPlaybackSessionContext());
			startProgressReporting();
		} catch (playError) {
			playbackStartedRef.current = false;
			console.error('Auto-play failed:', playError);
			const errorMessage = getPlaybackErrorMessage(playError, 'Playback failed to start');
			setPlaying(false);

			if (isFatalPlaybackError(playError)) {
				const didFallback = await tryPlaybackFallbackOnCanPlayError(errorMessage);
				if (didFallback) {
					return;
				}
			}
			if (isFatalPlaybackError(playError)) {
				showPlaybackError(errorMessage);
			} else {
				setToastMessage('Playback failed to start. Press Play/Retry.');
			}
		}
	}, [
		clearStartWatch,
		getPlaybackSessionContext,
		item,
		pendingOverrideClearRef,
		playbackStartedRef,
		playbackOverrideRef,
		setLoading,
		setPlaying,
		setToastMessage,
		showPlaybackError,
		startProgressReporting,
		startupFallbackTimerRef,
		tryPlaybackFallbackOnCanPlayError,
		videoRef
	]);

	const handleTimeUpdate = useCallback(() => {
		if (videoRef.current) {
			const actualTime = videoRef.current.currentTime + seekOffsetRef.current;
			setCurrentTime(actualTime);
			checkSkipSegments(actualTime);
			lastProgressRef.current = {time: actualTime, timestamp: Date.now()};
		}
	}, [checkSkipSegments, lastProgressRef, seekOffsetRef, setCurrentTime, videoRef]);

	const handleVideoError = useCallback(async (event) => {
		if (playbackFailureLockedRef.current) return;
		const video = videoRef.current;
		const mediaError = video?.error;

		console.error('=== Video Error ===');
		console.error('Event:', event);
		console.error('Video src:', video?.src);
		console.error('Network state:', video?.networkState);
		console.error('Ready state:', video?.readyState);

		let errorMessage = 'Failed to play video';
		if (mediaError) {
			const errorMessages = {
				1: 'Playback aborted',
				2: 'Network error',
				3: 'Decode error',
				4: 'Format not supported'
			};
			errorMessage = errorMessages[mediaError.code] || `Error code: ${mediaError.code}`;
			console.error('MediaError code:', mediaError.code, '-', errorMessage);
		}
		if (isSubtitleCompatibilityError(errorMessage) && playbackSettingsRef.current.strictTranscodingMode) {
			showPlaybackError('Subtitle burn-in failed while strict transcoding is enabled.');
			return;
		}

		const subtitleFallbackWorked = await attemptSubtitleCompatibilityFallback(errorMessage);
		if (subtitleFallbackWorked) {
			return;
		}

		if (!isCurrentTranscoding) {
			const didFallback = await attemptTranscodeFallback(errorMessage);
			if (didFallback) {
				return;
			}
		}

		try {
			await handleStop();
		} catch (stopErr) {
			console.warn('Error while handling playback failure:', stopErr);
		}
		showPlaybackError(errorMessage);
	}, [
		attemptSubtitleCompatibilityFallback,
		attemptTranscodeFallback,
		handleStop,
		isCurrentTranscoding,
		isSubtitleCompatibilityError,
		playbackFailureLockedRef,
		playbackSettingsRef,
		showPlaybackError,
		videoRef
	]);

	return {
		handleLoadedMetadata,
		handleLoadedData,
		handleCanPlay,
		handleTimeUpdate,
		handleVideoError
	};
};
