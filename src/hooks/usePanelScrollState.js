import {useCallback, useEffect} from 'react';

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

	const commitScrollTop = useCallback((rawTop) => {
		const nextTop = Number(rawTop);
		if (!Number.isFinite(nextTop)) return false;
		const normalizedTop = nextTop <= 0 ? 0 : nextTop;
		setScrollTop(normalizedTop);
		if (typeof onCacheState !== 'function') return true;
		if (!hasCacheKey(cacheKey)) {
			if (requireCacheKey) return true;
			onCacheState({scrollTop: normalizedTop});
			return true;
		}
		onCacheState(cacheKey, {scrollTop: normalizedTop});
		return true;
	}, [cacheKey, onCacheState, requireCacheKey, setScrollTop]);

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
		commitScrollTop,
		captureScrollTo,
		handleScrollStop
	};
};
