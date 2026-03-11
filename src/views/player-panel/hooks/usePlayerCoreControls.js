import {useCallback} from 'react';
import Spotlight from '@enact/spotlight';

import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import jellyfinService from '../../../services/jellyfinService';

export const usePlayerCoreControls = ({
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
}) => {
	const clearStartWatch = useCallback(() => {
		if (startWatchTimerRef.current) {
			clearTimeout(startWatchTimerRef.current);
			startWatchTimerRef.current = null;
		}
		if (failStartTimerRef.current) {
			clearTimeout(failStartTimerRef.current);
			failStartTimerRef.current = null;
		}
	}, [failStartTimerRef, startWatchTimerRef]);

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
				target.focus({preventScroll: true});
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
	}, [skipButtonRef, skipFocusRetryTimerRef, skipOverlayRef]);

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
			} catch (error) {
				console.warn('Error destroying HLS instance:', error);
			}
			hlsRef.current = null;
		}

		if (videoRef.current && item) {
			const positionTicks = Math.floor(videoRef.current.currentTime * JELLYFIN_TICKS_PER_SECOND);
			try {
				await jellyfinService.reportPlaybackStopped(item.Id, positionTicks, getPlaybackSessionContext());
			} catch (error) {
				console.warn('Failed to report playback stopped:', error);
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
	}, [
		clearStartWatch,
		getPlaybackSessionContext,
		hlsRef,
		item,
		playbackSessionRef,
		progressIntervalRef,
		startupFallbackTimerRef,
		videoRef
	]);

	return {
		clearStartWatch,
		focusSkipOverlayAction,
		handleStop
	};
};
