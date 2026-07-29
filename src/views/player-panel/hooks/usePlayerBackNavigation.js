import {useCallback} from 'react';

export const usePlayerBackNavigation = ({
	hasPlaybackError,
	handleBackButton,
	showAudioPopup,
	closeAudioPopup,
	showSubtitlePopup,
	closeSubtitlePopup,
	skipOverlayVisible,
	handleDismissSkipOverlay,
	showControls,
	setShowControls,
	pausedScreensaverActive = false,
	dismissPausedScreensaver,
	handleSubtitlePromptBack,
	handleGroupSessionBack
}) => {
	const handleInternalBack = useCallback(() => {
		if (pausedScreensaverActive) {
			dismissPausedScreensaver?.();
			return true;
		}
		if (handleSubtitlePromptBack?.()) return true;
		if (handleGroupSessionBack?.()) return true;
		if (hasPlaybackError) {
			handleBackButton();
			return true;
		}
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
		handleBackButton();
		return true;
	}, [
		closeAudioPopup,
		closeSubtitlePopup,
		dismissPausedScreensaver,
		handleBackButton,
		handleDismissSkipOverlay,
		handleGroupSessionBack,
		handleSubtitlePromptBack,
		hasPlaybackError,
		pausedScreensaverActive,
		setShowControls,
		showAudioPopup,
		showControls,
		showSubtitlePopup,
		skipOverlayVisible
	]);

	return {
		handleInternalBack
	};
};
