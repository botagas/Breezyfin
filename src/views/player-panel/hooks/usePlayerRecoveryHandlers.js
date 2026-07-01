import {useCallback} from 'react';
import Hls from 'hls.js';
import {getDynamicRangeInfo, normalizeDynamicRangeCap} from '../../../utils/playbackDynamicRange';
import {
	buildPlaybackOverride,
	resolveVideoSeekSeconds
} from '../utils/playbackOverride';

export const usePlayerRecoveryHandlers = ({
	maxHlsNetworkRecoveryAttempts,
	maxHlsMediaRecoveryAttempts,
	maxPlaySessionRebuildAttempts,
	hlsConfig,
	clearStartWatch,
	playbackOptions,
	setToastMessage,
	setError,
	setShowControls,
	setLoading,
	setLoadingStatusMessage,
	setPlaying,
	handleStop,
	currentAudioTrackRef,
	currentSubtitleTrackRef,
	playbackFailureLockedRef,
	hlsNetworkRecoveryAttemptsRef,
	hlsMediaRecoveryAttemptsRef,
	hlsRef,
	nativeHlsFallbackCleanupRef,
	reloadAttemptedRef,
	playSessionRebuildAttemptsRef,
	videoRef,
	seekOffsetRef,
	startupFallbackTimerRef,
	playbackOverrideRef,
	loadVideoRef,
	mediaSourceData,
	appendPlaybackDiagnostic,
	playbackSettingsRef,
	transcodeFallbackAttemptedRef,
	dynamicRangeFallbackAttemptedRef,
	subtitleCompatibilityFallbackAttemptedRef,
	setCurrentSubtitleTrack
}) => {
	const resetRecoveryGuards = useCallback(() => {
		playbackFailureLockedRef.current = false;
		hlsNetworkRecoveryAttemptsRef.current = 0;
		hlsMediaRecoveryAttemptsRef.current = 0;
		dynamicRangeFallbackAttemptedRef.current = false;
	}, [
		dynamicRangeFallbackAttemptedRef,
		hlsMediaRecoveryAttemptsRef,
		hlsNetworkRecoveryAttemptsRef,
		playbackFailureLockedRef
	]);

	const stopHlsRecoveryLoop = useCallback(() => {
		if (typeof nativeHlsFallbackCleanupRef?.current === 'function') {
			nativeHlsFallbackCleanupRef.current();
		}
		if (!hlsRef.current) return;
		try {
			hlsRef.current.stopLoad?.();
		} catch (err) {
			console.warn('Error stopping HLS load:', err);
		}
		try {
			hlsRef.current.destroy();
		} catch (err) {
			console.warn('Error destroying HLS instance during failure handling:', err);
		}
		hlsRef.current = null;
	}, [hlsRef, nativeHlsFallbackCleanupRef]);

	const attemptPlaybackSessionRebuild = useCallback((reason, options = {}) => {
		const {
			toast = '',
			errorData = null
		} = options;
		if (playbackFailureLockedRef.current) {
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'session-rebuild',
				status: 'skipped',
				reason: 'playback-failure-locked',
				message: 'Session rebuild skipped because playback is already locked in error state.'
			});
			return false;
		}
		if (reloadAttemptedRef.current) {
			console.warn(`[Player] ${reason}, rebuild already attempted for this load`);
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'session-rebuild',
				status: 'skipped',
				reason: 'already-attempted',
				message: String(reason || 'Session rebuild already attempted.')
			});
			return false;
		}
		if (playSessionRebuildAttemptsRef.current >= maxPlaySessionRebuildAttempts) {
			console.warn(
				`[Player] ${reason}, rebuild limit reached (${maxPlaySessionRebuildAttempts})`
			);
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'session-rebuild',
				status: 'skipped',
				reason: 'limit-reached',
				message: `Session rebuild limit reached (${maxPlaySessionRebuildAttempts}).`
			});
			return false;
		}

		playSessionRebuildAttemptsRef.current += 1;
		reloadAttemptedRef.current = true;
		const rebuildAttempt = playSessionRebuildAttemptsRef.current;
		const seekSeconds = Math.max(0, (videoRef.current?.currentTime || 0) + seekOffsetRef.current);

		console.warn(
			`[Player] ${reason}. Rebuilding session with fresh PlaySessionId (${rebuildAttempt}/${maxPlaySessionRebuildAttempts})`,
			errorData || ''
		);
		appendPlaybackDiagnostic?.({
			scope: 'runtime-fallback',
			stage: 'session-rebuild',
			status: 'applied',
			reason: String(reason || 'session-rebuild'),
			message: `Rebuilding playback session (${rebuildAttempt}/${maxPlaySessionRebuildAttempts}).`
		});

		clearStartWatch();
		if (startupFallbackTimerRef.current) {
			clearTimeout(startupFallbackTimerRef.current);
			startupFallbackTimerRef.current = null;
		}
		if (typeof nativeHlsFallbackCleanupRef?.current === 'function') {
			nativeHlsFallbackCleanupRef.current();
		}

		if (hlsRef.current) {
			try {
				hlsRef.current.destroy();
			} catch (destroyErr) {
				console.warn('Failed to destroy HLS instance during session rebuild:', destroyErr);
			}
			hlsRef.current = null;
		}
		if (videoRef.current) {
			try {
				videoRef.current.pause();
			} catch (_) {
				// Ignore pause failures while recovering.
			}
			videoRef.current.removeAttribute('src');
			videoRef.current.load();
		}

		playbackOverrideRef.current = buildPlaybackOverride({
			baseOptions: playbackOptions,
			mediaSourceId: mediaSourceData?.Id,
			audioStreamIndex: currentAudioTrackRef.current,
			subtitleStreamIndex: currentSubtitleTrackRef.current,
			seekSeconds
		});

		setError(null);
		setLoading(true);
		setLoadingStatusMessage('Restarting stream...');
		setPlaying(false);
		if (toast) {
			setToastMessage(toast);
		}

		if (typeof loadVideoRef.current === 'function') {
			setTimeout(() => {
				if (!playbackFailureLockedRef.current) {
					loadVideoRef.current();
				}
			}, 0);
			return true;
		}
		return false;
	}, [
		clearStartWatch,
		currentAudioTrackRef,
		currentSubtitleTrackRef,
		hlsRef,
		loadVideoRef,
		maxPlaySessionRebuildAttempts,
		mediaSourceData?.Id,
		nativeHlsFallbackCleanupRef,
		playSessionRebuildAttemptsRef,
		playbackFailureLockedRef,
		playbackOptions,
		playbackOverrideRef,
		appendPlaybackDiagnostic,
		reloadAttemptedRef,
		seekOffsetRef,
		setError,
		setLoading,
		setLoadingStatusMessage,
		setPlaying,
		setToastMessage,
		startupFallbackTimerRef,
		videoRef
	]);

	const showPlaybackError = useCallback((message) => {
		playbackFailureLockedRef.current = true;
		stopHlsRecoveryLoop();
		const errorMessage = message || 'Failed to play video';
		setError(errorMessage);
		setToastMessage('');
		setShowControls(true);
		setLoading(false);
		setLoadingStatusMessage('Loading...');
		clearStartWatch();
		if (startupFallbackTimerRef.current) {
			clearTimeout(startupFallbackTimerRef.current);
			startupFallbackTimerRef.current = null;
		}
	}, [clearStartWatch, playbackFailureLockedRef, setError, setLoading, setLoadingStatusMessage, setShowControls, setToastMessage, startupFallbackTimerRef, stopHlsRecoveryLoop]);

	const isSubtitleCompatibilityError = useCallback((errorData) => {
		const fromMessage = typeof errorData === 'string' ? errorData : '';
		const responseUrl = errorData?.response?.url;
		const fragmentUrl = errorData?.frag?.url;
		const videoUrl = videoRef.current?.currentSrc || '';
		const joined = [fromMessage, responseUrl, fragmentUrl, videoUrl]
			.filter((value) => typeof value === 'string' && value.length > 0)
			.join(' ');
		return joined.includes('SubtitleCodecNotSupported');
	}, [videoRef]);

	const attemptTranscodeFallback = useCallback(async (reason) => {
		if (playbackFailureLockedRef.current) {
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'transcode-fallback',
				status: 'skipped',
				reason: 'playback-failure-locked',
				message: 'Transcode fallback skipped because playback is already locked in error state.'
			});
			return false;
		}
		if (playbackSettingsRef.current.forceDolbyVision === true) {
			setToastMessage('Force DV is enabled. Disable it to allow HDR/transcode fallback.');
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'transcode-fallback',
				status: 'skipped',
				reason: 'force-dolby-vision',
				message: 'Transcode fallback skipped because Force DV is enabled.'
			});
			return false;
		}
		const reasonText = typeof reason === 'string' ? reason.toLowerCase() : '';
		const currentDynamicRangeCap = normalizeDynamicRangeCap(playbackSettingsRef.current.dynamicRangeCap);
		const dynamicRangeInfo = getDynamicRangeInfo(mediaSourceData);
		const shouldAttemptRangeFallback =
			!reasonText.includes('subtitle') &&
			!dynamicRangeFallbackAttemptedRef.current &&
			currentDynamicRangeCap !== 'sdr' &&
			dynamicRangeInfo.id === 'DV';
		if (shouldAttemptRangeFallback) {
			const nextDynamicRangeCap = currentDynamicRangeCap === 'hdr10' ? 'sdr' : 'hdr10';
			dynamicRangeFallbackAttemptedRef.current = true;
			setToastMessage(
				nextDynamicRangeCap === 'hdr10'
					? 'Dolby Vision failed. Retrying with HDR fallback...'
					: 'HDR fallback failed. Retrying in SDR mode...'
			);
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'dynamic-range-fallback',
				status: 'applied',
				reason: reasonText || 'playback-failure',
				message: `Retrying playback with ${nextDynamicRangeCap.toUpperCase()} dynamic range cap.`
			});
			playbackOverrideRef.current = buildPlaybackOverride({
				baseOptions: playbackOptions,
				mediaSourceId: mediaSourceData?.Id,
				audioStreamIndex: currentAudioTrackRef.current,
				subtitleStreamIndex: currentSubtitleTrackRef.current,
				seekSeconds: resolveVideoSeekSeconds(videoRef.current),
				extra: {
					dynamicRangeCap: nextDynamicRangeCap,
					avoidDolbyVision: true
				}
			});
			try {
				await handleStop();
			} catch (rangeFallbackError) {
				console.warn('Failed while preparing dynamic range fallback:', rangeFallbackError);
				appendPlaybackDiagnostic?.({
					scope: 'runtime-fallback',
					stage: 'dynamic-range-fallback',
					status: 'failed',
					reason: 'stop-failed',
					message: rangeFallbackError?.message || 'Failed while preparing dynamic range fallback.'
				});
			}
			setError(null);
			setLoading(true);
			setLoadingStatusMessage('Restarting stream...');
			setPlaying(false);
			if (typeof loadVideoRef.current === 'function') {
				loadVideoRef.current();
				return true;
			}
		}
		if (playbackSettingsRef.current.strictTranscodingMode || transcodeFallbackAttemptedRef.current) {
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'transcode-fallback',
				status: 'skipped',
				reason: playbackSettingsRef.current.strictTranscodingMode ? 'strict-transcoding-mode' : 'already-attempted',
				message: 'Transcode fallback was not applicable.'
			});
			return false;
		}
		if (!mediaSourceData?.SupportsTranscoding) {
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'transcode-fallback',
				status: 'skipped',
				reason: 'server-transcoding-unsupported',
				message: 'Server did not report transcoding support for this source.'
			});
			return false;
		}
		transcodeFallbackAttemptedRef.current = true;
		console.warn('[Player] Attempting transcode fallback. Reason:', reason);
		appendPlaybackDiagnostic?.({
			scope: 'runtime-fallback',
			stage: 'transcode-fallback',
			status: 'applied',
			reason: String(reason || 'playback-failure'),
			message: 'Retrying playback with forced transcoding.'
		});
		playbackOverrideRef.current = buildPlaybackOverride({
			baseOptions: playbackOptions,
			mediaSourceId: mediaSourceData?.Id,
			audioStreamIndex: currentAudioTrackRef.current,
			subtitleStreamIndex: currentSubtitleTrackRef.current,
			seekSeconds: resolveVideoSeekSeconds(videoRef.current)
		});
		setToastMessage('Switching to transcoding...');
		await handleStop();
		setError(null);
		setLoading(true);
		setLoadingStatusMessage('Restarting stream...');
		if (loadVideoRef.current) {
			loadVideoRef.current(true);
		}
		return true;
	}, [
		handleStop,
		loadVideoRef,
		mediaSourceData,
		playbackFailureLockedRef,
		playbackSettingsRef,
		setError,
		setLoading,
		setLoadingStatusMessage,
		setPlaying,
		setToastMessage,
		playbackOptions,
		playbackOverrideRef,
		appendPlaybackDiagnostic,
		currentAudioTrackRef,
		currentSubtitleTrackRef,
		videoRef,
		dynamicRangeFallbackAttemptedRef,
		transcodeFallbackAttemptedRef
	]);

	const attemptSubtitleCompatibilityFallback = useCallback(async (errorData = null) => {
		if (playbackFailureLockedRef.current) return false;
		if (subtitleCompatibilityFallbackAttemptedRef.current) return false;
		const selectedSubtitle = currentSubtitleTrackRef.current;
		if (!(Number.isInteger(selectedSubtitle) && selectedSubtitle >= 0)) return false;
		if (!isSubtitleCompatibilityError(errorData)) return false;
		if (playbackSettingsRef.current.strictTranscodingMode) {
			setToastMessage('Subtitle burn-in failed. Strict transcoding mode is enabled.');
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'subtitle-compatibility',
				status: 'skipped',
				reason: 'strict-transcoding-mode',
				message: 'Subtitle compatibility fallback skipped because strict transcoding is enabled.'
			});
			return false;
		}

		subtitleCompatibilityFallbackAttemptedRef.current = true;
		setToastMessage('Subtitle track is not supported by server transcoding. Retrying without subtitles.');
		appendPlaybackDiagnostic?.({
			scope: 'runtime-fallback',
			stage: 'subtitle-compatibility',
			status: 'applied',
			reason: 'subtitle-codec-not-supported',
			message: 'Retrying playback without subtitles after subtitle compatibility error.'
		});
		playbackOverrideRef.current = buildPlaybackOverride({
			baseOptions: playbackOptions,
			mediaSourceId: mediaSourceData?.Id,
			audioStreamIndex: currentAudioTrackRef.current,
			subtitleStreamIndex: -1,
			seekSeconds: resolveVideoSeekSeconds(videoRef.current)
		});
		setCurrentSubtitleTrack(-1);
		try {
			await handleStop();
		} catch (fallbackError) {
			console.warn('Failed while preparing subtitle compatibility fallback:', fallbackError);
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'subtitle-compatibility',
				status: 'failed',
				reason: 'stop-failed',
				message: fallbackError?.message || 'Failed while preparing subtitle compatibility fallback.'
			});
		}
		if (typeof loadVideoRef.current === 'function') {
			setLoadingStatusMessage('Restarting stream...');
			loadVideoRef.current();
		}
		return true;
	}, [
		currentAudioTrackRef,
		currentSubtitleTrackRef,
		handleStop,
		isSubtitleCompatibilityError,
		loadVideoRef,
		mediaSourceData?.Id,
		playbackFailureLockedRef,
		playbackOptions,
		playbackOverrideRef,
		appendPlaybackDiagnostic,
		playbackSettingsRef,
		setCurrentSubtitleTrack,
		setLoadingStatusMessage,
		setToastMessage,
		subtitleCompatibilityFallbackAttemptedRef,
		videoRef
	]);

	const attemptHlsFatalRecovery = useCallback((hls, errorData, source = 'HLS') => {
		if (!errorData?.fatal) return false;
		if (playbackFailureLockedRef.current) return true;

		if (errorData.type === Hls.ErrorTypes.NETWORK_ERROR) {
			const statusCode = Number(errorData?.response?.code);
			const isServerHttpFailure = Number.isFinite(statusCode) && statusCode >= 500;
			if (isServerHttpFailure && errorData.details === 'fragLoadError') {
				const rebuilt = attemptPlaybackSessionRebuild(
					`${source} fragment request failed with HTTP ${statusCode}`,
					{
						toast: 'Server stream failed. Rebuilding playback session...',
						errorData
					}
				);
				if (rebuilt) {
					return true;
				}
				showPlaybackError(
					'Playback failed after session rebuild attempt. Please retry or go back.'
				);
				return true;
			}

			const attemptNumber = hlsNetworkRecoveryAttemptsRef.current + 1;
			if (attemptNumber <= maxHlsNetworkRecoveryAttempts) {
				hlsNetworkRecoveryAttemptsRef.current = attemptNumber;
				console.warn(
					`[Player] ${source} fatal network error. Recovery ${attemptNumber}/${maxHlsNetworkRecoveryAttempts}`,
					errorData
				);
				hls.startLoad();
				return true;
			}
			showPlaybackError(
				'Playback failed after multiple network retries. Please retry or go back.'
			);
			return true;
		}

		if (errorData.type === Hls.ErrorTypes.MEDIA_ERROR) {
			const attemptNumber = hlsMediaRecoveryAttemptsRef.current + 1;
			if (attemptNumber <= maxHlsMediaRecoveryAttempts) {
				hlsMediaRecoveryAttemptsRef.current = attemptNumber;
				console.warn(
					`[Player] ${source} fatal media error. Recovery ${attemptNumber}/${maxHlsMediaRecoveryAttempts}`,
					errorData
				);
				hls.recoverMediaError();
				return true;
			}
			showPlaybackError(
				'Playback failed after repeated media recovery attempts. Please retry or go back.'
			);
			return true;
		}

		showPlaybackError(`HLS playback error: ${errorData.details || 'unknown error'}`);
		return true;
	}, [
		attemptPlaybackSessionRebuild,
		hlsMediaRecoveryAttemptsRef,
		hlsNetworkRecoveryAttemptsRef,
		maxHlsMediaRecoveryAttempts,
		maxHlsNetworkRecoveryAttempts,
		playbackFailureLockedRef,
		showPlaybackError
	]);

	const attachHlsPlayback = useCallback((video, sourceUrl, sourceLabel = 'HLS.js') => {
		const hls = new Hls(hlsConfig);
		hlsRef.current = hls;
		hls.loadSource(sourceUrl);
		hls.attachMedia(video);

		hls.on(Hls.Events.ERROR, (event, data) => {
			console.error(`${sourceLabel} error:`, data);
			if (isSubtitleCompatibilityError(data) && playbackSettingsRef.current.strictTranscodingMode) {
				showPlaybackError('Subtitle burn-in failed while strict transcoding is enabled.');
				return;
			}
			if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.details === 'fragLoadError') {
				attemptSubtitleCompatibilityFallback(data).then((handled) => {
					if (!handled) {
						attemptHlsFatalRecovery(hls, data, sourceLabel);
					}
				});
				return;
			}
			if (data.fatal) {
				attemptHlsFatalRecovery(hls, data, sourceLabel);
			}
		});

		return hls;
	}, [
		attemptHlsFatalRecovery,
		attemptSubtitleCompatibilityFallback,
		hlsConfig,
		hlsRef,
		isSubtitleCompatibilityError,
		playbackSettingsRef,
		showPlaybackError
	]);

	return {
		resetRecoveryGuards,
		stopHlsRecoveryLoop,
		attemptPlaybackSessionRebuild,
		showPlaybackError,
		attemptHlsFatalRecovery,
		attemptTranscodeFallback,
		isSubtitleCompatibilityError,
		attemptSubtitleCompatibilityFallback,
		attachHlsPlayback
	};
};
