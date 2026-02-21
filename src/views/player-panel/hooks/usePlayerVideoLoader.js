import {useCallback} from 'react';
import Hls from 'hls.js';
import jellyfinService from '../../../services/jellyfinService';
import {getPlaybackErrorMessage, isFatalPlaybackError} from '../../../utils/errorMessages';
import {readBreezyfinSettings} from '../../../utils/settingsStorage';
import {isStyleDebugEnabled} from '../../../utils/featureFlags';

const RELAXED_PLAYBACK_PROFILE_ENABLED = isStyleDebugEnabled();

export const usePlayerVideoLoader = ({
	item,
	videoRef,
	hlsRef,
	loadVideoRef,
	resetRecoveryGuards,
	setLoading,
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
	playbackSessionRef
}) => {
	const loadVideo = useCallback(async (forceTranscodeOverride = false) => {
		if (!item) return;

		if (!videoRef.current) {
			setTimeout(() => loadVideo(forceTranscodeOverride), 100);
			return;
		}

		resetRecoveryGuards();
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

		loadVideoRef.current = loadVideo;

		try {
			const settings = readBreezyfinSettings();
			let forceTranscoding = forceTranscodeOverride || settings.forceTranscoding || false;
			let forcedBySubtitlePreference = false;
			const enableTranscoding = settings.enableTranscoding !== false;
			const maxBitrate = settings.maxBitrate;
			const autoPlayNext = settings.autoPlayNext !== false;
			const relaxedPlaybackProfile = RELAXED_PLAYBACK_PROFILE_ENABLED && settings.relaxedPlaybackProfile === true;
			const requestedSubtitleTrack =
				(playbackOverrideRef.current?.subtitleStreamIndex === -1 ||
					Number.isInteger(playbackOverrideRef.current?.subtitleStreamIndex))
					? playbackOverrideRef.current?.subtitleStreamIndex
					: playbackOptions?.subtitleStreamIndex;

			const hasSubtitles =
				Number.isInteger(requestedSubtitleTrack) && requestedSubtitleTrack >= 0;
			const strictTranscodingMode =
				settings.forceTranscoding === true ||
				(hasSubtitles && settings.forceTranscodingWithSubtitles !== false);
			if (!forceTranscoding && hasSubtitles && settings.forceTranscodingWithSubtitles !== false) {
				forceTranscoding = true;
				forcedBySubtitlePreference = true;
			}

			playbackSettingsRef.current = {
				forceTranscoding,
				strictTranscodingMode,
				enableTranscoding,
				maxBitrate,
				autoPlayNext,
				relaxedPlaybackProfile
			};

			let playbackInfo = null;
			try {
				const options = {
					...((playbackOverrideRef.current ?? playbackOptions) || {}),
					...playbackSettingsRef.current
				};
				playbackInfo = await jellyfinService.getPlaybackInfo(item.Id, options);
			} catch (infoError) {
				console.error('Failed to get playback info:', infoError);
			}

			const mediaSource = playbackInfo?.MediaSources?.[0];
			if (!mediaSource) {
				throw new Error('No media source available');
			}

			const playbackMeta = playbackInfo?.__breezyfin || {};
			const compatibilityToasts = [];
			if (forcedBySubtitlePreference) {
				compatibilityToasts.push('Subtitles selected: using transcoding for compatibility.');
			}
			if (Array.isArray(playbackMeta.adjustments)) {
				playbackMeta.adjustments.forEach((adjustment) => {
					if (adjustment?.toast) compatibilityToasts.push(adjustment.toast);
				});
			}
			if (compatibilityToasts.length > 0) {
				setToastMessage([...new Set(compatibilityToasts)].join(' '));
			}

			if (playbackSettingsRef.current.forceTranscoding && !mediaSource.TranscodingUrl) {
				throw new Error('Transcoding was forced, but the server did not return a transcoding URL.');
			}

			const resolvedPlayMethod =
				playbackMeta.playMethod ||
				(mediaSource.TranscodingUrl
					? 'Transcode'
					: (mediaSource.SupportsDirectPlay ? 'DirectPlay' : 'DirectStream'));

			playbackSessionRef.current = {
				playSessionId: playbackInfo?.PlaySessionId || null,
				mediaSourceId: mediaSource?.Id || null,
				playMethod: resolvedPlayMethod
			};

			setMediaSourceData({
				...mediaSource,
				__selectedPlayMethod: resolvedPlayMethod
			});

			if (mediaSource.RunTimeTicks) {
				const totalDuration = mediaSource.RunTimeTicks / 10000000;
				setDuration(totalDuration);
			} else if (item.RunTimeTicks) {
				const totalDuration = item.RunTimeTicks / 10000000;
				setDuration(totalDuration);
			}

			const audioStreams = mediaSource.MediaStreams?.filter((s) => s.Type === 'Audio') || [];
			const subtitleStreams = mediaSource.MediaStreams?.filter((s) => s.Type === 'Subtitle') || [];

			setAudioTracks(audioStreams);
			setSubtitleTracks(subtitleStreams);

			const defaultAudio = audioStreams.find((s) => s.IsDefault) || audioStreams[0];
			const defaultSubtitle = subtitleStreams.find((s) => s.IsDefault);

			const providedAudio = Number.isInteger(playbackOptions?.audioStreamIndex)
				? playbackOptions.audioStreamIndex
				: null;
			const providedSubtitle = Number.isInteger(playbackOptions?.subtitleStreamIndex)
				? playbackOptions.subtitleStreamIndex
				: null;

			const initialAudio = pickPreferredAudio(audioStreams, providedAudio, defaultAudio);
			const initialSubtitle = pickPreferredSubtitle(subtitleStreams, providedSubtitle, defaultSubtitle);

			const overrideAudio = Number.isInteger(playbackOverrideRef.current?.audioStreamIndex)
				? playbackOverrideRef.current.audioStreamIndex
				: null;
			const overrideSubtitle =
				(playbackOverrideRef.current?.subtitleStreamIndex === -1 ||
					Number.isInteger(playbackOverrideRef.current?.subtitleStreamIndex))
					? playbackOverrideRef.current.subtitleStreamIndex
					: null;

			const selectedAudio = Number.isInteger(overrideAudio) ? overrideAudio : initialAudio;
			const selectedSubtitle =
				(overrideSubtitle === -1 || Number.isInteger(overrideSubtitle))
					? overrideSubtitle
					: initialSubtitle;

			setCurrentAudioTrack(selectedAudio);
			setCurrentSubtitleTrack(selectedSubtitle);

			let videoUrl;
			let isHls = false;
			const useTranscoding = resolvedPlayMethod === 'Transcode';

			if (useTranscoding) {
				if (!mediaSource.TranscodingUrl) {
					throw new Error('Transcoding selected, but no transcoding URL was returned.');
				}
				videoUrl = `${jellyfinService.serverUrl}${mediaSource.TranscodingUrl}`;
				isHls = mediaSource.TranscodingUrl.includes('.m3u8') ||
					mediaSource.TranscodingUrl.includes('/hls/') ||
					mediaSource.TranscodingContainer?.toLowerCase() === 'ts';
			} else if (resolvedPlayMethod === 'DirectStream' && mediaSource.SupportsDirectStream) {
				videoUrl = jellyfinService.getPlaybackUrl(
					item.Id,
					mediaSource.Id,
					playbackInfo.PlaySessionId,
					mediaSource.ETag,
					mediaSource.Container,
					mediaSource.LiveStreamId
				);
			} else if (resolvedPlayMethod === 'DirectPlay' && mediaSource.SupportsDirectPlay) {
				videoUrl =
					`${jellyfinService.serverUrl}/Videos/${item.Id}/stream?static=true&mediaSourceId=${mediaSource.Id}&api_key=${jellyfinService.accessToken}`;
			} else {
				throw new Error('No supported playback method available');
			}

			if (useTranscoding && mediaSource.TranscodingUrl) {
				const url = new URL(`${jellyfinService.serverUrl}${mediaSource.TranscodingUrl}`);
				if (Number.isInteger(selectedAudio)) {
					url.searchParams.set('AudioStreamIndex', selectedAudio);
				}
				if (selectedSubtitle === -1 || Number.isInteger(selectedSubtitle)) {
					url.searchParams.set('SubtitleStreamIndex', selectedSubtitle);
					if (selectedSubtitle >= 0) {
						url.searchParams.set('SubtitleMethod', 'Encode');
					} else {
						url.searchParams.delete('SubtitleMethod');
					}
				}
				if (playbackOverrideRef.current?.forceNewSession) {
					const newSessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
					url.searchParams.set('PlaySessionId', newSessionId);
				}
				videoUrl = url.toString();
			}

			pendingOverrideClearRef.current = !!playbackOverrideRef.current;

			const video = videoRef.current;
			if (!video) {
				throw new Error('Video element not available');
			}

			if (!useTranscoding && mediaSource.SupportsTranscoding) {
				if (startupFallbackTimerRef.current) {
					clearTimeout(startupFallbackTimerRef.current);
				}
				startupFallbackTimerRef.current = setTimeout(() => {
					console.warn('[Player] Direct playback startup timeout, attempting transcode fallback');
					attemptTranscodeFallback('Startup timeout');
				}, 12000);
			}

			if (isHls) {
				const nativeHls =
					video.canPlayType('application/vnd.apple.mpegURL') ||
					video.canPlayType('application/x-mpegURL');

				if (nativeHls) {
					let fallbackTriggered = false;

					const tryHlsJsFallback = () => {
						if (fallbackTriggered || !Hls.isSupported()) return;
						fallbackTriggered = true;

						video.src = '';
						video.removeAttribute('src');

						attachHlsPlayback(video, videoUrl, 'HLS.js');
					};

					const fallbackTimer = setTimeout(() => {
						if (video.readyState === 0) {
							tryHlsJsFallback();
						}
					}, 3000);

					const errorHandler = (e) => {
						console.error('Native HLS error:', e);
						clearTimeout(fallbackTimer);
						tryHlsJsFallback();
					};
					video.addEventListener('error', errorHandler, {once: true});

					video.addEventListener('loadstart', () => {
						clearTimeout(fallbackTimer);
						video.removeEventListener('error', errorHandler);
					}, {once: true});

					video.src = videoUrl;
				} else if (Hls.isSupported()) {
					attachHlsPlayback(video, videoUrl, 'HLS.js');
				} else {
					throw new Error('HLS playback not supported on this device');
				}
			} else {
				video.src = videoUrl;
			}

			video.load();
			try {
				await video.play();
			} catch (playError) {
				if (isFatalPlaybackError(playError)) {
					const errorMessage = getPlaybackErrorMessage(playError);
					if (!useTranscoding) {
						const didFallback = await attemptTranscodeFallback(errorMessage);
						if (didFallback) {
							return;
						}
					}
					showPlaybackError(errorMessage);
					return;
				}
			}

			if (startWatchTimerRef.current) {
				clearTimeout(startWatchTimerRef.current);
			}
			startWatchTimerRef.current = setTimeout(() => {
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
				if (playbackFailureLockedRef.current) return;
				const videoElement = videoRef.current;
				if (!videoElement) return;
				if (videoElement.readyState >= 3) return;
				console.warn('[Player] Playback failed to start within timeout, showing retry');
				showPlaybackError('Playback failed to start. Please try again.');
			}, 12000);
		} catch (err) {
			console.error('Failed to load video:', err);
			showPlaybackError(getPlaybackErrorMessage(err, 'Failed to load video'));
		}
	}, [
		attachHlsPlayback,
		attemptPlaybackSessionRebuild,
		attemptTranscodeFallback,
		failStartTimerRef,
		hlsRef,
		item,
		lastProgressRef,
		loadTrackPreferences,
		loadVideoRef,
		pendingOverrideClearRef,
		pickPreferredAudio,
		pickPreferredSubtitle,
		playbackFailureLockedRef,
		playbackOptions,
		playbackOverrideRef,
		playbackSessionRef,
		playbackSettingsRef,
		playing,
		reloadAttemptedRef,
		resetRecoveryGuards,
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
