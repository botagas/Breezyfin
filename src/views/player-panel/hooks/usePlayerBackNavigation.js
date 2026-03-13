import {useCallback} from 'react';

export const usePlayerBackNavigation = ({
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
		handleDismissSkipOverlay,
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

