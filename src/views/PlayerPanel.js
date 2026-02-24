import { useState, useEffect, useRef, useCallback } from 'react';
import { Panel } from '../components/BreezyPanels';
import Spotlight from '@enact/spotlight';
import jellyfinService from '../services/jellyfinService';
import {getPlaybackErrorMessage, isFatalPlaybackError} from '../utils/errorMessages';
import {
	getPlayerTrackLabel,
	getPlayerErrorBackdropUrl,
	getSkipSegmentLabel
} from './player-panel/utils/playerPanelHelpers';
import {getNextEpisodeForItem, getPreviousEpisodeForItem} from './player-panel/utils/episodeNavigation';
import { usePanelBackHandler } from '../hooks/usePanelBackHandler';
import { useDisclosureHandlers } from '../hooks/useDisclosureHandlers';
import { usePlayerKeyboardShortcuts } from './player-panel/hooks/usePlayerKeyboardShortcuts';
import { usePlayerLifecycleEffects } from './player-panel/hooks/usePlayerLifecycleEffects';
import { useTrackPreferences } from '../hooks/useTrackPreferences';
import { useToastMessage } from '../hooks/useToastMessage';
import { useDisclosureMap } from '../hooks/useDisclosureMap';
import { usePlayerRecoveryHandlers } from './player-panel/hooks/usePlayerRecoveryHandlers';
import { usePlayerVideoLoader } from './player-panel/hooks/usePlayerVideoLoader';
import { usePlayerSkipOverlayState } from './player-panel/hooks/usePlayerSkipOverlayState';
import { usePlayerSeekAndTrackSwitching } from './player-panel/hooks/usePlayerSeekAndTrackSwitching';
import { usePlayerPlaybackCommands } from './player-panel/hooks/usePlayerPlaybackCommands';
import PlayerErrorPopup from './player-panel/components/PlayerErrorPopup';
import PlayerTrackPopup from './player-panel/components/PlayerTrackPopup';
import PlayerLoadingOverlay from './player-panel/components/PlayerLoadingOverlay';
import PlayerSkipOverlay from './player-panel/components/PlayerSkipOverlay';
import PlayerControlsOverlay from './player-panel/components/PlayerControlsOverlay';
import PlayerSeekFeedback from './player-panel/components/PlayerSeekFeedback';
import PlayerToast from './player-panel/components/PlayerToast';

import css from './PlayerPanel.module.less';

const MAX_HLS_NETWORK_RECOVERY_ATTEMPTS = 1;
const MAX_HLS_MEDIA_RECOVERY_ATTEMPTS = 1;
const MAX_PLAY_SESSION_REBUILD_ATTEMPTS = 1;
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
const PLAYER_DISCLOSURE_KEY_LIST = [
	PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS,
	PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS
];

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
	const dynamicRangeFallbackAttemptedRef = useRef(false);
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
		toastVisible,
		setToastMessage
	} = useToastMessage({durationMs: 2050, fadeOutMs: 350});
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

	const [audioTracks, setAudioTracks] = useState([]);
	const [subtitleTracks, setSubtitleTracks] = useState([]);
	const [currentAudioTrack, setCurrentAudioTrack] = useState(null);
	const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState(null);
	const {
		disclosures,
		openDisclosure,
		closeDisclosure
	} = useDisclosureMap(INITIAL_PLAYER_DISCLOSURES);
	const disclosureHandlers = useDisclosureHandlers(
		PLAYER_DISCLOSURE_KEY_LIST,
		openDisclosure,
		closeDisclosure
	);
	const showAudioPopup = disclosures[PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS] === true;
	const showSubtitlePopup = disclosures[PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS] === true;
	const openAudioPopup = disclosureHandlers[PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS].open;
	const closeAudioPopup = disclosureHandlers[PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS].close;
	const openSubtitlePopup = disclosureHandlers[PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS].open;
	const closeSubtitlePopup = disclosureHandlers[PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS].close;
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

	const getNextEpisode = useCallback(async (currentItem) => {
		return getNextEpisodeForItem(jellyfinService, currentItem);
	}, []);

	const getPreviousEpisode = useCallback(async (currentItem) => {
		return getPreviousEpisodeForItem(jellyfinService, currentItem);
	}, []);

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
			videoRef.current.removeAttribute('src');
			videoRef.current.load();
		}
		playbackSessionRef.current = {
			playSessionId: null,
			mediaSourceId: null,
			playMethod: 'DirectStream'
		};
	}, [clearStartWatch, getPlaybackSessionContext, item]);

	const {
		resetRecoveryGuards,
		attemptPlaybackSessionRebuild,
		showPlaybackError,
		attemptTranscodeFallback,
		isSubtitleCompatibilityError,
		attemptSubtitleCompatibilityFallback,
		attachHlsPlayback
	} = usePlayerRecoveryHandlers({
		maxHlsNetworkRecoveryAttempts: MAX_HLS_NETWORK_RECOVERY_ATTEMPTS,
		maxHlsMediaRecoveryAttempts: MAX_HLS_MEDIA_RECOVERY_ATTEMPTS,
		maxPlaySessionRebuildAttempts: MAX_PLAY_SESSION_REBUILD_ATTEMPTS,
		hlsConfig: HLS_PLAYER_CONFIG,
		clearStartWatch,
		playbackOptions,
		setToastMessage,
		setError,
		setShowControls,
		setLoading,
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
		startupFallbackTimerRef,
		playbackOverrideRef,
		loadVideoRef,
		mediaSourceData,
			playbackSettingsRef,
			transcodeFallbackAttemptedRef,
			dynamicRangeFallbackAttemptedRef,
			subtitleCompatibilityFallbackAttemptedRef,
			setCurrentSubtitleTrack
		});

	const loadVideo = usePlayerVideoLoader({
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
	});

	const {
		handleEnded,
		handlePlay,
		handlePause,
		handleRetryPlayback,
		handleBackButton,
		tryPlaybackFallbackOnCanPlayError
	} = usePlayerPlaybackCommands({
		item,
		onBack,
		onPlay,
		hasNextEpisode,
		getNextEpisode,
		buildPlaybackOptions,
		playbackSettingsRef,
		videoRef,
		handleStop,
		getPlaybackSessionContext,
		startProgressReporting,
		setPlaying,
		setShowControls,
		setError,
		setToastMessage,
		showPlaybackError,
		resetRecoveryGuards,
		playSessionRebuildAttemptsRef,
		transcodeFallbackAttemptedRef,
		reloadAttemptedRef,
		subtitleCompatibilityFallbackAttemptedRef,
		loadVideo,
		attemptTranscodeFallback,
		isCurrentTranscoding
	});

	const handleLoadedMetadata = useCallback(() => {
		if (videoRef.current) {
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

				const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
			await jellyfinService.reportPlaybackStart(item.Id, positionTicks, getPlaybackSessionContext());
			startProgressReporting();
		} catch (playError) {
			console.error('Auto-play failed:', playError);
			const errorMessage = getPlaybackErrorMessage(playError, 'Playback failed to start');
			setPlaying(false);

			if (isFatalPlaybackError(playError)) {
				const didFallback = await tryPlaybackFallbackOnCanPlayError(errorMessage);
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
	}, [clearStartWatch, getPlaybackSessionContext, loading, item, setToastMessage, showPlaybackError, startProgressReporting, tryPlaybackFallbackOnCanPlayError]);

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

	const {
		checkSkipSegments,
		handleSkipSegment,
		handleDismissSkipOverlay
	} = usePlayerSkipOverlayState({
		mediaSegments,
		duration,
		nextEpisodeData,
		currentSkipSegment,
		dismissedSkipSegmentId,
		nextEpisodePromptDismissed,
		showNextEpisodePrompt,
		skipOverlayVisible,
		nextEpisodePromptStartTicksRef,
		videoRef,
		setCurrentTime,
		setSkipOverlayVisible,
		setCurrentSkipSegment,
		setSkipCountdown,
		setShowNextEpisodePrompt,
		setDismissedSkipSegmentId,
		setNextEpisodePromptDismissed,
		handlePlayNextEpisode
	});

	const handleTimeUpdate = useCallback(() => {
		if (videoRef.current) {
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

		if (!isCurrentTranscoding) {
			const didFallback = await attemptTranscodeFallback(errorMessage);
			if (didFallback) {
				return;
			}
		}

		try {
			await handleStop();
		} catch (stopErr) {
			console.warn('Error while handling playback failure:', stopErr);
		}
		showPlaybackError(errorMessage);
	}, [attemptSubtitleCompatibilityFallback, attemptTranscodeFallback, handleStop, isCurrentTranscoding, isSubtitleCompatibilityError, showPlaybackError]);

	const {
		isSeekContext,
		isProgressSliderTarget,
		seekBySeconds,
		handleSeek,
		handleAudioTrackChange,
		handleSubtitleTrackChange
	} = usePlayerSeekAndTrackSwitching({
		item,
		videoRef,
		hlsRef,
		duration,
		isCurrentTranscoding,
		mediaSourceData,
		checkSkipSegments,
		playbackOptions,
		currentAudioTrack,
		currentSubtitleTrack,
		getPlaybackSessionContext,
		handleStop,
		loadVideo,
		playbackOverrideRef,
		lastInteractionRef,
		seekOffsetRef,
		seekFeedbackTimerRef,
		setCurrentTime,
		setLoading,
		setSeekFeedback,
		audioTracks,
		subtitleTracks,
		closeAudioPopup,
		closeSubtitlePopup,
		saveAudioSelection,
		saveSubtitleSelection,
		setCurrentAudioTrack,
		setCurrentSubtitleTrack,
		setToastMessage
	});

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
	const errorBackdropUrl = getPlayerErrorBackdropUrl(item, jellyfinService);
	const hasErrorBackdrop = Boolean(errorBackdropUrl);

	const handleVideoPlaying = useCallback(() => {
		setPlaying(true);
	}, []);

	const handleVideoPause = useCallback(() => {
		setPlaying(false);
	}, []);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

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

	const handleInternalBack = useCallback(() => {
		if (showAudioPopup) {
			closeAudioPopup();
			return true;
		}
		if (showSubtitlePopup) {
			closeSubtitlePopup();
			return true;
		}
		if (skipOverlayVisible) {
			handleDismissSkipOverlay();
			return true;
		}
		if (showControls) {
			setShowControls(false);
			return true;
		}
		return false;
	}, [closeAudioPopup, closeSubtitlePopup, handleDismissSkipOverlay, showAudioPopup, showControls, showSubtitlePopup, skipOverlayVisible]);
	const getMediaSegmentsForItem = useCallback((itemId) => {
		return jellyfinService.getMediaSegments(itemId);
	}, []);

	usePlayerLifecycleEffects({
		item,
		resetRecoveryGuards,
		playSessionRebuildAttemptsRef,
		transcodeFallbackAttemptedRef,
		reloadAttemptedRef,
		setSkipOverlayVisible,
		setCurrentSkipSegment,
		setSkipCountdown,
		setDismissedSkipSegmentId,
		setShowNextEpisodePrompt,
		setNextEpisodePromptDismissed,
		nextEpisodePromptStartTicksRef,
		loadVideo,
		getMediaSegmentsForItem,
		setMediaSegments,
		handleStop,
		showControls,
		playing,
		showAudioPopup,
		showSubtitlePopup,
		lastInteractionRef,
		setShowControls,
		mediaSourceData,
		isCurrentTranscoding,
		lastProgressRef,
		videoRef,
		attemptTranscodeFallback,
		skipFocusRetryTimerRef,
		seekFeedbackTimerRef,
		skipOverlayVisible,
		wasSkipOverlayVisibleRef,
		focusSkipOverlayAction,
		playPauseButtonRef
	});

	usePanelBackHandler(registerBackHandler, handleInternalBack, {enabled: isActive});

	usePlayerKeyboardShortcuts({
		isActive,
		onUserInteraction: () => {
			lastInteractionRef.current = Date.now();
		},
		showControls,
		setShowControls,
		skipOverlayVisible,
		showAudioPopup,
		showSubtitlePopup,
		isSeekContext,
		seekBySeconds,
		handleInternalBack,
		handleBackButton,
		handlePause,
		handlePlay,
		playing,
		controlsRef,
		skipOverlayRef,
		focusSkipOverlayAction,
		isProgressSliderTarget
	});
	const playerControlsState = {
		show: showControls,
		loading,
		error,
		item,
		currentTime,
		duration,
		hasPreviousEpisode,
		playing,
		hasNextEpisode,
		audioTracks,
		subtitleTracks,
		muted,
		volume
	};
	const playerControlsActions = {
		handleBackButton,
		handleSeek,
		handlePlayPreviousEpisode,
		handlePause,
		handlePlay,
		handlePlayNextEpisode,
		openAudioPopup,
		openSubtitlePopup,
		toggleMute,
		handleVolumeChange
	};
	const playerControlsRefs = {
		controlsRef,
		playPauseButtonRef
	};

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

				<PlayerLoadingOverlay loading={loading} />
				<PlayerSeekFeedback seekFeedback={seekFeedback} />

				<PlayerErrorPopup
					open={!!error}
					error={error}
					onClose={clearError}
					onRetry={handleRetryPlayback}
					onBack={handleBackButton}
				/>

				<PlayerSkipOverlay
					visible={skipOverlayVisible}
					currentSkipSegment={currentSkipSegment}
					showNextEpisodePrompt={showNextEpisodePrompt}
					nextEpisodeData={nextEpisodeData}
					skipCountdown={skipCountdown}
					onSkip={handleSkipSegment}
					onDismiss={handleDismissSkipOverlay}
					skipButtonRef={skipButtonRef}
					skipOverlayRef={skipOverlayRef}
					getSkipSegmentLabel={getSkipSegmentLabel}
				/>

				<PlayerToast message={toastMessage} visible={toastVisible && !error} />

					<PlayerControlsOverlay
						state={playerControlsState}
						actions={playerControlsActions}
						refs={playerControlsRefs}
					/>

				<PlayerTrackPopup
					open={showAudioPopup}
					onClose={closeAudioPopup}
					title="Audio Track"
					tracks={audioTracks}
					currentTrack={currentAudioTrack}
					onTrackClick={handleAudioTrackItemClick}
					getTrackLabel={getPlayerTrackLabel}
				/>

				<PlayerTrackPopup
					open={showSubtitlePopup}
					onClose={closeSubtitlePopup}
					title="Subtitles"
					tracks={subtitleTracks}
					currentTrack={currentSubtitleTrack}
					onTrackClick={handleSubtitleTrackItemClick}
					getTrackLabel={getPlayerTrackLabel}
					includeOffOption
					offLabel="Off"
				/>
			</div>
		</Panel>
	);
};

export default PlayerPanel;
