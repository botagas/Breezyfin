import { useState, useEffect, useRef, useCallback } from 'react';
import { Panel } from '../components/BreezyPanels';
import Button from '../components/BreezyButton';
import Slider from '@enact/sandstone/Slider';
import BodyText from '@enact/sandstone/BodyText';
import Popup from '@enact/sandstone/Popup';
import Item from '@enact/sandstone/Item';
import Scroller from '@enact/sandstone/Scroller';
import Spotlight from '@enact/spotlight';
import Hls from 'hls.js';
import jellyfinService from '../services/jellyfinService';
import {KeyCodes} from '../utils/keyCodes';
import {getPlaybackErrorMessage, isFatalPlaybackError} from '../utils/errorMessages';
import {readBreezyfinSettings} from '../utils/settingsStorage';
import {isStyleDebugEnabled} from '../utils/featureFlags';
import { usePanelBackHandler } from '../hooks/usePanelBackHandler';
import { useTrackPreferences } from '../hooks/useTrackPreferences';
import { useToastMessage } from '../hooks/useToastMessage';
import { useDisclosureMap } from '../hooks/useDisclosureMap';

import css from './PlayerPanel.module.less';
import popupStyles from '../styles/popupStyles.module.less';
import {popupShellCss} from '../styles/popupStyles';

const MAX_HLS_NETWORK_RECOVERY_ATTEMPTS = 1;
const MAX_HLS_MEDIA_RECOVERY_ATTEMPTS = 1;
const MAX_PLAY_SESSION_REBUILD_ATTEMPTS = 1;
const RELAXED_PLAYBACK_PROFILE_ENABLED = isStyleDebugEnabled();
const HLS_PLAYER_CONFIG = {
	enableWorker: true,
	lowLatencyMode: false,
	backBufferLength: 90,
	maxBufferLength: 30,
	maxMaxBufferLength: 600,
	fragLoadingTimeOut: 20000,
	levelLoadingTimeOut: 20000,
	fragLoadingMaxRetry: 4,
	levelLoadingMaxRetry: 4,
	startLevel: -1
};
const PLAYER_DISCLOSURE_KEYS = {
	AUDIO_TRACKS: 'audioTracksPopup',
	SUBTITLE_TRACKS: 'subtitleTracksPopup'
};
const INITIAL_PLAYER_DISCLOSURES = {
	[PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS]: false,
	[PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS]: false
};

const PlayerPanel = ({
	item,
	playbackOptions,
	onBack,
	onPlay,
	isActive = false,
	requestedControlsVisible,
	onControlsVisibilityChange,
	registerBackHandler,
	...rest
}) => {
	const videoRef = useRef(null);
	const hlsRef = useRef(null);
	const progressIntervalRef = useRef(null);
	const seekOffsetRef = useRef(0); // Track offset for transcoded stream seeking
	const playbackSettingsRef = useRef({}); // Persist user playback settings between re-requests
	const playbackSessionRef = useRef({
		playSessionId: null,
		mediaSourceId: null,
		playMethod: 'DirectStream'
	});
	const currentAudioTrackRef = useRef(null);
	const currentSubtitleTrackRef = useRef(null);
	const startupFallbackTimerRef = useRef(null);
	const transcodeFallbackAttemptedRef = useRef(false);
	const reloadAttemptedRef = useRef(false);
	const lastProgressRef = useRef({ time: 0, timestamp: 0 });
	const loadVideoRef = useRef(null);
	const playbackOverrideRef = useRef(null);
	const skipButtonRef = useRef(null);
	const playPauseButtonRef = useRef(null);
	const skipOverlayRef = useRef(null);
	const controlsRef = useRef(null);
	const lastInteractionRef = useRef(Date.now());
	const startWatchTimerRef = useRef(null);
	const failStartTimerRef = useRef(null);
	const pendingOverrideClearRef = useRef(false);
	const seekFeedbackTimerRef = useRef(null);
	const nextEpisodePromptStartTicksRef = useRef(null);
	const wasSkipOverlayVisibleRef = useRef(false);
	const skipFocusRetryTimerRef = useRef(null);
	const subtitleCompatibilityFallbackAttemptedRef = useRef(false);
	const hlsNetworkRecoveryAttemptsRef = useRef(0);
	const hlsMediaRecoveryAttemptsRef = useRef(0);
	const playSessionRebuildAttemptsRef = useRef(0);
	const playbackFailureLockedRef = useRef(false);
	const {
		toastMessage,
		setToastMessage
	} = useToastMessage({durationMs: 2000});
	const {
		loadTrackPreferences,
		pickPreferredAudio,
		pickPreferredSubtitle,
		saveAudioSelection,
		saveSubtitleSelection
	} = useTrackPreferences();

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [showControls, setShowControls] = useState(true);
	const [volume, setVolume] = useState(100);
	const [muted, setMuted] = useState(false);

	// Track selection state
	const [audioTracks, setAudioTracks] = useState([]);
	const [subtitleTracks, setSubtitleTracks] = useState([]);
	const [currentAudioTrack, setCurrentAudioTrack] = useState(null);
	const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState(null);
	const {
		disclosures,
		openDisclosure,
		closeDisclosure
	} = useDisclosureMap(INITIAL_PLAYER_DISCLOSURES);
	const showAudioPopup = disclosures[PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS] === true;
	const showSubtitlePopup = disclosures[PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS] === true;
	const [mediaSourceData, setMediaSourceData] = useState(null);
	const [hasNextEpisode, setHasNextEpisode] = useState(false);
	const [hasPreviousEpisode, setHasPreviousEpisode] = useState(false);
	const [mediaSegments, setMediaSegments] = useState([]);
	const [currentSkipSegment, setCurrentSkipSegment] = useState(null);
	const [skipCountdown, setSkipCountdown] = useState(null);
	const [skipOverlayVisible, setSkipOverlayVisible] = useState(false);
	const [dismissedSkipSegmentId, setDismissedSkipSegmentId] = useState(null);
	const [showNextEpisodePrompt, setShowNextEpisodePrompt] = useState(false);
	const [nextEpisodePromptDismissed, setNextEpisodePromptDismissed] = useState(false);
	const [nextEpisodeData, setNextEpisodeData] = useState(null);
	const [seekFeedback, setSeekFeedback] = useState('');
	const isCurrentTranscoding = mediaSourceData?.__selectedPlayMethod === 'Transcode';

	useEffect(() => {
		if (typeof requestedControlsVisible === 'boolean') {
			setShowControls((prev) => (
				prev === requestedControlsVisible ? prev : requestedControlsVisible
			));
		}
	}, [requestedControlsVisible]);

	useEffect(() => {
		if (typeof onControlsVisibilityChange === 'function') {
			onControlsVisibilityChange(showControls);
		}
	}, [onControlsVisibilityChange, showControls]);

	// Build playback options to carry current selections to the next item
	const buildPlaybackOptions = useCallback(() => {
		const opts = { ...playbackSettingsRef.current };
		if (Number.isInteger(currentAudioTrack)) {
			opts.audioStreamIndex = currentAudioTrack;
		}
		if (currentSubtitleTrack === -1 || Number.isInteger(currentSubtitleTrack)) {
			opts.subtitleStreamIndex = currentSubtitleTrack;
		}
		return opts;
	}, [currentAudioTrack, currentSubtitleTrack]);

	useEffect(() => {
		currentAudioTrackRef.current = currentAudioTrack;
	}, [currentAudioTrack]);

	useEffect(() => {
		currentSubtitleTrackRef.current = currentSubtitleTrack;
	}, [currentSubtitleTrack]);

	const getPlaybackSessionContext = useCallback(() => ({
		...playbackSessionRef.current,
		audioStreamIndex: Number.isInteger(currentAudioTrackRef.current) ? currentAudioTrackRef.current : undefined,
		subtitleStreamIndex: (currentSubtitleTrackRef.current === -1 || Number.isInteger(currentSubtitleTrackRef.current))
			? currentSubtitleTrackRef.current
			: undefined
	}), []);

	// Find the next episode relative to the current one
	const getNextEpisode = useCallback(async (currentItem) => {
		if (!currentItem || currentItem.Type !== 'Episode' || !currentItem.SeriesId) return null;

		const seasonId = currentItem.SeasonId || currentItem.ParentId;
		if (!seasonId) return null;

		// Try to find next episode in the same season
		const seasonEpisodes = await jellyfinService.getEpisodes(currentItem.SeriesId, seasonId);
		const currentIndex = seasonEpisodes.findIndex(ep => ep.Id === currentItem.Id);
		if (currentIndex >= 0 && currentIndex < seasonEpisodes.length - 1) {
			return seasonEpisodes[currentIndex + 1];
		}

		// Otherwise, move to the next season and pick its first episode
		const seasons = await jellyfinService.getSeasons(currentItem.SeriesId);
		if (!seasons || seasons.length === 0) return null;

		// Sort seasons by index for predictable order
		seasons.sort((a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0));
		const currentSeasonIndex = seasons.findIndex(s => s.Id === seasonId);
		if (currentSeasonIndex >= 0 && currentSeasonIndex < seasons.length - 1) {
			const nextSeason = seasons[currentSeasonIndex + 1];
			const nextEpisodes = await jellyfinService.getEpisodes(currentItem.SeriesId, nextSeason.Id);
			return nextEpisodes?.[0] || null;
		}

		return null;
	}, []);

	const getPreviousEpisode = useCallback(async (currentItem) => {
		if (!currentItem || currentItem.Type !== 'Episode' || !currentItem.SeriesId) return null;

		const seasonId = currentItem.SeasonId || currentItem.ParentId;
		if (!seasonId) return null;

		const seasonEpisodes = await jellyfinService.getEpisodes(currentItem.SeriesId, seasonId);
		const currentIndex = seasonEpisodes.findIndex(ep => ep.Id === currentItem.Id);
		if (currentIndex > 0) {
			return seasonEpisodes[currentIndex - 1];
		}

		const seasons = await jellyfinService.getSeasons(currentItem.SeriesId);
		if (!seasons || seasons.length === 0) return null;
		seasons.sort((a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0));
		const currentSeasonIndex = seasons.findIndex(s => s.Id === seasonId);
		if (currentSeasonIndex > 0) {
			const previousSeason = seasons[currentSeasonIndex - 1];
			const previousEpisodes = await jellyfinService.getEpisodes(currentItem.SeriesId, previousSeason.Id);
			return previousEpisodes?.[previousEpisodes.length - 1] || null;
		}

		return null;
	}, []);

	// Pre-compute whether a next episode exists to control button visibility/behavior
	useEffect(() => {
		let cancelled = false;
		const checkNext = async () => {
			if (!item || item.Type !== 'Episode') {
				if (!cancelled) {
					setHasNextEpisode(false);
					setHasPreviousEpisode(false);
					setNextEpisodeData(null);
				}
				return;
			}
			try {
				const nextEp = await getNextEpisode(item);
				const prevEp = await getPreviousEpisode(item);
				if (!cancelled) {
					setHasNextEpisode(!!nextEp);
					setHasPreviousEpisode(!!prevEp);
					setNextEpisodeData(nextEp || null);
				}
			} catch (err) {
				console.error('Failed to check next episode:', err);
				if (!cancelled) {
					setHasNextEpisode(false);
					setHasPreviousEpisode(false);
					setNextEpisodeData(null);
				}
			}
		};
		checkNext();
		return () => { cancelled = true; };
	}, [getNextEpisode, getPreviousEpisode, item]);

	// Start progress reporting to Jellyfin server
	const startProgressReporting = useCallback(() => {
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current);
		}

		progressIntervalRef.current = setInterval(async () => {
			if (videoRef.current && item) {
				const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
				await jellyfinService.reportPlaybackProgress(item.Id, positionTicks, false, getPlaybackSessionContext());
			}
		}, 10000);
	}, [getPlaybackSessionContext, item]);

	const clearStartWatch = useCallback(() => {
		if (startWatchTimerRef.current) {
			clearTimeout(startWatchTimerRef.current);
			startWatchTimerRef.current = null;
		}
		if (failStartTimerRef.current) {
			clearTimeout(failStartTimerRef.current);
			failStartTimerRef.current = null;
		}
	}, []);

	const focusSkipOverlayAction = useCallback(() => {
		if (skipFocusRetryTimerRef.current) {
			clearTimeout(skipFocusRetryTimerRef.current);
			skipFocusRetryTimerRef.current = null;
		}

		let attempts = 0;
		const maxAttempts = 10;
		const tryFocus = () => {
			Spotlight.focus('skip-overlay-action');
			const target = skipButtonRef.current?.nodeRef?.current || skipButtonRef.current;
			if (target?.focus) {
				target.focus({ preventScroll: true });
			}
			const active = document.activeElement;
			const focused = !!(active && skipOverlayRef.current && skipOverlayRef.current.contains(active));
			if (!focused && attempts < maxAttempts) {
				attempts += 1;
				skipFocusRetryTimerRef.current = setTimeout(tryFocus, 40);
			} else {
				skipFocusRetryTimerRef.current = null;
			}
		};
		tryFocus();
	}, []);

	const resetRecoveryGuards = useCallback(() => {
		playbackFailureLockedRef.current = false;
		hlsNetworkRecoveryAttemptsRef.current = 0;
		hlsMediaRecoveryAttemptsRef.current = 0;
	}, []);

	const stopHlsRecoveryLoop = useCallback(() => {
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
	}, []);

	const attemptPlaybackSessionRebuild = useCallback((reason, options = {}) => {
		const {
			toast = '',
			errorData = null
		} = options;
		if (playbackFailureLockedRef.current) return false;
		if (reloadAttemptedRef.current) {
			console.warn(`[Player] ${reason}, rebuild already attempted for this load`);
			return false;
		}
		if (playSessionRebuildAttemptsRef.current >= MAX_PLAY_SESSION_REBUILD_ATTEMPTS) {
			console.warn(
				`[Player] ${reason}, rebuild limit reached (${MAX_PLAY_SESSION_REBUILD_ATTEMPTS})`
			);
			return false;
		}

		playSessionRebuildAttemptsRef.current += 1;
		reloadAttemptedRef.current = true;
		const rebuildAttempt = playSessionRebuildAttemptsRef.current;
		const seekSeconds = Math.max(0, (videoRef.current?.currentTime || 0) + seekOffsetRef.current);

		console.warn(
			`[Player] ${reason}. Rebuilding session with fresh PlaySessionId (${rebuildAttempt}/${MAX_PLAY_SESSION_REBUILD_ATTEMPTS})`,
			errorData || ''
		);

		clearStartWatch();
		if (startupFallbackTimerRef.current) {
			clearTimeout(startupFallbackTimerRef.current);
			startupFallbackTimerRef.current = null;
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
			videoRef.current.removeAttribute('src');
			videoRef.current.load();
		}

		playbackOverrideRef.current = {
			...(playbackOptions || {}),
			audioStreamIndex: Number.isInteger(currentAudioTrackRef.current) ? currentAudioTrackRef.current : undefined,
			subtitleStreamIndex:
				(currentSubtitleTrackRef.current === -1 || Number.isInteger(currentSubtitleTrackRef.current))
					? currentSubtitleTrackRef.current
					: undefined,
			seekSeconds,
			forceNewSession: true
		};

		setError(null);
		setLoading(true);
		setPlaying(false);
		if (toast) {
			setToastMessage(toast);
		}

		if (typeof loadVideoRef.current === 'function') {
			setTimeout(() => {
				if (!playbackFailureLockedRef.current) {
					loadVideoRef.current();
				}
			}, 0);
			return true;
		}
		return false;
	}, [clearStartWatch, playbackOptions, setToastMessage]);

	const showPlaybackError = useCallback((message) => {
		playbackFailureLockedRef.current = true;
		stopHlsRecoveryLoop();
		const errorMessage = message || 'Failed to play video';
		setError(errorMessage);
		setToastMessage('');
		setShowControls(true);
		setLoading(false);
		clearStartWatch();
		if (startupFallbackTimerRef.current) {
			clearTimeout(startupFallbackTimerRef.current);
			startupFallbackTimerRef.current = null;
		}
	}, [clearStartWatch, setToastMessage, stopHlsRecoveryLoop]);

	const attemptHlsFatalRecovery = useCallback((hls, errorData, source = 'HLS') => {
		if (!errorData?.fatal) return false;
		if (playbackFailureLockedRef.current) return true;

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
			if (attemptNumber <= MAX_HLS_NETWORK_RECOVERY_ATTEMPTS) {
				hlsNetworkRecoveryAttemptsRef.current = attemptNumber;
				console.warn(
					`[Player] ${source} fatal network error. Recovery ${attemptNumber}/${MAX_HLS_NETWORK_RECOVERY_ATTEMPTS}`,
					errorData
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
			if (attemptNumber <= MAX_HLS_MEDIA_RECOVERY_ATTEMPTS) {
				hlsMediaRecoveryAttemptsRef.current = attemptNumber;
				console.warn(
					`[Player] ${source} fatal media error. Recovery ${attemptNumber}/${MAX_HLS_MEDIA_RECOVERY_ATTEMPTS}`,
					errorData
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
	}, [attemptPlaybackSessionRebuild, showPlaybackError]);

	// Stop playback and clean up
	const handleStop = useCallback(async () => {
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current);
			progressIntervalRef.current = null;
		}
		if (startupFallbackTimerRef.current) {
			clearTimeout(startupFallbackTimerRef.current);
			startupFallbackTimerRef.current = null;
		}
		clearStartWatch();

		if (hlsRef.current) {
			try {
				hlsRef.current.destroy();
			} catch (err) {
				console.warn('Error destroying HLS instance:', err);
			}
			hlsRef.current = null;
		}

		if (videoRef.current && item) {
			const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
			try {
				await jellyfinService.reportPlaybackStopped(item.Id, positionTicks, getPlaybackSessionContext());
			} catch (err) {
				console.warn('Failed to report playback stopped:', err);
			}
		}

		if (videoRef.current) {
			// Clear source to ensure next load starts cleanly
			videoRef.current.removeAttribute('src');
			videoRef.current.load();
		}
		playbackSessionRef.current = {
			playSessionId: null,
			mediaSourceId: null,
			playMethod: 'DirectStream'
		};
	}, [clearStartWatch, getPlaybackSessionContext, item]);

	// Attempt to fall back to transcoding if direct playback looks unhealthy
	const attemptTranscodeFallback = useCallback(async (reason) => {
		if (playbackFailureLockedRef.current) {
			return false;
		}
		// If user already forced transcoding or we've tried already, bail
		if (playbackSettingsRef.current.strictTranscodingMode || transcodeFallbackAttemptedRef.current) {
			return false;
		}
		// Only try if the server can transcode
		if (!mediaSourceData?.SupportsTranscoding) {
			return false;
		}
		transcodeFallbackAttemptedRef.current = true;
		console.warn('[Player] Attempting transcode fallback. Reason:', reason);
		setToastMessage('Switching to transcoding...');
		await handleStop();
		setError(null);
		setLoading(true);
		// Re-run loadVideo with a forced transcode override
		if (loadVideoRef.current) {
			loadVideoRef.current(true);
		}
		return true;
	}, [handleStop, mediaSourceData, setToastMessage]);

	const isSubtitleCompatibilityError = useCallback((errorData) => {
		const fromMessage = typeof errorData === 'string' ? errorData : '';
		const responseUrl = errorData?.response?.url;
		const fragmentUrl = errorData?.frag?.url;
		const videoUrl = videoRef.current?.currentSrc || '';
		const joined = [fromMessage, responseUrl, fragmentUrl, videoUrl]
			.filter((value) => typeof value === 'string' && value.length > 0)
			.join(' ');
		return joined.includes('SubtitleCodecNotSupported');
	}, []);

	const attemptSubtitleCompatibilityFallback = useCallback(async (errorData = null) => {
		if (playbackFailureLockedRef.current) return false;
		if (subtitleCompatibilityFallbackAttemptedRef.current) return false;
		const selectedSubtitle = currentSubtitleTrackRef.current;
		if (!(Number.isInteger(selectedSubtitle) && selectedSubtitle >= 0)) return false;
		if (!isSubtitleCompatibilityError(errorData)) return false;
		if (playbackSettingsRef.current.strictTranscodingMode) {
			setToastMessage('Subtitle burn-in failed. Strict transcoding mode is enabled.');
			return false;
		}

		subtitleCompatibilityFallbackAttemptedRef.current = true;
		setToastMessage('Subtitle track is not supported by server transcoding. Retrying without subtitles.');
		playbackOverrideRef.current = {
			...(playbackOptions || {}),
			audioStreamIndex: Number.isInteger(currentAudioTrackRef.current) ? currentAudioTrackRef.current : undefined,
			subtitleStreamIndex: -1,
			seekSeconds: videoRef.current?.currentTime || 0,
			forceNewSession: true
		};
		setCurrentSubtitleTrack(-1);
		try {
			await handleStop();
		} catch (fallbackError) {
			console.warn('Failed while preparing subtitle compatibility fallback:', fallbackError);
		}
		if (typeof loadVideoRef.current === 'function') {
			loadVideoRef.current();
		}
		return true;
	}, [handleStop, isSubtitleCompatibilityError, playbackOptions, setToastMessage]);

	const attachHlsPlayback = useCallback((video, sourceUrl, sourceLabel = 'HLS.js') => {
		const hls = new Hls(HLS_PLAYER_CONFIG);
		hlsRef.current = hls;
		hls.loadSource(sourceUrl);
		hls.attachMedia(video);

		hls.on(Hls.Events.ERROR, (event, data) => {
			console.error(`${sourceLabel} error:`, data);
			if (isSubtitleCompatibilityError(data) && playbackSettingsRef.current.strictTranscodingMode) {
				showPlaybackError('Subtitle burn-in failed while strict transcoding is enabled.');
				return;
			}
			if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.details === 'fragLoadError') {
				attemptSubtitleCompatibilityFallback(data).then((handled) => {
					if (!handled) {
						attemptHlsFatalRecovery(hls, data, sourceLabel);
					}
				});
				return;
			}
			if (data.fatal) {
				attemptHlsFatalRecovery(hls, data, sourceLabel);
			}
		});

		return hls;
	}, [attemptHlsFatalRecovery, attemptSubtitleCompatibilityFallback, isSubtitleCompatibilityError, showPlaybackError]);

	// Load and play video
	const loadVideo = useCallback(async (forceTranscodeOverride = false) => {
		if (!item) return;

		// Wait for video element to be available
		if (!videoRef.current) {
			setTimeout(() => loadVideo(forceTranscodeOverride), 100);
			return;
		}

		resetRecoveryGuards();
		setLoading(true);
		reloadAttemptedRef.current = false;
		subtitleCompatibilityFallbackAttemptedRef.current = false;
		// Reset last progress marker so stall detection can work even before timeupdate
		lastProgressRef.current = {time: 0, timestamp: Date.now()};
		setError(null);
		seekOffsetRef.current = 0; // Reset seek offset for new video
		loadTrackPreferences();

		// Clean up any existing HLS instance
		if (hlsRef.current) {
			hlsRef.current.destroy();
			hlsRef.current = null;
		}

		loadVideoRef.current = loadVideo;

			try {
				// Load user settings to check for force transcoding
			const settings = readBreezyfinSettings();
			let forceTranscoding = forceTranscodeOverride || settings.forceTranscoding || false;
			let forcedBySubtitlePreference = false;
			const enableTranscoding = settings.enableTranscoding !== false;
			const maxBitrate = settings.maxBitrate;
			const autoPlayNext = settings.autoPlayNext !== false;
			const relaxedPlaybackProfile = RELAXED_PLAYBACK_PROFILE_ENABLED && settings.relaxedPlaybackProfile === true;
			const requestedSubtitleTrack =
				(playbackOverrideRef.current?.subtitleStreamIndex === -1 || Number.isInteger(playbackOverrideRef.current?.subtitleStreamIndex))
					? playbackOverrideRef.current?.subtitleStreamIndex
					: playbackOptions?.subtitleStreamIndex;

			// Check if we should force transcoding for subtitles
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

			// Get playback info from Jellyfin
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

			// Guard: if user forced transcoding but the server didn't provide a transcoding URL, bail with a clear message
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

			// Store media source and selected method for track switching and fallback checks
			setMediaSourceData({
				...mediaSource,
				__selectedPlayMethod: resolvedPlayMethod
			});

			// Set duration from media source (in ticks, 10,000,000 ticks = 1 second)
			// This is the actual duration, not from the video element which may report incorrect values during transcoding
			if (mediaSource.RunTimeTicks) {
				const totalDuration = mediaSource.RunTimeTicks / 10000000;
				setDuration(totalDuration);
			} else if (item.RunTimeTicks) {
				const totalDuration = item.RunTimeTicks / 10000000;
				setDuration(totalDuration);
			}

			// Extract audio and subtitle tracks
			const audioStreams = mediaSource.MediaStreams?.filter((s) => s.Type === 'Audio') || [];
			const subtitleStreams = mediaSource.MediaStreams?.filter((s) => s.Type === 'Subtitle') || [];

			setAudioTracks(audioStreams);
			setSubtitleTracks(subtitleStreams);

			// Set default selected tracks
			const defaultAudio = audioStreams.find((s) => s.IsDefault) || audioStreams[0];
			const defaultSubtitle = subtitleStreams.find((s) => s.IsDefault);

			// Use subtitle from playbackOptions if provided (selected from MediaDetailsPanel)
			const providedAudio = Number.isInteger(playbackOptions?.audioStreamIndex)
				? playbackOptions.audioStreamIndex
				: null;
			const providedSubtitle = Number.isInteger(playbackOptions?.subtitleStreamIndex)
				? playbackOptions.subtitleStreamIndex
				: null;

			const initialAudio = pickPreferredAudio(audioStreams, providedAudio, defaultAudio);
			const initialSubtitle = pickPreferredSubtitle(subtitleStreams, providedSubtitle, defaultSubtitle);

			// Respect explicit overrides (e.g., from track switching) if present
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

			// Determine video URL and playback method
			let videoUrl;
			let isHls = false;
			const useTranscoding = resolvedPlayMethod === 'Transcode';

			if (useTranscoding) {
				if (!mediaSource.TranscodingUrl) {
					throw new Error('Transcoding selected, but no transcoding URL was returned.');
				}
				// Server wants to transcode - use the transcoding URL
				videoUrl = `${jellyfinService.serverUrl}${mediaSource.TranscodingUrl}`;
				isHls = mediaSource.TranscodingUrl.includes('.m3u8') ||
					mediaSource.TranscodingUrl.includes('/hls/') ||
					mediaSource.TranscodingContainer?.toLowerCase() === 'ts';
			} else if (resolvedPlayMethod === 'DirectStream' && mediaSource.SupportsDirectStream) {
				// Direct stream - server remuxes without transcoding
				videoUrl = jellyfinService.getPlaybackUrl(
					item.Id,
					mediaSource.Id,
					playbackInfo.PlaySessionId,
					mediaSource.ETag,
					mediaSource.Container,
					mediaSource.LiveStreamId
				);
			} else if (resolvedPlayMethod === 'DirectPlay' && mediaSource.SupportsDirectPlay) {
				// Direct play - play file as-is
				videoUrl =
					`${jellyfinService.serverUrl}/Videos/${item.Id}/stream?static=true&mediaSourceId=${mediaSource.Id}&api_key=${jellyfinService.accessToken}`;
			} else {
				throw new Error('No supported playback method available');
			}

			// When transcoding, enforce the selected tracks and optionally force a fresh PlaySessionId
			if (useTranscoding && mediaSource.TranscodingUrl) {
				// Server wants to transcode - use the transcoding URL
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
				// Only force a fresh PlaySession when we explicitly asked to (track change/override)
				if (playbackOverrideRef.current?.forceNewSession) {
					const newSessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
					url.searchParams.set('PlaySessionId', newSessionId);
				}
				videoUrl = url.toString();
			}

			// Mark overrides to clear once playback has actually started
			pendingOverrideClearRef.current = !!playbackOverrideRef.current;

			const video = videoRef.current;
			if (!video) {
				throw new Error('Video element not available');
			}

			// If we picked a direct path, set a startup timeout to fall back to transcode if it stalls
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
				// Handle HLS playback
				// Check for native HLS support
				const nativeHls =
					video.canPlayType('application/vnd.apple.mpegURL') ||
					video.canPlayType('application/x-mpegURL');

				// Try native HLS first on webOS, fallback to HLS.js if it fails
				if (nativeHls) {
					let fallbackTriggered = false;

					const tryHlsJsFallback = () => {
						if (fallbackTriggered || !Hls.isSupported()) return;
						fallbackTriggered = true;

						video.src = '';
						video.removeAttribute('src');

						attachHlsPlayback(video, videoUrl, 'HLS.js');
					};

					// Fallback after 3 seconds if not loaded
					const fallbackTimer = setTimeout(() => {
						if (video.readyState === 0) {
							tryHlsJsFallback();
						}
					}, 3000);

					// Immediate fallback if video errors
					const errorHandler = (e) => {
						console.error('Native HLS error:', e);
						clearTimeout(fallbackTimer);
						tryHlsJsFallback();
					};
					video.addEventListener('error', errorHandler, {once: true});

					// Clear timer if video starts loading successfully
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
				// Direct MP4/WebM playback
				video.src = videoUrl;
			}

			// Load the video
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

			// Startup watchdog: if playback hasn't begun shortly after load, try to kick it
			if (startWatchTimerRef.current) {
				clearTimeout(startWatchTimerRef.current);
			}
			startWatchTimerRef.current = setTimeout(() => {
				if (!videoRef.current) return;

				// Consider it stalled if not playing OR if currentTime hasn't advanced recently
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

			// Final fallback: if still loading after 12s, surface an error with retry
			if (failStartTimerRef.current) {
				clearTimeout(failStartTimerRef.current);
			}
			failStartTimerRef.current = setTimeout(() => {
				if (playbackFailureLockedRef.current) return;
				const videoElement = videoRef.current;
				if (!videoElement) return;
				// Consider startup unresolved when we still have no useful buffered/playable data.
				if (videoElement.readyState >= 3) return;
				console.warn('[Player] Playback failed to start within timeout, showing retry');
				showPlaybackError('Playback failed to start. Please try again.');
			}, 12000);

			// Note: Position will be set in handleLoadedMetadata after metadata loads
		} catch (err) {
			console.error('Failed to load video:', err);
			showPlaybackError(getPlaybackErrorMessage(err, 'Failed to load video'));
		}
	}, [
		attachHlsPlayback,
		attemptPlaybackSessionRebuild,
		attemptTranscodeFallback,
		item,
		loadTrackPreferences,
		pickPreferredAudio,
		pickPreferredSubtitle,
		playbackOptions,
		playing,
		resetRecoveryGuards,
		setToastMessage,
		showPlaybackError
	]);

	// Video event handlers
	const handleLoadedMetadata = useCallback(() => {
		if (videoRef.current) {
			// Note: For transcoded streams, video.duration may be inaccurate (only shows buffered duration)
			// We use the duration from media source RunTimeTicks instead, set in loadVideo

			// Set start position after metadata is loaded
			const overrideSeek = playbackOverrideRef.current?.seekSeconds;
			if (typeof overrideSeek === 'number') {
				videoRef.current.currentTime = overrideSeek;
				setCurrentTime(overrideSeek);
			} else if (item.UserData?.PlaybackPositionTicks) {
				const startPosition = item.UserData.PlaybackPositionTicks / 10000000;
				videoRef.current.currentTime = startPosition;
				setCurrentTime(startPosition);
			}
		}
	}, [item]);

	const handleLoadedData = useCallback(async () => {
		// If we got data but loading is still true, try to kick off playback
		if (loading && videoRef.current) {
			setLoading(false);
			try {
				await videoRef.current.play();
			} catch (playError) {
				// Ignore non-fatal autoplay interruptions; surface unsupported formats immediately.
				if (isFatalPlaybackError(playError)) {
					showPlaybackError(getPlaybackErrorMessage(playError));
				}
			}
		}
	}, [loading, showPlaybackError]);

	const handleCanPlay = useCallback(async () => {
		if (!videoRef.current || !loading) return;

		setLoading(false);

		try {
			await videoRef.current.play();
			setPlaying(true);
			if (pendingOverrideClearRef.current) {
				playbackOverrideRef.current = null;
				pendingOverrideClearRef.current = false;
			}
			clearStartWatch();
			if (startupFallbackTimerRef.current) {
				clearTimeout(startupFallbackTimerRef.current);
				startupFallbackTimerRef.current = null;
			}

			// Report to Jellyfin
			const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
			await jellyfinService.reportPlaybackStart(item.Id, positionTicks, getPlaybackSessionContext());
			startProgressReporting();
		} catch (playError) {
			console.error('Auto-play failed:', playError);
			const errorMessage = getPlaybackErrorMessage(playError, 'Playback failed to start');
			setPlaying(false);

			// If direct playback fails immediately, try a one-time transcode fallback
			if (!isCurrentTranscoding && isFatalPlaybackError(playError)) {
				const didFallback = await attemptTranscodeFallback(errorMessage);
				if (didFallback) {
					return;
				}
			}
			if (isFatalPlaybackError(playError)) {
				showPlaybackError(errorMessage);
			} else {
				setToastMessage('Playback failed to start. Press Play/Retry.');
			}
		}
	}, [attemptTranscodeFallback, clearStartWatch, getPlaybackSessionContext, isCurrentTranscoding, loading, item, setToastMessage, showPlaybackError, startProgressReporting]);

	// Detect skip intro/credits segments based on current playback position
	const checkSkipSegments = useCallback((positionSeconds) => {
		if (!Number.isFinite(positionSeconds)) return;
			let skipSegmentPromptsEnabled = true;
			let playNextPromptEnabled = true;
			let playNextPromptMode = 'segmentsOrLast60';

			// Optional opt-out for intro/recap/preview skip prompts.
			try {
				const settings = readBreezyfinSettings();
				skipSegmentPromptsEnabled = settings.skipIntro !== false;
				playNextPromptEnabled = settings.showPlayNextPrompt !== false;
				if (settings.playNextPromptMode === 'segmentsOnly' || settings.playNextPromptMode === 'segmentsOrLast60') {
					playNextPromptMode = settings.playNextPromptMode;
				}
			} catch (_) {
				// ignore parse issues
			}

		const positionTicks = positionSeconds * 10000000;
		const activeSegment = mediaSegments.find(
			(segment) => positionTicks >= segment.StartTicks && positionTicks < segment.EndTicks
		);

		if (activeSegment) {
			const isOutro = activeSegment.Type === 'Outro' || activeSegment.Type === 'Credits';
			if (!isOutro && dismissedSkipSegmentId === activeSegment.Id) {
				setSkipOverlayVisible(false);
				setCurrentSkipSegment(activeSegment);
				return;
			}
			if (!isOutro && !skipSegmentPromptsEnabled) {
				setSkipOverlayVisible(false);
				setCurrentSkipSegment(null);
				setSkipCountdown(null);
				return;
			}
			if (!currentSkipSegment || currentSkipSegment.Id !== activeSegment.Id) {
				setCurrentSkipSegment(activeSegment);
			}
			setSkipOverlayVisible(true);
			if (isOutro && nextEpisodeData && playNextPromptEnabled) {
				setShowNextEpisodePrompt(true);
				nextEpisodePromptStartTicksRef.current = activeSegment.StartTicks;
			} else {
				setShowNextEpisodePrompt(false);
				nextEpisodePromptStartTicksRef.current = null;
			}
			const remainingSeconds = Math.max(0, (activeSegment.EndTicks / 10000000) - positionSeconds);
			setSkipCountdown(Math.ceil(remainingSeconds));
		} else if (
			playNextPromptEnabled &&
			playNextPromptMode === 'segmentsOrLast60' &&
			!nextEpisodePromptDismissed &&
			nextEpisodeData &&
			Number.isFinite(duration) &&
			duration > 0
		) {
			const remainingSeconds = Math.max(0, duration - positionSeconds);
			if (remainingSeconds > 0 && remainingSeconds <= 60) {
				setSkipOverlayVisible(true);
				setShowNextEpisodePrompt(true);
				setCurrentSkipSegment(null);
				setSkipCountdown(Math.ceil(remainingSeconds));
			} else if (showNextEpisodePrompt) {
				setShowNextEpisodePrompt(false);
				setSkipOverlayVisible(false);
				setCurrentSkipSegment(null);
				setSkipCountdown(null);
			}
		} else if (showNextEpisodePrompt) {
			const promptStartTicks = nextEpisodePromptStartTicksRef.current || 0;
			// If user rewinds before outro/credits start, hide the sticky Next Episode prompt.
			if (positionTicks < promptStartTicks) {
				setShowNextEpisodePrompt(false);
				setSkipOverlayVisible(false);
				setCurrentSkipSegment(null);
				setSkipCountdown(null);
				nextEpisodePromptStartTicksRef.current = null;
			} else {
				if (!playNextPromptEnabled || (playNextPromptMode === 'segmentsOnly' && !currentSkipSegment)) {
					setShowNextEpisodePrompt(false);
					setSkipOverlayVisible(false);
					setCurrentSkipSegment(null);
					setSkipCountdown(null);
					nextEpisodePromptStartTicksRef.current = null;
					return;
				}
				setSkipOverlayVisible(true);
				setSkipCountdown(null);
			}
		} else if (skipOverlayVisible) {
			setSkipOverlayVisible(false);
			setCurrentSkipSegment(null);
			setSkipCountdown(null);
			setDismissedSkipSegmentId(null);
		}
	}, [currentSkipSegment, dismissedSkipSegmentId, duration, mediaSegments, nextEpisodeData, nextEpisodePromptDismissed, showNextEpisodePrompt, skipOverlayVisible]);

	const handleTimeUpdate = useCallback(() => {
		if (videoRef.current) {
			// Add seek offset to get actual position (for transcoded streams that restart from 0)
			const actualTime = videoRef.current.currentTime + seekOffsetRef.current;
			setCurrentTime(actualTime);
			checkSkipSegments(actualTime);
			lastProgressRef.current = { time: actualTime, timestamp: Date.now() };
		}
	}, [checkSkipSegments]);

	const handleVideoError = useCallback(async (e) => {
		if (playbackFailureLockedRef.current) return;
		const video = videoRef.current;
		const mediaError = video?.error;

		console.error('=== Video Error ===');
		console.error('Event:', e);
		console.error('Video src:', video?.src);
		console.error('Network state:', video?.networkState);
		console.error('Ready state:', video?.readyState);

		let errorMessage = 'Failed to play video';
		if (mediaError) {
			const errorMessages = {
				1: 'Playback aborted',
				2: 'Network error',
				3: 'Decode error',
				4: 'Format not supported'
			};
			errorMessage = errorMessages[mediaError.code] || `Error code: ${mediaError.code}`;
			console.error('MediaError code:', mediaError.code, '-', errorMessage);
		}
		if (isSubtitleCompatibilityError(errorMessage) && playbackSettingsRef.current.strictTranscodingMode) {
			showPlaybackError('Subtitle burn-in failed while strict transcoding is enabled.');
			return;
		}

		const subtitleFallbackWorked = await attemptSubtitleCompatibilityFallback(errorMessage);
		if (subtitleFallbackWorked) {
			return;
		}

		// Try falling back to transcoding once if we were on a direct path
		if (!isCurrentTranscoding) {
			const didFallback = await attemptTranscodeFallback(errorMessage);
			if (didFallback) {
				return;
			}
		}

		// Clean up the playback session on error
		try {
			await handleStop();
		} catch (stopErr) {
			console.warn('Error while handling playback failure:', stopErr);
		}
		showPlaybackError(errorMessage);
	}, [attemptSubtitleCompatibilityFallback, attemptTranscodeFallback, handleStop, isCurrentTranscoding, isSubtitleCompatibilityError, showPlaybackError]);

	const handleEnded = useCallback(async () => {
		await handleStop();

		// Auto-play next episode if enabled
		if (playbackSettingsRef.current.autoPlayNext && item?.Type === 'Episode' && onPlay) {
			try {
				const nextEpisode = hasNextEpisode ? await getNextEpisode(item) : null;
				if (nextEpisode) {
					onPlay(nextEpisode, buildPlaybackOptions());
					return;
				}
			} catch (err) {
				console.error('Failed to auto-play next episode:', err);
			}
		}

		onBack();
	}, [buildPlaybackOptions, getNextEpisode, handleStop, hasNextEpisode, item, onBack, onPlay]);

	// Playback controls
	const handlePlay = useCallback(async ({keepHidden = false} = {}) => {
		if (videoRef.current) {
			try {
				const resumeFromPaused = videoRef.current.currentTime > 0;
				await videoRef.current.play();
				setPlaying(true);
				setShowControls(keepHidden ? false : !resumeFromPaused);

				const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
				await jellyfinService.reportPlaybackStart(item.Id, positionTicks, getPlaybackSessionContext());
				startProgressReporting();
			} catch (err) {
				console.error('Play failed:', err);
				const errorMessage = getPlaybackErrorMessage(err);
				if (isFatalPlaybackError(err)) {
					showPlaybackError(errorMessage);
				} else {
					setToastMessage(errorMessage);
				}
			}
		}
	}, [getPlaybackSessionContext, item, setToastMessage, showPlaybackError, startProgressReporting]);

	const handlePause = useCallback(async ({keepHidden = false} = {}) => {
		if (videoRef.current) {
			videoRef.current.pause();
			setPlaying(false);
			setShowControls(!keepHidden);

			const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
			await jellyfinService.reportPlaybackProgress(item.Id, positionTicks, true, getPlaybackSessionContext());
		}
	}, [getPlaybackSessionContext, item]);

	const handleRetryPlayback = useCallback(async () => {
		setError(null);
		setToastMessage('');
		resetRecoveryGuards();
		playSessionRebuildAttemptsRef.current = 0;
		transcodeFallbackAttemptedRef.current = false;
		reloadAttemptedRef.current = false;
		subtitleCompatibilityFallbackAttemptedRef.current = false;
		await handleStop();
		loadVideo();
	}, [handleStop, loadVideo, resetRecoveryGuards, setToastMessage]);

	const handleSeek = useCallback(async (e) => {
		const seekTime = e.value;
		setCurrentTime(seekTime);
		checkSkipSegments(seekTime);

		if (!videoRef.current) return;

		lastInteractionRef.current = Date.now();
		// For HLS streams (native or HLS.js), let the player handle seeking
		const isHls = isCurrentTranscoding && (
			mediaSourceData?.TranscodingUrl?.includes('.m3u8') ||
			mediaSourceData?.TranscodingUrl?.includes('/hls/')
		);

		if (isHls) {
			// HLS supports native seeking via currentTime
			videoRef.current.currentTime = seekTime;

			// Report seek to Jellyfin
			const seekTicks = Math.floor(seekTime * 10000000);
			await jellyfinService.reportPlaybackProgress(item.Id, seekTicks, videoRef.current.paused, getPlaybackSessionContext());
		} else if (isCurrentTranscoding) {
			// For transcoding, rebuild the session at the target timestamp.
			try {
				const seekTicks = Math.floor(seekTime * 10000000);
				setLoading(true);
				playbackOverrideRef.current = {
					...(playbackOptions || {}),
					audioStreamIndex: Number.isInteger(currentAudioTrack) ? currentAudioTrack : undefined,
					subtitleStreamIndex: currentSubtitleTrack >= 0 ? currentSubtitleTrack : undefined,
					startTimeTicks: seekTicks,
					seekSeconds: seekTime,
					forceNewSession: true
				};
				await handleStop();
				loadVideo();
			} catch (err) {
				console.error('Failed to seek:', err);
				setLoading(false);
			}
		} else {
			// For direct play/stream, we can seek directly
			videoRef.current.currentTime = seekTime;
		}
	}, [checkSkipSegments, currentAudioTrack, currentSubtitleTrack, getPlaybackSessionContext, handleStop, isCurrentTranscoding, item, loadVideo, mediaSourceData, playbackOptions]);

	const handleVolumeChange = useCallback((e) => {
		lastInteractionRef.current = Date.now();
		if (videoRef.current) {
			const newVolume = e.value;
			videoRef.current.volume = newVolume / 100;
			setVolume(newVolume);
			if (newVolume > 0) setMuted(false);
		}
	}, []);

	const toggleMute = useCallback(() => {
		lastInteractionRef.current = Date.now();
		if (videoRef.current) {
			const newMuted = !muted;
			videoRef.current.muted = newMuted;
			setMuted(newMuted);
		}
	}, [muted]);

	// Reload playback with explicit track selections, keeping position
	const reloadWithTrackSelection = useCallback(async (audioIndex, subtitleIndex) => {
		if (!videoRef.current) return;
		const currentPosition = videoRef.current.currentTime || 0;
		playbackOverrideRef.current = {
			...(playbackOptions || {}),
			audioStreamIndex: Number.isInteger(audioIndex) ? audioIndex : undefined,
			subtitleStreamIndex: (subtitleIndex === -1 || Number.isInteger(subtitleIndex)) ? subtitleIndex : undefined,
			seekSeconds: currentPosition,
			forceNewSession: true
		};
		setLoading(true);
		// Stop current playback cleanly so the next request starts fresh (important for HLS/transcode)
		await handleStop();
		loadVideo();
	}, [handleStop, loadVideo, playbackOptions]);

	// Change audio track - requires reloading with new parameters
	const handleAudioTrackChange = useCallback(async (trackIndex) => {
		setCurrentAudioTrack(trackIndex);
		closeDisclosure(PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS);
		saveAudioSelection(trackIndex, audioTracks);

		// For HLS streams using HLS.js, use native audio track switching
		if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks.length > 0) {
			// HLS.js audio tracks are 0-based, find matching track by stream index
			const hlsTrackIndex = hlsRef.current.audioTracks.findIndex(t => {
				// Try to match by language or other properties
				const mediaTrack = audioTracks.find(at => at.Index === trackIndex);
				return t.lang === mediaTrack?.Language || t.name === mediaTrack?.Title;
			});
			if (hlsTrackIndex >= 0) {
				hlsRef.current.audioTrack = hlsTrackIndex;
				return;
			}
		}
		// Fallback: reload playback with the chosen track
		reloadWithTrackSelection(trackIndex, currentSubtitleTrack);
	}, [audioTracks, closeDisclosure, currentSubtitleTrack, reloadWithTrackSelection, saveAudioSelection]);

	// Change subtitle track
	const handleSubtitleTrackChange = useCallback(async (trackIndex) => {
		setCurrentSubtitleTrack(trackIndex);
		closeDisclosure(PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS);
		saveSubtitleSelection(trackIndex, subtitleTracks);

		// For HLS streams, subtitle switching via source reload doesn't work well
		// External subtitles would need to be handled separately
		// For now, skip subtitle switching on HLS to avoid breaking playback
		if (hlsRef.current) {
			if (typeof hlsRef.current.subtitleTrack === 'number' && hlsRef.current.subtitleTracks) {
				const hlsTrackIndex = hlsRef.current.subtitleTracks.findIndex(t => {
					const mediaTrack = subtitleTracks.find(st => st.Index === trackIndex);
					return mediaTrack && (t.lang === mediaTrack.Language || t.name === mediaTrack.Title);
				});
				if (hlsTrackIndex >= 0) {
					hlsRef.current.subtitleTrack = hlsTrackIndex;
					return;
				}
			}
			setToastMessage('Subtitle change may require retry/reload on this stream');
		}

		// Fallback: reload playback with the selected subtitle track
		reloadWithTrackSelection(currentAudioTrack, trackIndex);
	}, [closeDisclosure, currentAudioTrack, reloadWithTrackSelection, saveSubtitleSelection, setToastMessage, subtitleTracks]);

	const getTrackLabel = (track) => {
		const parts = [];
		if (track.Title) parts.push(track.Title);
		if (track.Language) parts.push(track.Language.toUpperCase());
		if (track.Codec) parts.push(track.Codec.toUpperCase());
		if (track.Channels) parts.push(`${track.Channels}ch`);
		return parts.join(' - ') || `Track ${track.Index}`;
	};

	// Manually trigger next episode from the player controls
	const handlePlayNextEpisode = useCallback(async () => {
		if (!item || item.Type !== 'Episode' || !onPlay || !hasNextEpisode) return;
		try {
			const nextEpisode = nextEpisodeData || await getNextEpisode(item);
			if (nextEpisode) {
				const opts = buildPlaybackOptions();
				playbackOverrideRef.current = { ...opts, forceNewSession: true };
				await handleStop();
				onPlay(nextEpisode, opts);
			}
		} catch (err) {
			console.error('Failed to play next episode:', err);
		}
	}, [buildPlaybackOptions, getNextEpisode, handleStop, hasNextEpisode, item, nextEpisodeData, onPlay]);

	const handlePlayPreviousEpisode = useCallback(async () => {
		if (!item || item.Type !== 'Episode' || !onPlay || !hasPreviousEpisode) return;
		try {
			const prevEpisode = await getPreviousEpisode(item);
			if (prevEpisode) {
				const opts = buildPlaybackOptions();
				playbackOverrideRef.current = { ...opts, forceNewSession: true };
				await handleStop();
				onPlay(prevEpisode, opts);
			}
		} catch (err) {
			console.error('Failed to play previous episode:', err);
		}
	}, [buildPlaybackOptions, getPreviousEpisode, handleStop, hasPreviousEpisode, item, onPlay]);

	const handleBackButton = useCallback(async () => {
		await handleStop();
		onBack();
	}, [handleStop, onBack]);

	const handleVideoSurfaceClick = useCallback(() => {
		if (loading || error || showAudioPopup || showSubtitlePopup) return;
		lastInteractionRef.current = Date.now();
		const keepHidden = !showControls;
		if (playing) {
			handlePause({keepHidden});
		} else {
			handlePlay({keepHidden});
		}
	}, [error, handlePause, handlePlay, loading, playing, showAudioPopup, showControls, showSubtitlePopup]);

	// Only allow seek shortcuts when focus isn't on another UI element
	const isSeekContext = useCallback((target) => {
		if (!target) return true;
		if (target === videoRef.current || target === document.body || target === document.documentElement) return true;
		if (target.closest && target.closest('[data-seekable="true"]')) return true;
		return false;
	}, []);

	const seekBySeconds = useCallback((deltaSeconds) => {
		const video = videoRef.current;
		if (!video || !Number.isFinite(deltaSeconds)) return;
		const nextTime = Math.min(Math.max(0, video.currentTime + deltaSeconds), duration || video.duration || 0);
		video.currentTime = nextTime;
		const actualTime = nextTime + seekOffsetRef.current;
		setCurrentTime(actualTime);
		checkSkipSegments(actualTime);
		setSeekFeedback(`${deltaSeconds > 0 ? '+' : '-'}${Math.abs(deltaSeconds)}s`);
		if (seekFeedbackTimerRef.current) {
			clearTimeout(seekFeedbackTimerRef.current);
		}
		seekFeedbackTimerRef.current = setTimeout(() => {
			setSeekFeedback('');
			seekFeedbackTimerRef.current = null;
		}, 900);
	}, [checkSkipSegments, duration]);

	// Format time for display
	const formatTime = (seconds) => {
		if (!isFinite(seconds) || seconds < 0) return '0:00';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);

		if (h > 0) {
			return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		}
		return `${m}:${s.toString().padStart(2, '0')}`;
	};

	const getSkipButtonLabel = (segmentType) => {
		switch (segmentType) {
			case 'Intro':
				return 'Skip Intro';
			case 'Recap':
				return 'Skip Recap';
			case 'Preview':
				return 'Skip Preview';
			case 'Outro':
			case 'Credits':
				return nextEpisodeData ? 'Next Episode' : 'Skip Credits';
			default:
				return 'Skip';
		}
	};

	const errorBackdropUrl = (() => {
		if (!item) return '';
		if (item?.BackdropImageTags?.length > 0) {
			return jellyfinService.getBackdropUrl(item.Id, 0, 1920);
		}
		if (item?.SeriesId) {
			return jellyfinService.getBackdropUrl(item.SeriesId, 0, 1920);
		}
		if (item?.ImageTags?.Primary) {
			return jellyfinService.getImageUrl(item.Id, 'Primary', 1920);
		}
		return '';
	})();
	const hasErrorBackdrop = Boolean(errorBackdropUrl);

	const handleSkipSegment = useCallback(() => {
		if (showNextEpisodePrompt && nextEpisodeData) {
			handlePlayNextEpisode();
			return;
		}
		if (!currentSkipSegment) return;
		const isOutro = currentSkipSegment.Type === 'Outro' || currentSkipSegment.Type === 'Credits';
		if (isOutro && nextEpisodeData) {
			handlePlayNextEpisode();
			return;
		}
		const skipTo = currentSkipSegment.EndTicks / 10000000;
		if (videoRef.current) {
			videoRef.current.currentTime = skipTo;
			setCurrentTime(skipTo);
		}
		setDismissedSkipSegmentId(currentSkipSegment.Id || null);
		setSkipOverlayVisible(false);
		setCurrentSkipSegment(null);
		setSkipCountdown(null);
		setShowNextEpisodePrompt(false);
		setNextEpisodePromptDismissed(false);
		nextEpisodePromptStartTicksRef.current = null;
	}, [currentSkipSegment, handlePlayNextEpisode, nextEpisodeData, showNextEpisodePrompt]);

	const handleVideoPlaying = useCallback(() => {
		setPlaying(true);
	}, []);

	const handleVideoPause = useCallback(() => {
		setPlaying(false);
	}, []);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	const openAudioPopup = useCallback(() => {
		openDisclosure(PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS);
	}, [openDisclosure]);

	const closeAudioPopup = useCallback(() => {
		closeDisclosure(PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS);
	}, [closeDisclosure]);

	const openSubtitlePopup = useCallback(() => {
		openDisclosure(PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS);
	}, [openDisclosure]);

	const closeSubtitlePopup = useCallback(() => {
		closeDisclosure(PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS);
	}, [closeDisclosure]);

	const handleProgressSliderKeyDown = useCallback((e) => {
		const SEEK_STEP = 15;
		if (e.keyCode === KeyCodes.LEFT) {
			e.preventDefault();
			seekBySeconds(-SEEK_STEP);
		} else if (e.keyCode === KeyCodes.RIGHT) {
			e.preventDefault();
			seekBySeconds(SEEK_STEP);
		}
		lastInteractionRef.current = Date.now();
	}, [seekBySeconds]);

	const handleAudioTrackItemClick = useCallback((event) => {
		const trackIndex = Number(event.currentTarget.dataset.trackIndex);
		if (!Number.isFinite(trackIndex)) return;
		handleAudioTrackChange(trackIndex);
	}, [handleAudioTrackChange]);

	const handleSubtitleTrackItemClick = useCallback((event) => {
		const trackIndex = Number(event.currentTarget.dataset.trackIndex);
		if (!Number.isFinite(trackIndex)) return;
		handleSubtitleTrackChange(trackIndex);
	}, [handleSubtitleTrackChange]);

	const handleDismissNextEpisodePrompt = useCallback(() => {
		setShowNextEpisodePrompt(false);
		setSkipOverlayVisible(false);
		setCurrentSkipSegment(null);
		setSkipCountdown(null);
		setNextEpisodePromptDismissed(true);
		nextEpisodePromptStartTicksRef.current = null;
	}, []);

	const handleDismissSkipOverlay = useCallback(() => {
		if (showNextEpisodePrompt) {
			handleDismissNextEpisodePrompt();
			return;
		}
		setDismissedSkipSegmentId(currentSkipSegment?.Id || null);
		setSkipOverlayVisible(false);
		setSkipCountdown(null);
	}, [currentSkipSegment?.Id, handleDismissNextEpisodePrompt, showNextEpisodePrompt]);

	const handleInternalBack = useCallback(() => {
		// Close secondary UI first before leaving the player.
		if (showAudioPopup) {
			closeDisclosure(PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS);
			return true;
		}
		if (showSubtitlePopup) {
			closeDisclosure(PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS);
			return true;
		}
		if (skipOverlayVisible) {
			handleDismissSkipOverlay();
			return true;
		}
		// Back hides controls first; only exits when already hidden.
		if (showControls) {
			setShowControls(false);
			return true;
		}
		return false;
	}, [closeDisclosure, handleDismissSkipOverlay, showAudioPopup, showControls, showSubtitlePopup, skipOverlayVisible]);

	// Effects
	useEffect(() => {
		if (item) {
			resetRecoveryGuards();
			playSessionRebuildAttemptsRef.current = 0;
			transcodeFallbackAttemptedRef.current = false;
			reloadAttemptedRef.current = false;
			setSkipOverlayVisible(false);
			setCurrentSkipSegment(null);
			setSkipCountdown(null);
			setDismissedSkipSegmentId(null);
			setShowNextEpisodePrompt(false);
			setNextEpisodePromptDismissed(false);
			nextEpisodePromptStartTicksRef.current = null;
			loadVideo();
			// Prefetch skip segments for intro/credits
			jellyfinService.getMediaSegments(item.Id).then(setMediaSegments).catch(() => setMediaSegments([]));
		}
		return () => {
			handleStop();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [item]);

	useEffect(() => {
		let hideTimer;
		// Only auto-hide when video is playing and no modal is open
		if (showControls && playing && !showAudioPopup && !showSubtitlePopup) {
			hideTimer = setInterval(() => {
				const inactiveFor = Date.now() - lastInteractionRef.current;
				if (inactiveFor > 5000) {
					setShowControls(false);
				}
			}, 1000);
		}
		return () => clearInterval(hideTimer);
	}, [showControls, playing, showAudioPopup, showSubtitlePopup]);

	// Playback health watchdog: if direct playback stalls, try transcode fallback
	useEffect(() => {
		if (!mediaSourceData || isCurrentTranscoding) return undefined;
		const interval = setInterval(() => {
			const now = Date.now();
			const last = lastProgressRef.current;
			// If we haven't moved at least 0.5s in 12s of playback, consider it stalled
			if (playing && now - last.timestamp > 12000) {
				if (videoRef.current && Math.abs(videoRef.current.currentTime - last.time) < 0.5) {
					console.warn('[Player] Playback stall detected, attempting transcode fallback');
					attemptTranscodeFallback('Playback stalled');
				}
			}
		}, 5000);
		return () => clearInterval(interval);
	}, [attemptTranscodeFallback, isCurrentTranscoding, mediaSourceData, playing]);

	useEffect(() => () => {
		if (skipFocusRetryTimerRef.current) {
			clearTimeout(skipFocusRetryTimerRef.current);
			skipFocusRetryTimerRef.current = null;
		}
	}, []);

	useEffect(() => () => {
		if (seekFeedbackTimerRef.current) {
			clearTimeout(seekFeedbackTimerRef.current);
			seekFeedbackTimerRef.current = null;
		}
	}, []);

	usePanelBackHandler(registerBackHandler, handleInternalBack, {enabled: isActive});

	// Auto-focus skip when it appears; otherwise, focus play/pause after pausing.
	useEffect(() => {
		let focusTimer = null;
		const becameVisible = skipOverlayVisible && !wasSkipOverlayVisibleRef.current;
		wasSkipOverlayVisibleRef.current = skipOverlayVisible;

		if (becameVisible) {
			focusTimer = setTimeout(() => {
				focusSkipOverlayAction();
			}, 20);
		} else if (!playing && showControls && playPauseButtonRef.current) {
			const target = playPauseButtonRef.current.nodeRef?.current || playPauseButtonRef.current;
			if (target?.focus) {
				focusTimer = setTimeout(() => target.focus({ preventScroll: true }), 0);
			}
		}

		return () => {
			if (focusTimer !== null) {
				clearTimeout(focusTimer);
			}
		};
	}, [focusSkipOverlayAction, playing, showControls, skipOverlayVisible]);

	// Handle remote/keyboard controls for play/pause, seek, back, and control visibility
	useEffect(() => {
		if (!isActive) return undefined;

		const handleKeyDown = (e) => {
			lastInteractionRef.current = Date.now();
			const code = e.keyCode || e.which;
			const BACK_KEYS = [KeyCodes.BACK, KeyCodes.BACK_SOFT, KeyCodes.EXIT, KeyCodes.BACKSPACE, KeyCodes.ESC];
			const SEEK_STEP = 15; // seconds
			const PLAY_KEYS = [KeyCodes.ENTER, KeyCodes.OK, KeyCodes.SPACE, 179]; // enter/OK, space, media play/pause
			const PLAY_ONLY_KEYS = [KeyCodes.PLAY];
			const PAUSE_KEYS = [KeyCodes.PAUSE];

			// Only bring up controls on up/down when hidden
			if ([KeyCodes.UP, KeyCodes.DOWN].includes(code) && !showControls) {
				e.preventDefault();
				setShowControls(true);
			}

			switch (code) {
				case KeyCodes.LEFT:
					if (showControls || skipOverlayVisible || showAudioPopup || showSubtitlePopup || !isSeekContext(e.target)) break;
					e.preventDefault();
					seekBySeconds(-SEEK_STEP);
					break;
				case KeyCodes.RIGHT:
					if (showControls || skipOverlayVisible || showAudioPopup || showSubtitlePopup || !isSeekContext(e.target)) break;
					e.preventDefault();
					seekBySeconds(SEEK_STEP);
					break;
				case KeyCodes.UP:
					e.preventDefault();
					if (skipOverlayVisible) {
						setShowControls(true);
						focusSkipOverlayAction();
						return;
					}
					setShowControls(true);
					break;
				case KeyCodes.DOWN:
					e.preventDefault();
					setShowControls(true);
					break;
				default:
					break;
			}

			if (BACK_KEYS.includes(code)) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation?.();
				if (handleInternalBack()) return;
				handleBackButton();
				return;
			}

			if (PLAY_KEYS.includes(code)) {
				// Avoid double-trigger when an actual button is focused
				const activeEl = document.activeElement;
				const isControlFocused = controlsRef.current && activeEl && controlsRef.current.contains(activeEl);
				const isSkipFocused = skipOverlayRef.current && activeEl && skipOverlayRef.current.contains(activeEl);
				if (isControlFocused || isSkipFocused) {
					return;
				}
				e.preventDefault();
				const keepHidden = !showControls;
				if (playing) {
					handlePause({keepHidden});
				} else {
					handlePlay({keepHidden});
				}
				return;
			}

			if (PLAY_ONLY_KEYS.includes(code)) {
				e.preventDefault();
				handlePlay({keepHidden: !showControls});
				return;
			}

			if (PAUSE_KEYS.includes(code)) {
				e.preventDefault();
				handlePause({keepHidden: !showControls});
			}
		};

		document.addEventListener('keydown', handleKeyDown, true);
		return () => document.removeEventListener('keydown', handleKeyDown, true);
	}, [focusSkipOverlayAction, handleBackButton, handleInternalBack, handlePause, handlePlay, isActive, isSeekContext, playing, seekBySeconds, showAudioPopup, showControls, showSubtitlePopup, skipOverlayVisible]);

	return (
		<Panel {...rest} noCloseButton>
				<div className={css.playerContainer}>
					<video
						ref={videoRef}
						className={`${css.video} ${error ? css.videoHidden : ''}`}
						onLoadedData={handleLoadedData}
						onLoadedMetadata={handleLoadedMetadata}
						onCanPlay={handleCanPlay}
						onTimeUpdate={handleTimeUpdate}
						onEnded={handleEnded}
						onError={handleVideoError}
						onPlaying={handleVideoPlaying}
						onPause={handleVideoPause}
						onClick={handleVideoSurfaceClick}
						autoPlay
					playsInline
					preload="auto"
				/>
				{error && (
					<div className={`${css.errorBackdrop} ${hasErrorBackdrop ? '' : css.errorBackdropFallback}`}>
						{hasErrorBackdrop && <img src={errorBackdropUrl} alt={item?.Name || 'Playback error'} />}
						<div className={css.errorBackdropGradient} />
					</div>
				)}

				{loading && (
					<div className={css.loading}>
						<svg className={css.loadingDefs} aria-hidden="true" focusable="false">
							<filter id="glass-distortion-player-loading">
								<feTurbulence type="turbulence" baseFrequency="0.008" numOctaves="2" result="noise" />
								<feDisplacementMap in="SourceGraphic" in2="noise" scale="77" />
							</filter>
						</svg>
						<div className={css.loadingGlassSpinner}>
							<div className={css.loadingGlassFilter} />
							<div className={css.loadingGlassOverlay} />
							<div className={css.loadingGlassSpecular} />
							<div className={css.loadingGlassContent}>
								<div className={css.loadingSpinnerRing} />
								<div className={css.loadingSpinnerCore} />
							</div>
						</div>
						<BodyText className={css.loadingText}>Loading...</BodyText>
					</div>
				)}

				{seekFeedback && (
					<div className={css.seekFeedback}>
						<BodyText className={css.seekFeedbackText}>{seekFeedback}</BodyText>
					</div>
				)}

					<Popup
						open={!!error}
						onClose={clearError}
						noAutoDismiss
						css={{popup: popupStyles.popupShell, body: css.errorPopupBody}}
				>
					<div
						className={`${popupStyles.popupSurface} ${css.errorPopupContent}`}
					>
						<BodyText className={css.popupTitle}>Playback Error</BodyText>
						<BodyText className={css.errorMessage}>{error}</BodyText>
						<div className={css.errorActions}>
							<Button onClick={handleRetryPlayback} autoFocus className={css.errorActionButton}>
								Retry
							</Button>
							<Button onClick={handleBackButton} className={css.errorActionButton}>
								Go Back
							</Button>
						</div>
					</div>
				</Popup>

				{skipOverlayVisible && (currentSkipSegment || showNextEpisodePrompt) && (
					<div className={css.skipOverlay} ref={skipOverlayRef}>
						<div className={`${css.skipPill} ${css.skipPillCompact}`}>
							<Button
								size="small"
								onClick={handleSkipSegment}
								className={css.skipButton}
								componentRef={skipButtonRef}
								spotlightId="skip-overlay-action"
								autoFocus
							>
								{showNextEpisodePrompt ? 'Play Next' : getSkipButtonLabel(currentSkipSegment.Type)}
							</Button>
							{skipCountdown !== null && (
								<BodyText className={css.skipCountdownCompact}>{skipCountdown}s</BodyText>
							)}
							<Button
								size="small"
								icon="closex"
								onClick={handleDismissSkipOverlay}
								className={css.skipCloseButton}
							/>
						</div>
					</div>
				)}

				{toastMessage && !error && (
					<div className={css.playerToast}>{toastMessage}</div>
				)}

				{showControls && !loading && !error && (
					<div className={css.controls} ref={controlsRef}>
						<div className={css.topBar}>
							<Button
								onClick={handleBackButton}
								size="large"
								icon="arrowlargeleft"
								className={css.playerBackButton}
							/>
							<BodyText className={css.title}>{item?.Name}</BodyText>
						</div>

						<div className={css.bottomBar}>
							<div className={css.progressContainer} data-seekable="true">
								<BodyText className={css.time}>
									{formatTime(currentTime)}
								</BodyText>
									<Slider
										className={css.progressSlider}
										min={0}
										max={Math.floor(duration) || 1}
										step={1}
										value={Math.floor(currentTime)}
										onChange={handleSeek}
										data-seekable="true"
										onKeyDown={handleProgressSliderKeyDown}
									/>
								<BodyText className={css.time}>
									-{formatTime(Math.max(0, duration - currentTime))}
								</BodyText>
							</div>

							<div className={css.controlButtons}>
								{item?.Type === 'Episode' && (
									<Button
										onClick={handlePlayPreviousEpisode}
										size="large"
										icon="jumpbackward"
										disabled={!hasPreviousEpisode}
									/>
								)}

								{playing ? (
									<Button onClick={handlePause} size="large" icon="pause" componentRef={playPauseButtonRef} />
								) : (
									<Button onClick={handlePlay} size="large" icon="play" componentRef={playPauseButtonRef} />
								)}

								{item?.Type === 'Episode' && (
									<Button
										onClick={handlePlayNextEpisode}
										size="large"
										icon="jumpforward"
										disabled={!hasNextEpisode}
									/>
								)}

								<div className={css.trackButtons}>
										{audioTracks.length > 1 && (
											<Button
												size="small"
												icon="speaker"
												onClick={openAudioPopup}
											/>
										)}
										{subtitleTracks.length > 0 && (
											<Button
												size="small"
												icon="subtitle"
												onClick={openSubtitlePopup}
											/>
										)}
								</div>

								<div className={css.volumeControl}>
									<Button
										size="small"
										icon={muted || volume === 0 ? 'soundmute' : 'sound'}
										onClick={toggleMute}
									/>
									<Slider
										className={css.volumeSlider}
										min={0}
										max={100}
										value={muted ? 0 : volume}
										onChange={handleVolumeChange}
									/>
								</div>
							</div>
						</div>
					</div>
				)}

					<Popup
						open={showAudioPopup}
						onClose={closeAudioPopup}
						position="center"
						css={popupShellCss}
					>
					<div className={`${popupStyles.popupSurface} ${css.trackPopup}`}>
						<BodyText className={css.popupTitle}>Audio Track</BodyText>
						<Scroller className={css.trackList}>
								{audioTracks.map((track) => (
									<Item
										key={track.Index}
										className={css.trackOption}
										data-track-index={track.Index}
										selected={currentAudioTrack === track.Index}
										onClick={handleAudioTrackItemClick}
									>
									{getTrackLabel(track)}
								</Item>
							))}
						</Scroller>
					</div>
				</Popup>

					<Popup
						open={showSubtitlePopup}
						onClose={closeSubtitlePopup}
						position="center"
						css={popupShellCss}
					>
					<div className={`${popupStyles.popupSurface} ${css.trackPopup}`}>
						<BodyText className={css.popupTitle}>Subtitles</BodyText>
						<Scroller className={css.trackList}>
								<Item
									className={css.trackOption}
									data-track-index={-1}
									selected={currentSubtitleTrack === -1}
									onClick={handleSubtitleTrackItemClick}
								>
								Off
							</Item>
								{subtitleTracks.map((track) => (
									<Item
										key={track.Index}
										className={css.trackOption}
										data-track-index={track.Index}
										selected={currentSubtitleTrack === track.Index}
										onClick={handleSubtitleTrackItemClick}
									>
									{getTrackLabel(track)}
								</Item>
							))}
						</Scroller>
					</div>
				</Popup>
			</div>
		</Panel>
	);
};

export default PlayerPanel;
