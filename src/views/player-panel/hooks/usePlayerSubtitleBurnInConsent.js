import {useCallback, useEffect, useRef, useState} from 'react';

import {
	buildPlaybackOverride,
	resolveVideoSeekSeconds
} from '../utils/playbackOverride';

export const usePlayerSubtitleBurnInConsent = ({
	itemId,
	mediaSourceId,
	playbackOptions,
	currentAudioTrack,
	videoRef,
	currentTimeRef,
	playbackOverrideRef,
	setToastMessage,
	setLoading,
	setLoadingStatusMessage,
	handleStop,
	loadVideoRef,
	setCurrentSubtitleTrack,
	exitInProgressRef,
	loadRequestIdRef,
	onBack
}) => {
	const [subtitleBurnInPrompt, setSubtitleBurnInPrompt] = useState(null);
	const pendingExitRef = useRef(null);
	const didNavigateRef = useRef(false);

	useEffect(() => {
		setSubtitleBurnInPrompt(null);
		pendingExitRef.current = null;
		didNavigateRef.current = false;
		exitInProgressRef.current = false;
	}, [exitInProgressRef, itemId]);

	const suspendPlaybackForDecision = useCallback(() => {
		const video = videoRef.current;
		if (video && !video.paused) {
			video.pause();
		}
		setLoading(false);
		setLoadingStatusMessage('Waiting for subtitle decision...');
	}, [setLoading, setLoadingStatusMessage, videoRef]);

	const restartWithSubtitleOverride = useCallback(async ({
		subtitleStreamIndex,
		extra = {},
		toast = null,
		loadingMessage = 'Restarting stream...'
	} = {}) => {
		playbackOverrideRef.current = buildPlaybackOverride({
			baseOptions: playbackOptions,
			mediaSourceId,
			audioStreamIndex: currentAudioTrack,
			subtitleStreamIndex,
			seekSeconds: resolveVideoSeekSeconds(videoRef.current) || currentTimeRef.current || 0,
			extra
		});
		if (toast) setToastMessage(toast);
		setLoading(true);
		setLoadingStatusMessage(loadingMessage);
		try {
			await handleStop();
		} catch (fallbackError) {
			console.warn('Failed while preparing subtitle fallback restart:', fallbackError);
		}
		loadVideoRef.current?.();
	}, [
		currentAudioTrack,
		currentTimeRef,
		handleStop,
		loadVideoRef,
		mediaSourceId,
		playbackOptions,
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
			console.warn('Failed while stopping playback after subtitle decision:', error);
		});
		setSubtitleBurnInPrompt(null);
		setLoading(false);
		setLoadingStatusMessage('Loading...');
	}, [exitInProgressRef, handleStop, loadRequestIdRef, setLoading, setLoadingStatusMessage]);

	const handleSubtitleBurnInPromptHide = useCallback(() => {
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

	const handleSubtitleBurnInFallback = useCallback(async ({
		subtitleStreamIndex,
		reason,
		requiresHdrConsent = false,
		requiresBitmapBurnInConsent = false,
		requiresNoSubtitleConsent = false,
		fallbackType = ''
	}) => {
		if (!Number.isInteger(subtitleStreamIndex) || subtitleStreamIndex < 0) return;
		if (exitInProgressRef.current) return;
		if (requiresNoSubtitleConsent || fallbackType === 'no-subtitles') {
			suspendPlaybackForDecision();
			setSubtitleBurnInPrompt({
				type: 'no-subtitles',
				subtitleStreamIndex,
				reason: reason || 'subtitle-delivery-failed'
			});
			return;
		}
		if (requiresBitmapBurnInConsent || fallbackType === 'bitmap-burn-in-fragility') {
			suspendPlaybackForDecision();
			setSubtitleBurnInPrompt({
				type: 'bitmap-burn-in-fragility',
				subtitleStreamIndex,
				reason: reason || 'image-subtitle-burn-in-fragile'
			});
			return;
		}
		if (requiresHdrConsent) {
			suspendPlaybackForDecision();
			setSubtitleBurnInPrompt({
				type: 'hdr-dv-burn-in',
				subtitleStreamIndex,
				reason: reason || 'bitmap-subtitle-renderer-failed'
			});
			return;
		}
		await restartWithSubtitleOverride({
			subtitleStreamIndex,
			extra: {
				forceSubtitleBurnIn: true
			},
			toast: {
				message: `Subtitle renderer fallback: ${reason || 'retrying with burn-in'}`,
				severity: 'warning'
			}
		});
	}, [exitInProgressRef, restartWithSubtitleOverride, suspendPlaybackForDecision]);

	const handleConfirmSubtitleBurnIn = useCallback(async () => {
		if (!subtitleBurnInPrompt) return;
		const {subtitleStreamIndex, reason, type} = subtitleBurnInPrompt;
		setSubtitleBurnInPrompt(null);
		if (type === 'no-subtitles') {
			setCurrentSubtitleTrack(-1);
			await restartWithSubtitleOverride({
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
		await restartWithSubtitleOverride({
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
	}, [restartWithSubtitleOverride, setCurrentSubtitleTrack, subtitleBurnInPrompt]);

	const handleDeclineSubtitleBurnIn = useCallback(async () => {
		if (!subtitleBurnInPrompt) return;
		if (subtitleBurnInPrompt.type === 'hdr-dv-burn-in') {
			setSubtitleBurnInPrompt(null);
			setCurrentSubtitleTrack(-1);
			await restartWithSubtitleOverride({
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
	}, [abortToDetails, restartWithSubtitleOverride, setCurrentSubtitleTrack, subtitleBurnInPrompt]);

	const handleSubtitleBurnInPromptBack = useCallback(() => {
		if (!subtitleBurnInPrompt) return false;
		abortToDetails();
		return true;
	}, [abortToDetails, subtitleBurnInPrompt]);

	return {
		subtitleBurnInPrompt,
		handleSubtitleBurnInFallback,
		handleConfirmSubtitleBurnIn,
		handleDeclineSubtitleBurnIn,
		handleSubtitleBurnInPromptBack,
		handleSubtitleBurnInPromptHide
	};
};
