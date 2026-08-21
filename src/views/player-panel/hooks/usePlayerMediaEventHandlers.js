import {useCallback} from 'react';
import {redactSensitiveUrl} from '../../../utils/sensitiveData';

import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {
	getSubtitleStreamByIndex,
	isBitmapSubtitleCodec,
	normalizeSubtitleCodec
} from '../../../utils/playbackSelection';
import {
	isServerTranscodingStartupFailure,
	SERVER_TRANSCODING_FAILURE_DIAGNOSTIC,
	SERVER_TRANSCODING_FAILURE_MESSAGE
} from '../utils/playerRecoveryPolicy';
import {isPlaybackSourceMediaEventCurrent} from '../utils/playbackRuntimeContext';

const isImageSubtitleBurnInPlaybackPath = ({video, mediaSourceData, currentSubtitleTrack}) => {
	const values = [
		video?.currentSrc,
		video?.src,
		mediaSourceData?.TranscodingUrl,
		mediaSourceData?.DirectStreamUrl,
		mediaSourceData?.__debugVideoUrl
	].filter(Boolean).join(' ').toLowerCase();
	const hasEncodeSubtitlePath = values.includes('subtitlemethod=encode') ||
		values.includes('subtitlemethod%3dencode');
	const subtitlePolicy = mediaSourceData?.__debugSubtitlePolicy || {};
	const hasEncodedSubtitleIndex = /[?&]subtitlestreamindex=(?!-1(?:&|$))\d+/i.test(values) ||
		/subtitlestreamindex%3d(?!-1(?:%26|$))\d+/i.test(values);
	const subtitleStream = getSubtitleStreamByIndex(mediaSourceData, currentSubtitleTrack);
	const codec = subtitlePolicy.codec || normalizeSubtitleCodec(subtitleStream);
	const burnInRequested = subtitlePolicy.forceBurnIn === true || subtitlePolicy.requiresBurnIn === true;
	return (burnInRequested || (hasEncodeSubtitlePath && hasEncodedSubtitleIndex)) &&
		isBitmapSubtitleCodec(codec);
};

export const usePlayerMediaEventHandlers = ({
	item,
	loading,
	videoRef,
	playbackStartedRef,
	playbackOverrideRef,
	setCurrentTime,
	showPlaybackError,
	checkSkipSegments,
	seekOffsetRef,
	lastProgressRef,
	playbackFailureLockedRef,
	playbackSettingsRef,
	isSubtitleCompatibilityError,
	attemptSubtitleCompatibilityFallback,
	isCurrentTranscoding,
	attemptTranscodeFallback,
	handleStop,
	mediaSourceData,
	currentSubtitleTrack,
	appendPlaybackDiagnostic,
	onPlaybackEvidence,
	setPlaying,
	exitInProgressRef,
	nativeSourceTokenRef,
	playbackRuntimeContextRef,
	playbackGenerationRef,
	onAudioTransitionFailed
}) => {
	const isCurrentNativeEvent = useCallback((event, sourceToken = nativeSourceTokenRef.current) => (
		isPlaybackSourceMediaEventCurrent({
			event,
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

	const handleLoadedMetadata = useCallback((event) => {
		if (!isCurrentNativeEvent(event)) return;
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
		appendPlaybackDiagnostic?.({
			scope: 'startup',
			stage: 'loadedmetadata',
			status: 'ready',
			reason: nativeSourceTokenRef.current?.engine || 'native',
			message: 'Current playback source emitted loadedmetadata.'
		});
	}, [appendPlaybackDiagnostic, isCurrentNativeEvent, item, nativeSourceTokenRef, playbackOverrideRef, setCurrentTime, videoRef]);

	const handleLoadedData = useCallback((event) => {
		if (!isCurrentNativeEvent(event)) return;
		if (!videoRef.current || !loading) return;
		lastProgressRef.current = {
			time: videoRef.current.currentTime || 0,
			timestamp: Date.now()
		};
		appendPlaybackDiagnostic?.({
			scope: 'startup',
			stage: 'loadeddata',
			status: 'ready',
			reason: nativeSourceTokenRef.current?.engine || 'native',
			message: 'Current playback source emitted loadeddata.'
		});
	}, [appendPlaybackDiagnostic, isCurrentNativeEvent, lastProgressRef, loading, nativeSourceTokenRef, videoRef]);

	const handleCanPlay = useCallback((event) => {
		if (!isCurrentNativeEvent(event) || !videoRef.current || exitInProgressRef.current) return;
		appendPlaybackDiagnostic?.({
			scope: 'startup',
			stage: 'canplay',
			status: 'ready',
			reason: nativeSourceTokenRef.current?.engine || 'native',
			message: 'Current playback source emitted canplay.'
		});
	}, [
		appendPlaybackDiagnostic,
		exitInProgressRef,
		isCurrentNativeEvent,
		nativeSourceTokenRef,
		videoRef
	]);

	const handleTimeUpdate = useCallback((event) => {
		if (!isCurrentNativeEvent(event)) return;
		if (videoRef.current) {
			const actualTime = videoRef.current.currentTime + seekOffsetRef.current;
			const previousTime = Number(lastProgressRef.current?.time) || 0;
			setCurrentTime(actualTime);
			checkSkipSegments(actualTime);
			lastProgressRef.current = {time: actualTime, timestamp: Date.now()};
			if (videoRef.current.paused === false && Math.abs(actualTime - previousTime) >= 0.25) {
				onPlaybackEvidence?.('timeline-progress', nativeSourceTokenRef.current);
			}
		}
	}, [checkSkipSegments, isCurrentNativeEvent, lastProgressRef, nativeSourceTokenRef, onPlaybackEvidence, seekOffsetRef, setCurrentTime, videoRef]);

	const handleVideoPlaying = useCallback((event) => {
		if (!isCurrentNativeEvent(event)) return;
		setPlaying(true);
		onPlaybackEvidence?.('playing-event', nativeSourceTokenRef.current);
	}, [isCurrentNativeEvent, nativeSourceTokenRef, onPlaybackEvidence, setPlaying]);

	const handleVideoPause = useCallback((event) => {
		if (!isCurrentNativeEvent(event)) return;
		setPlaying(false);
	}, [isCurrentNativeEvent, setPlaying]);

	const handleVideoError = useCallback(async (event) => {
		if (playbackFailureLockedRef.current || exitInProgressRef.current) return;
		const sourceToken = nativeSourceTokenRef.current;
		if (!isCurrentNativeEvent(event, sourceToken)) return;
		const video = videoRef.current;
		const mediaError = video?.error;

		console.error('[Player] Video playback error:', {
			eventType: event?.type || 'error',
			mediaErrorCode: Number(mediaError?.code) || null,
			videoUrl: redactSensitiveUrl(video?.currentSrc || video?.src || '', {includeOrigin: false}),
			networkState: Number(video?.networkState) || 0,
			readyState: Number(video?.readyState) || 0
		});

		let errorMessage = 'Failed to play video';
		if (mediaError) {
			const errorMessages = {
				1: 'Playback aborted',
				2: 'Network error',
				3: 'Decode error',
				4: 'Format not supported'
			};
			errorMessage = errorMessages[mediaError.code] || `Error code: ${mediaError.code}`;
			if (
				mediaError.code === 4 &&
				isImageSubtitleBurnInPlaybackPath({video, mediaSourceData, currentSubtitleTrack})
			) {
				errorMessage = 'Jellyfin failed to burn in image-based subtitles. Server hardware transcoding may not support PGS/PGSSUB burn-in; try Auto bitmap rendering or software transcoding.';
			}
			console.error('MediaError code:', mediaError.code, '-', errorMessage);
		}
		if (await onAudioTransitionFailed?.(sourceToken, errorMessage)) return;
		if (isSubtitleCompatibilityError(errorMessage) && playbackSettingsRef.current.strictTranscodingMode) {
			showPlaybackError('Subtitle burn-in failed while strict transcoding is enabled.');
			return;
		}

		const subtitleFallbackWorked = await attemptSubtitleCompatibilityFallback(errorMessage);
		if (!isCurrentNativeEvent(null, sourceToken) || subtitleFallbackWorked) {
			return;
		}

		if (!isCurrentTranscoding) {
			const didFallback = await attemptTranscodeFallback(errorMessage);
			if (!isCurrentNativeEvent(null, sourceToken) || didFallback) {
				return;
			}
		}

		const serverTranscodingStartupFailure = isServerTranscodingStartupFailure({
			isTranscoding: isCurrentTranscoding,
			playbackStarted: playbackStartedRef.current,
			mediaErrorCode: mediaError?.code
		});
		if (serverTranscodingStartupFailure) {
			appendPlaybackDiagnostic?.({
				scope: 'transcode',
				stage: 'startup-failure',
				status: 'error',
				reason: 'server-transcoder-startup-failure',
				message: SERVER_TRANSCODING_FAILURE_DIAGNOSTIC
			});
		}
		try {
			await handleStop();
		} catch (stopErr) {
			console.warn('Error while handling playback failure:', stopErr);
		}
		showPlaybackError(
			serverTranscodingStartupFailure
				? SERVER_TRANSCODING_FAILURE_MESSAGE
				: errorMessage
		);
	}, [
		appendPlaybackDiagnostic,
		attemptSubtitleCompatibilityFallback,
		attemptTranscodeFallback,
		currentSubtitleTrack,
		exitInProgressRef,
		handleStop,
		isCurrentTranscoding,
		isCurrentNativeEvent,
		isSubtitleCompatibilityError,
		mediaSourceData,
		nativeSourceTokenRef,
		playbackFailureLockedRef,
		playbackStartedRef,
		playbackSettingsRef,
		onAudioTransitionFailed,
		showPlaybackError,
		videoRef
	]);

	return {
		handleLoadedMetadata,
		handleLoadedData,
		handleCanPlay,
		handleTimeUpdate,
		handleVideoPlaying,
		handleVideoPause,
		handleVideoError
	};
};
