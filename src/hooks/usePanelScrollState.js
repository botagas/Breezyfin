import {useEffect} from 'react';

import {useCachedScrollTopState, useScrollerScrollMemory} from './useScrollerScrollMemory';

const hasCacheKey = (cacheKey) => cacheKey !== null && cacheKey !== undefined;

export const usePanelScrollState = ({
	cachedState = null,
	isActive = false,
	onCacheState = null,
	cacheKey = null,
	requireCacheKey = false
} = {}) => {
	const [scrollTop, setScrollTop] = useCachedScrollTopState(cachedState?.scrollTop);
	const {
		captureScrollTo,
		handleScrollStop
	} = useScrollerScrollMemory({
		isActive,
		scrollTop,
		onScrollTopChange: setScrollTop
	});

	useEffect(() => {
		if (typeof onCacheState !== 'function') return;
		if (!hasCacheKey(cacheKey)) {
			if (requireCacheKey) return;
			onCacheState({scrollTop});
			return;
		}
		onCacheState(cacheKey, {scrollTop});
	}, [cacheKey, onCacheState, requireCacheKey, scrollTop]);

	return {
		scrollTop,
		setScrollTop,
		captureScrollTo,
		handleScrollStop
	};
};
