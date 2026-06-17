import { useCallback, useMemo, useRef } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Spinner from '@enact/sandstone/Spinner';
import Toolbar from '../components/Toolbar';
import MediaFilterControls from '../components/MediaFilterControls';
import PanelPosterMediaCard from '../components/PanelPosterMediaCard';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import Spotlight from '@enact/spotlight';
import { createLastFocusedSpotlightContainer } from '../utils/spotlightContainerUtils';
import { useMapById } from '../hooks/useMapById';
import { usePanelToolbarActions } from '../hooks/usePanelToolbarActions';
import { usePanelScrollState } from '../hooks/usePanelScrollState';
import {useMediaFilterState} from '../hooks/useMediaFilterState';
import { useLibraryPagination } from './library-panel/hooks/useLibraryPagination';
import { useLibraryScrollPersistence } from './library-panel/hooks/useLibraryScrollPersistence';
import {focusTargetFromRightMostGridItem, shouldLoadMoreFromGridFocus} from '../utils/gridFocus';
import {getPanelPosterCardClassProps} from '../utils/posterCardClassProps';
import {MEDIA_FILTER_OPTIONS} from '../utils/mediaFilters';
import {buildMediaListItemKey} from '../utils/reactKeys';
import {MEDIA_GRID_PAGE_SIZE} from '../constants/pagination';

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
	const panelRootRef = useRef(null);
	const lastFocusedCardIdRef = useRef(null);
	const commitCurrentScrollNowRef = useRef(null);
	const setScrollTopRef = useRef(null);
	const activeLibraryId = library?.Id || null;
	const activeLibraryCollectionType = library?.CollectionType || null;
	const isPointerInputMode = inputMode === 'pointer';
	const handleFilterApply = useCallback(() => {
		commitCurrentScrollNowRef.current?.();
		setScrollTopRef.current?.(0);
	}, []);
	const {
		activeFilterIds,
		draftFilterIds,
		filterPopupOpen,
		filterPopupContentRef,
		activeFilterCount,
		cacheStateWithFilters,
		openFilterPopup,
		closeFilterPopup,
		resetDraftFilters,
		selectDraftFilter,
		applyDraftFilters
	} = useMediaFilterState({
		cachedState,
		resetKey: activeLibraryId,
		onCacheState,
		triggerSpotlightId: 'library-filter-trigger',
		onApplyFilters: handleFilterApply
	});
	const {
		scrollTop,
		setScrollTop
	} = usePanelScrollState({
		cachedState,
		isActive,
		onCacheState: cacheStateWithFilters,
		cacheKey: activeLibraryId,
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
		pageSize: MEDIA_GRID_PAGE_SIZE,
		activeFilterIds
	});
	const filteredOptions = useMemo(() => {
		if (library?.CollectionType === 'movies') {
			return MEDIA_FILTER_OPTIONS.filter((entry) => entry.id !== 'played');
		}
		return MEDIA_FILTER_OPTIONS;
	}, [library?.CollectionType]);
	const panelCardClasses = getPanelPosterCardClassProps(css);
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
	commitCurrentScrollNowRef.current = commitCurrentScrollNow;
	setScrollTopRef.current = setScrollTop;

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
		lastFocusedCardIdRef.current = event.currentTarget?.dataset?.itemId || null;
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
	}, [hasMore, isPointerInputMode, items.length, loadNextPage, loadingMoreRef]);

	const focusLibraryFilterTrigger = useCallback(() => {
		Spotlight.focus('library-filter-trigger');
	}, []);

	const focusLastCard = useCallback(() => {
		if (!lastFocusedCardIdRef.current) return false;
		const cards = Array.from(panelRootRef.current?.querySelectorAll(`.${css.gridCard}`) || []);
		const target = cards.find((card) => card.dataset?.itemId === lastFocusedCardIdRef.current);
		if (!target) return false;
		target.focus?.();
		return true;
	}, []);

	const handlePanelKeyDownCapture = useCallback((event) => {
		const code = event.keyCode || event.which;
		const activeElement = document.activeElement;
		const spotlightId = activeElement?.dataset?.spotlightId || '';
		if (code === 40 && (spotlightId === 'toolbar-user' || spotlightId === 'toolbar-library')) {
			event.preventDefault();
			event.stopPropagation();
			focusLibraryFilterTrigger();
			return;
		}
		if (code === 37 && spotlightId === 'library-filter-trigger') {
			event.preventDefault();
			event.stopPropagation();
			if (!focusLastCard()) {
				Spotlight.focus('library-grid');
			}
		}
	}, [focusLastCard, focusLibraryFilterTrigger]);

	const handleGridCardKeyDown = useCallback((event) => {
		focusTargetFromRightMostGridItem({
			event,
			panelRoot: panelRootRef.current,
			gridCardClassName: css.gridCard,
			focusTarget: focusLibraryFilterTrigger
		});
	}, [focusLibraryFilterTrigger]);

	const topToolbar = (
		<Toolbar
			activeSection="library"
			activeLibraryId={library?.Id}
			isActive={isActive}
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
			<div className={css.libraryContainer} ref={panelRootRef} onKeyDownCapture={handlePanelKeyDownCapture}>
				<div
					ref={scrollerRef}
					className={css.nativeScroller}
					onScroll={handleScrollerScroll}
				>
					<div className={css.contentFrame}>
						<div className={css.filterOverlay}>
							<div className={css.filterOverlayControls}>
								<MediaFilterControls
									title="Library"
									triggerSpotlightId="library-filter-trigger"
									activeFilterCount={activeFilterCount}
									filterPopupOpen={filterPopupOpen}
									filterPopupContentRef={filterPopupContentRef}
									draftFilterIds={draftFilterIds}
									filterOptions={filteredOptions}
									onTrigger={openFilterPopup}
									onClose={closeFilterPopup}
									onReset={resetDraftFilters}
									onApply={applyDraftFilters}
									onDraftSelect={selectDraftFilter}
								/>
							</div>
						</div>
						<LibraryGridSpotlightContainer className={css.gridContainer} spotlightId="library-grid">
							{items.map((item, index) => (
								<PanelPosterMediaCard
									key={buildMediaListItemKey(`library-${activeLibraryId || 'unknown'}`, item, index)}
									item={item}
									index={index}
									classes={panelCardClasses}
									imageOptions={{includeBackdrop: true, includeSeriesFallback: false}}
									onClick={handleGridCardClick}
									onPointerDown={handleGridCardPointerDown}
									onMouseDown={handleGridCardPointerDown}
									onFocus={handleGridCardFocus}
									onKeyDown={handleGridCardKeyDown}
									spotlightDisabled={isPointerInputMode}
								/>
							))}
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
