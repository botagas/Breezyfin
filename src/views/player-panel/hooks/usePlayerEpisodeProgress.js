import {useCallback, useEffect, useState} from 'react';

import jellyfinService from '../../../services/jellyfinService';
import {getNextEpisodeForItem, getPreviousEpisodeForItem} from '../utils/episodeNavigation';

export const usePlayerEpisodeProgress = ({
	item
}) => {
	const [hasNextEpisode, setHasNextEpisode] = useState(false);
	const [hasPreviousEpisode, setHasPreviousEpisode] = useState(false);
	const [nextEpisodeData, setNextEpisodeData] = useState(null);

	const getNextEpisode = useCallback(async (currentItem) => {
		return getNextEpisodeForItem(jellyfinService, currentItem);
	}, []);

	const getPreviousEpisode = useCallback(async (currentItem) => {
		return getPreviousEpisodeForItem(jellyfinService, currentItem);
	}, []);

	useEffect(() => {
		let cancelled = false;
		const checkAdjacentEpisodes = async () => {
			if (!item || item.Type !== 'Episode') {
				if (!cancelled) {
					setHasNextEpisode(false);
					setHasPreviousEpisode(false);
					setNextEpisodeData(null);
				}
				return;
			}
			try {
				const [nextEpisode, previousEpisode] = await Promise.all([
					getNextEpisode(item),
					getPreviousEpisode(item)
				]);
				if (!cancelled) {
					setHasNextEpisode(Boolean(nextEpisode));
					setHasPreviousEpisode(Boolean(previousEpisode));
					setNextEpisodeData(nextEpisode || null);
				}
			} catch (error) {
				console.error('Failed to check adjacent episodes:', error);
				if (!cancelled) {
					setHasNextEpisode(false);
					setHasPreviousEpisode(false);
					setNextEpisodeData(null);
				}
			}
		};

		checkAdjacentEpisodes();
		return () => {
			cancelled = true;
		};
	}, [getNextEpisode, getPreviousEpisode, item]);

	return {
		hasNextEpisode,
		hasPreviousEpisode,
		nextEpisodeData,
		getNextEpisode,
		getPreviousEpisode
	};
};
