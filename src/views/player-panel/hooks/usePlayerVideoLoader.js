import {useCallback} from 'react';
import Hls from 'hls.js';
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
	resolvePlaybackVideoUrl,
	selectHlsEnginePreference
} from '../utils/playerVideoLoaderHelpers';
import {
	createNativePlaybackSourceToken,
	createPlaybackRuntimeContext
} from '../utils/playbackRuntimeContext';

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
	hlsRef,
	nativeHlsFallbackCleanupRef,
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
	attachHlsPlayback,
	pendingOverrideClearRef,
	showPlaybackError,
	playbackSessionRef,
	appendPlaybackDiagnostic,
	requestPlaybackDecision,
	exitInProgressRef,
	playbackGenerationRef,
	playbackRuntimeContextRef,
	nativeSourceTokenRef,
	videoMountRetryTimerRef,
	onPlaybackSourceAttached,
	onPlaybackSourceInvalidated,
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
		playbackGenerationRef.current = generation;
		playbackRuntimeContextRef.current = null;
		nativeSourceTokenRef.current = null;
		onPlaybackSourceInvalidated?.();
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
		if (playbackOverrideRef.current?.forceNewSession !== true) {
			setLoadingStatusMessage('Loading...');
		}
		setLoading(true);
		reloadAttemptedRef.current = false;
		subtitleCompatibilityFallbackAttemptedRef.current = false;
		lastProgressRef.current = {time: 0, timestamp: Date.now()};
		setError(null);
		seekOffsetRef.current = 0;
		loadTrackPreferences();

		if (hlsRef.current) {
			hlsRef.current.destroy();
			hlsRef.current = null;
		}
		if (typeof nativeHlsFallbackCleanupRef?.current === 'function') {
			nativeHlsFallbackCleanupRef.current();
		}

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
			let hlsEngine = null;

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

			let activeSourceToken = null;
			const registerSource = (engine) => {
				const sourceToken = createNativePlaybackSourceToken({
					runtimeContext: playbackRuntimeContext,
					video,
					sourceUrl: videoUrl,
					engine
				});
				activeSourceToken = sourceToken;
				nativeSourceTokenRef.current = sourceToken;
				onPlaybackSourceAttached?.(sourceToken);
				return sourceToken;
			};
			if (isHls) {
				const nativeHlsMimeResults = {
					'application/vnd.apple.mpegURL':
						video.canPlayType('application/vnd.apple.mpegURL'),
					'application/x-mpegURL':
						video.canPlayType('application/x-mpegURL')
				};
				const nativeHlsSupported = Boolean(
					nativeHlsMimeResults['application/vnd.apple.mpegURL'] ||
					nativeHlsMimeResults['application/x-mpegURL']
				);
				const hlsJsSupported = Hls.isSupported();
				const hlsPreference = selectHlsEnginePreference({
					isHls,
					isHdrLikeStream,
					nativeHlsSupported,
					hlsJsSupported
				});

				if (hlsPreference.engine === 'native') {
					appendPlaybackDiagnostic?.({
						scope: 'hls-engine',
						stage: 'select',
						status: 'applied',
						reason: hlsPreference.reason,
						message: `Using native HLS playback (${JSON.stringify(nativeHlsMimeResults)}).`
					});

					if (hlsPreference.allowNativeFallback) {
						let fallbackTriggered = false;
						let fallbackTimer = null;
						let errorHandler = null;
						let startupHandler = null;
						const startupInitialTime = Number(video.currentTime) || 0;
						const cleanupNativeFallback = () => {
							if (fallbackTimer) {
								clearTimeout(fallbackTimer);
								fallbackTimer = null;
							}
							if (errorHandler) {
								video.removeEventListener('error', errorHandler);
							}
							if (startupHandler) {
								video.removeEventListener('canplay', startupHandler);
								video.removeEventListener('playing', startupHandler);
								video.removeEventListener('timeupdate', startupHandler);
							}
							if (nativeHlsFallbackCleanupRef?.current === cleanupNativeFallback) {
								nativeHlsFallbackCleanupRef.current = null;
							}
						};
						nativeHlsFallbackCleanupRef.current = cleanupNativeFallback;

						const tryHlsJsFallback = (reason = 'native-hls-timeout') => {
							if (fallbackTriggered || !hlsJsSupported || isStaleLoad()) return;
							fallbackTriggered = true;
							cleanupNativeFallback();
							if (nativeSourceTokenRef.current === activeSourceToken) {
								nativeSourceTokenRef.current = null;
								onPlaybackSourceInvalidated?.();
							}
							hlsEngine = 'hls.js';
							appendPlaybackDiagnostic?.({
								scope: 'hls-engine',
								stage: 'fallback',
								status: 'applied',
								reason,
								message: 'Native HLS fallback started with HLS.js.'
							});

							video.src = '';
							video.removeAttribute('src');
							attachHlsPlayback(video, videoUrl, 'HLS.js', playbackRuntimeContext);
							registerSource('hls.js');
							setMediaSourceData((previousValue) => ({
								...(previousValue || mediaSource),
								__debugHlsEngine: 'hls.js'
							}));
						};

						fallbackTimer = setTimeout(() => {
							if (!isStaleLoad() && video.readyState < 2) {
								tryHlsJsFallback('native-hls-timeout');
							}
						}, 3500);

						errorHandler = (event) => {
							if (isStaleLoad()) return;
							console.error('Native HLS error:', {
								type: event?.type || 'error',
								mediaErrorCode: video.error?.code || null,
								networkState: video.networkState,
								readyState: video.readyState
							});
							cleanupNativeFallback();
							appendPlaybackDiagnostic?.({
								scope: 'hls-engine',
								stage: 'native-error',
								status: 'failed',
								reason: 'native-hls-error',
								message: 'Native HLS emitted an error before startup.'
							});
							tryHlsJsFallback('native-hls-error');
						};
						startupHandler = (event) => {
							const hasProgress = event?.type !== 'timeupdate' ||
								Math.abs((Number(video.currentTime) || 0) - startupInitialTime) >= 0.25;
							if (!hasProgress) return;
							cleanupNativeFallback();
						};

						video.addEventListener('error', errorHandler, {once: true});
						video.addEventListener('canplay', startupHandler, {once: true});
						video.addEventListener('playing', startupHandler, {once: true});
						video.addEventListener('timeupdate', startupHandler);
					}

					video.src = videoUrl;
					hlsEngine = 'native';
				} else if (hlsPreference.engine === 'hls.js') {
					appendPlaybackDiagnostic?.({
						scope: 'hls-engine',
						stage: 'select',
						status: 'applied',
						reason: hlsPreference.reason,
						message: 'Using HLS.js playback.'
					});
					attachHlsPlayback(video, videoUrl, 'HLS.js', playbackRuntimeContext);
					hlsEngine = 'hls.js';
				} else {
					appendPlaybackDiagnostic?.({
						scope: 'hls-engine',
						stage: 'select',
						status: 'failed',
						reason: hlsPreference.reason,
						message: 'No supported HLS playback engine is available.'
					});
					throw new Error('HLS playback not supported on this device');
				}
			} else {
				video.src = videoUrl;
			}
			if (isStaleLoad()) return;

			setMediaSourceData((previousValue) => ({
				...(previousValue || mediaSource),
				__debugHlsEngine: isHls ? (hlsEngine || 'unknown') : null
			}));

			if (!activeSourceToken) {
				registerSource(isHls ? (hlsEngine || 'unknown') : 'native');
			}
			video.load();
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
		attachHlsPlayback,
		hlsRef,
		item,
		nativeHlsFallbackCleanupRef,
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
		nativeSourceTokenRef,
		onPlaybackSourceAttached,
		onPlaybackSourceInvalidated,
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
