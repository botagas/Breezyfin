import {useCallback} from 'react';
import Spotlight from '@enact/spotlight';

import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';

export const usePlayerCoreControls = ({
	item,
	videoRef,
	hlsRef,
	nativeHlsFallbackCleanupRef,
	playbackSessionRef,
	startupDeadlineTimerRef,
	videoMountRetryTimerRef,
	nativeSourceTokenRef,
	playbackRuntimeContextRef,
	onPlaybackSourceInvalidated,
	stopProgressReporting,
	reportPlaybackStopped,
	skipFocusRetryTimerRef,
	skipButtonRef,
	skipOverlayRef,
	playPauseButtonRef
}) => {
	const clearStartupDeadline = useCallback(() => {
		if (startupDeadlineTimerRef.current) {
			clearTimeout(startupDeadlineTimerRef.current);
			startupDeadlineTimerRef.current = null;
		}
	}, [startupDeadlineTimerRef]);

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

	const focusPlayerWakeAction = useCallback(({preferSkip = false} = {}) => {
		if (preferSkip) {
			focusSkipOverlayAction();
			return;
		}
		if (skipFocusRetryTimerRef.current) {
			clearTimeout(skipFocusRetryTimerRef.current);
			skipFocusRetryTimerRef.current = null;
		}

		let attempts = 0;
		const maxAttempts = 10;
		const tryFocus = () => {
			Spotlight.focus('player-primary-playback-action');
			const target = playPauseButtonRef.current?.nodeRef?.current || playPauseButtonRef.current;
			target?.focus?.({preventScroll: true});
			const focused = target && (
				document.activeElement === target || target.contains?.(document.activeElement)
			);
			if (!focused && attempts < maxAttempts) {
				attempts += 1;
				skipFocusRetryTimerRef.current = setTimeout(tryFocus, 40);
			} else {
				skipFocusRetryTimerRef.current = null;
			}
		};
		tryFocus();
	}, [focusSkipOverlayAction, playPauseButtonRef, skipFocusRetryTimerRef]);

	const handleStop = useCallback(async () => {
		const video = videoRef.current;
		const positionTicks = video && item
			? Math.floor(video.currentTime * JELLYFIN_TICKS_PER_SECOND)
			: 0;
		if (videoMountRetryTimerRef.current) {
			clearTimeout(videoMountRetryTimerRef.current);
			videoMountRetryTimerRef.current = null;
		}
		stopProgressReporting();
		clearStartupDeadline();
		if (typeof nativeHlsFallbackCleanupRef?.current === 'function') {
			nativeHlsFallbackCleanupRef.current();
		}

		if (hlsRef.current) {
			try {
				hlsRef.current.destroy();
			} catch (error) {
				console.warn('Error destroying HLS instance:', error);
			}
			hlsRef.current = null;
		}

		if (video) {
			try {
				video.pause();
			} catch (_) {
				// Ignore native pause failures during teardown.
			}
			video.removeAttribute('src');
			video.load();
		}
		nativeSourceTokenRef.current = null;
		playbackRuntimeContextRef.current = null;
		onPlaybackSourceInvalidated?.();
		if (item) {
			reportPlaybackStopped({positionTicks});
		}
		playbackSessionRef.current = {
			playSessionId: null,
			mediaSourceId: null,
			playMethod: 'DirectStream'
		};
	}, [
		clearStartupDeadline,
		hlsRef,
		item,
		nativeSourceTokenRef,
		nativeHlsFallbackCleanupRef,
		onPlaybackSourceInvalidated,
		playbackSessionRef,
		playbackRuntimeContextRef,
		reportPlaybackStopped,
		stopProgressReporting,
		videoMountRetryTimerRef,
		videoRef
	]);

	return {
		clearStartupDeadline,
		focusPlayerWakeAction,
		focusSkipOverlayAction,
		handleStop
	};
};
