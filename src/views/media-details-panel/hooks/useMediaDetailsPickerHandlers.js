import {useCallback} from 'react';

export const useMediaDetailsPickerHandlers = ({
	playbackInfo,
	saveAudioSelection,
	saveSubtitleSelection,
	setSelectedAudioTrack,
	setSelectedSubtitleTrack,
	closeAudioPicker,
	closeSubtitlePicker,
	popupEpisodesById,
	handleEpisodeClick,
	onItemSelect,
	item,
	closeEpisodePicker
}) => {
	const handleTrackSelect = useCallback((event) => {
		const trackKey = Number(event.currentTarget.dataset.trackKey);
		if (!Number.isFinite(trackKey)) return;
		const mediaStreams = playbackInfo?.MediaSources?.[0]?.MediaStreams || [];
		const audioStreams = mediaStreams.filter((stream) => stream.Type === 'Audio');
		const subtitleStreams = mediaStreams.filter((stream) => stream.Type === 'Subtitle');
		if (event.currentTarget.dataset.trackType === 'audio') {
			setSelectedAudioTrack(trackKey);
			saveAudioSelection(trackKey, audioStreams);
			closeAudioPicker();
			return;
		}
		setSelectedSubtitleTrack(trackKey);
		saveSubtitleSelection(trackKey, subtitleStreams);
		closeSubtitlePicker();
	}, [
		closeAudioPicker,
		closeSubtitlePicker,
		playbackInfo,
		saveAudioSelection,
		saveSubtitleSelection,
		setSelectedAudioTrack,
		setSelectedSubtitleTrack
	]);

	const handleEpisodePopupSelect = useCallback((event) => {
		const episodeId = event.currentTarget.dataset.episodeId;
		const episode = popupEpisodesById.get(episodeId);
		if (!episode) return;
		const seriesSelectionMode = event.currentTarget.dataset.seriesMode === '1';
		if (seriesSelectionMode) {
			handleEpisodeClick(episode);
		} else if (onItemSelect) {
			onItemSelect(episode, item);
		}
		closeEpisodePicker();
	}, [closeEpisodePicker, handleEpisodeClick, item, onItemSelect, popupEpisodesById]);

	return {
		handleTrackSelect,
		handleEpisodePopupSelect
	};
};
