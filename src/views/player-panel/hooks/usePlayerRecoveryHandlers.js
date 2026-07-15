import {useCallback} from 'react';
import Hls from 'hls.js';
import {createHlsPlayerConfig} from '../constants';
import {getDynamicRangeInfo, normalizeDynamicRangeCap} from '../../../utils/playbackDynamicRange';
import {
	buildPlaybackOverride,
	resolveVideoSeekSeconds
} from '../utils/playbackOverride';
import {
	buildHlsErrorSummary,
	classifyHlsError
} from '../utils/hlsErrorClassification';
import {
	collectRecoveryStringValues,
	extractSubtitleStreamIndexFromValues,
	getSubtitleFallbackContext,
	hasRequestedSubtitleBurnIn,
	hasSubtitleCodecUnsupportedReason,
	isKnownImageSubtitleBurnInFailure,
	isSubtitleBurnInPlaybackFailure,
	isSubtitleBurnInPlaybackPath,
	shouldRequireSubtitleBurnInConsent,
	shouldRetrySubtitleBurnInWithSafeProfile
} from '../utils/playerRecoveryPolicy';

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
	setCurrentSubtitleTrack,
	requestSubtitleBurnInFallback,
	exitInProgressRef
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
		if (exitInProgressRef.current || playbackFailureLockedRef.current) {
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
			errorData ? buildHlsErrorSummary(errorData) : ''
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
				if (!exitInProgressRef.current && !playbackFailureLockedRef.current) {
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
		exitInProgressRef,
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

	const collectSubtitleErrorValues = useCallback((errorData) => {
		const fromMessage = typeof errorData === 'string' ? errorData : '';
		const responseUrl = errorData?.response?.url;
		const fragmentUrl = errorData?.frag?.url;
		const videoUrl = videoRef.current?.currentSrc || '';
		const sourceUrls = [
			mediaSourceData?.TranscodingUrl,
			mediaSourceData?.DirectStreamUrl,
			mediaSourceData?.Path,
			mediaSourceData?.__debugVideoUrl
		];
		return [
			fromMessage,
			responseUrl,
			fragmentUrl,
			videoUrl,
			...sourceUrls,
			...collectRecoveryStringValues(errorData)
		]
			.filter((value) => typeof value === 'string' && value.length > 0);
	}, [mediaSourceData, videoRef]);

	const isSubtitleCompatibilityError = useCallback((errorData) => {
		const values = collectSubtitleErrorValues(errorData);
		return hasSubtitleCodecUnsupportedReason(values);
	}, [collectSubtitleErrorValues]);

	const isSubtitlePlaybackFailure = useCallback((errorData) => {
		const values = collectSubtitleErrorValues(errorData);
		return hasSubtitleCodecUnsupportedReason(values) ||
			isSubtitleBurnInPlaybackPath({
				subtitlePolicy: mediaSourceData?.__debugSubtitlePolicy,
				values
			}) ||
			isSubtitleBurnInPlaybackFailure({
				errorData,
				subtitlePolicy: mediaSourceData?.__debugSubtitlePolicy,
				values
			});
	}, [collectSubtitleErrorValues, mediaSourceData?.__debugSubtitlePolicy]);

	const attemptTranscodeFallback = useCallback(async (reason) => {
		if (exitInProgressRef.current || playbackFailureLockedRef.current) {
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
		exitInProgressRef,
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
		if (exitInProgressRef.current || playbackFailureLockedRef.current) return false;
		const subtitlePolicy = mediaSourceData?.__debugSubtitlePolicy || {};
		const subtitleErrorValues = collectSubtitleErrorValues(errorData);
		const errorSubtitleIndex = extractSubtitleStreamIndexFromValues(subtitleErrorValues);
		const selectedSubtitle = Number.isInteger(currentSubtitleTrackRef.current) &&
			currentSubtitleTrackRef.current >= 0
			? currentSubtitleTrackRef.current
			: errorSubtitleIndex;
		if (!(Number.isInteger(selectedSubtitle) && selectedSubtitle >= 0)) return false;
		if (!isSubtitlePlaybackFailure(errorData)) return false;
		if (subtitleCompatibilityFallbackAttemptedRef.current) {
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'subtitle-compatibility',
				status: 'skipped',
				reason: 'already-handled',
				message: 'Subtitle compatibility fallback is already handling this stream.'
			});
			return true;
		}
		if (playbackSettingsRef.current.strictTranscodingMode) {
			setToastMessage({
				message: 'Subtitle burn-in failed. Strict transcoding mode is enabled.',
				severity: 'warning'
			});
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
		const burnInPlaybackFailed = isSubtitleBurnInPlaybackPath({
			subtitlePolicy,
			values: subtitleErrorValues
		}) || isSubtitleBurnInPlaybackFailure({
			errorData,
			subtitlePolicy,
			values: subtitleErrorValues
		});
		const knownImageSubtitleHardwareBurnInFailure = isKnownImageSubtitleBurnInFailure({
			errorData,
			subtitlePolicy,
			values: subtitleErrorValues,
			mediaSourceData,
			subtitleStreamIndex: selectedSubtitle
		});
		if (
			!hasRequestedSubtitleBurnIn(subtitlePolicy) &&
			!burnInPlaybackFailed &&
			typeof requestSubtitleBurnInFallback === 'function'
		) {
			const requiresHdrConsent = shouldRequireSubtitleBurnInConsent({
				mediaSourceData,
				subtitlePolicy,
				playbackSettings: playbackSettingsRef.current
			});
			const requiresBitmapBurnInConsent =
				subtitlePolicy?.requiresBitmapBurnInConsent === true ||
				subtitlePolicy?.fallbackPromptType === 'bitmap-burn-in-fragility' ||
				String(subtitlePolicy?.renderer || '').startsWith('client-bitmap');
			setToastMessage({
				message: requiresBitmapBurnInConsent
					? 'Image subtitle burn-in requires confirmation before server transcoding.'
					: requiresHdrConsent
					? 'Subtitle playback failed. Burn-in requires HDR/DV consent.'
					: 'Subtitle playback failed. Retrying with subtitle burn-in...',
				severity: 'warning'
			});
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'subtitle-compatibility',
				status: 'applied',
				reason: requiresBitmapBurnInConsent
					? 'bitmap-burn-in-fragility-consent-required'
					: requiresHdrConsent
					? 'subtitle-burn-in-consent-required'
					: 'subtitle-burn-in-fallback',
				message: requiresBitmapBurnInConsent
					? 'Requesting user confirmation before trying fragile image subtitle burn-in.'
					: requiresHdrConsent
					? 'Requesting user consent before burning subtitles into HDR/DV playback.'
					: 'Retrying playback with forced subtitle burn-in after a subtitle compatibility failure.'
			});
			await requestSubtitleBurnInFallback({
				subtitleStreamIndex: selectedSubtitle,
				reason: 'subtitle-codec-not-supported',
				requiresHdrConsent,
				requiresBitmapBurnInConsent,
				fallbackType: requiresBitmapBurnInConsent ? 'bitmap-burn-in-fragility' : ''
			});
			return true;
		}
		if (shouldRetrySubtitleBurnInWithSafeProfile({
			burnInPlaybackFailed,
			mediaSourceData,
			playbackOverride: playbackOverrideRef.current,
			knownImageSubtitleHardwareBurnInFailure
		})) {
			setToastMessage({
				message: 'Subtitle burn-in stream failed. Retrying with a safer transcode profile...',
				severity: 'warning'
			});
			stopHlsRecoveryLoop();
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'subtitle-burn-in-safe-profile',
				status: 'applied',
				reason: 'encoded-subtitle-fragment-failed',
				message: 'Retrying subtitle burn-in with HLS TS, H.264 video, AAC audio, and a 6-channel audio cap.'
			});
			playbackOverrideRef.current = buildPlaybackOverride({
				baseOptions: playbackOptions,
				mediaSourceId: mediaSourceData?.Id,
				audioStreamIndex: currentAudioTrackRef.current,
				subtitleStreamIndex: selectedSubtitle,
				seekSeconds: resolveVideoSeekSeconds(videoRef.current),
				extra: {
					forceSubtitleBurnIn: true,
					forceSubtitleBurnInOnHdr: true,
					safeSubtitleBurnInProfile: true
				}
			});
			try {
				await handleStop();
			} catch (safeFallbackError) {
				console.warn('Failed while preparing safe subtitle burn-in retry:', safeFallbackError);
				appendPlaybackDiagnostic?.({
					scope: 'runtime-fallback',
					stage: 'subtitle-burn-in-safe-profile',
					status: 'failed',
					reason: 'stop-failed',
					message: safeFallbackError?.message || 'Failed while preparing safe subtitle burn-in retry.'
				});
			}
			if (typeof loadVideoRef.current === 'function') {
				setLoadingStatusMessage('Restarting stream...');
				loadVideoRef.current();
			}
			return true;
		}

		const subtitleFallbackContext = getSubtitleFallbackContext(mediaSourceData, {
			burnInRequestedOverride: burnInPlaybackFailed
		});
		stopHlsRecoveryLoop();
		console.warn('[Player] Subtitle compatibility fallback: requesting no-subtitle consent.', {
			reason: subtitleFallbackContext.reason,
			mediaSourceId: mediaSourceData?.Id || null,
			audioStreamIndex: currentAudioTrackRef.current,
			subtitleStreamIndex: -1
		});
		appendPlaybackDiagnostic?.({
			scope: 'runtime-fallback',
			stage: 'subtitle-compatibility',
			status: typeof requestSubtitleBurnInFallback === 'function' ? 'pending-user-consent' : 'applied',
			reason: subtitleFallbackContext.reason,
			message: typeof requestSubtitleBurnInFallback === 'function'
				? 'Requesting user confirmation before continuing without selected subtitles.'
				: subtitleFallbackContext.message
		});
		if (typeof requestSubtitleBurnInFallback === 'function') {
			setToastMessage({
				message: knownImageSubtitleHardwareBurnInFailure
					? 'Jellyfin failed to burn in image-based subtitles. Choose whether to continue without subtitles.'
					: subtitleFallbackContext.toast.message,
				severity: 'warning'
			});
			setShowControls(true);
			setLoading(false);
			setLoadingStatusMessage('Loading...');
			await requestSubtitleBurnInFallback({
				subtitleStreamIndex: selectedSubtitle,
				reason: knownImageSubtitleHardwareBurnInFailure
					? 'image-subtitle-hardware-burn-in-failed'
					: subtitleFallbackContext.reason,
				requiresNoSubtitleConsent: true,
				fallbackType: 'no-subtitles'
			});
			return true;
		}
		setToastMessage(subtitleFallbackContext.toast);
		currentSubtitleTrackRef.current = -1;
		playbackOverrideRef.current = buildPlaybackOverride({
			baseOptions: playbackOptions,
			mediaSourceId: mediaSourceData?.Id,
			audioStreamIndex: currentAudioTrackRef.current,
			subtitleStreamIndex: -1,
			seekSeconds: resolveVideoSeekSeconds(videoRef.current),
			extra: {
				forceSubtitleBurnIn: false,
				forceSubtitleBurnInOnHdr: false,
				safeSubtitleBurnInProfile: false,
				subtitleFallbackConsent: 'no-subtitles'
			}
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
		collectSubtitleErrorValues,
		isSubtitlePlaybackFailure,
		loadVideoRef,
		mediaSourceData,
		playbackFailureLockedRef,
		playbackOptions,
		playbackOverrideRef,
		appendPlaybackDiagnostic,
		playbackSettingsRef,
		requestSubtitleBurnInFallback,
		setCurrentSubtitleTrack,
		setLoading,
		setLoadingStatusMessage,
		setShowControls,
		exitInProgressRef,
		setToastMessage,
		stopHlsRecoveryLoop,
		subtitleCompatibilityFallbackAttemptedRef,
		videoRef
	]);

	const attemptHlsFatalRecovery = useCallback((hls, errorData, source = 'HLS') => {
		if (!errorData?.fatal) return false;
		if (exitInProgressRef.current || playbackFailureLockedRef.current) return true;

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
					buildHlsErrorSummary(errorData)
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
					buildHlsErrorSummary(errorData)
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
		exitInProgressRef,
		showPlaybackError
	]);

	const attachHlsPlayback = useCallback((video, sourceUrl, sourceLabel = 'HLS.js') => {
		const hls = new Hls(createHlsPlayerConfig(hlsConfig));
		hlsRef.current = hls;
		hls.loadSource(sourceUrl);
		hls.attachMedia(video);

		hls.on(Hls.Events.ERROR, (event, data) => {
			const hlsError = classifyHlsError(data);
			const errorSummary = buildHlsErrorSummary(data);
			if (hlsError.severity === 'error') {
				console.error(`${sourceLabel} error:`, errorSummary);
			} else if (hlsError.severity === 'warning') {
				console.warn(`${sourceLabel} warning:`, errorSummary);
			} else {
				console.info(`${sourceLabel} recovered:`, errorSummary);
			}
			appendPlaybackDiagnostic?.({
				scope: 'hls-runtime',
				stage: hlsError.category,
				status: hlsError.fatal ? 'fatal' : hlsError.severity,
				reason: hlsError.reason,
				message: `HLS ${hlsError.category} (${hlsError.reason}) after subtitle fallback=${currentSubtitleTrackRef.current === -1 ? 'yes' : 'no'}; engine=${sourceLabel}; playMethod=${mediaSourceData?.__selectedPlayMethod || '-'}.`
			});
			if (isSubtitleCompatibilityError(data) && playbackSettingsRef.current.strictTranscodingMode) {
				showPlaybackError('Subtitle burn-in failed while strict transcoding is enabled.');
				return;
			}
			if (hlsError.subtitleCandidate) {
				attemptSubtitleCompatibilityFallback(data).then((handled) => {
					if (!handled && hlsError.fatal) {
						attemptHlsFatalRecovery(hls, data, sourceLabel);
					}
				});
				return;
			}
			if (hlsError.fatal) {
				attemptHlsFatalRecovery(hls, data, sourceLabel);
			}
		});

		return hls;
	}, [
		attemptHlsFatalRecovery,
		attemptSubtitleCompatibilityFallback,
		appendPlaybackDiagnostic,
		currentSubtitleTrackRef,
		hlsConfig,
		hlsRef,
		isSubtitleCompatibilityError,
		mediaSourceData,
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
