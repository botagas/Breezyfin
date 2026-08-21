import {useEffect} from 'react';
import {buildMediaSegmentsLoadDiagnostic} from '../utils/playerDiagnostics';

export const usePlayerLifecycleEffects = ({
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
	appendPlaybackDiagnostic,
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
	focusPlayerWakeAction,
	playPauseButtonRef,
	loadRequestIdRef,
	playbackStartedRef,
	playbackRecoveryLedger,
	cancelTrackTransition
}) => {
	useEffect(() => {
		if (item) {
			playbackRecoveryLedger?.resetForItem(item.Id);
			playbackStartedRef.current = false;
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
			getMediaSegmentsForItem(item.Id, {
				itemRunTimeTicks: item.RunTimeTicks
			}).then((segments) => {
				setMediaSegments(segments);
				appendPlaybackDiagnostic?.(buildMediaSegmentsLoadDiagnostic({segments}));
			}).catch((error) => {
				setMediaSegments([]);
				appendPlaybackDiagnostic?.(buildMediaSegmentsLoadDiagnostic({error}));
			});
		}
		return () => {
			cancelTrackTransition?.();
			loadRequestIdRef.current += 1;
			playbackStartedRef.current = false;
			handleStop();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [item]);

	useEffect(() => {
		let hideTimer;
		if (showControls && playing && !showAudioPopup && !showSubtitlePopup) {
			hideTimer = setInterval(() => {
				const inactiveFor = Date.now() - lastInteractionRef.current;
				if (inactiveFor > 5000) {
					setShowControls(false);
				}
			}, 1000);
		}
		return () => clearInterval(hideTimer);
	}, [lastInteractionRef, playing, setShowControls, showAudioPopup, showControls, showSubtitlePopup]);

	useEffect(() => {
		if (!mediaSourceData || isCurrentTranscoding || !playing) return undefined;
		const interval = setInterval(() => {
			const now = Date.now();
			const last = lastProgressRef.current;
			if (playing && now - last.timestamp > 12000) {
				if (videoRef.current && Math.abs(videoRef.current.currentTime - last.time) < 0.5) {
					console.warn('[Player] Playback stall detected, attempting transcode fallback');
					attemptTranscodeFallback('Playback stalled');
				}
			}
		}, 5000);
		return () => clearInterval(interval);
	}, [attemptTranscodeFallback, isCurrentTranscoding, lastProgressRef, mediaSourceData, playing, videoRef]);

	useEffect(() => () => {
		if (skipFocusRetryTimerRef.current) {
			clearTimeout(skipFocusRetryTimerRef.current);
			skipFocusRetryTimerRef.current = null;
		}
	}, [skipFocusRetryTimerRef]);

	useEffect(() => () => {
		if (seekFeedbackTimerRef.current) {
			clearTimeout(seekFeedbackTimerRef.current);
			seekFeedbackTimerRef.current = null;
		}
	}, [seekFeedbackTimerRef]);

	useEffect(() => {
		let focusTimer = null;
		const becameVisible = skipOverlayVisible && !wasSkipOverlayVisibleRef.current;
		const becameHidden = !skipOverlayVisible && wasSkipOverlayVisibleRef.current;
		wasSkipOverlayVisibleRef.current = skipOverlayVisible;

		if (becameVisible) {
			focusTimer = setTimeout(() => {
				focusSkipOverlayAction();
			}, 20);
		} else if (becameHidden) {
			lastInteractionRef.current = Date.now();
			setShowControls(true);
			focusPlayerWakeAction();
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
	}, [
		focusPlayerWakeAction,
		focusSkipOverlayAction,
		lastInteractionRef,
		playPauseButtonRef,
		playing,
		setShowControls,
		showControls,
		skipOverlayVisible,
		wasSkipOverlayVisibleRef
	]);
};
