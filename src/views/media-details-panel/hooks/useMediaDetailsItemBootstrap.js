import {useEffect} from 'react';

export const useMediaDetailsItemBootstrap = ({
	item,
	playbackInfoRequestRef,
	episodesRequestRef,
	seasonsRequestRef,
	setPlaybackInfo,
	applyDefaultTracks,
	loadPlaybackInfo,
	loadSeasons,
	setSeasons,
	setEpisodes,
	setSelectedSeason,
	setSelectedEpisode,
	setIsFavorite,
	setIsWatched,
	setIsWatchlisted
}) => {
	useEffect(() => {
		playbackInfoRequestRef.current += 1;
		episodesRequestRef.current += 1;
		seasonsRequestRef.current += 1;
		setPlaybackInfo(null);
		applyDefaultTracks(null);
		loadPlaybackInfo();
		if (item?.Type === 'Series') {
			loadSeasons();
		} else {
			setSeasons([]);
			setEpisodes([]);
			setSelectedSeason(null);
			setSelectedEpisode(null);
		}
		setIsFavorite(Boolean(item?.UserData?.IsFavorite));
		setIsWatched(Boolean(item?.UserData?.Played));
		setIsWatchlisted(item?.UserData?.Likes === true);
	}, [
		applyDefaultTracks,
		episodesRequestRef,
		item,
		loadPlaybackInfo,
		loadSeasons,
		playbackInfoRequestRef,
		seasonsRequestRef,
		setEpisodes,
		setIsFavorite,
		setIsWatched,
		setIsWatchlisted,
		setPlaybackInfo,
		setSeasons,
		setSelectedEpisode,
		setSelectedSeason
	]);
};
