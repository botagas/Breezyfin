import {useCallback, useEffect, useRef} from 'react';
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
	buildPlayerRecoveryAction,
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
	PLAYER_RECOVERY_ACTIONS,
	shouldRequireSubtitleBurnInConsent,
	shouldRetrySubtitleBurnInWithSafeProfile
} from '../utils/playerRecoveryPolicy';
import {isPlaybackRuntimeContextCurrent} from '../utils/playbackRuntimeContext';
import {PLAYBACK_RECOVERY_KEYS} from '../utils/playbackRecoveryLedger';
import {createPlaybackRecoveryTransactionManager} from '../utils/playbackRecoveryTransaction';

export const usePlayerRecoveryHandlers = ({
	itemId,
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
	loadRequestIdRef,
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
	playbackRecoveryLedger,
	playbackRuntimeContextRef,
	nativeSourceTokenRef,
	detachPlaybackSource
}) => {
	const recoveryTransactionManagerRef = useRef(null);
	if (!recoveryTransactionManagerRef.current) {
		recoveryTransactionManagerRef.current = createPlaybackRecoveryTransactionManager();
	}
	const recoveryItemIdRef = useRef(String(itemId || mediaSourceData?.__itemId || ''));
	const currentRecoveryItemId = String(itemId || mediaSourceData?.__itemId || '');
	if (recoveryItemIdRef.current !== currentRecoveryItemId) {
		recoveryTransactionManagerRef.current.invalidate('item-changed');
		recoveryItemIdRef.current = currentRecoveryItemId;
	}

	useEffect(() => () => {
		recoveryTransactionManagerRef.current?.invalidate('unmounted');
	}, []);

	const beginRecoveryTransaction = useCallback((kind, overrideCandidate) => (
		recoveryTransactionManagerRef.current.begin({
			kind,
			itemId: recoveryItemIdRef.current,
			playbackGeneration: playbackGenerationRef.current,
			loadRequestId: loadRequestIdRef?.current ?? null,
			overrideCandidate
		})
	), [loadRequestIdRef, playbackGenerationRef]);

	const isRecoveryTransactionCurrent = useCallback((operation) => (
		recoveryTransactionManagerRef.current.isCurrent(operation, {
			itemId: recoveryItemIdRef.current,
			playbackGeneration: playbackGenerationRef.current,
			loadRequestId: loadRequestIdRef?.current ?? null,
			exitInProgress: exitInProgressRef.current
		})
	), [exitInProgressRef, loadRequestIdRef, playbackGenerationRef]);

	const completeRecoveryTransaction = useCallback((operation) => {
		recoveryTransactionManagerRef.current.complete(operation);
	}, []);

	const resetRecoveryGuards = useCallback(() => {
		playbackRecoveryLedger?.resetGeneration(playbackGenerationRef.current);
		playbackFailureLockedRef.current = false;
		hlsNetworkRecoveryAttemptsRef.current = 0;
		hlsMediaRecoveryAttemptsRef.current = 0;
		dynamicRangeFallbackAttemptedRef.current = false;
	}, [
		dynamicRangeFallbackAttemptedRef,
		hlsMediaRecoveryAttemptsRef,
		hlsNetworkRecoveryAttemptsRef,
		playbackFailureLockedRef,
		playbackGenerationRef,
		playbackRecoveryLedger
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

		const generation = runtimeContext?.generation ?? playbackGenerationRef.current;
		const recoveryClaim = playbackRecoveryLedger?.claimMany(generation, [
			{key: PLAYBACK_RECOVERY_KEYS.playSessionRebuild, max: maxPlaySessionRebuildAttempts},
			{key: PLAYBACK_RECOVERY_KEYS.reload}
		]);
		if (recoveryClaim && !recoveryClaim.accepted) {
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'session-rebuild',
				status: 'skipped',
				reason: recoveryClaim.reason,
				message: 'Session rebuild budget was not available for this playback generation.'
			});
			return false;
		}
		const claimedAttempt = recoveryClaim?.claims?.find(
			(claim) => claim.key === PLAYBACK_RECOVERY_KEYS.playSessionRebuild
		)?.attempt;
		playSessionRebuildAttemptsRef.current = claimedAttempt || (playSessionRebuildAttemptsRef.current + 1);
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
		playbackRecoveryLedger,
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
		playbackRecoveryLedger?.lock(playbackGenerationRef.current, message || 'terminal-playback-error');
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
	}, [clearStartupDeadline, detachPlaybackSource, playbackFailureLockedRef, playbackGenerationRef, playbackRecoveryLedger, setError, setLoading, setLoadingStatusMessage, setPlaying, setShowControls, setToastMessage]);

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
		const reasonText = typeof reason === 'string' ? reason.toLowerCase() : '';
		const currentDynamicRangeCap = normalizeDynamicRangeCap(playbackSettingsRef.current.dynamicRangeCap);
		const dynamicRangeInfo = getDynamicRangeInfo(mediaSourceData);
		const nextDynamicRangeCap = currentDynamicRangeCap === 'hdr10' ? 'sdr' : 'hdr10';
		const recoveryAction = buildPlayerRecoveryAction({
			kind: 'transcode-fallback',
			exitInProgress: exitInProgressRef.current,
			failureLocked: playbackFailureLockedRef.current,
			forceDolbyVision: playbackSettingsRef.current.forceDolbyVision === true,
			requiresDynamicRangeDecision:
				!reasonText.includes('subtitle') &&
				!dynamicRangeFallbackAttemptedRef.current &&
				currentDynamicRangeCap !== 'sdr' &&
				dynamicRangeInfo.id === 'DV',
			strictTranscodingMode: playbackSettingsRef.current.strictTranscodingMode === true,
			transcodeFallbackAttempted: transcodeFallbackAttemptedRef.current,
			supportsTranscoding: mediaSourceData?.SupportsTranscoding === true,
			reason: reasonText || 'playback-failure',
			decision: {
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
			},
			toast: reasonText === 'startup-no-progress'
				? {
					message: 'Direct playback did not start. Retrying with server transcoding.',
					severity: 'warning'
				}
				: 'Switching to transcoding...'
		}, {}, playbackRecoveryLedger?.get(playbackGenerationRef.current));

		if (recoveryAction.reason === 'playback-failure-locked') {
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'transcode-fallback',
				status: 'skipped',
				reason: 'playback-failure-locked',
				message: 'Transcode fallback skipped because playback is already locked in error state.'
			});
			return false;
		}
		if (recoveryAction.reason === 'force-dolby-vision') {
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
		if (recoveryAction.type === PLAYER_RECOVERY_ACTIONS.REQUEST_DECISION) {
			const rangeClaim = playbackRecoveryLedger?.claim(
				playbackGenerationRef.current,
				recoveryAction.claim
			);
			if (rangeClaim && !rangeClaim.accepted) return false;
			dynamicRangeFallbackAttemptedRef.current = true;
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'dynamic-range-fallback',
				status: 'pending-user-consent',
				reason: reasonText || 'playback-failure',
				message: `Waiting for confirmation before using ${nextDynamicRangeCap.toUpperCase()} playback.`
			});
			if (typeof requestPlaybackDecision === 'function') {
				await requestPlaybackDecision(recoveryAction.decision);
				return true;
			}
			return false;
		}
		if (recoveryAction.type === PLAYER_RECOVERY_ACTIONS.IGNORE) {
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'transcode-fallback',
				status: 'skipped',
				reason: recoveryAction.reason,
				message: 'Transcode fallback was not applicable.'
			});
			return false;
		}
		const overrideCandidate = buildPlaybackOverride({
			baseOptions: playbackOptions,
			mediaSourceId: mediaSourceData?.Id,
			audioStreamIndex: currentAudioTrackRef.current,
			subtitleStreamIndex: currentSubtitleTrackRef.current,
			seekSeconds: resolveVideoSeekSeconds(videoRef.current)
		});
		const recoveryOperation = beginRecoveryTransaction('transcode-fallback', overrideCandidate);
		try {
			await handleStop();
		} catch (stopError) {
			completeRecoveryTransaction(recoveryOperation);
			throw stopError;
		}
		if (!isRecoveryTransactionCurrent(recoveryOperation)) {
			completeRecoveryTransaction(recoveryOperation);
			return true;
		}
		const transcodeClaim = playbackRecoveryLedger?.claim(
			playbackGenerationRef.current,
			recoveryAction.claim
		);
		if (transcodeClaim && !transcodeClaim.accepted) {
			completeRecoveryTransaction(recoveryOperation);
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
		playbackOverrideRef.current = recoveryOperation.overrideCandidate;
		setToastMessage(recoveryAction.toast);
		setError(null);
		setLoading(true);
		setLoadingStatusMessage('Restarting stream...');
		try {
			if (loadVideoRef.current) {
				await loadVideoRef.current(true);
			}
		} finally {
			completeRecoveryTransaction(recoveryOperation);
		}
		return true;
	}, [
		beginRecoveryTransaction,
		completeRecoveryTransaction,
		handleStop,
		isRecoveryTransactionCurrent,
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
		playbackRecoveryLedger,
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

		const subtitleClaim = playbackRecoveryLedger?.claim(
			playbackGenerationRef.current,
			PLAYBACK_RECOVERY_KEYS.subtitleCompatibilityFallback
		);
		if (subtitleClaim && !subtitleClaim.accepted) return true;
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
			const safeOverrideCandidate = buildPlaybackOverride({
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
			const safeRecoveryOperation = beginRecoveryTransaction(
				'safe-subtitle-burn-in',
				safeOverrideCandidate
			);
			stopHlsRecoveryLoop();
			appendPlaybackDiagnostic?.({
				scope: 'runtime-fallback',
				stage: 'subtitle-burn-in-safe-profile',
				status: 'applied',
				reason: 'encoded-subtitle-fragment-failed',
				message: 'Retrying subtitle burn-in with HLS TS, H.264 video, AAC audio, and a 6-channel audio cap.'
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
			if (!isRecoveryTransactionCurrent(safeRecoveryOperation)) {
				completeRecoveryTransaction(safeRecoveryOperation);
				return true;
			}
			setToastMessage({
				message: 'Subtitle burn-in stream failed. Retrying with a safer transcode profile...',
				severity: 'warning'
			});
			playbackOverrideRef.current = safeRecoveryOperation.overrideCandidate;
			try {
				if (typeof loadVideoRef.current === 'function') {
					setLoadingStatusMessage('Restarting stream...');
					await loadVideoRef.current();
				}
			} finally {
				completeRecoveryTransaction(safeRecoveryOperation);
			}
			return true;
		}

		const subtitleFallbackContext = getSubtitleFallbackContext(activeMediaSourceData, {
			burnInRequestedOverride: burnInPlaybackFailed
		});
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
			stopHlsRecoveryLoop();
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
		const noSubtitleOverrideCandidate = buildPlaybackOverride({
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
		const noSubtitleRecoveryOperation = beginRecoveryTransaction(
			'no-subtitle-fallback',
			noSubtitleOverrideCandidate
		);
		stopHlsRecoveryLoop();
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
		if (!isRecoveryTransactionCurrent(noSubtitleRecoveryOperation)) {
			completeRecoveryTransaction(noSubtitleRecoveryOperation);
			return true;
		}
		setToastMessage(subtitleFallbackContext.toast);
		currentSubtitleTrackRef.current = -1;
		playbackOverrideRef.current = noSubtitleRecoveryOperation.overrideCandidate;
		setCurrentSubtitleTrack(-1);
		try {
			if (typeof loadVideoRef.current === 'function') {
				setLoadingStatusMessage('Restarting stream...');
				await loadVideoRef.current();
			}
		} finally {
			completeRecoveryTransaction(noSubtitleRecoveryOperation);
		}
		return true;
	}, [
		beginRecoveryTransaction,
		completeRecoveryTransaction,
		currentAudioTrackRef,
		currentSubtitleTrackRef,
		handleStop,
		isRecoveryTransactionCurrent,
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
		playbackGenerationRef,
		playbackRecoveryLedger,
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
		const generation = runtimeContext?.generation ?? playbackGenerationRef.current;
		const recoveryAction = buildPlayerRecoveryAction({
			networkErrorType: Hls.ErrorTypes.NETWORK_ERROR,
			mediaErrorType: Hls.ErrorTypes.MEDIA_ERROR,
			maxHlsNetworkRecoveryAttempts,
			maxHlsMediaRecoveryAttempts,
			sourceCurrent: true,
			exitInProgress: exitInProgressRef.current
		}, errorData, playbackRecoveryLedger?.get(generation));
		if (recoveryAction.type === PLAYER_RECOVERY_ACTIONS.IGNORE) return true;

		if (recoveryAction.type === PLAYER_RECOVERY_ACTIONS.REBUILD_SESSION) {
			const statusCode = Number(errorData?.response?.code);
			const rebuilt = attemptPlaybackSessionRebuild(
				`${source} fragment request failed with HTTP ${statusCode}`,
				{
					toast: 'Server stream failed. Rebuilding playback session...',
					errorData,
					runtimeContext
				}
			);
			if (rebuilt) return true;
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

		if (recoveryAction.type === PLAYER_RECOVERY_ACTIONS.RECOVER_HLS_NETWORK) {
			const networkClaim = playbackRecoveryLedger?.claim(
				generation,
				PLAYBACK_RECOVERY_KEYS.hlsNetwork,
				{max: maxHlsNetworkRecoveryAttempts}
			);
			const attemptNumber = networkClaim?.attempt || (hlsNetworkRecoveryAttemptsRef.current + 1);
			if ((!networkClaim || networkClaim.accepted) && attemptNumber <= maxHlsNetworkRecoveryAttempts) {
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

		if (recoveryAction.type === PLAYER_RECOVERY_ACTIONS.RECOVER_HLS_MEDIA) {
			const mediaClaim = playbackRecoveryLedger?.claim(
				generation,
				PLAYBACK_RECOVERY_KEYS.hlsMedia,
				{max: maxHlsMediaRecoveryAttempts}
			);
			const attemptNumber = mediaClaim?.attempt || (hlsMediaRecoveryAttemptsRef.current + 1);
			if ((!mediaClaim || mediaClaim.accepted) && attemptNumber <= maxHlsMediaRecoveryAttempts) {
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
		playbackGenerationRef,
		playbackRecoveryLedger,
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
