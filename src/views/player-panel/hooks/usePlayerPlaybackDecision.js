import {useCallback, useEffect, useRef, useState} from 'react';

import {
	buildPlaybackOverride,
	resolveVideoSeekSeconds
} from '../utils/playbackOverride';

export const usePlayerPlaybackDecision = ({
	itemId,
	mediaSourceId,
	playbackOptions,
	currentAudioTrack,
	currentSubtitleTrack,
	audioTracks,
	videoRef,
	currentTimeRef,
	playbackOverrideRef,
	setToastMessage,
	setLoading,
	setLoadingStatusMessage,
	handleStop,
	loadVideoRef,
	setCurrentAudioTrack,
	setCurrentSubtitleTrack,
	saveAudioSelection,
	exitInProgressRef,
	loadRequestIdRef,
	playbackGenerationRef,
	onBack
}) => {
	const [playbackDecisionPrompt, setPlaybackDecisionPrompt] = useState(null);
	const playbackDecisionPromptRef = useRef(null);
	const playbackDecisionRequestRef = useRef(null);
	const pendingExitRef = useRef(null);
	const didNavigateRef = useRef(false);
	const commitPlaybackDecisionPrompt = useCallback((prompt) => {
		playbackDecisionPromptRef.current = prompt;
		setPlaybackDecisionPrompt(prompt);
	}, []);

	useEffect(() => {
		commitPlaybackDecisionPrompt(null);
		playbackDecisionRequestRef.current = null;
		pendingExitRef.current = null;
		didNavigateRef.current = false;
		exitInProgressRef.current = false;
	}, [commitPlaybackDecisionPrompt, exitInProgressRef, itemId]);

	const suspendPlaybackForDecision = useCallback((message = 'Waiting for playback decision...') => {
		const video = videoRef.current;
		if (video && !video.paused) {
			video.pause();
		}
		setLoading(false);
		setLoadingStatusMessage(message);
	}, [setLoading, setLoadingStatusMessage, videoRef]);

	const restartWithPlaybackOverride = useCallback(async ({
		audioStreamIndex = currentAudioTrack,
		subtitleStreamIndex = currentSubtitleTrack,
		decisionMediaSourceId = mediaSourceId,
		seekSeconds = resolveVideoSeekSeconds(videoRef.current) || currentTimeRef.current || 0,
		extra = {},
		toast = null,
		loadingMessage = 'Restarting stream...'
	} = {}) => {
		playbackOverrideRef.current = buildPlaybackOverride({
			baseOptions: playbackOverrideRef.current || playbackOptions,
			mediaSourceId: decisionMediaSourceId,
			audioStreamIndex,
			subtitleStreamIndex,
			seekSeconds,
			extra
		});
		if (toast) setToastMessage(toast);
		setLoading(true);
		setLoadingStatusMessage(loadingMessage);
		loadRequestIdRef.current += 1;
		playbackGenerationRef.current += 1;
		try {
			await handleStop();
		} catch (fallbackError) {
			console.warn('Failed while preparing playback decision restart:', fallbackError);
		}
		loadVideoRef.current?.();
	}, [
		currentAudioTrack,
		currentSubtitleTrack,
		currentTimeRef,
		handleStop,
		loadVideoRef,
		loadRequestIdRef,
		mediaSourceId,
		playbackOptions,
		playbackGenerationRef,
		playbackOverrideRef,
		setLoading,
		setLoadingStatusMessage,
		setToastMessage,
		videoRef
	]);

	const abortToDetails = useCallback(() => {
		if (pendingExitRef.current || didNavigateRef.current) return;
		exitInProgressRef.current = true;
		loadRequestIdRef.current += 1;
		pendingExitRef.current = Promise.resolve(handleStop()).catch((error) => {
			console.warn('Failed while stopping playback after playback decision:', error);
		});
		playbackDecisionRequestRef.current = null;
		commitPlaybackDecisionPrompt(null);
		setLoading(false);
		setLoadingStatusMessage('Loading...');
	}, [
		commitPlaybackDecisionPrompt,
		exitInProgressRef,
		handleStop,
		loadRequestIdRef,
		setLoading,
		setLoadingStatusMessage
	]);

	const handlePlaybackDecisionPromptHide = useCallback(() => {
		if (!pendingExitRef.current || didNavigateRef.current) return;
		const stopPromise = pendingExitRef.current;
		const stopTimeout = new Promise((resolve) => setTimeout(resolve, 1400));
		Promise.race([stopPromise, stopTimeout]).finally(() => {
			if (didNavigateRef.current) return;
			didNavigateRef.current = true;
			pendingExitRef.current = null;
			if (typeof onBack === 'function') onBack();
		});
	}, [onBack]);

	const requestPlaybackDecision = useCallback(async (request = {}) => {
		const {
			type,
			subtitleStreamIndex,
			reason,
			requiresHdrConsent = false,
			requiresBitmapBurnInConsent = false,
			requiresNoSubtitleConsent = false,
			fallbackType = ''
		} = request;
		const resolvedType = type ||
			(requiresNoSubtitleConsent || fallbackType === 'no-subtitles'
				? 'no-subtitles'
				: (requiresBitmapBurnInConsent || fallbackType === 'bitmap-burn-in-fragility'
					? 'bitmap-burn-in-fragility'
					: (requiresHdrConsent ? 'hdr-dv-burn-in' : fallbackType)));
		const isSubtitleDecision = [
			'no-subtitles',
			'bitmap-burn-in-fragility',
			'hdr-dv-burn-in'
		].includes(resolvedType);
		const requestGeneration = Number.isInteger(request.generation)
			? request.generation
			: playbackGenerationRef.current;

		if (isSubtitleDecision && (!Number.isInteger(subtitleStreamIndex) || subtitleStreamIndex < 0)) return;
		if (
			exitInProgressRef.current ||
			requestGeneration !== playbackGenerationRef.current
		) {
			return false;
		}
		if (playbackDecisionPromptRef.current || playbackDecisionRequestRef.current) {
			return true;
		}
		const reservation = {
			generation: requestGeneration,
			type: resolvedType || 'immediate-fallback'
		};
		playbackDecisionRequestRef.current = reservation;

		if (!resolvedType) {
			try {
				await restartWithPlaybackOverride({
					subtitleStreamIndex,
					extra: {forceSubtitleBurnIn: true},
					toast: {
						message: `Subtitle renderer fallback: ${reason || 'retrying with burn-in'}`,
						severity: 'warning'
					}
				});
			} finally {
				if (playbackDecisionRequestRef.current === reservation) {
					playbackDecisionRequestRef.current = null;
				}
			}
			return true;
		}

		if (request.runtime === true) {
			try {
				await handleStop();
			} catch (error) {
				console.warn('Failed while stopping playback for a runtime decision:', error);
			}
		}
		if (
			playbackDecisionRequestRef.current !== reservation ||
			exitInProgressRef.current ||
			requestGeneration !== playbackGenerationRef.current
		) {
			if (playbackDecisionRequestRef.current === reservation) {
				playbackDecisionRequestRef.current = null;
			}
			return false;
		}
		suspendPlaybackForDecision(
			resolvedType === 'unsupported-audio-switch'
				? 'Waiting for audio decision...'
				: ([
					'dynamic-range-fallback',
					'dolby-vision-original-quality'
				].includes(resolvedType)
					? 'Waiting for video quality decision...'
					: 'Waiting for subtitle decision...')
		);
		commitPlaybackDecisionPrompt({
			...request,
			type: resolvedType,
			subtitleStreamIndex,
			reason: reason || resolvedType,
			itemId,
			generation: requestGeneration
		});
		if (playbackDecisionRequestRef.current === reservation) {
			playbackDecisionRequestRef.current = null;
		}
		return true;
	}, [
		commitPlaybackDecisionPrompt,
		exitInProgressRef,
		handleStop,
		itemId,
		playbackGenerationRef,
		restartWithPlaybackOverride,
		suspendPlaybackForDecision
	]);

	const handleSubtitleBurnInFallback = useCallback(async ({
		subtitleStreamIndex,
		reason,
		requiresHdrConsent = false,
		requiresBitmapBurnInConsent = false,
		requiresNoSubtitleConsent = false,
		fallbackType = ''
	}) => {
		return requestPlaybackDecision({
			subtitleStreamIndex,
			reason,
			requiresHdrConsent,
			requiresBitmapBurnInConsent,
			requiresNoSubtitleConsent,
			fallbackType
		});
	}, [requestPlaybackDecision]);

	const handleConfirmPlaybackDecision = useCallback(async () => {
		if (!playbackDecisionPrompt) return;
		if (
			playbackDecisionPrompt.itemId !== itemId ||
			playbackDecisionPrompt.generation !== playbackGenerationRef.current ||
			(
				playbackDecisionPrompt.mediaSourceId &&
				mediaSourceId &&
				playbackDecisionPrompt.mediaSourceId !== mediaSourceId
			)
		) {
			commitPlaybackDecisionPrompt(null);
			return;
		}
		const {subtitleStreamIndex, reason, type} = playbackDecisionPrompt;
		commitPlaybackDecisionPrompt(null);
		if (type === 'unsupported-audio-switch') {
			const proposedAudioIndex = playbackDecisionPrompt.proposedTrack?.index;
			if (!Number.isInteger(proposedAudioIndex)) return;
			setCurrentAudioTrack(proposedAudioIndex);
			saveAudioSelection?.(proposedAudioIndex, audioTracks);
			await restartWithPlaybackOverride({
				audioStreamIndex: proposedAudioIndex,
				decisionMediaSourceId: playbackDecisionPrompt.mediaSourceId || mediaSourceId,
				seekSeconds: Number.isFinite(Number(playbackDecisionPrompt.resumeTicks))
					? Math.max(0, Number(playbackDecisionPrompt.resumeTicks) / 10000000)
					: undefined,
				toast: {
					message: `Using ${playbackDecisionPrompt.proposedTrack?.displayTitle || playbackDecisionPrompt.proposedTrack?.title || playbackDecisionPrompt.proposedTrack?.codec || 'supported audio track'}.`,
					severity: 'warning'
				},
				loadingMessage: 'Switching audio track...'
			});
			return;
		}
		if (type === 'dynamic-range-fallback') {
			const target = playbackDecisionPrompt.proposedRange === 'sdr' ? 'sdr' : 'hdr10';
			await restartWithPlaybackOverride({
				decisionMediaSourceId: playbackDecisionPrompt.mediaSourceId || mediaSourceId,
				seekSeconds: Number.isFinite(Number(playbackDecisionPrompt.resumeTicks))
					? Math.max(0, Number(playbackDecisionPrompt.resumeTicks) / 10000000)
					: undefined,
				extra: {
					dynamicRangeCap: target,
					avoidDolbyVision: true,
					confirmedDynamicRangeFallback: target
				},
				toast: {
					message: target === 'hdr10'
						? 'Dolby Vision is unavailable for this stream. Trying HDR playback.'
						: 'HDR playback is unavailable. Trying SDR playback.',
					severity: 'warning'
				},
				loadingMessage: target === 'hdr10'
					? 'Preparing HDR fallback...'
					: 'Preparing SDR fallback...'
			});
			return;
		}
		if (type === 'dolby-vision-original-quality') {
			const proposedBitrate = Number(playbackDecisionPrompt.proposedBitrateMbps) || 120;
			await restartWithPlaybackOverride({
				decisionMediaSourceId: playbackDecisionPrompt.mediaSourceId || mediaSourceId,
				seekSeconds: Number.isFinite(Number(playbackDecisionPrompt.resumeTicks))
					? Math.max(0, Number(playbackDecisionPrompt.resumeTicks) / 10000000)
					: undefined,
				extra: {
					maxBitrate: String(proposedBitrate),
					confirmedDolbyVisionOriginalQuality: true
				},
				toast: {
					message: `Trying original-quality Dolby Vision playback at up to ${proposedBitrate} Mbps.`,
					severity: 'warning'
				},
				loadingMessage: 'Preparing original-quality playback...'
			});
			return;
		}
		if (type === 'no-subtitles') {
			setCurrentSubtitleTrack(-1);
			await restartWithPlaybackOverride({
				subtitleStreamIndex: -1,
				extra: {
					forceSubtitleBurnIn: false,
					forceSubtitleBurnInOnHdr: false,
					safeSubtitleBurnInProfile: false,
					subtitleFallbackConsent: 'no-subtitles'
				},
				toast: {
					message: `Playing without subtitles: ${reason || 'subtitle delivery failed'}`,
					severity: 'warning'
				}
			});
			return;
		}
		await restartWithPlaybackOverride({
			subtitleStreamIndex,
			extra: {
				forceSubtitleBurnIn: true,
				forceSubtitleBurnInOnHdr: true,
				confirmedBitmapBurnIn: type === 'bitmap-burn-in-fragility'
			},
			toast: {
				message: type === 'bitmap-burn-in-fragility'
					? `Trying image subtitle burn-in: ${reason || 'server burn-in confirmed'}`
					: `Burning in subtitles for this playback: ${reason || 'HDR/DV consent confirmed'}`,
				severity: 'warning'
			}
		});
	}, [
		audioTracks,
		commitPlaybackDecisionPrompt,
		itemId,
		mediaSourceId,
		playbackDecisionPrompt,
		playbackGenerationRef,
		restartWithPlaybackOverride,
		saveAudioSelection,
		setCurrentAudioTrack,
		setCurrentSubtitleTrack
	]);

	const handleDeclinePlaybackDecision = useCallback(async () => {
		if (!playbackDecisionPrompt) return;
		if (playbackDecisionPrompt.type === 'hdr-dv-burn-in') {
			commitPlaybackDecisionPrompt(null);
			setCurrentSubtitleTrack(-1);
			await restartWithPlaybackOverride({
				subtitleStreamIndex: -1,
				extra: {
					forceSubtitleBurnIn: false,
					forceSubtitleBurnInOnHdr: false,
					safeSubtitleBurnInProfile: false,
					subtitleFallbackConsent: 'no-subtitles'
				},
				toast: {
					message: 'Playing without subtitles to preserve HDR/DV quality.',
					severity: 'warning'
				}
			});
			return;
		}
		await abortToDetails();
	}, [
		abortToDetails,
		commitPlaybackDecisionPrompt,
		playbackDecisionPrompt,
		restartWithPlaybackOverride,
		setCurrentSubtitleTrack
	]);

	const handleAlternatePlaybackDecision = useCallback(async () => {
		if (!playbackDecisionPrompt || playbackDecisionPrompt.type !== 'dolby-vision-original-quality') {
			return;
		}
		if (
			playbackDecisionPrompt.itemId !== itemId ||
			playbackDecisionPrompt.generation !== playbackGenerationRef.current ||
			(
				playbackDecisionPrompt.mediaSourceId &&
				mediaSourceId &&
				playbackDecisionPrompt.mediaSourceId !== mediaSourceId
			)
		) {
			commitPlaybackDecisionPrompt(null);
			return;
		}
		commitPlaybackDecisionPrompt(null);
		await restartWithPlaybackOverride({
			decisionMediaSourceId: playbackDecisionPrompt.mediaSourceId || mediaSourceId,
			seekSeconds: Number.isFinite(Number(playbackDecisionPrompt.resumeTicks))
				? Math.max(0, Number(playbackDecisionPrompt.resumeTicks) / 10000000)
				: undefined,
			extra: {
				forceTranscoding: true,
				dynamicRangeCap: 'sdr',
				avoidDolbyVision: true,
				confirmedDynamicRangeFallback: 'sdr'
			},
			toast: {
				message: 'Transcoding Dolby Vision to SDR at the configured bitrate.',
				severity: 'warning'
			},
			loadingMessage: 'Preparing SDR transcode...'
		});
	}, [
		commitPlaybackDecisionPrompt,
		itemId,
		mediaSourceId,
		playbackDecisionPrompt,
		playbackGenerationRef,
		restartWithPlaybackOverride
	]);

	const handlePlaybackDecisionBack = useCallback(() => {
		if (!playbackDecisionPrompt) return false;
		abortToDetails();
		return true;
	}, [abortToDetails, playbackDecisionPrompt]);

	return {
		playbackDecisionPrompt,
		requestPlaybackDecision,
		handleSubtitleBurnInFallback,
		handleConfirmPlaybackDecision,
		handleAlternatePlaybackDecision,
		handleDeclinePlaybackDecision,
		handlePlaybackDecisionBack,
			handlePlaybackDecisionPromptHide
		};
};
