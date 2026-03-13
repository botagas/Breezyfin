import {useCallback} from 'react';

import {KeyCodes} from '../../../utils/keyCodes';

export const useMediaDetailsPrimaryActions = ({
	item,
	onPlay,
	onBack,
	playbackInfo,
	selectedAudioTrack,
	selectedSubtitleTrack,
	selectedEpisode,
	showEpisodePicker,
	closeEpisodePicker,
	showAudioPicker,
	closeAudioPicker,
	showSubtitlePicker,
	closeSubtitlePicker,
	openSeriesFromEpisode,
	handleToggleWatched,
	setIsCastCollapsed,
	isElegantTheme,
	hasOverviewOverflow,
	setOverviewExpanded
}) => {
	const handlePlay = useCallback(() => {
		const mediaSourceId = playbackInfo?.MediaSources?.[0]?.Id || null;
		const options = {mediaSourceId};
		if (Number.isInteger(selectedAudioTrack)) {
			options.audioStreamIndex = selectedAudioTrack;
		}
		if (selectedSubtitleTrack === -1 || Number.isInteger(selectedSubtitleTrack)) {
			options.subtitleStreamIndex = selectedSubtitleTrack;
		}

		if (item?.Type === 'Series') {
			if (selectedEpisode) {
				onPlay(selectedEpisode, options);
			} else {
				console.error('No episode selected');
			}
		} else {
			onPlay(item, options);
		}
	}, [item, onPlay, playbackInfo, selectedAudioTrack, selectedEpisode, selectedSubtitleTrack]);

	const handleBack = useCallback(() => {
		onBack();
	}, [onBack]);

	const handleInternalBack = useCallback(() => {
		if (showEpisodePicker) {
			closeEpisodePicker();
			return true;
		}
		if (showAudioPicker) {
			closeAudioPicker();
			return true;
		}
		if (showSubtitlePicker) {
			closeSubtitlePicker();
			return true;
		}
		handleBack();
		return true;
	}, [
		closeAudioPicker,
		closeEpisodePicker,
		closeSubtitlePicker,
		handleBack,
		showAudioPicker,
		showEpisodePicker,
		showSubtitlePicker
	]);

	const handleOpenEpisodeSeries = useCallback(() => {
		openSeriesFromEpisode(item?.SeasonId || null);
	}, [item?.SeasonId, openSeriesFromEpisode]);

	const handleToggleWatchedMain = useCallback(() => {
		handleToggleWatched();
	}, [handleToggleWatched]);

	const toggleCastCollapsed = useCallback(() => {
		setIsCastCollapsed((currentValue) => !currentValue);
	}, [setIsCastCollapsed]);

	const handleOverviewActivate = useCallback((event) => {
		if (!isElegantTheme || !hasOverviewOverflow) return;
		if (event?.type === 'keydown') {
			const code = event.keyCode || event.which;
			if (code !== KeyCodes.ENTER && code !== KeyCodes.OK && code !== KeyCodes.SPACE) return;
			event.preventDefault();
			event.stopPropagation();
		}
		setOverviewExpanded((currentValue) => !currentValue);
	}, [hasOverviewOverflow, isElegantTheme, setOverviewExpanded]);

	return {
		handlePlay,
		handleBack,
		handleInternalBack,
		handleOpenEpisodeSeries,
		handleToggleWatchedMain,
		toggleCastCollapsed,
		handleOverviewActivate
	};
};

