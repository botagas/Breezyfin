import {useCallback} from 'react';
import jellyfinService from '../../../services/jellyfinService';
import {getPlaybackErrorMessage} from '../../../utils/errorMessages';
import {readBreezyfinSettings} from '../../../utils/settingsStorage';
import {
	buildPlayerPlaybackSettingsSnapshot,
	cancelVideoMountAdmission,
	waitForVideoMount
} from '../utils/playerVideoLoaderHelpers';
import {buildPlaybackPlan, isPlaybackPlan} from '../utils/playbackPlan';
import {commitPlaybackPlan} from './playerPlaybackPlanCommit';

const MAX_VIDEO_MOUNT_RETRIES = 20;

export const usePlayerVideoLoader = ({
	item,
	videoRef,
	loadVideoRef,
	loadRequestIdRef,
	playbackStartedRef,
	resetRecoveryGuards,
	setLoading,
	setLoadingStatusMessage,
	reloadAttemptedRef,
	subtitleCompatibilityFallbackAttemptedRef,
	lastProgressRef,
	setError,
	seekOffsetRef,
	loadTrackPreferences,
	playbackOverrideRef,
	playbackOptions,
	playbackSettingsRef,
	setToastMessage,
	setMediaSourceData,
	setDuration,
	setAudioTracks,
	setSubtitleTracks,
	pickPreferredAudio,
	pickPreferredSubtitle,
	setCurrentAudioTrack,
	setCurrentSubtitleTrack,
	attachPlaybackSource,
	detachPlaybackSource,
	pendingOverrideClearRef,
	showPlaybackError,
	playbackSessionRef,
	appendPlaybackDiagnostic,
	requestPlaybackDecision,
	exitInProgressRef,
	playbackGenerationAllocator,
	playbackRecoveryLedger,
	playbackRuntimeContextRef,
	videoMountRetryTimerRef
}) => {
	const preparePlaybackPlan = useCallback(async ({
		playbackOverride = playbackOverrideRef.current,
		forceTranscodeOverride = false
	} = {}) => {
		if (!item || exitInProgressRef.current) {
			throw new Error('Playback preparation is no longer active');
		}
		const settings = readBreezyfinSettings();
		const playbackSettingsSnapshot = buildPlayerPlaybackSettingsSnapshot({
			settings,
			playbackOptions,
			playbackOverride,
			forceTranscodeOverride
		});
		const options = {
			...playbackSettingsSnapshot,
			...((playbackOverride ?? playbackOptions) || {})
		};
		const playbackInfo = await jellyfinService.getPlaybackInfo(item.Id, options);
		if (!playbackInfo?.MediaSources?.[0]) {
			throw new Error('No media source available');
		}
		return buildPlaybackPlan({
			item,
			playbackInfo,
			playbackSettingsSnapshot,
			playbackOptions,
			playbackOverride,
			service: jellyfinService,
			pickPreferredAudio,
			pickPreferredSubtitle
		});
	}, [exitInProgressRef, item, pickPreferredAudio, pickPreferredSubtitle, playbackOptions, playbackOverrideRef]);

	const loadVideo = useCallback(async (
		forceTranscodeOverride = false,
		mountRetry = null,
		loadOptions = null
	) => {
		if (!item || exitInProgressRef.current) return;

		const requestId = Number.isInteger(mountRetry?.requestId)
			? mountRetry.requestId
			: (loadRequestIdRef.current || 0) + 1;
		loadRequestIdRef.current = requestId;
		cancelVideoMountAdmission(videoMountRetryTimerRef);
		const admittedOverride = playbackOverrideRef.current;
		let generation = null;
		const isStaleLoad = () => (
			exitInProgressRef.current ||
			loadRequestIdRef.current !== requestId ||
			playbackOverrideRef.current !== admittedOverride ||
			(generation !== null && !playbackGenerationAllocator.isCurrent(generation))
		);
		loadVideoRef.current = loadVideo;
		const mountResult = await waitForVideoMount({
			videoRef,
			pendingRef: videoMountRetryTimerRef,
			isStale: isStaleLoad,
			maxAttempts: MAX_VIDEO_MOUNT_RETRIES
		});
		if (mountResult.status !== 'ready') {
			if (mountResult.status === 'failed' && !loadOptions?.suppressErrors) {
				showPlaybackError('The video surface was not available. Please retry.', {detachMedia: true});
			}
			return mountResult;
		}
		if (isStaleLoad()) return {status: 'stale', reason: 'video-surface-wait-stale'};
		const beginCommit = () => {
			if (generation !== null) return generation;
			if (isStaleLoad()) return null;
			detachPlaybackSource?.({
				clearRuntimeContext: true,
				resetVideo: true,
				reason: 'new-playback-load'
			});
			generation = playbackGenerationAllocator.allocate('new-playback-load');
			playbackRecoveryLedger.beginGeneration(generation, {itemId: item.Id});
			playbackRuntimeContextRef.current = null;
			resetRecoveryGuards();
			playbackStartedRef.current = false;
			setMediaSourceData(null);
			setAudioTracks([]);
			setSubtitleTracks([]);
			if (!loadOptions?.deferTrackState) {
				setCurrentAudioTrack(null);
				setCurrentSubtitleTrack(null);
			}
			setLoadingStatusMessage('Loading...');
			setLoading(true);
			reloadAttemptedRef.current = false;
			subtitleCompatibilityFallbackAttemptedRef.current = false;
			lastProgressRef.current = {time: 0, timestamp: Date.now()};
			setError(null);
			seekOffsetRef.current = 0;
			loadTrackPreferences();
			return generation;
		};
		const beginPlaybackPlanCommit = (playbackPlan) => {
			if (!isPlaybackPlan(playbackPlan)) return null;
			if (playbackPlan.itemId !== String(item.Id) || isStaleLoad()) return null;
			return beginCommit();
		};

		try {
			let playbackPlan = loadOptions?.playbackPlan || null;
			if (playbackPlan && !isPlaybackPlan(playbackPlan)) {
				playbackPlan = buildPlaybackPlan({
					item,
					playbackInfo: playbackPlan.playbackInfo,
					playbackSettingsSnapshot: playbackPlan.playbackSettingsSnapshot,
					playbackOptions,
					playbackOverride: playbackPlan.playbackOverride,
					service: jellyfinService,
					pickPreferredAudio,
					pickPreferredSubtitle
				});
			}
			const settings = playbackPlan ? null : readBreezyfinSettings();
			const playbackSettingsSnapshot = playbackPlan?.settingsSnapshot ||
				buildPlayerPlaybackSettingsSnapshot({
					settings,
					playbackOptions,
					playbackOverride: playbackOverrideRef.current,
					forceTranscodeOverride
				});
			let playbackInfo = playbackPlan?.playbackInfo || null;
			let playbackInfoError = null;
			try {
				if (playbackPlan) {
					appendPlaybackDiagnostic?.({
						scope: 'audio-track',
						stage: 'prepared-playback-commit',
						status: 'applied',
						reason: loadOptions?.transitionId || 'prepared-playback',
						message: 'Committing previously prepared playback negotiation.'
					});
				} else {
					const playbackOverrideOptions = {...((playbackOverrideRef.current ?? playbackOptions) || {})};
					const options = {
						...playbackSettingsSnapshot,
						...playbackOverrideOptions
					};
					playbackInfo = await jellyfinService.getPlaybackInfo(item.Id, options);
				}
			} catch (infoError) {
				playbackInfoError = infoError;
				console.error('Failed to get playback info:', infoError);
			}
			if (isStaleLoad()) return;

			if (!playbackPlan && playbackInfo) {
				playbackPlan = buildPlaybackPlan({
					item,
					playbackInfo,
					playbackSettingsSnapshot,
					playbackOptions,
					playbackOverride: playbackOverrideRef.current,
					service: jellyfinService,
					pickPreferredAudio,
					pickPreferredSubtitle
				});
			}
			const mediaSource = playbackPlan?.mediaSource;
			if (!mediaSource) {
				if (playbackInfoError) {
					throw playbackInfoError;
				}
				throw new Error('No media source available');
			}
			if (beginPlaybackPlanCommit(playbackPlan) === null || isStaleLoad()) return;
			return await commitPlaybackPlan(playbackPlan, {
				item,
				generation,
				loadOptions,
				playbackSettingsSnapshot,
				isStale: isStaleLoad,
				refs: {
					pendingOverrideClear: pendingOverrideClearRef,
					playbackOverride: playbackOverrideRef,
					playbackRuntimeContext: playbackRuntimeContextRef,
					playbackSession: playbackSessionRef,
					playbackSettings: playbackSettingsRef,
					video: videoRef
				},
				actions: {
					appendPlaybackDiagnostic,
					attachPlaybackSource,
					requestPlaybackDecision,
					setAudioTracks,
					setCurrentAudioTrack,
					setCurrentSubtitleTrack,
					setDuration,
					setLoading,
					setLoadingStatusMessage,
					setMediaSourceData,
					setSubtitleTracks,
					setToastMessage
				}
			});
		} catch (err) {
			if (isStaleLoad()) return;
			if (err?.code === 'subtitle-burn-in-no-source') {
				if (beginCommit() === null || isStaleLoad()) return;
				const subtitleStreamIndex = Number.isInteger(err?.details?.subtitleStreamIndex)
					? err.details.subtitleStreamIndex
					: playbackOverrideRef.current?.subtitleStreamIndex;
				appendPlaybackDiagnostic?.({
					scope: 'subtitle-policy',
					stage: 'burn-in-no-source',
					status: 'pending-user-consent',
					reason: err.code,
					message: err.message
				});
				setLoading(false);
				setLoadingStatusMessage('Waiting for subtitle decision...');
				if (!loadOptions?.deferDecisions) {
					await requestPlaybackDecision?.({
					type: 'no-subtitles',
					itemId: item.Id,
					generation,
					subtitleStreamIndex,
					reason: 'subtitle-burn-in-no-source',
					requiresNoSubtitleConsent: true
					});
				}
				return {status: 'decision', reason: err.code};
			}
			const confirmedRange = String(
				playbackOverrideRef.current?.confirmedDynamicRangeFallback || ''
			).toLowerCase();
			if (confirmedRange === 'hdr10') {
				if (beginCommit() === null || isStaleLoad()) return;
				setLoading(false);
				setLoadingStatusMessage('Waiting for video quality decision...');
				if (!loadOptions?.deferDecisions) {
					await requestPlaybackDecision?.({
					type: 'dynamic-range-fallback',
					itemId: item.Id,
					mediaSourceId: playbackOverrideRef.current?.mediaSourceId || null,
					generation,
					originalRange: 'DV',
					proposedRange: 'sdr',
					reason: 'hdr-fallback-negotiation-failed'
					});
				}
				return {status: 'decision', reason: 'hdr-fallback-negotiation-failed'};
			}
			console.error('Failed to load video:', err);
			if (!loadOptions?.suppressErrors) {
				showPlaybackError(getPlaybackErrorMessage(err, 'Failed to load video'));
			}
			return {status: 'failed', error: err};
		}
	}, [
		appendPlaybackDiagnostic,
		attachPlaybackSource,
		detachPlaybackSource,
		item,
		lastProgressRef,
		loadRequestIdRef,
		loadTrackPreferences,
		loadVideoRef,
		pendingOverrideClearRef,
		pickPreferredAudio,
		pickPreferredSubtitle,
		playbackStartedRef,
		playbackOptions,
		playbackOverrideRef,
		playbackSessionRef,
		playbackSettingsRef,
		reloadAttemptedRef,
		resetRecoveryGuards,
		requestPlaybackDecision,
		exitInProgressRef,
		playbackGenerationAllocator,
		playbackRecoveryLedger,
		playbackRuntimeContextRef,
		setLoadingStatusMessage,
		seekOffsetRef,
		setAudioTracks,
		setCurrentAudioTrack,
		setCurrentSubtitleTrack,
		setDuration,
		setError,
		setLoading,
		setMediaSourceData,
		setSubtitleTracks,
		setToastMessage,
		showPlaybackError,
		subtitleCompatibilityFallbackAttemptedRef,
		videoMountRetryTimerRef,
		videoRef
	]);
	loadVideo.preparePlaybackPlan = preparePlaybackPlan;

	return loadVideo;
};
