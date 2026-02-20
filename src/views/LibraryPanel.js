import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Scroller from '../components/AppScroller';
import Spinner from '@enact/sandstone/Spinner';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';
import PosterMediaCard from '../components/PosterMediaCard';
import MediaCardStatusOverlay from '../components/MediaCardStatusOverlay';
import {KeyCodes} from '../utils/keyCodes';
import { createLastFocusedSpotlightContainer } from '../utils/spotlightContainerUtils';
import {focusToolbarSpotlightTargets} from '../utils/toolbarFocus';
import { useMapById } from '../hooks/useMapById';
import { usePanelScrollState } from '../hooks/usePanelScrollState';
import { useToolbarActions } from '../hooks/useToolbarActions';
import {
	getPlaybackProgressPercent,
	getPosterCardImageUrl,
	getSeriesUnplayedCount,
	hasStartedWatching
} from '../utils/mediaItemUtils';

import css from './LibraryPanel.module.less';

const LIBRARY_PAGE_SIZE = 60;
const FOCUS_PREFETCH_THRESHOLD = 12;
const LibraryGridSpotlightContainer = createLastFocusedSpotlightContainer();

const LibraryPanel = ({
	library,
	onItemSelect,
	onNavigate,
	onSwitchUser,
	onLogout,
	onExit,
	registerBackHandler,
	isActive = false,
	cachedState = null,
	onCacheState = null,
	...rest
}) => {
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [items, setItems] = useState([]);
	const libraryScrollToRef = useRef(null);
	const gridRef = useRef(null);
	const paginationRef = useRef({ nextStartIndex: 0, itemTypes: undefined });
	const requestIdRef = useRef(0);
	const loadingMoreRef = useRef(false);
	const toolbarActions = useToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler
	});
	const itemsById = useMapById(items);
	const {
		captureScrollTo: captureLibraryScrollRestore,
		handleScrollStop: handleLibraryScrollMemoryStop
	} = usePanelScrollState({
		cachedState,
		isActive,
		onCacheState,
		cacheKey: library?.Id || null,
		requireCacheKey: true
	});

	const getItemTypesForLibrary = useCallback((libraryValue) => {
		if (!libraryValue) return undefined;
		if (libraryValue.CollectionType === 'movies') return ['Movie'];
		if (libraryValue.CollectionType === 'tvshows') return ['Series'];
		return undefined;
	}, []);

	const loadNextPage = useCallback(async () => {
		if (!library || loading || !hasMore || loadingMoreRef.current) return;

		loadingMoreRef.current = true;
		setLoadingMore(true);
		const requestId = requestIdRef.current;
		const { nextStartIndex, itemTypes } = paginationRef.current;

		try {
			const nextBatch = await jellyfinService.getLibraryItems(
				library.Id,
				itemTypes,
				LIBRARY_PAGE_SIZE,
				nextStartIndex
			);
			if (requestId !== requestIdRef.current) return;

			const safeBatch = Array.isArray(nextBatch) ? nextBatch : [];
			if (safeBatch.length === 0) {
				setHasMore(false);
				return;
			}

			paginationRef.current.nextStartIndex = nextStartIndex + safeBatch.length;
			setItems((prevItems) => {
				const existingIds = new Set(prevItems.map((item) => String(item.Id)));
				const dedupedBatch = safeBatch.filter((item) => !existingIds.has(String(item.Id)));
				return dedupedBatch.length ? [...prevItems, ...dedupedBatch] : prevItems;
			});
			if (safeBatch.length < LIBRARY_PAGE_SIZE) {
				setHasMore(false);
			}
		} catch (error) {
			console.error('Failed to load additional library items:', error);
		} finally {
			if (requestId === requestIdRef.current) {
				setLoadingMore(false);
			}
			loadingMoreRef.current = false;
		}
	}, [hasMore, library, loading]);

	const loadLibraryItems = useCallback(async () => {
		if (!library) return;
		const requestId = requestIdRef.current + 1;
		requestIdRef.current = requestId;
		const itemTypes = getItemTypesForLibrary(library);
		paginationRef.current = { nextStartIndex: 0, itemTypes };
		loadingMoreRef.current = false;
		setLoading(true);
		setLoadingMore(false);
		setItems([]);
		setHasMore(false);
		try {
			const firstBatch = await jellyfinService.getLibraryItems(
				library.Id,
				itemTypes,
				LIBRARY_PAGE_SIZE,
				0
			);
			if (requestId !== requestIdRef.current) return;

			const safeFirstBatch = Array.isArray(firstBatch) ? firstBatch : [];
			setItems(safeFirstBatch);
			paginationRef.current.nextStartIndex = safeFirstBatch.length;
			setHasMore(safeFirstBatch.length === LIBRARY_PAGE_SIZE);
		} catch (error) {
			console.error('Failed to load library items:', error);
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false);
			}
		}
	}, [getItemTypesForLibrary, library]);

	useEffect(() => {
		if (library) {
			loadLibraryItems();
		}
	}, [library, loadLibraryItems]);

	const handleGridCardClick = useCallback((event) => {
		const itemId = event.currentTarget.dataset.itemId;
		const selectedItem = itemsById.get(itemId);
		if (!selectedItem) return;
		onItemSelect(selectedItem);
	}, [itemsById, onItemSelect]);

	const getUnwatchedCount = (item) => {
		return getSeriesUnplayedCount(item);
	};

	const captureLibraryScrollTo = useCallback((fn) => {
		libraryScrollToRef.current = fn;
		captureLibraryScrollRestore(fn);
	}, [captureLibraryScrollRestore]);

	const focusTopToolbarAction = useCallback(() => {
		const preferredLibraryId = library?.Id ? `toolbar-library-${library.Id}` : null;
		return focusToolbarSpotlightTargets([preferredLibraryId, 'toolbar-home', 'toolbar-user']);
	}, [library?.Id]);

	const handleGridCardKeyDown = useCallback((event) => {
		const code = event.keyCode || event.which;
		if (code !== KeyCodes.UP) return;
		const cards = Array.from(gridRef.current?.querySelectorAll(`.${css.gridCard}`) || []);
		if (cards.length === 0) return;
		const firstRowTop = Math.min(...cards.map((card) => card.offsetTop));
		const currentTop = event.currentTarget.offsetTop;
		if (currentTop > firstRowTop + 1) return;

		event.preventDefault();
		event.stopPropagation();
		if (typeof libraryScrollToRef.current === 'function') {
			libraryScrollToRef.current({align: 'top', animate: true});
		}
		focusTopToolbarAction();
	}, [focusTopToolbarAction]);

	const handleGridCardFocus = useCallback((event) => {
		if (!hasMore || loadingMoreRef.current) return;
		const itemIndex = Number(event.currentTarget.dataset.itemIndex);
		if (!Number.isInteger(itemIndex)) return;
		const remainingItems = items.length - itemIndex - 1;
		if (remainingItems <= FOCUS_PREFETCH_THRESHOLD) {
			loadNextPage();
		}
	}, [hasMore, items.length, loadNextPage]);

	const handleScrollerScrollStop = useCallback((event) => {
		handleLibraryScrollMemoryStop(event);
		if (event?.reachedEdgeInfo?.bottom) {
			loadNextPage();
		}
	}, [handleLibraryScrollMemoryStop, loadNextPage]);
	const topToolbar = (
		<Toolbar
			activeSection="library"
			activeLibraryId={library?.Id}
			{...toolbarActions}
		/>
	);

	if (loading) {
		return (
			<Panel {...rest}>
				<Header title={library?.Name || 'Library'} />
				{topToolbar}
				<div className={css.loading}>
					<Spinner />
				</div>
			</Panel>
		);
	}

	return (
		<Panel {...rest}>
			<Header title={library?.Name || 'Library'} />
			{topToolbar}
			<div className={css.libraryContainer}>
				<Scroller
					className={css.scroller}
					cbScrollTo={captureLibraryScrollTo}
					onScrollStop={handleScrollerScrollStop}
				>
					<div ref={gridRef}>
						<LibraryGridSpotlightContainer className={css.gridContainer} spotlightId="library-grid">
							{items.map((item, index) => (
								<PosterMediaCard
									key={item.Id}
									itemId={item.Id}
									data-item-index={index}
									className={css.gridCard}
									imageClassName={css.cardImage}
									placeholderClassName={css.placeholder}
									usePlaceholderClassWhenNoImage
									imageUrl={getPosterCardImageUrl(item, {includeBackdrop: true, includeSeriesFallback: false}) || ''}
									title={item.Name}
									subtitle={item.ProductionYear ? String(item.ProductionYear) : ''}
									titleClassName={css.cardTitle}
									subtitleClassName={css.cardSubtitle}
									onClick={handleGridCardClick}
									onKeyDown={handleGridCardKeyDown}
									onFocus={handleGridCardFocus}
									overlayContent={(
										<MediaCardStatusOverlay
											showWatched={getUnwatchedCount(item) !== null && hasStartedWatching(item)}
											watchedContent={getUnwatchedCount(item) === 0 ? '\u2713' : getUnwatchedCount(item)}
											watchedClassName={css.progressBadge}
											progressPercent={item.Type !== 'Series' && hasStartedWatching(item) ? getPlaybackProgressPercent(item) : null}
											progressBarClassName={css.progressBar}
											progressClassName={css.progress}
										/>
									)}
								/>
						))}
						{loadingMore && (
							<div className={css.loadingMore}>
								<Spinner size="small" />
							</div>
						)}
						</LibraryGridSpotlightContainer>
					</div>
				</Scroller>
			</div>
		</Panel>
	);
};

export default LibraryPanel;
