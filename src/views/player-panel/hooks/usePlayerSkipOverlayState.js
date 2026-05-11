import {useCallback} from 'react';
import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {readBreezyfinSettings} from '../../../utils/settingsStorage';

const isOutroSegmentType = (type) => type === 'Outro' || type === 'Credits';

const pickActiveSkipSegment = (mediaSegments, positionTicks) => {
	if (!Array.isArray(mediaSegments) || mediaSegments.length === 0) return null;
	const matchingSegments = mediaSegments.filter(
		(segment) => positionTicks >= segment.StartTicks && positionTicks < segment.EndTicks
	);
	if (matchingSegments.length === 0) return null;
	if (matchingSegments.length === 1) return matchingSegments[0];

	const ranked = [...matchingSegments].sort((left, right) => {
		const leftIsOutro = isOutroSegmentType(left?.Type);
		const rightIsOutro = isOutroSegmentType(right?.Type);
		if (leftIsOutro !== rightIsOutro) return leftIsOutro ? -1 : 1;

		const leftDuration = (left?.EndTicks || 0) - (left?.StartTicks || 0);
		const rightDuration = (right?.EndTicks || 0) - (right?.StartTicks || 0);
		if (leftDuration !== rightDuration) return leftDuration - rightDuration;

		return (right?.StartTicks || 0) - (left?.StartTicks || 0);
	});

	return ranked[0] || null;
};

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
	const resetSkipOverlayState = useCallback(({
		clearDismissedId = false,
		clearNextEpisodeDismissed = false
	} = {}) => {
		setSkipOverlayVisible(false);
		setCurrentSkipSegment(null);
		setSkipCountdown(null);
		setShowNextEpisodePrompt(false);
		nextEpisodePromptStartTicksRef.current = null;
		if (clearDismissedId) {
			setDismissedSkipSegmentId(null);
		}
		if (clearNextEpisodeDismissed) {
			setNextEpisodePromptDismissed(false);
		}
	}, [
		nextEpisodePromptStartTicksRef,
		setCurrentSkipSegment,
		setDismissedSkipSegmentId,
		setNextEpisodePromptDismissed,
		setShowNextEpisodePrompt,
		setSkipCountdown,
		setSkipOverlayVisible
	]);

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

		const positionTicks = positionSeconds * JELLYFIN_TICKS_PER_SECOND;
		const activeSegment = pickActiveSkipSegment(mediaSegments, positionTicks);

		if (activeSegment) {
			const isOutro = isOutroSegmentType(activeSegment.Type);
			if (!isOutro && dismissedSkipSegmentId === activeSegment.Id) {
				setCurrentSkipSegment(activeSegment);
				setShowNextEpisodePrompt(false);
				setSkipCountdown(null);
				return;
			}
			if (!isOutro && !skipSegmentPromptsEnabled) {
				resetSkipOverlayState();
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
			const remainingSeconds = Math.max(0, (activeSegment.EndTicks / JELLYFIN_TICKS_PER_SECOND) - positionSeconds);
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
				resetSkipOverlayState();
			}
		} else if (showNextEpisodePrompt) {
			const promptStartTicks = nextEpisodePromptStartTicksRef.current || 0;
			if (positionTicks < promptStartTicks) {
				resetSkipOverlayState();
			} else {
				if (!playNextPromptEnabled || (playNextPromptMode === 'segmentsOnly' && !currentSkipSegment)) {
					resetSkipOverlayState();
					return;
				}
				setSkipOverlayVisible(true);
				setSkipCountdown(null);
			}
		} else if (skipOverlayVisible) {
			resetSkipOverlayState({clearDismissedId: true});
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
		setShowNextEpisodePrompt,
		setSkipCountdown,
		setSkipOverlayVisible,
		showNextEpisodePrompt,
		skipOverlayVisible,
		resetSkipOverlayState
	]);

	const handleSkipSegment = useCallback(() => {
		if (showNextEpisodePrompt && nextEpisodeData) {
			handlePlayNextEpisode();
			return;
		}
		if (!currentSkipSegment) return;
		const isOutro = isOutroSegmentType(currentSkipSegment.Type);
		if (isOutro && nextEpisodeData) {
			handlePlayNextEpisode();
			return;
		}
		const skipTo = currentSkipSegment.EndTicks / JELLYFIN_TICKS_PER_SECOND;
		if (videoRef.current) {
			videoRef.current.currentTime = skipTo;
			setCurrentTime(skipTo);
		}
		setDismissedSkipSegmentId(currentSkipSegment.Id || null);
		resetSkipOverlayState({clearNextEpisodeDismissed: true});
	}, [
		currentSkipSegment,
		handlePlayNextEpisode,
		nextEpisodeData,
		setCurrentTime,
		setDismissedSkipSegmentId,
		resetSkipOverlayState,
		showNextEpisodePrompt,
		videoRef
	]);

	const handleDismissNextEpisodePrompt = useCallback(() => {
		resetSkipOverlayState();
		setNextEpisodePromptDismissed(true);
	}, [
		resetSkipOverlayState,
		setNextEpisodePromptDismissed,
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
