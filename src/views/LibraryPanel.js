import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Toolbar from '../components/Toolbar';
import MediaFilterControls from '../components/MediaFilterControls';
import MediaBrowseOverlay from '../components/MediaBrowseOverlay';
import PanelLandscapeVirtualGrid from '../components/PanelLandscapeVirtualGrid';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import MediaPanelBackdrop from '../components/MediaPanelBackdrop';
import BodyText from '@enact/sandstone/BodyText';
import { useMapById } from '../hooks/useMapById';
import { usePanelToolbarActions } from '../hooks/usePanelToolbarActions';
import {useMediaFilterState} from '../hooks/useMediaFilterState';
import {useCollapsibleBrowseSearch} from '../hooks/useCollapsibleBrowseSearch';
import { useLibraryPagination } from './library-panel/hooks/useLibraryPagination';
import {focusSpotlightTarget} from '../utils/gridFocus';
import {MEDIA_FILTER_OPTIONS} from '../utils/mediaFilters';
import {MEDIA_GRID_PAGE_SIZE} from '../constants/pagination';
import {buildGridQuerySignature} from '../utils/gridScrollRestore';

import css from './LibraryPanel.module.less';
import browseCss from '../components/MediaBrowseControls.module.less';

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
	const lastFocusedCardIdRef = useRef(cachedState?.focusedItemId || null);
	const focusResultsAfterFilterRef = useRef(false);
	const panelCacheSnapshotRef = useRef(cachedState || {});
	const latestCachedStateRef = useRef(cachedState);
	latestCachedStateRef.current = cachedState;
	const activeLibraryId = library?.Id || null;
	const activeLibraryCollectionType = library?.CollectionType || null;
	const handleAppliedSearchChange = useCallback(() => {
		lastFocusedCardIdRef.current = null;
		focusResultsAfterFilterRef.current = true;
	}, []);
	const {
		searchValue: searchTerm,
		appliedSearchValue: appliedSearchTerm,
		searchExpanded,
		restoreSearchState,
		handleSearchReveal,
		handleSearchChange,
		handleSearchBlur
	} = useCollapsibleBrowseSearch({
		initialValue: cachedState?.searchTerm,
		spotlightId: 'library-search-input',
		onApplySearch: handleAppliedSearchChange
	});
	const handleFilterApply = useCallback(() => {
		lastFocusedCardIdRef.current = null;
		focusResultsAfterFilterRef.current = true;
	}, []);
	const {
		activeFilterIds,
		draftFilterIds,
		filterPopupOpen,
		filterPopupContentRef,
		activeFilterCount,
		openFilterPopup,
		closeFilterPopup,
		resetDraftFilters,
		selectDraftFilter,
		applyDraftFilters,
		handleFilterPopupHide
	} = useMediaFilterState({
		cachedState,
		resetKey: activeLibraryId,
		onCacheState,
		triggerSpotlightId: 'library-filter-trigger',
		onApplyFilters: handleFilterApply
	});
	const cacheBrowseState = useCallback((cacheKey, nextState) => {
		if (typeof onCacheState !== 'function' || !cacheKey) return;
		const mergedState = {
			...panelCacheSnapshotRef.current,
			...(nextState || {}),
			activeFilterIds,
			searchTerm: appliedSearchTerm
		};
		panelCacheSnapshotRef.current = mergedState;
		onCacheState(cacheKey, mergedState);
	}, [activeFilterIds, appliedSearchTerm, onCacheState]);
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
	const handlePaginationStateChange = useCallback((nextPaginationState) => {
		cacheBrowseState(activeLibraryId, nextPaginationState);
	}, [activeLibraryId, cacheBrowseState]);
	const {
		loading,
		loadingMore,
		hasMore,
		items,
		loadNextPage
	} = useLibraryPagination({
		activeLibraryId,
		activeLibraryCollectionType,
		getItemTypesForLibrary,
		pageSize: MEDIA_GRID_PAGE_SIZE,
		activeFilterIds,
		searchTerm: appliedSearchTerm,
		cachedState,
		onStateChange: handlePaginationStateChange
	});
	useEffect(() => {
		const restoredState = latestCachedStateRef.current;
		const restoredSearchTerm = String(restoredState?.searchTerm || '');
		panelCacheSnapshotRef.current = restoredState || {};
		restoreSearchState(restoredSearchTerm);
	}, [activeLibraryId, cachedState?.searchTerm, restoreSearchState]);
	useEffect(() => {
		lastFocusedCardIdRef.current = cachedState?.focusedItemId || null;
	}, [activeLibraryId, cachedState?.focusedItemId]);
	const filteredOptions = useMemo(() => {
		if (library?.CollectionType === 'movies') {
			return MEDIA_FILTER_OPTIONS.filter((entry) => entry.id !== 'played');
		}
		return MEDIA_FILTER_OPTIONS;
	}, [library?.CollectionType]);
	const itemsById = useMapById(items);
	const handleGridCardClick = useCallback((event) => {
		const itemId = event.currentTarget.dataset.itemId;
		lastFocusedCardIdRef.current = itemId || null;
		cacheBrowseState(activeLibraryId, {focusedItemId: lastFocusedCardIdRef.current});
		const selectedItem = itemsById.get(itemId);
		if (!selectedItem) return;
		onItemSelect(selectedItem);
	}, [activeLibraryId, cacheBrowseState, itemsById, onItemSelect]);

	const gridItemRendererProps = useMemo(() => ({
		onItemClick: handleGridCardClick,
		cardClassName: css.gridCard,
		imageOptions: {includeBackdrop: true, includeSeriesFallback: false}
	}), [handleGridCardClick]);
	const handleToolbarNavigateDown = useCallback(() => focusSpotlightTarget('library-search-input'), []);
	const querySignature = buildGridQuerySignature(activeLibraryId, [appliedSearchTerm, ...activeFilterIds]);

	const topToolbar = (
		<Toolbar
			activeSection="library"
			activeLibraryId={library?.Id}
			isActive={isActive}
			onNavigateDown={handleToolbarNavigateDown}
			{...toolbarActions}
		/>
	);

	return (
		<Panel {...rest}>
			<Header title={library?.Name || 'Library'} />
			{topToolbar}
			<div
				className={`${css.libraryContainer} ${browseCss.panelLayout}`}
				data-input-mode={inputMode}
			>
				<MediaPanelBackdrop item={items[0] || null} />
				<MediaBrowseOverlay compact expanded={searchExpanded} actionCount={2}>
								<MediaFilterControls
									title="Library"
									triggerSpotlightId="library-filter-trigger"
									activeFilterCount={activeFilterCount}
									filterPopupOpen={filterPopupOpen}
									filterPopupContentRef={filterPopupContentRef}
									draftFilterIds={draftFilterIds}
									filterOptions={filteredOptions}
									searchVisible
									searchExpanded={searchExpanded}
									searchValue={searchTerm}
									searchPlaceholder={`Search ${library?.Name || 'library'}...`}
									searchSpotlightId="library-search-input"
									onSearchReveal={handleSearchReveal}
									onSearchChange={handleSearchChange}
									onSearchBlur={handleSearchBlur}
									onTrigger={openFilterPopup}
									onClose={closeFilterPopup}
									onHide={handleFilterPopupHide}
									onReset={resetDraftFilters}
									onApply={applyDraftFilters}
									onDraftSelect={selectDraftFilter}
								/>
				</MediaBrowseOverlay>
				<div className={`${css.virtualGridViewport} ${browseCss.panelResultsOffset}`}>
					{loading ? <div className={css.loading}><BreezyLoadingOverlay /></div> : null}
					{!loading && items.length === 0 ? <div className={css.emptyState}><BodyText>No items found.</BodyText></div> : null}
					<PanelLandscapeVirtualGrid
						id="library-grid"
						className={css.virtualGrid}
						items={loading ? [] : items}
						itemRendererProps={gridItemRendererProps}
						isActive={isActive && !loading}
						queryKey={querySignature}
						hasMore={!loading && hasMore}
						loadingMore={loadingMore}
						onLoadMore={loadNextPage}
						disableFocusScale
						focusedItemIdRef={lastFocusedCardIdRef}
						focusFirstItemRef={focusResultsAfterFilterRef}
						data-spotlight-container-disabled={loading || items.length === 0}
					/>
				</div>
			</div>
		</Panel>
	);
};

export default LibraryPanel;
