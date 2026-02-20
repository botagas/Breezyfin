import {useEffect} from 'react';
import {KeyCodes} from '../utils/keyCodes';

const BACK_KEYS = [KeyCodes.BACK, KeyCodes.BACK_SOFT, KeyCodes.EXIT, KeyCodes.BACKSPACE, KeyCodes.ESC];
const SEEK_STEP_SECONDS = 15;
const PLAY_KEYS = [KeyCodes.ENTER, KeyCodes.OK, KeyCodes.SPACE, KeyCodes.MEDIA_PLAY_PAUSE];
const PLAY_ONLY_KEYS = [KeyCodes.PLAY];
const PAUSE_KEYS = [KeyCodes.PAUSE];

export const usePlayerKeyboardShortcuts = ({
	isActive,
	onUserInteraction,
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
}) => {
	useEffect(() => {
		if (!isActive) return undefined;

		const handleKeyDown = (event) => {
			const consumeEvent = () => {
				event.preventDefault?.();
				event.stopPropagation?.();
				event.stopImmediatePropagation?.();
				event.nativeEvent?.preventDefault?.();
				event.nativeEvent?.stopPropagation?.();
				event.nativeEvent?.stopImmediatePropagation?.();
			};

			onUserInteraction();
			const code = event.keyCode || event.which;

			if (
				showControls &&
				(code === KeyCodes.LEFT || code === KeyCodes.RIGHT) &&
				typeof isProgressSliderTarget === 'function' &&
				isProgressSliderTarget(event.target)
			) {
				consumeEvent();
				seekBySeconds(code === KeyCodes.LEFT ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS);
				return;
			}

			if ([KeyCodes.UP, KeyCodes.DOWN].includes(code) && !showControls) {
				event.preventDefault?.();
				setShowControls(true);
			}

			switch (code) {
				case KeyCodes.LEFT:
					if (showControls || skipOverlayVisible || showAudioPopup || showSubtitlePopup || !isSeekContext(event.target)) break;
					consumeEvent();
					seekBySeconds(-SEEK_STEP_SECONDS);
					break;
				case KeyCodes.RIGHT:
					if (showControls || skipOverlayVisible || showAudioPopup || showSubtitlePopup || !isSeekContext(event.target)) break;
					consumeEvent();
					seekBySeconds(SEEK_STEP_SECONDS);
					break;
				case KeyCodes.UP:
					event.preventDefault?.();
					if (skipOverlayVisible) {
						setShowControls(true);
						focusSkipOverlayAction();
						return;
					}
					setShowControls(true);
					break;
				case KeyCodes.DOWN:
					event.preventDefault?.();
					setShowControls(true);
					break;
				default:
					break;
			}

			if (BACK_KEYS.includes(code)) {
				consumeEvent();
				if (handleInternalBack()) return;
				handleBackButton();
				return;
			}

			if (PLAY_KEYS.includes(code)) {
				// Avoid double-trigger when an actual button is focused
				const activeElement = document.activeElement;
				const isControlFocused = controlsRef.current && activeElement && controlsRef.current.contains(activeElement);
				const isSkipFocused = skipOverlayRef.current && activeElement && skipOverlayRef.current.contains(activeElement);
				if (isControlFocused || isSkipFocused) {
					return;
				}
				consumeEvent();
				const keepHidden = !showControls;
				if (playing) {
					handlePause({keepHidden});
				} else {
					handlePlay({keepHidden});
				}
				return;
			}

			if (PLAY_ONLY_KEYS.includes(code)) {
				consumeEvent();
				handlePlay({keepHidden: !showControls});
				return;
			}

			if (PAUSE_KEYS.includes(code)) {
				consumeEvent();
				handlePause({keepHidden: !showControls});
			}
		};

		document.addEventListener('keydown', handleKeyDown, true);
		return () => document.removeEventListener('keydown', handleKeyDown, true);
	}, [
		controlsRef,
		focusSkipOverlayAction,
		handleBackButton,
		handleInternalBack,
		handlePause,
		handlePlay,
		isActive,
		isSeekContext,
		onUserInteraction,
		playing,
		isProgressSliderTarget,
		seekBySeconds,
		setShowControls,
		showAudioPopup,
		showControls,
		showSubtitlePopup,
		skipOverlayRef,
		skipOverlayVisible
	]);
};
