import { useState, useRef, useCallback, useEffect } from 'react';
import { Panel } from '../components/BreezyPanels';
import jellyfinService from '../services/jellyfinService';
import {
	getPlayerTrackLabel,
	getPlayerBackdropCandidates,
	getSkipSegmentLabel
} from './player-panel/utils/playerPanelHelpers';
import { usePanelBackHandler } from '../hooks/usePanelBackHandler';
import { usePlayerKeyboardShortcuts } from './player-panel/hooks/usePlayerKeyboardShortcuts';
import { usePlayerLifecycleEffects } from './player-panel/hooks/usePlayerLifecycleEffects';
import { useTrackPreferences } from '../hooks/useTrackPreferences';
import { useToastMessage } from '../hooks/useToastMessage';
import { PLAYER_PANEL_TOAST_CONFIG } from '../constants/toast';
import { usePlayerRecoveryHandlers } from './player-panel/hooks/usePlayerRecoveryHandlers';
import { usePlayerVideoLoader } from './player-panel/hooks/usePlayerVideoLoader';
import { usePlayerSkipOverlayState } from './player-panel/hooks/usePlayerSkipOverlayState';
import { usePlayerSeekAndTrackSwitching } from './player-panel/hooks/usePlayerSeekAndTrackSwitching';
import { usePlayerPlaybackCommands } from './player-panel/hooks/usePlayerPlaybackCommands';
import { usePlayerDisclosures } from './player-panel/hooks/usePlayerDisclosures';
import { usePlayerEpisodeProgress } from './player-panel/hooks/usePlayerEpisodeProgress';
import { usePlayerEpisodeAndSurfaceHandlers } from './player-panel/hooks/usePlayerEpisodeAndSurfaceHandlers';
import { usePlayerCoreControls } from './player-panel/hooks/usePlayerCoreControls';
import { usePlayerBackNavigation } from './player-panel/hooks/usePlayerBackNavigation';
import { usePlayerMediaEventHandlers } from './player-panel/hooks/usePlayerMediaEventHandlers';
import { usePlayerVisibilitySync } from './player-panel/hooks/usePlayerVisibilitySync';
import { usePlayerPlaybackContext } from './player-panel/hooks/usePlayerPlaybackContext';
import { usePlayerTrackPopupHandlers } from './player-panel/hooks/usePlayerTrackPopupHandlers';
import {usePlayerSubtitleRenderer} from './player-panel/hooks/usePlayerSubtitleRenderer';
import {usePlayerStartupCoordinator} from './player-panel/hooks/usePlayerStartupCoordinator';
import {usePlayerInteractionReveal} from './player-panel/hooks/usePlayerInteractionReveal';
import {usePlayerSubtitleBurnInConsent} from './player-panel/hooks/usePlayerSubtitleBurnInConsent';
import {usePlayerPausedScreensaver} from './player-panel/hooks/usePlayerPausedScreensaver';
import {usePlayerRuntimeDiagnostics} from './player-panel/hooks/usePlayerRuntimeDiagnostics';
import {
	buildPlaybackOverride,
	resolveVideoSeekSeconds
} from './player-panel/utils/playbackOverride';
import {useBreezyfinSettingsSync} from '../hooks/useBreezyfinSettingsSync';
import {readBreezyfinSettings} from '../utils/settingsStorage';
import {normalizeScreensaverTimeoutMinutes} from '../utils/screensaver';
import PlayerPanelContent from './player-panel/components/PlayerPanelContent';
import {
	HLS_PLAYER_CONFIG,
	MAX_HLS_MEDIA_RECOVERY_ATTEMPTS,
	MAX_HLS_NETWORK_RECOVERY_ATTEMPTS,
	MAX_PLAY_SESSION_REBUILD_ATTEMPTS
} from './player-panel/constants';

const PlayerPanel = ({
	item,
	playbackOptions,
	onBack,
	onPlay,
	isActive = false,
	diagnosticsEnabled = false,
	requestedControlsVisible,
	onControlsVisibilityChange,
	registerBackHandler,
	...rest
}) => {
	const [extendedDebugOverlayEnabled, setExtendedDebugOverlayEnabled] = useState(
		() => readBreezyfinSettings().showExtendedPlayerDebugOverlay === true
	);
	const [debugOverlayVisible, setDebugOverlayVisible] = useState(
		() => readBreezyfinSettings().showExtendedPlayerDebugOverlay === true
	);
	const [pausedScreensaverTimeoutMinutes, setPausedScreensaverTimeoutMinutes] = useState(
		() => normalizeScreensaverTimeoutMinutes(readBreezyfinSettings().screensaverTimeoutMinutes)
	);
	const videoRef = useRef(null);
	const externalSubtitleLayerRef = useRef(null);
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
	const currentTimeRef = useRef(0);
	const startupFallbackTimerRef = useRef(null);
	const transcodeFallbackAttemptedRef = useRef(false);
	const dynamicRangeFallbackAttemptedRef = useRef(false);
	const reloadAttemptedRef = useRef(false);
	const lastProgressRef = useRef({ time: 0, timestamp: 0 });
	const loadVideoRef = useRef(null);
	const loadRequestIdRef = useRef(0);
	const exitInProgressRef = useRef(false);
	const playbackGenerationRef = useRef(0);
	const playbackStartedRef = useRef(false);
	const playbackOverrideRef = useRef(null);
	const nativeHlsFallbackCleanupRef = useRef(null);
	const skipButtonRef = useRef(null);
	const playPauseButtonRef = useRef(null);
	const skipOverlayRef = useRef(null);
	const controlsRef = useRef(null);
	const lastInteractionRef = useRef(0);
	const startWatchTimerRef = useRef(null);
	const failStartTimerRef = useRef(null);
	const pendingOverrideClearRef = useRef(false);

	useEffect(() => {
		lastInteractionRef.current = Date.now();
	}, []);
	const seekFeedbackTimerRef = useRef(null);
	const nextEpisodePromptStartTicksRef = useRef(null);
	const wasSkipOverlayVisibleRef = useRef(false);
	const skipFocusRetryTimerRef = useRef(null);
	const subtitleCompatibilityFallbackAttemptedRef = useRef(false);
	const subtitleBurnInFallbackHandlerRef = useRef(null);
	const nativeAudioFallbackAttemptedRef = useRef(false);
	const hlsNetworkRecoveryAttemptsRef = useRef(0);
	const hlsMediaRecoveryAttemptsRef = useRef(0);
	const playSessionRebuildAttemptsRef = useRef(0);
	const playbackFailureLockedRef = useRef(false);
	const {
		toastMessage,
		toastSeverity,
		toastVisible,
		toastMessages,
		setToastMessage
	} = useToastMessage(PLAYER_PANEL_TOAST_CONFIG);
	const {
		loadTrackPreferences,
		pickPreferredAudio,
		pickPreferredSubtitle,
		saveAudioSelection,
		saveSubtitleSelection
	} = useTrackPreferences();

	const [loading, setLoading] = useState(true);
	const [loadingStatusMessage, setLoadingStatusMessage] = useState('Loading...');
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
		showAudioPopup,
		showSubtitlePopup,
		openAudioPopup,
		closeAudioPopup,
		openSubtitlePopup,
		closeSubtitlePopup
	} = usePlayerDisclosures();
	const [mediaSourceData, setMediaSourceData] = useState(null);
	const [playbackGeneration, setPlaybackGeneration] = useState(0);
	const {
		append: appendPlayerDiagnostic,
		diagnostics: runtimeDiagnostics
	} = usePlayerRuntimeDiagnostics({enabled: diagnosticsEnabled, itemId: item?.Id});
	const [mediaSegments, setMediaSegments] = useState([]);
	const [currentSkipSegment, setCurrentSkipSegment] = useState(null);
	const [skipCountdown, setSkipCountdown] = useState(null);
	const [skipOverlayVisible, setSkipOverlayVisible] = useState(false);
	const [dismissedSkipSegmentId, setDismissedSkipSegmentId] = useState(null);
	const [showNextEpisodePrompt, setShowNextEpisodePrompt] = useState(false);
	const [nextEpisodePromptDismissed, setNextEpisodePromptDismissed] = useState(false);
	const [seekFeedback, setSeekFeedback] = useState('');
	const isCurrentTranscoding = mediaSourceData?.__selectedPlayMethod === 'Transcode';
	const playerDiagnosticsEnabled = diagnosticsEnabled && extendedDebugOverlayEnabled;
	const playerDebugOverlayActive = playerDiagnosticsEnabled && debugOverlayVisible;
	const requestSubtitleBurnInFallback = useCallback((payload) => {
		const handler = subtitleBurnInFallbackHandlerRef.current;
		if (typeof handler !== 'function') return false;
		return handler(payload);
	}, []);

	useBreezyfinSettingsSync((settings) => {
		playbackSettingsRef.current = {
			...playbackSettingsRef.current,
			...(settings || {})
		};
		setExtendedDebugOverlayEnabled(settings?.showExtendedPlayerDebugOverlay === true);
		setPausedScreensaverTimeoutMinutes(
			normalizeScreensaverTimeoutMinutes(settings?.screensaverTimeoutMinutes)
		);
	}, {enabled: true, applyOnMount: true});

	useEffect(() => {
		setDebugOverlayVisible(playerDiagnosticsEnabled);
	}, [playerDiagnosticsEnabled]);

	useEffect(() => {
		nativeAudioFallbackAttemptedRef.current = false;
	}, [item?.Id]);

	useEffect(() => {
		currentTimeRef.current = currentTime;
	}, [currentTime]);

	usePlayerVisibilitySync({
		requestedControlsVisible,
		onControlsVisibilityChange,
		showControls,
		setShowControls
	});

	usePlayerInteractionReveal({
		enabled: isActive,
		disabled: loading || Boolean(error),
		showControls,
		setShowControls,
		lastInteractionRef
	});

	const {
		buildPlaybackOptions,
		getPlaybackSessionContext
	} = usePlayerPlaybackContext({
		playbackSettingsRef,
		playbackSessionRef,
		currentAudioTrack,
		currentSubtitleTrack,
		audioTracks,
		subtitleTracks,
		currentAudioTrackRef,
		currentSubtitleTrackRef
	});

	const {
		hasNextEpisode,
		hasPreviousEpisode,
		nextEpisodeData,
		getNextEpisode,
		getPreviousEpisode,
		startProgressReporting
	} = usePlayerEpisodeProgress({
		item,
		videoRef,
		progressIntervalRef,
		getPlaybackSessionContext
	});

	const {
		clearStartWatch,
		focusSkipOverlayAction,
		handleStop
	} = usePlayerCoreControls({
		item,
		videoRef,
		hlsRef,
		nativeHlsFallbackCleanupRef,
		playbackSessionRef,
		progressIntervalRef,
		startupFallbackTimerRef,
		startWatchTimerRef,
		failStartTimerRef,
		skipFocusRetryTimerRef,
		skipButtonRef,
		skipOverlayRef,
		getPlaybackSessionContext
	});
	const {
		subtitleBurnInPrompt,
		handleSubtitleBurnInFallback,
		handleConfirmSubtitleBurnIn,
		handleDeclineSubtitleBurnIn,
		handleSubtitleBurnInPromptBack,
		handleSubtitleBurnInPromptHide
	} = usePlayerSubtitleBurnInConsent({
		itemId: item?.Id,
		mediaSourceId: mediaSourceData?.Id,
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
	});
	subtitleBurnInFallbackHandlerRef.current = handleSubtitleBurnInFallback;

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
		setLoadingStatusMessage,
		setPlaying,
		handleStop,
		currentAudioTrackRef,
		currentSubtitleTrackRef,
		playbackFailureLockedRef,
		hlsNetworkRecoveryAttemptsRef,
		hlsMediaRecoveryAttemptsRef,
		hlsRef,
		nativeHlsFallbackCleanupRef,
		reloadAttemptedRef,
		playSessionRebuildAttemptsRef,
		videoRef,
		seekOffsetRef,
		startupFallbackTimerRef,
		playbackOverrideRef,
		loadVideoRef,
		mediaSourceData,
		appendPlaybackDiagnostic: appendPlayerDiagnostic,
		playbackSettingsRef,
		transcodeFallbackAttemptedRef,
		dynamicRangeFallbackAttemptedRef,
		subtitleCompatibilityFallbackAttemptedRef,
		setCurrentSubtitleTrack,
		requestSubtitleBurnInFallback,
		exitInProgressRef
	});

	const loadVideo = usePlayerVideoLoader({
		item,
		videoRef,
		hlsRef,
		nativeHlsFallbackCleanupRef,
		loadVideoRef,
		loadRequestIdRef,
		playbackStartedRef,
		resetRecoveryGuards,
		setLoading,
		reloadAttemptedRef,
		subtitleCompatibilityFallbackAttemptedRef,
		lastProgressRef,
		setError,
		seekOffsetRef,
		loadTrackPreferences,
		setLoadingStatusMessage,
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
		appendPlaybackDiagnostic: appendPlayerDiagnostic,
		requestSubtitleDecision: handleSubtitleBurnInFallback,
		exitInProgressRef,
		playbackGenerationRef,
		setPlaybackGeneration
	});

	const handleInitialNativeAudioFallback = useCallback(async ({
		reason,
		audioStreamIndex,
		subtitleStreamIndex
	}) => {
		if (nativeAudioFallbackAttemptedRef.current) return;
		nativeAudioFallbackAttemptedRef.current = true;
		appendPlayerDiagnostic({
			scope: 'audio-track',
			stage: 'initial-directstream-fallback',
			status: 'requested',
			reason,
			message: 'Restarting with DirectPlay disabled so Jellyfin can honor the selected audio stream.'
		});
		playbackOverrideRef.current = buildPlaybackOverride({
			baseOptions: playbackOptions,
			mediaSourceId: mediaSourceData?.Id,
			audioStreamIndex,
			subtitleStreamIndex,
			seekSeconds: resolveVideoSeekSeconds(videoRef.current) || currentTime || 0,
			extra: {
				disableDirectPlay: true
			}
		});
		setLoading(true);
		setLoadingStatusMessage('Restarting stream...');
		try {
			await handleStop();
		} catch (fallbackError) {
			console.warn('Failed while preparing native audio fallback:', fallbackError);
		}
		loadVideo();
	}, [
		appendPlayerDiagnostic,
		currentTime,
		handleStop,
		loadVideo,
		mediaSourceData?.Id,
		playbackOptions,
		playbackOverrideRef,
		setLoading,
		setLoadingStatusMessage,
		videoRef
	]);

	const {
		subtitleCues,
		subtitleRendererPolicy,
		subtitleRendererState,
		requestSubtitleRendererFallback
	} = usePlayerSubtitleRenderer({
		item,
		videoRef,
		externalSubtitleLayerRef,
		mediaSourceData,
		subtitleTracks,
		currentSubtitleTrack,
		currentTime,
		playbackSettingsRef,
		onBurnInFallback: handleSubtitleBurnInFallback,
		setToastMessage,
		playbackGeneration,
		exitInProgressRef,
		diagnosticsEnabled,
		debugDiagnosticsEnabled: playerDebugOverlayActive
	});
	const handleSubtitleStartupTimeout = useCallback(() => (
		requestSubtitleRendererFallback?.('subtitle-startup-timeout')
	), [requestSubtitleRendererFallback]);
	const {
		status: playbackStartupStatus,
		markVideoReady
	} = usePlayerStartupCoordinator({
		item,
		playbackGeneration,
		videoRef,
		currentSubtitleTrack,
		subtitleRendererPolicy,
		subtitleRendererState,
		exitInProgressRef,
		playbackStartedRef,
		playbackOverrideRef,
		pendingOverrideClearRef,
		startupFallbackTimerRef,
		clearStartWatch,
		getPlaybackSessionContext,
		startProgressReporting,
		setLoading,
		setLoadingStatusMessage,
		setPlaying,
		setToastMessage,
		showPlaybackError,
		attemptTranscodeFallback,
		isCurrentTranscoding,
		onSubtitleTimeout: handleSubtitleStartupTimeout
	});

	const {
		handleEnded,
		handlePlay,
		handlePause,
		handleRetryPlayback,
		handleBackButton
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
		setLoadingStatusMessage,
		setToastMessage,
		showPlaybackError,
		resetRecoveryGuards,
		playSessionRebuildAttemptsRef,
		transcodeFallbackAttemptedRef,
		reloadAttemptedRef,
		subtitleCompatibilityFallbackAttemptedRef,
		loadVideo,
		attemptTranscodeFallback,
		isCurrentTranscoding,
		exitInProgressRef,
		loadRequestIdRef
	});

	const {
		handlePlayNextEpisode,
		handlePlayPreviousEpisode,
		handleVideoSurfaceClick,
		handleVolumeChange,
		toggleMute,
		handleVideoPlaying,
		handleVideoPause,
		clearError
	} = usePlayerEpisodeAndSurfaceHandlers({
		item,
		onPlay,
		hasNextEpisode,
		nextEpisodeData,
		getNextEpisode,
		hasPreviousEpisode,
		getPreviousEpisode,
		buildPlaybackOptions,
		playbackOverrideRef,
		handleStop,
		loading,
		error,
		showAudioPopup,
		showSubtitlePopup,
		showControls,
		playing,
		handlePause,
		handlePlay,
		lastInteractionRef,
		videoRef,
		muted,
		setMuted,
		setVolume,
		setPlaying,
		setError
	});

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
		playbackSettingsRef,
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
		setToastMessage,
		appendPlaybackDiagnostic: appendPlayerDiagnostic
	});

	const {
		handleLoadedMetadata,
		handleLoadedData,
		handleCanPlay,
		handleTimeUpdate,
		handleVideoError
	} = usePlayerMediaEventHandlers({
		item,
		loading,
		videoRef,
		playbackStartedRef,
		playbackOverrideRef,
		setCurrentTime,
		showPlaybackError,
		checkSkipSegments,
		seekOffsetRef,
		lastProgressRef,
		playbackFailureLockedRef,
		playbackSettingsRef,
		isSubtitleCompatibilityError,
		attemptSubtitleCompatibilityFallback,
		isCurrentTranscoding,
		attemptTranscodeFallback,
		handleStop,
		mediaSourceData,
		audioTracks,
		currentAudioTrack,
		currentSubtitleTrack,
		appendPlaybackDiagnostic: appendPlayerDiagnostic,
		onNativeAudioSwitchFallback: handleInitialNativeAudioFallback,
		onVideoCanPlay: markVideoReady,
		exitInProgressRef
	});

	const playerBackdropUrls = getPlayerBackdropCandidates(item, jellyfinService);

	const {
		handleAudioTrackItemClick,
		handleSubtitleTrackItemClick
	} = usePlayerTrackPopupHandlers({
		handleAudioTrackChange,
		handleSubtitleTrackChange
	});

	const handleToggleDebugOverlay = useCallback(() => {
		if (!playerDiagnosticsEnabled) return;
		setDebugOverlayVisible((current) => !current);
	}, [playerDiagnosticsEnabled]);

	const handleCloseDebugOverlay = useCallback(() => {
		setDebugOverlayVisible(false);
	}, []);

	const handleDebugErrorTrigger = useCallback(async (actionId) => {
		switch (actionId) {
			case 'playback-error':
			case 'player-playback-error':
				showPlaybackError('Debug: simulated playback failure');
				break;
			case 'session-rebuild':
			case 'player-session-rebuild': {
				const restarted = attemptPlaybackSessionRebuild('Debug forced session rebuild', {
					toast: 'Debug: restarting stream with a fresh session...'
				});
				if (!restarted) {
					setToastMessage('Debug: stream restart is unavailable for the current state.');
				}
				break;
			}
			case 'transcode-fallback':
			case 'player-transcode-fallback': {
				const applied = await attemptTranscodeFallback('Debug forced transcode fallback');
				if (!applied) {
					setToastMessage('Debug: transcode fallback was not applicable to this stream.');
				}
				break;
			}
			default:
				break;
		}
	}, [
		attemptPlaybackSessionRebuild,
		attemptTranscodeFallback,
		setToastMessage,
		showPlaybackError
	]);

	useEffect(() => {
		if (!isActive) return undefined;
		const handleDebugActionEvent = (event) => {
			const actionId = event?.detail?.action;
			if (!actionId) return;
			handleDebugErrorTrigger(actionId);
		};
		window.addEventListener('breezyfin:debug-error-action', handleDebugActionEvent, true);
		return () => {
			window.removeEventListener('breezyfin:debug-error-action', handleDebugActionEvent, true);
		};
	}, [handleDebugErrorTrigger, isActive]);

	const handlePausedScreensaverWake = useCallback(() => {
		lastInteractionRef.current = Date.now();
		setShowControls(true);
	}, []);
	const handlePausedScreensaverResume = useCallback(() => {
		return handlePlay({keepHidden: false});
	}, [handlePlay]);
	const {
		active: pausedScreensaverActive,
		dismiss: dismissPausedScreensaver
	} = usePlayerPausedScreensaver({
		isActive,
		playing,
		loading,
		error,
		playbackStarted: playbackStartedRef.current,
		blocked: Boolean(
			subtitleBurnInPrompt ||
			showAudioPopup ||
			showSubtitlePopup ||
			skipOverlayVisible ||
			showNextEpisodePrompt ||
			playerDebugOverlayActive
		),
		timeoutMinutes: pausedScreensaverTimeoutMinutes,
		onWake: handlePausedScreensaverWake,
		onResume: handlePausedScreensaverResume
	});

	const {
		handleInternalBack
	} = usePlayerBackNavigation({
		hasPlaybackError: Boolean(error),
		handleBackButton,
		showAudioPopup,
		closeAudioPopup,
		showSubtitlePopup,
		closeSubtitlePopup,
		skipOverlayVisible,
		handleDismissSkipOverlay,
		showControls,
		setShowControls
	});
	const handlePlayerInternalBack = useCallback(() => {
		if (pausedScreensaverActive) {
			dismissPausedScreensaver();
			handlePausedScreensaverWake();
			return true;
		}
		if (handleSubtitleBurnInPromptBack()) return true;
		return handleInternalBack();
	}, [
		dismissPausedScreensaver,
		handleInternalBack,
		handlePausedScreensaverWake,
		handleSubtitleBurnInPromptBack,
		pausedScreensaverActive
	]);
	const getMediaSegmentsForItem = useCallback((itemId, options = {}) => {
		return jellyfinService.getMediaSegments(itemId, options);
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
		appendPlaybackDiagnostic: appendPlayerDiagnostic,
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
		playPauseButtonRef,
		loadRequestIdRef,
		playbackStartedRef
	});

	usePanelBackHandler(registerBackHandler, handlePlayerInternalBack, {enabled: isActive});

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
		handleInternalBack: handlePlayerInternalBack,
		handleBackButton,
		handlePause,
		handlePlay,
		playing,
		controlsRef,
		skipOverlayRef,
		focusSkipOverlayAction,
		isProgressSliderTarget
	});
	const playerContentProps = {
		startupStatus: playbackStartupStatus,
		mediaSurface: {
			item,
			videoRef,
			onLoadedData: handleLoadedData,
			onLoadedMetadata: handleLoadedMetadata,
			onCanPlay: handleCanPlay,
			onTimeUpdate: handleTimeUpdate,
			onEnded: handleEnded,
			onError: handleVideoError,
			onPlaying: handleVideoPlaying,
			onPause: handleVideoPause,
			onClick: handleVideoSurfaceClick,
			error,
			loading,
			loadingStatusMessage,
			backdropUrls: playerBackdropUrls,
			showBackdrop: Boolean(loading || error || subtitleBurnInPrompt),
			seekFeedback,
			externalSubtitleLayerRef,
			showControls,
			subtitleCues,
			mediaSourceData,
			playbackSettings: playbackSettingsRef.current,
			diagnosticsEnabled
		},
		errorPopup: {
			open: Boolean(error),
			error,
			onClose: clearError,
			onRetry: handleRetryPlayback,
			onBack: handleBackButton
		},
		skipOverlay: {
			visible: skipOverlayVisible,
			currentSkipSegment,
			showNextEpisodePrompt,
			skipCountdown,
			onSkip: handleSkipSegment,
			onDismiss: handleDismissSkipOverlay,
			skipButtonRef,
			skipOverlayRef,
			getSkipSegmentLabel
		},
		subtitlePrompt: {
			open: Boolean(subtitleBurnInPrompt),
			prompt: subtitleBurnInPrompt,
			onConfirm: handleConfirmSubtitleBurnIn,
			onDecline: handleDeclineSubtitleBurnIn,
			onBack: handleSubtitleBurnInPromptBack,
			onHide: handleSubtitleBurnInPromptHide
		},
		toast: {
			message: toastMessage,
			severity: toastSeverity,
			messages: toastMessages,
			visible: toastVisible && !error
		},
		debugOverlay: {
			enabled: playerDebugOverlayActive,
			onClose: handleCloseDebugOverlay,
			item,
			mediaSourceData,
			playbackSession: playbackSessionRef.current,
			videoRef,
			hlsRef,
			loading,
			error,
			playing,
			showControls,
			currentTime,
			duration,
			currentAudioTrack,
			currentSubtitleTrack,
			subtitleRendererPolicy,
			subtitleRendererState,
			runtimeDiagnostics,
			isCurrentTranscoding,
			skipOverlayVisible,
			showNextEpisodePrompt
		},
		controls: {
			state: {
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
				volume,
				debugOverlayEnabled: playerDiagnosticsEnabled,
				debugOverlayVisible
			},
			actions: {
				handleBackButton,
				handleSeek,
				handlePlayPreviousEpisode,
				handlePause,
				handlePlay,
				handlePlayNextEpisode,
				openAudioPopup,
				openSubtitlePopup,
				toggleMute,
				handleVolumeChange,
				handleToggleDebugOverlay
			},
			refs: {controlsRef, playPauseButtonRef}
		},
		trackPopups: {
			audioOpen: showAudioPopup,
			onAudioClose: closeAudioPopup,
			audioTracks,
			currentAudioTrack,
			onAudioTrackClick: handleAudioTrackItemClick,
			subtitleOpen: showSubtitlePopup,
			onSubtitleClose: closeSubtitlePopup,
			subtitleTracks,
			currentSubtitleTrack,
			onSubtitleTrackClick: handleSubtitleTrackItemClick,
			getTrackLabel: getPlayerTrackLabel
		},
		pausedScreensaver: {
			active: pausedScreensaverActive,
			message: 'Press the scroll wheel button to resume playback'
		}
	};
	return (
		<Panel {...rest} noCloseButton>
			<PlayerPanelContent {...playerContentProps} />
		</Panel>
	);
};

export default PlayerPanel;
