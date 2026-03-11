import {useCallback} from 'react';

export const usePlayerTrackPopupHandlers = ({
	handleAudioTrackChange,
	handleSubtitleTrackChange
}) => {
	const handleAudioTrackItemClick = useCallback((event) => {
		const trackIndex = Number(event.currentTarget.dataset.trackIndex);
		if (!Number.isFinite(trackIndex)) return;
		handleAudioTrackChange(trackIndex);
	}, [handleAudioTrackChange]);

	const handleSubtitleTrackItemClick = useCallback((event) => {
		const trackIndex = Number(event.currentTarget.dataset.trackIndex);
		if (!Number.isFinite(trackIndex)) return;
		handleSubtitleTrackChange(trackIndex);
	}, [handleSubtitleTrackChange]);

	return {
		handleAudioTrackItemClick,
		handleSubtitleTrackItemClick
	};
};
