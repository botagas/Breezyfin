import {useCallback} from 'react';
import Hls from 'hls.js';
import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import jellyfinService from '../../../services/jellyfinService';
import {getPlaybackErrorMessage, isFatalPlaybackError} from '../../../utils/errorMessages';
import {toInteger} from '../../../utils/numberParsing';
import {readBreezyfinSettings} from '../../../utils/settingsStorage';
import {
	getDynamicRangeDisplayLabel,
	getDynamicRangeInfo
} from '../../../utils/playbackDynamicRange';
import {
	buildPlayerPlaybackSettingsSnapshot,
	resolveInitialTrackSelection,
	resolvePlaybackVideoUrl,
	selectHlsEnginePreference
} from '../utils/playerVideoLoaderHelpers';

const NATIVE_HLS_HDR_RANGE_IDS = new Set(['DV', 'HDR10', 'HDR10_PLUS', 'HLG']);
const DEBUG_SOURCE_SUMMARY_LIMIT = 8;

const buildSourceDebugSummary = (mediaSources = []) => {
	if (!Array.isArray(mediaSources) || mediaSources.length === 0) return [];
	return mediaSources.slice(0, DEBUG_SOURCE_SUMMARY_LIMIT).map((source) => {
		const videoStream = source?.MediaStreams?.find((stream) => stream?.Type === 'Video') || null;
		return {
			id: source?.Id || '',
			container: source?.Container || '',
			videoCodec: videoStream?.Codec || '',
			videoRangeType: videoStream?.VideoRangeType || '',
			videoRange: videoStream?.VideoRange || '',
			supportsDirectPlay: source?.SupportsDirectPlay === true,
			supportsDirectStream: source?.SupportsDirectStream === true,
			supportsTranscoding: source?.SupportsTranscoding === true,
			defaultAudioStreamIndex: toInteger(source?.DefaultAudioStreamIndex)
		};
	});
};

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
	startupFallbackTimerRef,
	attemptTranscodeFallback,
	attachHlsPlayback,
	pendingOverrideClearRef,
	showPlaybackError,
	startWatchTimerRef,
	playing,
	attemptPlaybackSessionRebuild,
	playbackFailureLockedRef,
	failStartTimerRef,
	playbackSessionRef,
	appendPlaybackDiagnostic
}) => {
	const loadVideo = useCallback(async (forceTranscodeOverride = false) => {
		if (!item) return;

		const requestId = (loadRequestIdRef.current || 0) + 1;
		loadRequestIdRef.current = requestId;
		const isStaleLoad = () => loadRequestIdRef.current !== requestId;

		if (!videoRef.current) {
			setTimeout(() => {
				if (!isStaleLoad()) {
					loadVideo(forceTranscodeOverride);
				}
			}, 100);
			return;
		}

		resetRecoveryGuards();
		playbackStartedRef.current = false;
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

			setMediaSourceData({
				...mediaSource,
				__selectedPlayMethod: resolvedPlayMethod,
				__dynamicRangeInfo: dynamicRangeInfo,
				__dynamicRangeLabel: dynamicRangeLabel,
				__requestedDynamicRangeCap: playbackMeta.dynamicRangeCap || requestedDynamicRangeCap,
				__debugVideoRangeType: videoStream?.VideoRangeType || '',
				__debugVideoRange: videoStream?.VideoRange || '',
				__debugVideoCodec: videoStream?.Codec || '',
				__debugRequest: playbackRequestDebug,
				__debugDecision: playbackMeta.decision || null,
				__debugSubtitlePolicy: playbackMeta.subtitlePolicy || null,
				__debugDiagnostics: Array.isArray(playbackMeta.diagnostics) ? playbackMeta.diagnostics : [],
				__debugAvailableSources: buildSourceDebugSummary(playbackInfo?.MediaSources),
				__debugSelectedSourceId: mediaSource?.Id || ''
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
				pickPreferredAudio,
				pickPreferredSubtitle
			});

			setCurrentAudioTrack(selectedAudio);
			setCurrentSubtitleTrack(selectedSubtitle);

			const {
				videoUrl,
				isHls,
				useTranscoding
			} = resolvePlaybackVideoUrl({
				service: jellyfinService,
				itemId: item.Id,
				mediaSource,
				playbackInfo,
				resolvedPlayMethod
			});
			let hlsEngine = null;

			setMediaSourceData((previousValue) => ({
				...(previousValue || mediaSource),
				__selectedPlayMethod: resolvedPlayMethod,
				__dynamicRangeInfo: dynamicRangeInfo,
				__dynamicRangeLabel: dynamicRangeLabel,
				__requestedDynamicRangeCap: playbackMeta.dynamicRangeCap || requestedDynamicRangeCap,
				__debugVideoRangeType: videoStream?.VideoRangeType || '',
				__debugVideoRange: videoStream?.VideoRange || '',
				__debugVideoCodec: videoStream?.Codec || '',
				__debugRequest: playbackRequestDebug,
				__debugDecision: playbackMeta.decision || null,
				__debugSubtitlePolicy: playbackMeta.subtitlePolicy || null,
				__debugDiagnostics: Array.isArray(playbackMeta.diagnostics) ? playbackMeta.diagnostics : [],
				__debugAvailableSources: buildSourceDebugSummary(playbackInfo?.MediaSources),
				__debugSelectedSourceId: mediaSource?.Id || '',
				__debugVideoUrl: videoUrl,
				__debugIsHls: isHls,
				__debugHlsEngine: isHls ? 'pending' : null
			}));

			pendingOverrideClearRef.current = !!playbackOverrideRef.current;

			const video = videoRef.current;
			if (!video) {
				throw new Error('Video element not available');
			}
			if (isStaleLoad()) return;

			if (!useTranscoding && mediaSource.SupportsTranscoding) {
				if (startupFallbackTimerRef.current) {
					clearTimeout(startupFallbackTimerRef.current);
				}
				startupFallbackTimerRef.current = setTimeout(() => {
					if (isStaleLoad()) return;
					console.warn('[Player] Direct playback startup timeout, attempting transcode fallback');
					attemptTranscodeFallback('Startup timeout');
				}, 12000);
			}

			if (isHls) {
				const nativeHlsSupported = Boolean(
					video.canPlayType('application/vnd.apple.mpegURL') ||
					video.canPlayType('application/x-mpegURL')
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
						message: 'Using native HLS playback.'
					});

					if (hlsPreference.allowNativeFallback) {
						let fallbackTriggered = false;
						let fallbackTimer = null;
						let errorHandler = null;
						let startupHandler = null;
						const cleanupNativeFallback = () => {
							if (fallbackTimer) {
								clearTimeout(fallbackTimer);
								fallbackTimer = null;
							}
							if (errorHandler) {
								video.removeEventListener('error', errorHandler);
							}
							if (startupHandler) {
								video.removeEventListener('loadeddata', startupHandler);
								video.removeEventListener('canplay', startupHandler);
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
							attachHlsPlayback(video, videoUrl, 'HLS.js');
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
							console.error('Native HLS error:', event);
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
						startupHandler = () => {
							cleanupNativeFallback();
						};

						video.addEventListener('error', errorHandler, {once: true});
						video.addEventListener('loadeddata', startupHandler, {once: true});
						video.addEventListener('canplay', startupHandler, {once: true});
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
					attachHlsPlayback(video, videoUrl, 'HLS.js');
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

			video.load();
			try {
				await video.play();
			} catch (playError) {
				if (isStaleLoad()) return;
				if (isFatalPlaybackError(playError)) {
					const errorMessage = getPlaybackErrorMessage(playError);
					if (!useTranscoding) {
						const didFallback = await attemptTranscodeFallback(errorMessage);
						if (isStaleLoad()) return;
						if (didFallback) {
							return;
						}
					}
					showPlaybackError(errorMessage);
					return;
				}
			}
			if (isStaleLoad()) return;

			if (startWatchTimerRef.current) {
				clearTimeout(startWatchTimerRef.current);
			}
			startWatchTimerRef.current = setTimeout(() => {
				if (isStaleLoad()) return;
				if (!videoRef.current) return;

				const last = lastProgressRef.current || {time: 0, timestamp: 0};
				const now = Date.now();
				const stagnant =
					(now - last.timestamp > 5000) &&
					Math.abs((videoRef.current.currentTime || 0) - last.time) < 0.25;
				if (playing && !stagnant) return;

				const rebuilt = attemptPlaybackSessionRebuild(
					'Playback stalled after load()',
					{
						toast: 'Playback stalled. Rebuilding session...',
						errorData: {
							videoReadyState: videoRef.current?.readyState,
							videoNetworkState: videoRef.current?.networkState,
							videoCurrentTime: videoRef.current?.currentTime,
							lastProgress: last
						}
					}
				);
				if (!rebuilt) {
					showPlaybackError(
						'Playback failed after session rebuild attempt. Please retry or go back.'
					);
				}
			}, 7000);

			if (failStartTimerRef.current) {
				clearTimeout(failStartTimerRef.current);
			}
			failStartTimerRef.current = setTimeout(() => {
				if (isStaleLoad()) return;
				if (playbackFailureLockedRef.current) return;
				const videoElement = videoRef.current;
				if (!videoElement) return;
				if (videoElement.readyState >= 3) return;
				console.warn('[Player] Playback failed to start within timeout, showing retry');
				showPlaybackError('Playback failed to start. Please try again.');
			}, 12000);
		} catch (err) {
			if (isStaleLoad()) return;
			console.error('Failed to load video:', err);
			showPlaybackError(getPlaybackErrorMessage(err, 'Failed to load video'));
		}
	}, [
		appendPlaybackDiagnostic,
		attachHlsPlayback,
		attemptPlaybackSessionRebuild,
		attemptTranscodeFallback,
		failStartTimerRef,
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
		playbackFailureLockedRef,
		playbackOptions,
		playbackOverrideRef,
		playbackSessionRef,
		playbackSettingsRef,
		playing,
		reloadAttemptedRef,
		resetRecoveryGuards,
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
		startWatchTimerRef,
		startupFallbackTimerRef,
		subtitleCompatibilityFallbackAttemptedRef,
		videoRef
	]);

	return loadVideo;
};
