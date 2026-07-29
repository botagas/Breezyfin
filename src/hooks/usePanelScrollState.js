import {useCallback, useEffect, useRef, useState} from 'react';

import {useCachedScrollTopState, useScrollerScrollMemory} from './useScrollerScrollMemory';

const hasCacheKey = (cacheKey) => cacheKey !== null && cacheKey !== undefined;

export const usePanelScrollState = ({
	cachedState = null,
	isActive = false,
	onCacheState = null,
	cacheKey = null,
	requireCacheKey = false,
	restoreAnimated = false,
	restoreReady = true,
	onRestoreComplete = null
} = {}) => {
	const [scrollTop, setScrollTopState] = useCachedScrollTopState(cachedState?.scrollTop);
	const [restoreRequestId, setRestoreRequestId] = useState(0);
	const cacheSnapshotRef = useRef(cachedState || {});
	useEffect(() => {
		if (cachedState && typeof cachedState === 'object') {
			cacheSnapshotRef.current = cachedState;
		}
	}, [cachedState]);
	const persistScrollTop = useCallback((rawTop) => {
		const nextTop = Number(rawTop);
		if (!Number.isFinite(nextTop)) return false;
		const normalizedTop = nextTop <= 0 ? 0 : nextTop;
		if (typeof onCacheState !== 'function') return true;
		const nextState = {
			...cacheSnapshotRef.current,
			scrollTop: normalizedTop
		};
		cacheSnapshotRef.current = nextState;
		if (!hasCacheKey(cacheKey)) {
			if (requireCacheKey) return true;
			onCacheState(nextState);
			return true;
		}
		onCacheState(cacheKey, nextState);
		return true;
	}, [cacheKey, onCacheState, requireCacheKey]);

	const commitScrollTop = useCallback((rawTop) => {
		const nextTop = Number(rawTop);
		if (!Number.isFinite(nextTop)) return false;
		const normalizedTop = nextTop <= 0 ? 0 : nextTop;
		setScrollTopState(normalizedTop);
		persistScrollTop(normalizedTop);
		return true;
	}, [persistScrollTop, setScrollTopState]);

	const requestScrollTop = useCallback((rawTop) => {
		const nextTop = Number(rawTop);
		if (!Number.isFinite(nextTop)) return false;
		const normalizedTop = nextTop <= 0 ? 0 : nextTop;
		setScrollTopState(normalizedTop);
		persistScrollTop(normalizedTop);
		setRestoreRequestId((requestId) => requestId + 1);
		return true;
	}, [persistScrollTop, setScrollTopState]);

	const {
		cancelScrollRestore,
		captureScrollTo,
		commitLatestScrollTop,
		handleScroll,
		handleScrollStop
	} = useScrollerScrollMemory({
		isActive,
		restoreAnimated,
		restoreReady,
		restoreRequestId,
		scrollTop,
		onRestoreComplete,
		onScrollTopChange: commitScrollTop,
		onScrollTopPersist: persistScrollTop
	});

	return {
		scrollTop,
		setScrollTop: requestScrollTop,
		commitScrollTop,
		commitLatestScrollTop,
		cancelScrollRestore,
		captureScrollTo,
		handleScroll,
		handleScrollStop
	};
};
