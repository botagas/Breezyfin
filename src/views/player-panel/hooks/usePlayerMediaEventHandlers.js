import {useCallback} from 'react';
import {redactSensitiveUrl} from '../../../utils/sensitiveData';

import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {applyNativeAudioTrackSelection} from '../../../utils/trackMatching';
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
	audioTracks,
	currentAudioTrack,
	currentSubtitleTrack,
	appendPlaybackDiagnostic,
	onNativeAudioSwitchFallback,
	onVideoCanPlay,
	exitInProgressRef
}) => {
	const applyInitialNativeAudioSelection = useCallback((phase) => {
		const defaultAudioTrack = Number.isInteger(mediaSourceData?.DefaultAudioStreamIndex)
			? mediaSourceData.DefaultAudioStreamIndex
			: audioTracks.find((track) => track?.IsDefault === true)?.Index;
		if (
			mediaSourceData?.__selectedPlayMethod !== 'DirectPlay' ||
			!Number.isInteger(currentAudioTrack) ||
			currentAudioTrack < 0 ||
			currentAudioTrack === defaultAudioTrack ||
			!Array.isArray(audioTracks) ||
			audioTracks.length <= 1
		) {
			return false;
		}
		const nativeResult = applyNativeAudioTrackSelection({
			video: videoRef.current,
			mediaTracks: audioTracks,
			selectedTrackIndex: currentAudioTrack
		});
		if (typeof appendPlaybackDiagnostic === 'function') {
			appendPlaybackDiagnostic({
				scope: 'audio-track',
				stage: `initial-native-switch-${phase}`,
				status: nativeResult.status,
				reason: nativeResult.method,
				message: nativeResult.applied
					? `Selected native audio track ${nativeResult.index} from ${nativeResult.tracks.length} tracks.`
					: `Native initial audio selection failed with ${nativeResult.tracks.length} tracks.`
			});
		}
		if (nativeResult.applied) return false;
		if (nativeResult.status === 'native-unavailable' && phase === 'metadata') {
			return false;
		}
		if (typeof onNativeAudioSwitchFallback !== 'function') return false;
		Promise.resolve(onNativeAudioSwitchFallback({
			reason: nativeResult.status || 'native-initial-audio-switch-failed',
			audioStreamIndex: currentAudioTrack,
			subtitleStreamIndex: currentSubtitleTrack
		})).catch((error) => {
			console.warn('Failed to run native audio fallback:', error);
		});
		return true;
	}, [
		appendPlaybackDiagnostic,
		audioTracks,
		currentAudioTrack,
		currentSubtitleTrack,
		mediaSourceData?.DefaultAudioStreamIndex,
		mediaSourceData?.__selectedPlayMethod,
		onNativeAudioSwitchFallback,
		videoRef
	]);

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
		applyInitialNativeAudioSelection('metadata');
	}, [applyInitialNativeAudioSelection, item, playbackOverrideRef, setCurrentTime, videoRef]);

	const handleLoadedData = useCallback(() => {
		if (!videoRef.current || !loading) return;
		// `canplay` owns startup finalization. `loadeddata` can fire too early on webOS.
		lastProgressRef.current = {
			time: videoRef.current.currentTime || 0,
			timestamp: Date.now()
		};
	}, [lastProgressRef, loading, videoRef]);

	const handleCanPlay = useCallback(() => {
		if (!videoRef.current || playbackStartedRef.current || exitInProgressRef.current) return;
		applyInitialNativeAudioSelection('canplay');
		onVideoCanPlay?.();
	}, [
		applyInitialNativeAudioSelection,
		exitInProgressRef,
		onVideoCanPlay,
		playbackStartedRef,
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
		if (playbackFailureLockedRef.current || exitInProgressRef.current) return;
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
		isSubtitleCompatibilityError,
		mediaSourceData,
		playbackFailureLockedRef,
		playbackStartedRef,
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
