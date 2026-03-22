import { useCallback, useRef } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Spinner from '@enact/sandstone/Spinner';
import Toolbar from '../components/Toolbar';
import PosterMediaCard from '../components/PosterMediaCard';
import MediaCardStatusOverlay from '../components/MediaCardStatusOverlay';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import { createLastFocusedSpotlightContainer } from '../utils/spotlightContainerUtils';
import { useMapById } from '../hooks/useMapById';
import { usePanelToolbarActions } from '../hooks/usePanelToolbarActions';
import { usePanelScrollState } from '../hooks/usePanelScrollState';
import { useLibraryPagination } from './library-panel/hooks/useLibraryPagination';
import { useLibraryScrollPersistence } from './library-panel/hooks/useLibraryScrollPersistence';
import {
	getPlaybackProgressPercent,
	getPosterCardImageUrl,
	getSeriesUnplayedCount,
	hasStartedWatching
} from '../utils/mediaItemUtils';

import css from './LibraryPanel.module.less';

const FOCUS_PREFETCH_THRESHOLD = 12;
const LibraryGridSpotlightContainer = createLastFocusedSpotlightContainer('div');

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
	inputMode = '5way',
	...rest
}) => {
	const scrollerRef = useRef(null);
	const activeLibraryId = library?.Id || null;
	const activeLibraryCollectionType = library?.CollectionType || null;
	const isPointerInputMode = inputMode === 'pointer';
	const {
		scrollTop,
		setScrollTop
	} = usePanelScrollState({
		cachedState,
		isActive,
		onCacheState,
		cacheKey: activeLibraryId,
		requireCacheKey: true
	});
	const toolbarActions = usePanelToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		isActive
	});

	const getItemTypesForLibrary = useCallback((collectionType) => {
		if (!collectionType) return undefined;
		if (collectionType === 'movies') return ['Movie'];
		if (collectionType === 'tvshows') return ['Series'];
		return undefined;
	}, []);
	const {
		loading,
		loadingMore,
		hasMore,
		items,
		loadNextPage,
		loadingMoreRef
	} = useLibraryPagination({
		activeLibraryId,
		activeLibraryCollectionType,
		getItemTypesForLibrary,
		pageSize: 60
	});
	const itemsById = useMapById(items);
	const {handleScrollerScroll, commitCurrentScrollNow} = useLibraryScrollPersistence({
		scrollerRef,
		isActive,
		activeLibraryId,
		loading,
		hasMore,
		loadNextPage,
		scrollTop,
		setScrollTop
	});

	const handleGridCardClick = useCallback((event) => {
		commitCurrentScrollNow();
		const itemId = event.currentTarget.dataset.itemId;
		const selectedItem = itemsById.get(itemId);
		if (!selectedItem) return;
		onItemSelect(selectedItem);
	}, [commitCurrentScrollNow, itemsById, onItemSelect]);

	const handleGridCardPointerDown = useCallback((event) => {
		if (!isPointerInputMode) return;
		event.stopPropagation();
	}, [isPointerInputMode]);

	const handleGridCardFocus = useCallback((event) => {
		if (isPointerInputMode) return;
		event.currentTarget?.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
		if (!hasMore || loadingMoreRef.current) return;
		const itemIndex = Number(event.currentTarget.dataset.itemIndex);
		if (!Number.isInteger(itemIndex)) return;
		const remainingItems = items.length - itemIndex - 1;
		if (remainingItems <= FOCUS_PREFETCH_THRESHOLD) {
			loadNextPage();
		}
	}, [hasMore, isPointerInputMode, items.length, loadNextPage, loadingMoreRef]);

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
					<BreezyLoadingOverlay />
				</div>
			</Panel>
		);
	}

	return (
		<Panel {...rest}>
			<Header title={library?.Name || 'Library'} />
			{topToolbar}
			<div className={css.libraryContainer}>
				<div
					ref={scrollerRef}
					className={css.nativeScroller}
					onScroll={handleScrollerScroll}
				>
					<div>
						<LibraryGridSpotlightContainer className={css.gridContainer}>
							{items.map((item, index) => {
								const unwatchedCount = getSeriesUnplayedCount(item);
								const showWatchStatus = unwatchedCount !== null && hasStartedWatching(item);
								const isWatchComplete = showWatchStatus && unwatchedCount === 0;
								return (
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
										onPointerDown={handleGridCardPointerDown}
										onMouseDown={handleGridCardPointerDown}
										onFocus={handleGridCardFocus}
										spotlightDisabled={isPointerInputMode}
										overlayContent={(
											<MediaCardStatusOverlay
												showWatched={showWatchStatus}
												watchedContent={isWatchComplete ? '\u2713' : unwatchedCount}
												watchedClassName={isWatchComplete ? css.watchedBadge : css.progressBadge}
												progressPercent={item.Type !== 'Series' && hasStartedWatching(item) ? getPlaybackProgressPercent(item) : null}
												progressBarClassName={css.progressBar}
												progressClassName={css.progress}
											/>
										)}
									/>
								);
							})}
							{loadingMore && (
								<div className={css.loadingMore}>
									<Spinner size="small" />
								</div>
							)}
						</LibraryGridSpotlightContainer>
					</div>
				</div>
			</div>
		</Panel>
	);
};

export default LibraryPanel;
