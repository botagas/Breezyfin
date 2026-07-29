import {useCallback, useEffect, useRef, useState} from 'react';
import jellyfinService from '../services/jellyfinService';
import {usePluginMediaItemActivation} from './usePluginMediaItemActivation';

export const usePluginMediaItemPopup = ({onItemSelect, isActive}) => {
	const [externalItem, setExternalItem] = useState(null);
	const [externalItemOpen, setExternalItemOpen] = useState(false);
	const detailGenerationRef = useRef(0);
	useEffect(() => {
		detailGenerationRef.current += 1;
		return () => {
			detailGenerationRef.current += 1;
		};
	}, [isActive]);
	const handleExternalItem = useCallback((item) => {
		const generation = detailGenerationRef.current + 1;
		detailGenerationRef.current = generation;
		setExternalItem(item);
		setExternalItemOpen(true);
		if (!item?.IsDiscoveryItem) return;
		jellyfinService.getDiscoveryDetails(item)
			.then((response) => {
				if (!isActive || generation !== detailGenerationRef.current || response?.available !== true) return;
				setExternalItem((current) => (
					current?.Id === item.Id
						? {...current, ...response.result, IsDiscoveryItem: true}
						: current
				));
			})
			.catch(() => {
				// Optional detail enrichment must not make a compact feed item unusable.
			});
	}, [isActive]);
	const activateItem = usePluginMediaItemActivation({
		onItemSelect,
		onExternalItem: handleExternalItem,
		isActive
	});
	const closeExternalItem = useCallback(() => setExternalItemOpen(false), []);
	const clearExternalItem = useCallback(() => {
		detailGenerationRef.current += 1;
		setExternalItem(null);
	}, []);

	return {activateItem, externalItem, externalItemOpen, closeExternalItem, clearExternalItem};
};
