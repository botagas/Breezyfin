import {useEffect, useState} from 'react';
import jellyfinService from '../services/jellyfinService';

export const useItemMetadata = (itemId, options = {}) => {
	const {
		enabled = true,
		errorContext = 'item metadata'
	} = options;
	const [metadata, setMetadata] = useState(null);

	useEffect(() => {
		let cancelled = false;

		const loadMetadata = async () => {
			if (!enabled || !itemId) {
				setMetadata(null);
				return;
			}
			try {
				const detailedItem = await jellyfinService.getItem(itemId);
				if (!cancelled) {
					setMetadata(detailedItem || null);
				}
			} catch (error) {
				console.error(`Failed to load ${errorContext}:`, error);
				if (!cancelled) {
					setMetadata(null);
				}
			}
		};

		loadMetadata();
		return () => {
			cancelled = true;
		};
	}, [enabled, errorContext, itemId]);

	return metadata;
};
