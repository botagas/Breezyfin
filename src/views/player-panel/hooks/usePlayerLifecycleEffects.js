import {useEffect} from 'react';

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
}) => {
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
			getMediaSegmentsForItem(item.Id).then(setMediaSegments).catch(() => setMediaSegments([]));
		}
		return () => {
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
		if (!mediaSourceData || isCurrentTranscoding) return undefined;
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
	}, [focusSkipOverlayAction, playPauseButtonRef, playing, showControls, skipOverlayVisible, wasSkipOverlayVisibleRef]);
};
