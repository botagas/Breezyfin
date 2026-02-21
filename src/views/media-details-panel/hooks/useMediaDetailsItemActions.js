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
	const refreshSeriesEpisodes = useCallback(async () => {
		if (item?.Type !== 'Series' || !selectedSeason?.Id) return null;
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
		return updatedEpisodes;
	}, [item, selectedEpisode?.Id, selectedSeason?.Id, setEpisodes, setSelectedEpisode]);

	const handleToggleFavoriteById = useCallback(async (itemId, currentFavoriteState) => {
		const targetId = itemId || item?.Id;
		const targetFavoriteState = currentFavoriteState !== undefined ? currentFavoriteState : isFavorite;
		if (!targetId) return false;

		try {
			const newStatus = await jellyfinService.toggleFavorite(targetId, targetFavoriteState);
			if (targetId === item?.Id) {
				setIsFavorite(newStatus);
				const updated = await jellyfinService.getItem(item.Id);
				if (updated?.UserData) {
					setIsWatched(updated.UserData.Played || false);
				}
			} else if (item?.Type === 'Series' && selectedSeason?.Id) {
				await refreshSeriesEpisodes();
			}
			setToastMessage(newStatus ? 'Added to favorites' : 'Removed from favorites');
			return newStatus;
		} catch (error) {
			console.error('Failed to toggle favorite:', error);
			setToastMessage('Failed to update favorite');
			return false;
		}
	}, [
		isFavorite,
		item,
		refreshSeriesEpisodes,
		selectedSeason?.Id,
		setIsFavorite,
		setIsWatched,
		setToastMessage
	]);

	const handleToggleFavorite = useCallback(async () => {
		if (!item?.Id) return;
		await handleToggleFavoriteById(item.Id, isFavorite);
	}, [handleToggleFavoriteById, isFavorite, item?.Id]);

	const handleToggleWatched = useCallback(async (itemId, currentWatchedState) => {
		const targetId = itemId || item?.Id;
		const targetWatchedState = currentWatchedState !== undefined ? currentWatchedState : isWatched;

		if (!targetId) return;
		try {
			await jellyfinService.toggleWatched(targetId, targetWatchedState);

			if (!itemId || itemId === item?.Id) {
				setIsWatched(!targetWatchedState);
			}

			if (itemId && item?.Type === 'Series' && selectedSeason?.Id) {
				await refreshSeriesEpisodes();
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
		refreshSeriesEpisodes,
		selectedSeason?.Id,
		setIsWatched,
		setToastMessage
	]);

	return {
		handleToggleFavorite,
		handleToggleFavoriteById,
		handleToggleWatched
	};
};
