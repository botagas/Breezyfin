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
	setShowControls
}) => {
	const handleInternalBack = useCallback(() => {
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
		return false;
	}, [
		closeAudioPopup,
		closeSubtitlePopup,
		handleBackButton,
		handleDismissSkipOverlay,
		hasPlaybackError,
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
