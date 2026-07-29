import {useCallback} from 'react';
import Hls from 'hls.js';
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
	isServerTranscodingStartupFailure,
	isSubtitleBurnInPlaybackFailure,
	isSubtitleBurnInPlaybackPath,
	SERVER_TRANSCODING_FAILURE_DIAGNOSTIC,
	SERVER_TRANSCODING_FAILURE_MESSAGE,
	shouldRequireSubtitleBurnInConsent,
	shouldRetrySubtitleBurnInWithSafeProfile
} from '../utils/playerRecoveryPolicy';
import {isPlaybackRuntimeContextCurrent} from '../utils/playbackRuntimeContext';

export const usePlayerRecoveryHandlers = ({
	maxHlsNetworkRecoveryAttempts,
	maxHlsMediaRecoveryAttempts,
	maxPlaySessionRebuildAttempts,
	clearStartupDeadline,
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
	reloadAttemptedRef,
	playSessionRebuildAttemptsRef,
	videoRef,
	seekOffsetRef,
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
	requestPlaybackDecision,
	exitInProgressRef,
	playbackStartedRef,
	playbackGenerationRef,
	playbackRuntimeContextRef,
	nativeSourceTokenRef,
	detachPlaybackSource
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
		detachPlaybackSource?.({
			clearRuntimeContext: false,
			resetVideo: true,
			reason: 'recovery-stop'
		});
	}, [detachPlaybackSource]);

	const attemptPlaybackSessionRebuild = useCallback((reason, options = {}) => {
		const {
			toast = '',
			errorData = null,
			runtimeContext = null
		} = options;
		const activeMediaSourceData = runtimeContext?.mediaSourceData || mediaSourceData;
		if (
			runtimeContext &&
			!isPlaybackRuntimeContextCurrent({
				runtimeContext,
				activeRuntimeContext: playbackRuntimeContextRef.current,
				generation: playbackGenerationRef.current,
				exitInProgress: exitInProgressRef.current
			})
		) {
			return false;
		}
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

		clearStartupDeadline();
		detachPlaybackSource?.({
			clearRuntimeContext: false,
			resetVideo: true,
			reason: 'session-rebuild'
		});

		playbackOverrideRef.current = buildPlaybackOverride({
			baseOptions: playbackOptions,
			mediaSourceId: activeMediaSourceData?.Id,
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
				const runtimeStillCurrent = !runtimeContext || isPlaybackRuntimeContextCurrent({
					runtimeContext,
					activeRuntimeContext: playbackRuntimeContextRef.current,
					generation: playbackGenerationRef.current,
					exitInProgress: exitInProgressRef.current
				});
				if (
					runtimeStillCurrent &&
					!exitInProgressRef.current &&
					!playbackFailureLockedRef.current
				) {
					loadVideoRef.current();
				}
			}, 0);
			return true;
		}
		return false;
	}, [
		clearStartupDeadline,
		currentAudioTrackRef,
		currentSubtitleTrackRef,
		detachPlaybackSource,
		loadVideoRef,
		maxPlaySessionRebuildAttempts,
		mediaSourceData,
		playSessionRebuildAttemptsRef,
		exitInProgressRef,
		playbackFailureLockedRef,
		playbackOptions,
		playbackOverrideRef,
		playbackGenerationRef,
		playbackRuntimeContextRef,
		appendPlaybackDiagnostic,
		reloadAttemptedRef,
		seekOffsetRef,
		setError,
		setLoading,
		setLoadingStatusMessage,
		setPlaying,
		setToastMessage,
		videoRef
	]);

	const showPlaybackError = useCallback((message, {detachMedia = false} = {}) => {
		playbackFailureLockedRef.current = true;
		detachPlaybackSource?.({
			clearRuntimeContext: detachMedia,
			resetVideo: true,
			reason: detachMedia ? 'terminal-startup-error' : 'terminal-playback-error'
		});
		const errorMessage = message || 'Failed to play video';
		setError(errorMessage);
		setToastMessage('');
		setShowControls(true);
		setLoading(false);
		setPlaying(false);
		setLoadingStatusMessage('Loading...');
		clearStartupDeadline();
	}, [clearStartupDeadline, detachPlaybackSource, playbackFailureLockedRef, setError, setLoading, setLoadingStatusMessage, setPlaying, setShowControls, setToastMessage]);

	const collectSubtitleErrorValues = useCallback((errorData, sourceData = mediaSourceData) => {
		const fromMessage = typeof errorData === 'string' ? errorData : '';
		const responseUrl = errorData?.response?.url;
		const fragmentUrl = errorData?.frag?.url;
		const videoUrl = videoRef.current?.currentSrc || '';
		const sourceUrls = [
			sourceData?.TranscodingUrl,
			sourceData?.DirectStreamUrl,
			sourceData?.Path,
			sourceData?.__debugVideoUrl
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

	const isSubtitleCompatibilityError = useCallback((errorData, sourceData = mediaSourceData) => {
		const values = collectSubtitleErrorValues(errorData, sourceData);
		return hasSubtitleCodecUnsupportedReason(values);
	}, [collectSubtitleErrorValues, mediaSourceData]);

	const isSubtitlePlaybackFailure = useCallback((errorData, sourceData = mediaSourceData) => {
		const values = collectSubtitleErrorValues(errorData, sourceData);
		return hasSubtitleCodecUnsupportedReason(values) ||
			isSubtitleBurnInPlaybackPath({
				subtitlePolicy: sourceData?.__debugSubtitlePolicy,
				values
			}) ||
			isSubtitleBurnInPlaybackFailure({
				errorData,
				subtitlePolicy: sourceData?.__debugSubtitlePolicy,
				values
			});
	}, [collectSubtitleErrorValues, mediaSourceData]);

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
			showPlaybackError(
				'Dolby Vision playback failed while Force DV is enabled. Disable Force DV to allow a confirmed HDR or SDR fallback.'
			);
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
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'dynamic-range-fallback',
				status: 'pending-user-consent',
				reason: reasonText || 'playback-failure',
				message: `Waiting for confirmation before using ${nextDynamicRangeCap.toUpperCase()} playback.`
			});
			if (typeof requestPlaybackDecision === 'function') {
				await requestPlaybackDecision({
					type: 'dynamic-range-fallback',
					runtime: true,
					itemId: mediaSourceData?.__itemId || null,
					mediaSourceId: mediaSourceData?.Id || null,
					generation: playbackGenerationRef.current,
					originalRange: 'DV',
					proposedRange: nextDynamicRangeCap,
					reason: reasonText || 'dolby-vision-playback-failed',
					resumeTicks: Math.round(
						Math.max(0, resolveVideoSeekSeconds(videoRef.current)) * 10000000
					)
				});
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
		setToastMessage(
			reasonText === 'startup-no-progress'
				? {
					message: 'Direct playback did not start. Retrying with server transcoding.',
					severity: 'warning'
				}
				: 'Switching to transcoding...'
		);
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
		setToastMessage,
		playbackOptions,
		playbackOverrideRef,
		appendPlaybackDiagnostic,
		requestPlaybackDecision,
		currentAudioTrackRef,
		currentSubtitleTrackRef,
		videoRef,
		dynamicRangeFallbackAttemptedRef,
		transcodeFallbackAttemptedRef,
		playbackGenerationRef,
		showPlaybackError
	]);

	const attemptSubtitleCompatibilityFallback = useCallback(async (
		errorData = null,
		runtimeContext = null
	) => {
		if (exitInProgressRef.current || playbackFailureLockedRef.current) return false;
		const activeMediaSourceData = runtimeContext?.mediaSourceData || mediaSourceData;
		const subtitlePolicy = activeMediaSourceData?.__debugSubtitlePolicy || {};
		const subtitleErrorValues = collectSubtitleErrorValues(errorData, activeMediaSourceData);
		const errorSubtitleIndex = extractSubtitleStreamIndexFromValues(subtitleErrorValues);
		const selectedSubtitle = Number.isInteger(currentSubtitleTrackRef.current) &&
			currentSubtitleTrackRef.current >= 0
			? currentSubtitleTrackRef.current
			: errorSubtitleIndex;
		if (!(Number.isInteger(selectedSubtitle) && selectedSubtitle >= 0)) return false;
		if (!isSubtitlePlaybackFailure(errorData, activeMediaSourceData)) return false;
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
			mediaSourceData: activeMediaSourceData,
			subtitleStreamIndex: selectedSubtitle
		});
		if (
			!hasRequestedSubtitleBurnIn(subtitlePolicy) &&
			!burnInPlaybackFailed &&
			typeof requestSubtitleBurnInFallback === 'function'
		) {
			const requiresHdrConsent = shouldRequireSubtitleBurnInConsent({
				mediaSourceData: activeMediaSourceData,
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
			mediaSourceData: activeMediaSourceData,
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
				mediaSourceId: activeMediaSourceData?.Id,
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

		const subtitleFallbackContext = getSubtitleFallbackContext(activeMediaSourceData, {
			burnInRequestedOverride: burnInPlaybackFailed
		});
		stopHlsRecoveryLoop();
		console.warn('[Player] Subtitle compatibility fallback: requesting no-subtitle consent.', {
			reason: subtitleFallbackContext.reason,
			mediaSourceId: activeMediaSourceData?.Id || null,
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
			mediaSourceId: activeMediaSourceData?.Id,
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

	const isHlsRuntimeActive = useCallback((hls, runtimeContext = null, sourceToken = null) => {
		if (sourceToken && nativeSourceTokenRef.current !== sourceToken) {
			return false;
		}
		if (!runtimeContext) {
			return !exitInProgressRef.current && hlsRef.current === hls;
		}
		return isPlaybackRuntimeContextCurrent({
			runtimeContext,
			activeRuntimeContext: playbackRuntimeContextRef.current,
			hls,
			activeHls: hlsRef.current,
			generation: playbackGenerationRef.current,
			exitInProgress: exitInProgressRef.current
		});
	}, [
		exitInProgressRef,
		hlsRef,
		nativeSourceTokenRef,
		playbackGenerationRef,
		playbackRuntimeContextRef
	]);

	const attemptHlsFatalRecovery = useCallback((
		hls,
		errorData,
		source = 'HLS',
		runtimeContext = null
	) => {
		if (!errorData?.fatal) return false;
		if (!isHlsRuntimeActive(hls, runtimeContext)) return true;
		if (exitInProgressRef.current || playbackFailureLockedRef.current) return true;

		if (errorData.type === Hls.ErrorTypes.NETWORK_ERROR) {
			const statusCode = Number(errorData?.response?.code);
			const isServerHttpFailure = Number.isFinite(statusCode) && statusCode >= 500;
			if (isServerHttpFailure && errorData.details === 'fragLoadError') {
				const rebuilt = attemptPlaybackSessionRebuild(
					`${source} fragment request failed with HTTP ${statusCode}`,
					{
						toast: 'Server stream failed. Rebuilding playback session...',
						errorData,
						runtimeContext
					}
				);
				if (rebuilt) {
					return true;
				}
				const activeMediaSourceData = runtimeContext?.mediaSourceData || mediaSourceData;
				const isTranscodingPath = runtimeContext?.playMethod === 'Transcode' ||
					activeMediaSourceData?.__selectedPlayMethod === 'Transcode' ||
					Boolean(activeMediaSourceData?.TranscodingUrl);
				if (isServerTranscodingStartupFailure({
					isTranscoding: isTranscodingPath,
					playbackStarted: playbackStartedRef.current,
					errorData
				})) {
					appendPlaybackDiagnostic?.({
						scope: 'transcode',
						stage: 'startup-failure',
						status: 'error',
						reason: 'server-transcoder-startup-failure',
						message: SERVER_TRANSCODING_FAILURE_DIAGNOSTIC
					});
					showPlaybackError(SERVER_TRANSCODING_FAILURE_MESSAGE);
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
		mediaSourceData,
		appendPlaybackDiagnostic,
		playbackStartedRef,
		playbackFailureLockedRef,
		exitInProgressRef,
		isHlsRuntimeActive,
		showPlaybackError
	]);

	const handleHlsRuntimeError = useCallback(async ({
		hls,
		data,
		sourceLabel = 'HLS.js',
		runtimeContext = null,
		sourceToken = null
	}) => {
		if (!isHlsRuntimeActive(hls, runtimeContext, sourceToken)) return false;
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
			message: `HLS ${hlsError.category} (${hlsError.reason}) after subtitle fallback=${currentSubtitleTrackRef.current === -1 ? 'yes' : 'no'}; engine=${sourceLabel}; playMethod=${runtimeContext?.playMethod || mediaSourceData?.__selectedPlayMethod || '-'}.`
		});
		if (
			isSubtitleCompatibilityError(data, runtimeContext?.mediaSourceData) &&
			playbackSettingsRef.current.strictTranscodingMode
		) {
			showPlaybackError('Subtitle burn-in failed while strict transcoding is enabled.');
			return true;
		}
		if (hlsError.subtitleCandidate) {
			const handled = await attemptSubtitleCompatibilityFallback(data, runtimeContext);
			if (!isHlsRuntimeActive(hls, runtimeContext, sourceToken)) return true;
			if (!handled && hlsError.fatal) {
				attemptHlsFatalRecovery(hls, data, sourceLabel, runtimeContext);
			}
			return handled || hlsError.fatal;
		}
		if (hlsError.fatal) {
			return attemptHlsFatalRecovery(hls, data, sourceLabel, runtimeContext);
		}
		return false;
	}, [
		attemptHlsFatalRecovery,
		attemptSubtitleCompatibilityFallback,
		appendPlaybackDiagnostic,
		currentSubtitleTrackRef,
		isHlsRuntimeActive,
		isSubtitleCompatibilityError,
		mediaSourceData,
		playbackSettingsRef,
		showPlaybackError
	]);

	const handleHlsBootstrapTimeout = useCallback(async ({
		hls,
		runtimeContext = null,
		sourceToken = null
	}) => {
		if (!isHlsRuntimeActive(hls, runtimeContext, sourceToken)) return false;
		const rebuilt = attemptPlaybackSessionRebuild(
			'HLS.js did not buffer a media fragment before startup',
			{runtimeContext}
		);
		if (rebuilt) return true;
		if (runtimeContext?.playMethod !== 'Transcode') {
			const fellBack = await attemptTranscodeFallback('hls-engine-no-fragment');
			if (fellBack || !isHlsRuntimeActive(hls, runtimeContext, sourceToken)) {
				return fellBack;
			}
		}
		showPlaybackError(
			'The video stream did not begin buffering. Please retry or go back.',
			{detachMedia: true}
		);
		return true;
	}, [
		attemptPlaybackSessionRebuild,
		attemptTranscodeFallback,
		isHlsRuntimeActive,
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
		handleHlsRuntimeError,
		handleHlsBootstrapTimeout
	};
};
