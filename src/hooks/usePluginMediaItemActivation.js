import {useCallback, useEffect, useRef} from 'react';
import jellyfinService from '../services/jellyfinService';

const LINKED_ITEM_UNAVAILABLE_MESSAGE = 'The linked Jellyfin item is no longer available to this user.';

export const usePluginMediaItemActivation = ({
	onItemSelect,
	onExternalItem,
	onUnavailable,
	isActive = true
}) => {
	const requestGenerationRef = useRef(0);
	useEffect(() => {
		requestGenerationRef.current += 1;
		return () => {
			requestGenerationRef.current += 1;
		};
	}, [isActive]);

	return useCallback(async (item) => {
		if (!isActive) return;
		const generation = requestGenerationRef.current + 1;
		requestGenerationRef.current = generation;
		if (item.CanPlay && item.JellyfinItemId) {
			try {
				const linkedItem = await jellyfinService.getItem(item.JellyfinItemId);
				if (!isActive || generation !== requestGenerationRef.current) return;
				if (linkedItem) {
					onItemSelect(linkedItem);
					return;
				}
				throw new Error('Linked Jellyfin item was not found.');
			} catch (error) {
				if (!isActive || generation !== requestGenerationRef.current) return;
				onUnavailable?.(LINKED_ITEM_UNAVAILABLE_MESSAGE, {error, item});
			}
			return;
		}
		onExternalItem(item);
	}, [isActive, onExternalItem, onItemSelect, onUnavailable]);
};
