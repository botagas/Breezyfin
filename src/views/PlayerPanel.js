import { useState, useRef, useCallback, useEffect } from 'react';
import { Panel } from '../components/BreezyPanels';
import jellyfinService from '../services/jellyfinService';
import {
	getPlayerTrackLabel,
	getPlayerErrorBackdropUrl,
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
import {useBreezyfinSettingsSync} from '../hooks/useBreezyfinSettingsSync';
import {readBreezyfinSettings} from '../utils/settingsStorage';
import PlayerErrorPopup from './player-panel/components/PlayerErrorPopup';
import PlayerTrackPopup from './player-panel/components/PlayerTrackPopup';
import PlayerLoadingOverlay from './player-panel/components/PlayerLoadingOverlay';
import PlayerSkipOverlay from './player-panel/components/PlayerSkipOverlay';
import PlayerControlsOverlay from './player-panel/components/PlayerControlsOverlay';
import PlayerSeekFeedback from './player-panel/components/PlayerSeekFeedback';
import PlayerToast from './player-panel/components/PlayerToast';
import PlayerDebugOverlay from './player-panel/components/PlayerDebugOverlay';

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
	const [extendedDebugOverlayEnabled, setExtendedDebugOverlayEnabled] = useState(
		() => readBreezyfinSettings().showExtendedPlayerDebugOverlay === true
	);
	const [debugOverlayVisible, setDebugOverlayVisible] = useState(
		() => readBreezyfinSettings().showExtendedPlayerDebugOverlay === true
	);
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
	} = useToastMessage(PLAYER_PANEL_TOAST_CONFIG);
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
		showAudioPopup,
		showSubtitlePopup,
		openAudioPopup,
		closeAudioPopup,
		openSubtitlePopup,
		closeSubtitlePopup
	} = usePlayerDisclosures();
	const [mediaSourceData, setMediaSourceData] = useState(null);
	const [mediaSegments, setMediaSegments] = useState([]);
	const [currentSkipSegment, setCurrentSkipSegment] = useState(null);
	const [skipCountdown, setSkipCountdown] = useState(null);
	const [skipOverlayVisible, setSkipOverlayVisible] = useState(false);
	const [dismissedSkipSegmentId, setDismissedSkipSegmentId] = useState(null);
	const [showNextEpisodePrompt, setShowNextEpisodePrompt] = useState(false);
	const [nextEpisodePromptDismissed, setNextEpisodePromptDismissed] = useState(false);
	const [seekFeedback, setSeekFeedback] = useState('');
	const isCurrentTranscoding = mediaSourceData?.__selectedPlayMethod === 'Transcode';

	useBreezyfinSettingsSync((settings) => {
		setExtendedDebugOverlayEnabled(settings?.showExtendedPlayerDebugOverlay === true);
	}, {enabled: true, applyOnMount: true});

	useEffect(() => {
		setDebugOverlayVisible(extendedDebugOverlayEnabled);
	}, [extendedDebugOverlayEnabled]);

	usePlayerVisibilitySync({
		requestedControlsVisible,
		onControlsVisibilityChange,
		showControls,
		setShowControls
	});

	const {
		buildPlaybackOptions,
		getPlaybackSessionContext
	} = usePlayerPlaybackContext({
		playbackSettingsRef,
		playbackSessionRef,
		currentAudioTrack,
		currentSubtitleTrack,
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
		setToastMessage
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
		playbackOverrideRef,
		setCurrentTime,
		setLoading,
		showPlaybackError,
		setPlaying,
		pendingOverrideClearRef,
		clearStartWatch,
		startupFallbackTimerRef,
		getPlaybackSessionContext,
		startProgressReporting,
		setToastMessage,
		tryPlaybackFallbackOnCanPlayError,
		checkSkipSegments,
		seekOffsetRef,
		lastProgressRef,
		playbackFailureLockedRef,
		playbackSettingsRef,
		isSubtitleCompatibilityError,
		attemptSubtitleCompatibilityFallback,
		isCurrentTranscoding,
		attemptTranscodeFallback,
		handleStop
	});

	const errorBackdropUrl = getPlayerErrorBackdropUrl(item, jellyfinService);
	const hasErrorBackdrop = Boolean(errorBackdropUrl);

	const {
		handleAudioTrackItemClick,
		handleSubtitleTrackItemClick
	} = usePlayerTrackPopupHandlers({
		handleAudioTrackChange,
		handleSubtitleTrackChange
	});

	const handleToggleDebugOverlay = useCallback(() => {
		if (!extendedDebugOverlayEnabled) return;
		setDebugOverlayVisible((current) => !current);
	}, [extendedDebugOverlayEnabled]);

	const handleCloseDebugOverlay = useCallback(() => {
		setDebugOverlayVisible(false);
	}, []);

	const {
		handleInternalBack
	} = usePlayerBackNavigation({
		showAudioPopup,
		closeAudioPopup,
		showSubtitlePopup,
		closeSubtitlePopup,
		skipOverlayVisible,
		handleDismissSkipOverlay,
		showControls,
		setShowControls
	});
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
		volume,
		debugOverlayEnabled: extendedDebugOverlayEnabled,
		debugOverlayVisible
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
		handleVolumeChange,
		handleToggleDebugOverlay
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
						{hasErrorBackdrop && (
							<img
								src={errorBackdropUrl}
								alt={item?.Name || 'Playback error'}
								loading="lazy"
								decoding="async"
								draggable={false}
							/>
						)}
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
				<PlayerDebugOverlay
					enabled={extendedDebugOverlayEnabled && debugOverlayVisible}
					onClose={handleCloseDebugOverlay}
					item={item}
					mediaSourceData={mediaSourceData}
					playbackSession={playbackSessionRef.current}
					videoRef={videoRef}
					hlsRef={hlsRef}
					loading={loading}
					error={error}
					playing={playing}
					showControls={showControls}
					currentTime={currentTime}
					duration={duration}
					currentAudioTrack={currentAudioTrack}
					currentSubtitleTrack={currentSubtitleTrack}
					isCurrentTranscoding={isCurrentTranscoding}
					skipOverlayVisible={skipOverlayVisible}
					showNextEpisodePrompt={showNextEpisodePrompt}
				/>

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
