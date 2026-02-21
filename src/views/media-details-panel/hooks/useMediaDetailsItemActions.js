import {useCallback} from 'react';
import jellyfinService from '../../../services/jellyfinService';

export const useMediaDetailsItemActions = ({
	item,
	isFavorite,
	isWatched,
	selectedSeason,
	selectedEpisode,
	setIsFavorite,
	setIsWatched,
	setEpisodes,
	setSelectedEpisode,
	setToastMessage
}) => {
	const handleToggleFavorite = useCallback(async () => {
		if (!item) return;
		try {
			const newStatus = await jellyfinService.toggleFavorite(item.Id, isFavorite);
			setIsFavorite(newStatus);
			const updated = await jellyfinService.getItem(item.Id);
			if (updated?.UserData) {
				setIsWatched(updated.UserData.Played || false);
			}
			setToastMessage(newStatus ? 'Added to favorites' : 'Removed from favorites');
		} catch (error) {
			console.error('Failed to toggle favorite:', error);
			setToastMessage('Failed to update favorite');
		}
	}, [isFavorite, item, setIsFavorite, setIsWatched, setToastMessage]);

	const handleToggleWatched = useCallback(async (itemId, currentWatchedState) => {
		const targetId = itemId || item?.Id;
		const targetWatchedState = currentWatchedState !== undefined ? currentWatchedState : isWatched;

		if (!targetId) return;
		try {
			await jellyfinService.toggleWatched(targetId, targetWatchedState);

			if (!itemId || itemId === item?.Id) {
				setIsWatched(!targetWatchedState);
			}

			if (itemId && item?.Type === 'Series' && selectedSeason) {
				const updatedEpisodes = await jellyfinService.getEpisodes(item.Id, selectedSeason.Id);
				setEpisodes(updatedEpisodes);
				if (selectedEpisode?.Id) {
					const refreshedSelectedEpisode = (updatedEpisodes || []).find(
						(episode) => episode.Id === selectedEpisode.Id
					);
					if (refreshedSelectedEpisode) {
						setSelectedEpisode(refreshedSelectedEpisode);
					}
				}
			} else {
				const refreshed = await jellyfinService.getItem(targetId);
				if (refreshed?.UserData && (!itemId || itemId === item?.Id)) {
					setIsWatched(refreshed.UserData.Played || false);
				}
			}
			setToastMessage(!targetWatchedState ? 'Marked as watched' : 'Marked as unwatched');
		} catch (error) {
			console.error('Error toggling watched status:', error);
			setToastMessage('Failed to update watched status');
		}
	}, [
		isWatched,
		item,
		selectedEpisode?.Id,
		selectedSeason,
		setEpisodes,
		setIsWatched,
		setSelectedEpisode,
		setToastMessage
	]);

	return {
		handleToggleFavorite,
		handleToggleWatched
	};
};
