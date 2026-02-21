import {useCallback} from 'react';
import {readBreezyfinSettings} from '../../../utils/settingsStorage';

export const usePlayerSkipOverlayState = ({
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
}) => {
	const checkSkipSegments = useCallback((positionSeconds) => {
		if (!Number.isFinite(positionSeconds)) return;
		let skipSegmentPromptsEnabled = true;
		let playNextPromptEnabled = true;
		let playNextPromptMode = 'segmentsOrLast60';

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
	}, [
		currentSkipSegment,
		dismissedSkipSegmentId,
		duration,
		mediaSegments,
		nextEpisodeData,
		nextEpisodePromptDismissed,
		nextEpisodePromptStartTicksRef,
		setCurrentSkipSegment,
		setDismissedSkipSegmentId,
		setShowNextEpisodePrompt,
		setSkipCountdown,
		setSkipOverlayVisible,
		showNextEpisodePrompt,
		skipOverlayVisible
	]);

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
	}, [
		currentSkipSegment,
		handlePlayNextEpisode,
		nextEpisodeData,
		nextEpisodePromptStartTicksRef,
		setCurrentSkipSegment,
		setCurrentTime,
		setDismissedSkipSegmentId,
		setNextEpisodePromptDismissed,
		setShowNextEpisodePrompt,
		setSkipCountdown,
		setSkipOverlayVisible,
		showNextEpisodePrompt,
		videoRef
	]);

	const handleDismissNextEpisodePrompt = useCallback(() => {
		setShowNextEpisodePrompt(false);
		setSkipOverlayVisible(false);
		setCurrentSkipSegment(null);
		setSkipCountdown(null);
		setNextEpisodePromptDismissed(true);
		nextEpisodePromptStartTicksRef.current = null;
	}, [
		nextEpisodePromptStartTicksRef,
		setCurrentSkipSegment,
		setNextEpisodePromptDismissed,
		setShowNextEpisodePrompt,
		setSkipCountdown,
		setSkipOverlayVisible
	]);

	const handleDismissSkipOverlay = useCallback(() => {
		if (showNextEpisodePrompt) {
			handleDismissNextEpisodePrompt();
			return;
		}
		setDismissedSkipSegmentId(currentSkipSegment?.Id || null);
		setSkipOverlayVisible(false);
		setSkipCountdown(null);
	}, [
		currentSkipSegment?.Id,
		handleDismissNextEpisodePrompt,
		setDismissedSkipSegmentId,
		setSkipCountdown,
		setSkipOverlayVisible,
		showNextEpisodePrompt
	]);

	return {
		checkSkipSegments,
		handleSkipSegment,
		handleDismissNextEpisodePrompt,
		handleDismissSkipOverlay
	};
};
