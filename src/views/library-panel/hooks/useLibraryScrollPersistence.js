import {useCallback, useEffect, useRef} from 'react';

const SCROLL_LOAD_MORE_THRESHOLD_PX = 240;
const SCROLL_CACHE_COMMIT_DELAY_MS = 120;
const RESTORE_SCROLL_ANIMATION_MS = 260;

export const useLibraryScrollPersistence = ({
	scrollerRef,
	isActive = false,
	activeLibraryId = null,
	loading = true,
	hasMore = false,
	loadNextPage,
	scrollTop = 0,
	setScrollTop
}) => {
	const scrollCommitTimerRef = useRef(null);
	const scrollCommitRafRef = useRef(null);
	const pendingScrollTopRef = useRef(0);
	const shouldRestoreScrollRef = useRef(true);
	const restoreTargetScrollTopRef = useRef(0);
	const previousActiveRef = useRef(isActive);

	const clearScrollCommitTimer = useCallback(() => {
		if (scrollCommitTimerRef.current) {
			clearTimeout(scrollCommitTimerRef.current);
			scrollCommitTimerRef.current = null;
		}
	}, []);

	const clearScrollCommitRaf = useCallback(() => {
		if (typeof window === 'undefined') return;
		if (scrollCommitRafRef.current !== null) {
			window.cancelAnimationFrame(scrollCommitRafRef.current);
			scrollCommitRafRef.current = null;
		}
	}, []);

	const flushScrollTopToCache = useCallback((preferPending = false) => {
		clearScrollCommitTimer();
		clearScrollCommitRaf();
		const currentTop = scrollerRef.current?.scrollTop;
		const nextTop = preferPending
			? pendingScrollTopRef.current
			: (Number.isFinite(Number(currentTop)) ? Number(currentTop) : pendingScrollTopRef.current);
		setScrollTop(nextTop > 0 ? nextTop : 0);
	}, [clearScrollCommitRaf, clearScrollCommitTimer, scrollerRef, setScrollTop]);

	const scheduleScrollTopCacheCommit = useCallback(() => {
		clearScrollCommitTimer();
		scrollCommitTimerRef.current = setTimeout(() => {
			scrollCommitTimerRef.current = null;
			if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
				if (scrollCommitRafRef.current !== null) return;
				scrollCommitRafRef.current = window.requestAnimationFrame(() => {
					scrollCommitRafRef.current = null;
					setScrollTop(pendingScrollTopRef.current || 0);
				});
				return;
			}
			setScrollTop(pendingScrollTopRef.current || 0);
		}, SCROLL_CACHE_COMMIT_DELAY_MS);
	}, [clearScrollCommitTimer, setScrollTop]);

	const commitCurrentScrollNow = useCallback(() => {
		const currentTop = scrollerRef.current?.scrollTop;
		if (Number.isFinite(Number(currentTop))) {
			const normalizedTop = Number(currentTop) > 0 ? Number(currentTop) : 0;
			pendingScrollTopRef.current = normalizedTop;
			setScrollTop(normalizedTop);
			return normalizedTop;
		}
		return 0;
	}, [scrollerRef, setScrollTop]);

	const handleScrollerScroll = useCallback((event) => {
		const container = event?.currentTarget;
		if (!container) return;
		pendingScrollTopRef.current = container.scrollTop || 0;
		scheduleScrollTopCacheCommit();
		const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
		if (remaining <= SCROLL_LOAD_MORE_THRESHOLD_PX) {
			loadNextPage();
		}
	}, [loadNextPage, scheduleScrollTopCacheCommit]);

	useEffect(() => {
		const normalizedTarget = Number.isFinite(Number(scrollTop)) ? Number(scrollTop) : 0;
		restoreTargetScrollTopRef.current = normalizedTarget > 0 ? normalizedTarget : 0;
	}, [scrollTop]);

	useEffect(() => {
		shouldRestoreScrollRef.current = true;
	}, [activeLibraryId]);

	useEffect(() => {
		if (isActive && !previousActiveRef.current) {
			shouldRestoreScrollRef.current = true;
		}
		previousActiveRef.current = isActive;
	}, [isActive]);

	useEffect(() => {
		if (!isActive || loading || !shouldRestoreScrollRef.current) return;
		const container = scrollerRef.current;
		if (!container) return;
		const targetTop = restoreTargetScrollTopRef.current;
		const maxReachableTop = Math.max(0, container.scrollHeight - container.clientHeight);
		const needsMoreContentForRestore = targetTop > maxReachableTop + 1;

		if (needsMoreContentForRestore && hasMore) {
			loadNextPage();
			if (container.scrollTop !== maxReachableTop) {
				container.scrollTop = maxReachableTop;
			}
			return;
		}

		const finalTargetTop = needsMoreContentForRestore ? maxReachableTop : targetTop;
		if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
			window.requestAnimationFrame(() => {
				const nextTop = finalTargetTop > 0 ? finalTargetTop : 0;
				if (nextTop > 0 && typeof container.scrollTo === 'function') {
					container.scrollTo({top: nextTop, behavior: 'smooth'});
				} else {
					container.scrollTop = nextTop;
				}
				if (nextTop > 0 && typeof window !== 'undefined') {
					window.setTimeout(() => {
						if (scrollerRef.current) {
							scrollerRef.current.scrollTop = nextTop;
						}
					}, RESTORE_SCROLL_ANIMATION_MS);
				}
			});
		} else {
			container.scrollTop = finalTargetTop > 0 ? finalTargetTop : 0;
		}
		pendingScrollTopRef.current = finalTargetTop > 0 ? finalTargetTop : 0;
		shouldRestoreScrollRef.current = false;
	}, [hasMore, isActive, loadNextPage, loading, scrollerRef]);

	useEffect(() => {
		if (isActive) return;
		flushScrollTopToCache(true);
	}, [flushScrollTopToCache, isActive]);

	useEffect(() => () => {
		flushScrollTopToCache(true);
		clearScrollCommitTimer();
		clearScrollCommitRaf();
	}, [clearScrollCommitRaf, clearScrollCommitTimer, flushScrollTopToCache]);

	return {
		handleScrollerScroll,
		commitCurrentScrollNow
	};
};

