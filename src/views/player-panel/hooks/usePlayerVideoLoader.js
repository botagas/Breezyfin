import {useCallback} from 'react';
import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import jellyfinService from '../../../services/jellyfinService';
import {getPlaybackErrorMessage} from '../../../utils/errorMessages';
import {readBreezyfinSettings} from '../../../utils/settingsStorage';
import {redactSensitiveUrl} from '../../../utils/sensitiveData';
import {
	getDynamicRangeDisplayLabel,
	getDynamicRangeInfo
} from '../../../utils/playbackDynamicRange';
import {
	buildMediaSourceDebugData,
	buildPlayerPlaybackSettingsSnapshot,
	resolveInitialTrackSelection,
	resolvePlaybackVideoUrl
} from '../utils/playerVideoLoaderHelpers';
import {createPlaybackRuntimeContext} from '../utils/playbackRuntimeContext';

const NATIVE_HLS_HDR_RANGE_IDS = new Set(['DV', 'HDR10', 'HDR10_PLUS', 'HLG']);
const MAX_VIDEO_MOUNT_RETRIES = 20;

const normalizeToastText = (value) => (
	String(value || '')
		.replace(/\s+/g, ' ')
		.replace(/[.]+$/, '')
		.trim()
		.toLowerCase()
);

const buildPlaybackCompatibilityToast = ({
	dynamicRangeLabel,
	resolvedPlayMethod,
	adjustments = []
}) => {
	const toastParts = [];
	if (dynamicRangeLabel) {
		toastParts.push(`Playback: ${dynamicRangeLabel} (${resolvedPlayMethod})`);
	}
	if (Array.isArray(adjustments)) {
		adjustments.forEach((adjustment) => {
			if (!adjustment?.toast) return;
			toastParts.push(adjustment.toast);
		});
	}
	const seen = new Set();
	const deduped = toastParts.filter((part) => {
		const normalized = normalizeToastText(part);
		if (!normalized || seen.has(normalized)) return false;
		seen.add(normalized);
		return true;
	});
	return deduped.join('  •  ');
};

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
	playbackGenerationRef,
	playbackRuntimeContextRef,
	videoMountRetryTimerRef,
	setPlaybackGeneration
}) => {
	const loadVideo = useCallback(async (forceTranscodeOverride = false, mountRetry = null) => {
		if (!item || exitInProgressRef.current) return;

		const isMountRetry = Number.isInteger(mountRetry?.requestId);
		const requestId = isMountRetry
			? mountRetry.requestId
			: (loadRequestIdRef.current || 0) + 1;
		if (!isMountRetry) {
			loadRequestIdRef.current = requestId;
			if (videoMountRetryTimerRef.current) {
				clearTimeout(videoMountRetryTimerRef.current);
				videoMountRetryTimerRef.current = null;
			}
		}
		if (!videoRef.current) {
			const attempt = Number(mountRetry?.attempt) || 0;
			if (loadRequestIdRef.current !== requestId || exitInProgressRef.current) return;
			if (attempt >= MAX_VIDEO_MOUNT_RETRIES) {
				showPlaybackError('The video surface was not available. Please retry.', {detachMedia: true});
				return;
			}
			videoMountRetryTimerRef.current = setTimeout(() => {
				videoMountRetryTimerRef.current = null;
				if (loadRequestIdRef.current === requestId && !exitInProgressRef.current) {
					loadVideo(forceTranscodeOverride, {requestId, attempt: attempt + 1});
				}
			}, 100);
			return;
		}

		const generation = (playbackGenerationRef.current || 0) + 1;
		detachPlaybackSource?.({
			clearRuntimeContext: true,
			resetVideo: true,
			reason: 'new-playback-load'
		});
		playbackGenerationRef.current = generation;
		playbackRuntimeContextRef.current = null;
		setPlaybackGeneration(generation);
		const isStaleLoad = () => (
			exitInProgressRef.current ||
			loadRequestIdRef.current !== requestId ||
			playbackGenerationRef.current !== generation
		);

		resetRecoveryGuards();
		playbackStartedRef.current = false;
		setMediaSourceData(null);
		setAudioTracks([]);
		setSubtitleTracks([]);
		setCurrentAudioTrack(null);
		setCurrentSubtitleTrack(null);
		setLoadingStatusMessage('Loading...');
		setLoading(true);
		reloadAttemptedRef.current = false;
		subtitleCompatibilityFallbackAttemptedRef.current = false;
		lastProgressRef.current = {time: 0, timestamp: Date.now()};
		setError(null);
		seekOffsetRef.current = 0;
		loadTrackPreferences();

		loadVideoRef.current = loadVideo;

		try {
			const settings = readBreezyfinSettings();
			const playbackSettingsSnapshot = buildPlayerPlaybackSettingsSnapshot({
				settings,
				playbackOptions,
				playbackOverride: playbackOverrideRef.current,
				forceTranscodeOverride
			});
			const requestedDynamicRangeCap = playbackSettingsSnapshot.dynamicRangeCap;
			playbackSettingsRef.current = playbackSettingsSnapshot;

			let playbackInfo = null;
			let playbackInfoError = null;
			try {
				const playbackOverrideOptions = {...((playbackOverrideRef.current ?? playbackOptions) || {})};
				const options = {
					...playbackSettingsRef.current,
					...playbackOverrideOptions
				};
				playbackInfo = await jellyfinService.getPlaybackInfo(item.Id, options);
			} catch (infoError) {
				playbackInfoError = infoError;
				console.error('Failed to get playback info:', infoError);
			}
			if (isStaleLoad()) return;

			const mediaSource = playbackInfo?.MediaSources?.[0];
			if (!mediaSource) {
				if (playbackInfoError) {
					throw playbackInfoError;
				}
				throw new Error('No media source available');
			}

			const playbackMeta = playbackInfo?.__breezyfin || {};
			const playbackRequestDebug = playbackMeta.requestDebug || null;
			const resolvedPlayMethod =
				playbackMeta.playMethod ||
				(mediaSource.TranscodingUrl
					? 'Transcode'
					: (mediaSource.SupportsDirectPlay ? 'DirectPlay' : 'DirectStream'));
			const dynamicRangeInfo = playbackMeta.dynamicRange || getDynamicRangeInfo(mediaSource);
			const dynamicRangeLabel = playbackMeta.dynamicRange?.displayLabel ||
				getDynamicRangeDisplayLabel(dynamicRangeInfo, playbackMeta.dynamicRangeCap || requestedDynamicRangeCap);
			const videoStream =
				mediaSource.MediaStreams?.find((stream) => stream.Type === 'Video') || null;
			const compatibilityToast = buildPlaybackCompatibilityToast({
				dynamicRangeLabel,
				resolvedPlayMethod,
				adjustments: playbackMeta.adjustments
			});
			if (compatibilityToast) {
				setToastMessage(compatibilityToast);
			}

			if (playbackSettingsRef.current.forceTranscoding && !mediaSource.TranscodingUrl) {
				throw new Error('Transcoding was forced, but the server did not return a transcoding URL.');
			}
			const isHdrLikeStream = NATIVE_HLS_HDR_RANGE_IDS.has(dynamicRangeInfo?.id);

			playbackSessionRef.current = {
				playSessionId: playbackInfo?.PlaySessionId || null,
				mediaSourceId: mediaSource?.Id || null,
				playMethod: resolvedPlayMethod
			};

			const mediaSourceDebugData = buildMediaSourceDebugData({
				mediaSource,
				playbackInfo,
				playbackMeta,
				resolvedPlayMethod,
				dynamicRangeInfo,
				dynamicRangeLabel,
				requestedDynamicRangeCap,
				playbackRequestDebug,
				videoStream,
				diagnosticsEnabled: playbackSettingsSnapshot.enableDiagnostics
			});

			setMediaSourceData({
				...mediaSource,
				...mediaSourceDebugData,
				__itemId: item.Id,
				__playbackGeneration: generation
			});

			if (mediaSource.RunTimeTicks) {
				const totalDuration = mediaSource.RunTimeTicks / JELLYFIN_TICKS_PER_SECOND;
				setDuration(totalDuration);
			} else if (item.RunTimeTicks) {
				const totalDuration = item.RunTimeTicks / JELLYFIN_TICKS_PER_SECOND;
				setDuration(totalDuration);
			}

			const audioStreams = mediaSource.MediaStreams?.filter((s) => s.Type === 'Audio') || [];
			const subtitleStreams = mediaSource.MediaStreams?.filter((s) => s.Type === 'Subtitle') || [];

			setAudioTracks(audioStreams);
			setSubtitleTracks(subtitleStreams);

			const {selectedAudio, selectedSubtitle} = resolveInitialTrackSelection({
				audioStreams,
				subtitleStreams,
				playbackOptions,
				playbackOverride: playbackOverrideRef.current,
				negotiatedAudioStreamIndex: playbackMeta.selectedAudioStreamIndex,
				negotiatedSubtitleStreamIndex: playbackMeta.selectedSubtitleStreamIndex,
				clientRenderedSubtitleStreamIndex: playbackMeta.clientRenderedSubtitleStreamIndex,
				pickPreferredAudio,
				pickPreferredSubtitle
			});

			setCurrentAudioTrack(selectedAudio);
			setCurrentSubtitleTrack(selectedSubtitle);

			const requiredDecision = playbackMeta.requiredDecision || playbackMeta.subtitlePolicy?.requiredDecision || null;
			if (requiredDecision) {
				const isVideoQualityDecision = [
					'dynamic-range-fallback',
					'dolby-vision-original-quality'
				].includes(requiredDecision.type);
				const decisionScope = requiredDecision.type === 'unsupported-audio-switch'
					? 'audio-track'
					: (isVideoQualityDecision ? 'dynamic-range' : 'subtitle-policy');
				const decisionMessage = requiredDecision.type === 'unsupported-audio-switch'
					? 'Waiting for audio decision...'
					: (isVideoQualityDecision
						? 'Waiting for video quality decision...'
						: 'Waiting for subtitle decision...');
				appendPlaybackDiagnostic?.({
					scope: decisionScope,
					stage: 'required-decision',
					status: 'pending-user-consent',
					reason: requiredDecision.reason || requiredDecision.type || 'playback-decision-required',
					message: 'Playback startup is blocked until the playback decision is resolved.'
				});
				setLoading(false);
				setLoadingStatusMessage(decisionMessage);
				await requestPlaybackDecision?.({
					...requiredDecision,
					itemId: item.Id,
					mediaSourceId: requiredDecision.mediaSourceId || mediaSource.Id,
					generation,
					subtitleStreamIndex: Number.isInteger(requiredDecision.subtitleStreamIndex)
						? requiredDecision.subtitleStreamIndex
						: selectedSubtitle
				});
				return;
			}

			const {
				videoUrl,
				isHls
			} = resolvePlaybackVideoUrl({
				service: jellyfinService,
				itemId: item.Id,
				mediaSource,
				playbackInfo,
				resolvedPlayMethod
			});
			const runtimeMediaSourceData = {
				...mediaSource,
				...mediaSourceDebugData,
				__itemId: item.Id,
				__playbackGeneration: generation,
				__debugVideoUrl: redactSensitiveUrl(videoUrl),
				__debugIsHls: isHls,
				__debugHlsEngine: isHls ? 'pending' : null
			};
			const playbackRuntimeContext = createPlaybackRuntimeContext({
				generation,
				itemId: item.Id,
				mediaSourceData: runtimeMediaSourceData,
				playMethod: resolvedPlayMethod,
				dynamicRange: dynamicRangeInfo,
				subtitlePolicy: playbackMeta.subtitlePolicy || mediaSourceDebugData.__debugSubtitlePolicy,
				selectedAudioTrack: selectedAudio,
				selectedSubtitleTrack: selectedSubtitle,
				playbackOptions: playbackSettingsSnapshot
			});
			playbackRuntimeContextRef.current = playbackRuntimeContext;

			setMediaSourceData((previousValue) => ({
				...(previousValue || mediaSource),
				...mediaSourceDebugData,
				__itemId: item.Id,
				__playbackGeneration: generation,
				__debugVideoUrl: redactSensitiveUrl(videoUrl),
				__debugIsHls: isHls,
				__debugHlsEngine: isHls ? 'pending' : null
			}));

			pendingOverrideClearRef.current = !!playbackOverrideRef.current;

			const video = videoRef.current;
			if (!video) {
				throw new Error('Video element not available');
			}
			if (isStaleLoad()) return;

			const subtitlePolicy = playbackMeta.subtitlePolicy ||
				mediaSourceDebugData.__debugSubtitlePolicy ||
				null;
			const serverBurnIn = subtitlePolicy?.forceBurnIn === true ||
				subtitlePolicy?.requiresBurnIn === true ||
				/[?&]subtitlemethod=encode(?:&|$)/i.test(videoUrl);
			const sourceToken = attachPlaybackSource?.({
				url: videoUrl,
				transport: isHls ? 'hls' : 'file',
				isHls,
				isHdrLikeStream,
				playMethod: resolvedPlayMethod,
				serverBurnIn,
				runtimeContext: playbackRuntimeContext,
				onEngineSelected: (engine) => {
					if (isStaleLoad()) return;
					setMediaSourceData((previousValue) => ({
						...(previousValue || mediaSource),
						__debugHlsEngine: isHls ? engine : null
					}));
				}
			});
			if (!sourceToken && !isStaleLoad()) {
				throw new Error('Playback source could not be attached');
			}
			if (isStaleLoad()) return;
		} catch (err) {
			if (isStaleLoad()) return;
			if (err?.code === 'subtitle-burn-in-no-source') {
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
				await requestPlaybackDecision?.({
					type: 'no-subtitles',
					itemId: item.Id,
					generation,
					subtitleStreamIndex,
					reason: 'subtitle-burn-in-no-source',
					requiresNoSubtitleConsent: true
				});
				return;
			}
			const confirmedRange = String(
				playbackOverrideRef.current?.confirmedDynamicRangeFallback || ''
			).toLowerCase();
			if (confirmedRange === 'hdr10') {
				setLoading(false);
				setLoadingStatusMessage('Waiting for video quality decision...');
				await requestPlaybackDecision?.({
					type: 'dynamic-range-fallback',
					itemId: item.Id,
					mediaSourceId: playbackOverrideRef.current?.mediaSourceId || null,
					generation,
					originalRange: 'DV',
					proposedRange: 'sdr',
					reason: 'hdr-fallback-negotiation-failed'
				});
				return;
			}
			console.error('Failed to load video:', err);
			showPlaybackError(getPlaybackErrorMessage(err, 'Failed to load video'));
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
		playbackGenerationRef,
		playbackRuntimeContextRef,
		setPlaybackGeneration,
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

	return loadVideo;
};
