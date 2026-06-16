import {useCallback, useEffect, useRef, useState} from 'react';
import {Panel, Header} from '../components/BreezyPanels';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import Toolbar from '../components/Toolbar';
import MediaFilterControls from '../components/MediaFilterControls';
import PanelPosterMediaCard from '../components/PanelPosterMediaCard';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import Spotlight from '@enact/spotlight';
import jellyfinService from '../services/jellyfinService';
import {useMapById} from '../hooks/useMapById';
import {usePanelToolbarActions} from '../hooks/usePanelToolbarActions';
import {usePanelScrollState} from '../hooks/usePanelScrollState';
import {useMediaFilterState} from '../hooks/useMediaFilterState';
import {useLibraryScrollPersistence} from './library-panel/hooks/useLibraryScrollPersistence';
import {HOME_SECTION_IDS, getHomeSectionDescriptor} from '../constants/homeSections';
import {MEDIA_GRID_PAGE_SIZE} from '../constants/pagination';
import {focusTargetFromRightMostGridItem, shouldLoadMoreFromGridFocus} from '../utils/gridFocus';
import {getPanelPosterCardClassProps} from '../utils/posterCardClassProps';
import {getJellyfinUsername} from '../utils/jellyfinUser';
import {
	MEDIA_FILTER_OPTIONS,
	mediaItemMatchesFilters
} from '../utils/mediaFilters';
import {buildMediaListItemKey} from '../utils/reactKeys';

import css from './LibraryPanel.module.less';

const PAGE_SIZE = MEDIA_GRID_PAGE_SIZE;
const FOCUS_PREFETCH_THRESHOLD = 12;
const FILTERED_PAGE_SCAN_MULTIPLIER = 4;
const FILTERED_PAGE_SCAN_LIMIT = 6;

const fetchHomeSectionPage = async (sectionId, {
	limit = PAGE_SIZE,
	startIndex = 0
} = {}) => {
	switch (sectionId) {
		case HOME_SECTION_IDS.RECENTLY_ADDED:
			return jellyfinService.getRecentlyAdded(limit, startIndex);
		case HOME_SECTION_IDS.CONTINUE_WATCHING:
			return jellyfinService.getResumeItems(limit, startIndex);
		case HOME_SECTION_IDS.NEXT_UP:
			return jellyfinService.getNextUp(limit, startIndex);
		case HOME_SECTION_IDS.LATEST_MOVIES:
			return jellyfinService.getLatestMedia(['Movie'], limit, startIndex);
		case HOME_SECTION_IDS.LATEST_SHOWS:
			return jellyfinService.getLatestMedia(['Series'], limit, startIndex);
		case HOME_SECTION_IDS.MY_REQUESTS: {
			const userName = jellyfinService.username || (await jellyfinService.getCurrentUser())?.Name || '';
			return jellyfinService.getMyRequests(null, ['Movie', 'Series'], limit, startIndex, userName);
		}
		default:
			return [];
	}
};

const HomeSectionPanel = ({
	section,
	onItemSelect,
	onNavigate,
	onSwitchUser,
	onLogout,
	onExit,
	registerBackHandler,
	isActive = false,
	cachedState = null,
	onCacheState = null,
	inputMode = '5way',
	...rest
}) => {
	const activeSection = getHomeSectionDescriptor(section?.id || section);
	const activeSectionId = activeSection?.id || null;
	const isPointerInputMode = inputMode === 'pointer';
	const scrollerRef = useRef(null);
	const panelRootRef = useRef(null);
	const requestIdRef = useRef(0);
	const loadingMoreRef = useRef(false);
	const commitCurrentScrollNowRef = useRef(null);
	const setScrollTopRef = useRef(null);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [items, setItems] = useState([]);
	const [error, setError] = useState('');
	const nextStartIndexRef = useRef(0);
	const handleFilterApply = useCallback(() => {
		commitCurrentScrollNowRef.current?.();
		setScrollTopRef.current?.(0);
		nextStartIndexRef.current = 0;
	}, []);
	const {
		draftFilterIds,
		filterPopupOpen,
		filterPopupContentRef,
		activeFilterCount,
		filterState,
		cacheStateWithFilters,
		openFilterPopup,
		closeFilterPopup,
		resetDraftFilters,
		selectDraftFilter,
		applyDraftFilters
	} = useMediaFilterState({
		cachedState,
		resetKey: activeSectionId,
		onCacheState,
		triggerSpotlightId: 'home-section-filter-trigger',
		onApplyFilters: handleFilterApply
	});
	const {
		scrollTop,
		setScrollTop
	} = usePanelScrollState({
		cachedState,
		isActive,
		onCacheState: cacheStateWithFilters,
		cacheKey: activeSectionId,
		requireCacheKey: true
	});
	const toolbarActions = usePanelToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		isActive,
		onPanelBack: () => {
			if (!filterPopupOpen) return false;
			closeFilterPopup();
			return true;
		}
	});
	const panelCardClasses = getPanelPosterCardClassProps(css);
	const itemsById = useMapById(items);
	const hasActiveFilters = activeFilterCount > 0;

	const fetchFilteredHomeSectionPage = useCallback(async ({
		startIndex = 0,
		requestId,
		currentFilterState
	}) => {
		if (activeSectionId === HOME_SECTION_IDS.MY_REQUESTS) {
			const requestUserName = await getJellyfinUsername(jellyfinService);
			let requestCursor = startIndex;
			let requestCollected = [];
			let requestScans = 0;
			let requestSourceHasMore = true;
			while (requestCollected.length < PAGE_SIZE && requestScans < FILTERED_PAGE_SCAN_LIMIT && requestSourceHasMore) {
				const result = await jellyfinService.getMyRequests(
					null,
					['Movie', 'Series'],
					PAGE_SIZE - requestCollected.length,
					requestCursor,
					requestUserName
				);
				if (requestId !== requestIdRef.current) {
					return {items: [], nextStartIndex: requestCursor, hasMore: false};
				}
				const safeItems = Array.isArray(result?.items) ? result.items : [];
				const nextStartIndex = Number(result?.nextStartIndex);
				const resolvedNextStartIndex = Number.isFinite(nextStartIndex)
					? Math.max(0, Math.trunc(nextStartIndex))
					: requestCursor + safeItems.length;
				if (resolvedNextStartIndex <= requestCursor && safeItems.length === 0) {
					requestSourceHasMore = false;
					break;
				}
				requestCollected = [
					...requestCollected,
					...safeItems.filter((item) => mediaItemMatchesFilters(item, {
						...currentFilterState,
						useMyRequestsSource: false,
						username: requestUserName
					}))
				];
				requestCursor = resolvedNextStartIndex;
				requestSourceHasMore = result?.hasMore === true;
				requestScans += 1;
			}
			return {
				items: requestCollected.slice(0, PAGE_SIZE),
				nextStartIndex: requestCursor,
				hasMore: requestSourceHasMore
			};
		}

		let cursor = startIndex;
		let collected = [];
		let scans = 0;
		let sourceHasMore = true;
		const rawLimit = PAGE_SIZE * FILTERED_PAGE_SCAN_MULTIPLIER;
		const userName = currentFilterState.useMyRequestsSource ? await getJellyfinUsername(jellyfinService) : '';

		while (collected.length < PAGE_SIZE && scans < FILTERED_PAGE_SCAN_LIMIT && sourceHasMore) {
			const rawPage = await fetchHomeSectionPage(activeSectionId, {
				limit: rawLimit,
				startIndex: cursor
			});
			if (requestId !== requestIdRef.current) {
				return {items: [], nextStartIndex: cursor, hasMore: false};
			}
			const safeItems = Array.isArray(rawPage) ? rawPage : [];
			if (safeItems.length === 0) {
				sourceHasMore = false;
				break;
			}
			cursor += safeItems.length;
			collected = [
				...collected,
				...safeItems.filter((item) => mediaItemMatchesFilters(item, {
					...currentFilterState,
					username: userName
				}))
			];
			sourceHasMore = safeItems.length >= rawLimit;
			scans += 1;
		}

		return {
			items: collected.slice(0, PAGE_SIZE),
			nextStartIndex: cursor,
			hasMore: sourceHasMore
		};
	}, [activeSectionId]);

	const loadPage = useCallback(async ({
		startIndex = 0,
		append = false
	} = {}) => {
		if (!activeSectionId) return;
		const requestId = append ? requestIdRef.current : requestIdRef.current + 1;
		if (!append) {
			requestIdRef.current = requestId;
			setLoading(true);
			setItems([]);
			setHasMore(false);
		}
		setError('');
		try {
			const pageResult = hasActiveFilters
				? await fetchFilteredHomeSectionPage({
					startIndex,
					requestId,
					currentFilterState: filterState
				})
				: await fetchHomeSectionPage(activeSectionId, {
					limit: PAGE_SIZE,
					startIndex
				});
			if (requestId !== requestIdRef.current) return;
			const safeItems = Array.isArray(pageResult)
				? pageResult
				: Array.isArray(pageResult?.items)
					? pageResult.items
					: [];
			const nextStartIndex = Number(pageResult?.nextStartIndex);
			nextStartIndexRef.current = Number.isFinite(nextStartIndex)
				? Math.max(0, Math.trunc(nextStartIndex))
				: startIndex + safeItems.length;
			setHasMore(typeof pageResult?.hasMore === 'boolean' ? pageResult.hasMore : safeItems.length >= PAGE_SIZE);
			setItems((previousItems) => {
				if (!append) return safeItems;
				const existingIds = new Set(previousItems.map((item) => String(item.Id)));
				const deduped = safeItems.filter((item) => !existingIds.has(String(item.Id)));
				return deduped.length ? [...previousItems, ...deduped] : previousItems;
			});
		} catch (loadError) {
			console.error('Failed to load Home section:', loadError);
			if (requestId === requestIdRef.current) {
				setError('Failed to load this section.');
				setHasMore(false);
			}
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false);
				setLoadingMore(false);
				loadingMoreRef.current = false;
			}
		}
	}, [activeSectionId, fetchFilteredHomeSectionPage, filterState, hasActiveFilters]);

	const loadNextPage = useCallback(async () => {
		if (!activeSectionId || loading || !hasMore || loadingMoreRef.current) return;
		loadingMoreRef.current = true;
		setLoadingMore(true);
		await loadPage({
			startIndex: nextStartIndexRef.current,
			append: true
		});
	}, [activeSectionId, hasMore, loadPage, loading]);

	const {handleScrollerScroll, commitCurrentScrollNow} = useLibraryScrollPersistence({
		scrollerRef,
		isActive,
		activeLibraryId: activeSectionId,
		loading,
		hasMore,
		loadNextPage,
		scrollTop,
		setScrollTop
	});
	commitCurrentScrollNowRef.current = commitCurrentScrollNow;
	setScrollTopRef.current = setScrollTop;

	useEffect(() => {
		loadPage({startIndex: 0, append: false});
		return () => {
			requestIdRef.current += 1;
		};
	}, [loadPage]);

	const handleGridCardClick = useCallback((event) => {
		commitCurrentScrollNow();
		const itemId = event.currentTarget.dataset.itemId;
		const selectedItem = itemsById.get(itemId);
		if (!selectedItem) return;
		onItemSelect(selectedItem);
	}, [commitCurrentScrollNow, itemsById, onItemSelect]);

	const handleGridCardFocus = useCallback((event) => {
		if (shouldLoadMoreFromGridFocus({
			event,
			isPointerInputMode,
			hasMore,
			isLoadingMore: loadingMoreRef.current,
			itemCount: items.length,
			threshold: FOCUS_PREFETCH_THRESHOLD
		})) {
			loadNextPage();
		}
	}, [hasMore, isPointerInputMode, items.length, loadNextPage]);

	const handleGridCardPointerDown = useCallback((event) => {
		if (!isPointerInputMode) return;
		event.stopPropagation();
	}, [isPointerInputMode]);

	const focusFilterTrigger = useCallback(() => {
		Spotlight.focus('home-section-filter-trigger');
	}, []);

	const handlePanelKeyDownCapture = useCallback((event) => {
		const code = event.keyCode || event.which;
		const activeElement = document.activeElement;
		const spotlightId = activeElement?.dataset?.spotlightId || '';
		if (code === 40 && (spotlightId === 'toolbar-home' || spotlightId === 'toolbar-user')) {
			event.preventDefault();
			event.stopPropagation();
			focusFilterTrigger();
		}
	}, [focusFilterTrigger]);

	const handleGridCardKeyDown = useCallback((event) => {
		focusTargetFromRightMostGridItem({
			event,
			panelRoot: panelRootRef.current,
			gridCardClassName: css.gridCard,
			focusTarget: focusFilterTrigger
		});
	}, [focusFilterTrigger]);

	const topToolbar = (
		<Toolbar
			activeSection="home"
			isActive={isActive}
			{...toolbarActions}
		/>
	);
	const title = activeSection?.title || 'Home Section';
	const showEmpty = !loading && !error && items.length === 0;

	if (loading) {
		return (
			<Panel {...rest}>
				<Header title={title} />
				{topToolbar}
				<div className={css.loading}>
					<BreezyLoadingOverlay />
				</div>
			</Panel>
		);
	}

	return (
		<Panel {...rest}>
			<Header title={title} />
			{topToolbar}
			<div className={css.libraryContainer} ref={panelRootRef} onKeyDownCapture={handlePanelKeyDownCapture}>
				<div
					ref={scrollerRef}
					className={`${css.nativeScroller} ${css.homeSectionScroller}`}
					onScroll={handleScrollerScroll}
				>
					<div className={css.contentFrame}>
						<div className={css.filterOverlay}>
							<div className={css.filterOverlayControls}>
								<MediaFilterControls
									title={title}
									triggerSpotlightId="home-section-filter-trigger"
									activeFilterCount={activeFilterCount}
									filterPopupOpen={filterPopupOpen}
									filterPopupContentRef={filterPopupContentRef}
									draftFilterIds={draftFilterIds}
									filterOptions={MEDIA_FILTER_OPTIONS}
									onTrigger={openFilterPopup}
									onClose={closeFilterPopup}
									onReset={resetDraftFilters}
									onApply={applyDraftFilters}
									onDraftSelect={selectDraftFilter}
								/>
							</div>
						</div>
						{error ? (
							<div className={css.emptyState}>
								<BodyText>{error}</BodyText>
							</div>
						) : null}
						{showEmpty ? (
							<div className={css.emptyState}>
								<BodyText>No items found.</BodyText>
							</div>
						) : null}
						<div className={css.gridContainer}>
							{items.map((item, index) => (
								<PanelPosterMediaCard
									key={buildMediaListItemKey(`home-section-${activeSectionId || 'unknown'}`, item, index)}
									item={item}
									index={index}
									classes={panelCardClasses}
									imageOptions={{includeBackdrop: true, includeSeriesFallback: true}}
									onClick={handleGridCardClick}
									onPointerDown={handleGridCardPointerDown}
									onMouseDown={handleGridCardPointerDown}
									onFocus={handleGridCardFocus}
									onKeyDown={handleGridCardKeyDown}
									spotlightDisabled={inputMode === 'pointer'}
								/>
							))}
							{loadingMore && (
								<div className={css.loadingMore}>
									<Spinner size="small" />
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</Panel>
	);
};

export default HomeSectionPanel;
