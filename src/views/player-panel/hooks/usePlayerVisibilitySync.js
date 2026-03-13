import {useEffect} from 'react';

export const usePlayerVisibilitySync = ({
	requestedControlsVisible,
	onControlsVisibilityChange,
	showControls,
	setShowControls
}) => {
	useEffect(() => {
		if (typeof requestedControlsVisible !== 'boolean') return;
		setShowControls((current) => (
			current === requestedControlsVisible ? current : requestedControlsVisible
		));
	}, [requestedControlsVisible, setShowControls]);

	useEffect(() => {
		if (typeof onControlsVisibilityChange !== 'function') return;
		onControlsVisibilityChange(showControls);
	}, [onControlsVisibilityChange, showControls]);
};
