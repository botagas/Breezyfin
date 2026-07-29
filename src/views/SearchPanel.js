import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Button from '../components/BreezyButton';
import MediaBrowseControls from '../components/MediaBrowseControls';
import MediaBrowseOverlay from '../components/MediaBrowseOverlay';
import BodyText from '@enact/sandstone/BodyText';
import Popup from '@enact/sandstone/Popup';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';
import PosterMediaCard from '../components/PosterMediaCard';
import MediaVirtualGrid from '../components/MediaVirtualGrid';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import MediaPanelBackdrop from '../components/MediaPanelBackdrop';
import {getPosterCardImageUrls} from '../utils/mediaItemUtils';
import {getMediaCardPresentation} from '../utils/mediaCardPresentation';
import { useDisclosureMap } from '../hooks/useDisclosureMap';
import { useDisclosureHandlers } from '../hooks/useDisclosureHandlers';
import { useMapById } from '../hooks/useMapById';
import { usePanelToolbarActions } from '../hooks/usePanelToolbarActions';
import { usePopupInitialFocus } from '../hooks/usePopupInitialFocus';
import {MEDIA_GRID_PAGE_SIZE} from '../constants/pagination';
import {
	resolveSearchPageProgress
} from '../utils/searchPagination';

import css from './SearchPanel.module.less';
import browseCss from '../components/MediaBrowseControls.module.less';
import popupStyles from '../styles/popupStyles.module.less';
import {popupShellCss} from '../styles/popupStyles';

const FILTER_OPTIONS = [
	{ id: 'movies', label: 'Movies', types: ['Movie'] },
	{ id: 'series', label: 'Series', types: ['Series'] },
	{ id: 'episodes', label: 'Episodes', types: ['Episode'] },
	{ id: 'people', label: 'People', types: ['Person'] }
];
const SEARCH_DISCLOSURE_KEYS = {
	FILTER_POPUP: 'filterPopup'
};
const SEARCH_DISCLOSURE_KEY_LIST = [
	SEARCH_DISCLOSURE_KEYS.FILTER_POPUP
];
const INITIAL_SEARCH_DISCLOSURES = {
	[SEARCH_DISCLOSURE_KEYS.FILTER_POPUP]: false
};
const ALL_FILTER_IDS = FILTER_OPTIONS.map((filter) => filter.id);
const SEARCH_PAGE_SIZE = MEDIA_GRID_PAGE_SIZE;
const SEARCH_FOCUS_PREFETCH_THRESHOLD = 12;
const SEARCH_GRID_ID = 'search-results-grid';
const sanitizeSelectedFilterIds = (candidateIds) => {
	if (!Array.isArray(candidateIds) || candidateIds.length === 0) return ALL_FILTER_IDS;
	const allowed = new Set(ALL_FILTER_IDS);
	const normalized = candidateIds.filter((id) => allowed.has(id));
	return normalized.length > 0 ? normalized : ALL_FILTER_IDS;
};
const getCachedNextStartIndex = (cachedValue) => {
	const numericValue = Number(cachedValue);
	if (Number.isFinite(numericValue) && numericValue >= 0) {
		return numericValue;
	}
	return null;
};

const SearchPanel = ({
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
	const [searchTerm, setSearchTerm] = useState(() => (
		typeof cachedState?.searchTerm === 'string' ? cachedState.searchTerm : ''
	));
	const [results, setResults] = useState(() => (
		Array.isArray(cachedState?.results) ? cachedState.results : []
	));
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasSearched, setHasSearched] = useState(() => cachedState?.hasSearched === true);
	const {disclosures, openDisclosure, closeDisclosure} = useDisclosureMap(INITIAL_SEARCH_DISCLOSURES);
	const disclosureHandlers = useDisclosureHandlers(
		SEARCH_DISCLOSURE_KEY_LIST,
		openDisclosure,
		closeDisclosure
	);
	const filterPopupOpen = disclosures[SEARCH_DISCLOSURE_KEYS.FILTER_POPUP] === true;
	const openFilterPopup = disclosureHandlers[SEARCH_DISCLOSURE_KEYS.FILTER_POPUP].open;
	const closeFilterPopup = disclosureHandlers[SEARCH_DISCLOSURE_KEYS.FILTER_POPUP].close;
	const [selectedFilterIds, setSelectedFilterIds] = useState(() => (
		sanitizeSelectedFilterIds(cachedState?.selectedFilterIds)
	));
	const [hasMore, setHasMore] = useState(() => cachedState?.hasMore === true);
	const searchDebounceRef = useRef(null);
	const activeSearchRequestIdRef = useRef(0);
	const loadingMoreRef = useRef(false);
	const lastPaginationCursorRef = useRef(null);
	const resultsRef = useRef(results);
	const gridScrollToRef = useRef(null);
	const lastFocusedItemIdRef = useRef(cachedState?.focusedItemId || null);
	const filterPopupContentRef = useRef(null);
	const lastCachedStateRef = useRef(cachedState);
	const paginationRef = useRef({
		nextStartIndex: getCachedNextStartIndex(cachedState?.nextStartIndex) ?? (
			Array.isArray(cachedState?.results) ? cachedState.results.length : 0
		),
		term: typeof cachedState?.searchTerm === 'string' ? cachedState.searchTerm.trim() : '',
		filterTypes: null
	});
	const filtersById = useMapById(FILTER_OPTIONS, 'id');
	const appliedFilterCount = useMemo(
		() => (selectedFilterIds.length < FILTER_OPTIONS.length ? selectedFilterIds.length : 0),
		[selectedFilterIds]
	);
	resultsRef.current = results;
	usePopupInitialFocus(filterPopupOpen, filterPopupContentRef);
	const captureGridScrollTo = useCallback((scrollTo) => {
		gridScrollToRef.current = scrollTo;
	}, []);
	const resetGridScroll = useCallback(() => {
		gridScrollToRef.current?.({align: 'top', animate: false});
	}, []);

	useEffect(() => {
		const hadCachedState = lastCachedStateRef.current !== null;
		lastCachedStateRef.current = cachedState;
		if (!hadCachedState || cachedState !== null) return;
		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
			searchDebounceRef.current = null;
		}
		activeSearchRequestIdRef.current += 1;
		loadingMoreRef.current = false;
		lastPaginationCursorRef.current = null;
		closeDisclosure(SEARCH_DISCLOSURE_KEYS.FILTER_POPUP);
		paginationRef.current = {
			nextStartIndex: 0,
			term: '',
			filterTypes: null
		};
		setSearchTerm('');
		lastFocusedItemIdRef.current = null;
		setResults([]);
		resultsRef.current = [];
		setLoading(false);
		setLoadingMore(false);
		setHasSearched(false);
		setSelectedFilterIds(ALL_FILTER_IDS);
		setHasMore(false);
		resetGridScroll();
	}, [cachedState, closeDisclosure, resetGridScroll]);

	const buildFilterTypes = useCallback((filterIds) => {
		if (!Array.isArray(filterIds) || filterIds.length === 0) return null;
		const selectedTypeSet = new Set();
		filterIds.forEach((id) => {
			const option = filtersById.get(id);
			option?.types?.forEach((type) => selectedTypeSet.add(type));
		});
		return Array.from(selectedTypeSet);
	}, [filtersById]);

	const performSearch = useCallback(async (term, filterTypes, requestId) => {
		if (requestId !== activeSearchRequestIdRef.current) return;
		const normalizedTerm = term?.trim() || '';
		if (normalizedTerm.length < 2) {
			if (requestId !== activeSearchRequestIdRef.current) return;
			setResults([]);
			resultsRef.current = [];
			setHasSearched(false);
			setLoading(false);
			setLoadingMore(false);
			setHasMore(false);
			resetGridScroll();
			loadingMoreRef.current = false;
			paginationRef.current = {
				nextStartIndex: 0,
				term: '',
				filterTypes: null
			};
			return;
		}

		if (requestId !== activeSearchRequestIdRef.current) return;
		setLoading(true);
		setLoadingMore(false);
		setHasSearched(true);
		setHasMore(false);
		resetGridScroll();
		loadingMoreRef.current = false;
		lastPaginationCursorRef.current = null;
		try {
			const page = await jellyfinService.searchPage(normalizedTerm, filterTypes, SEARCH_PAGE_SIZE, 0);
			if (requestId !== activeSearchRequestIdRef.current) return;
			const progress = resolveSearchPageProgress({page, pageSize: SEARCH_PAGE_SIZE});
			const safeItems = progress.uniqueItems;
			resultsRef.current = safeItems;
			setResults(safeItems);
			setHasMore(progress.hasMore);
			paginationRef.current = {
				nextStartIndex: progress.nextStartIndex,
				term: normalizedTerm,
				filterTypes
			};
		} catch (error) {
			if (requestId !== activeSearchRequestIdRef.current) return;
			console.error('Search failed:', error);
			resultsRef.current = [];
			setResults([]);
			setHasMore(false);
			paginationRef.current = {
				nextStartIndex: 0,
				term: normalizedTerm,
				filterTypes
			};
		} finally {
			if (requestId === activeSearchRequestIdRef.current) {
				setLoading(false);
			}
		}
	}, [resetGridScroll]);

	const loadNextPage = useCallback(async () => {
		if (loading || loadingMoreRef.current || !hasSearched || !hasMore) return;
		const {nextStartIndex, term, filterTypes} = paginationRef.current;
		if (!term || term.length < 2) return;
		if (lastPaginationCursorRef.current === nextStartIndex) return;

		const requestId = activeSearchRequestIdRef.current;
		lastPaginationCursorRef.current = nextStartIndex;
		loadingMoreRef.current = true;
		setLoadingMore(true);
		try {
			const page = await jellyfinService.searchPage(term, filterTypes, SEARCH_PAGE_SIZE, nextStartIndex);
			if (requestId !== activeSearchRequestIdRef.current) return;
			const progress = resolveSearchPageProgress({
				page,
				existingItems: resultsRef.current,
				pageSize: SEARCH_PAGE_SIZE,
				fallbackStartIndex: nextStartIndex
			});
			if (!progress.madeProgress) {
				setHasMore(false);
				return;
			}
			paginationRef.current.nextStartIndex = progress.nextStartIndex;
			resultsRef.current = [...resultsRef.current, ...progress.uniqueItems];
				setResults(resultsRef.current);
				setHasMore(progress.hasMore);
			} catch (error) {
				if (requestId !== activeSearchRequestIdRef.current) return;
				console.error('Failed to load additional search results:', error);
				setHasMore(false);
			} finally {
				if (requestId === activeSearchRequestIdRef.current) {
					setLoadingMore(false);
					loadingMoreRef.current = false;
				}
			}
	}, [hasMore, hasSearched, loading]);

	const scheduleSearch = useCallback((term, filterTypes) => {
		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
		}
		activeSearchRequestIdRef.current += 1;
		lastPaginationCursorRef.current = null;
		const requestId = activeSearchRequestIdRef.current;
		if (!term || term.trim().length < 2) {
			setResults([]);
			resultsRef.current = [];
			setHasSearched(false);
			setLoading(false);
			setLoadingMore(false);
			setHasMore(false);
			resetGridScroll();
			loadingMoreRef.current = false;
			paginationRef.current = {
				nextStartIndex: 0,
				term: '',
				filterTypes: null
			};
			return;
		}
		searchDebounceRef.current = setTimeout(() => {
			performSearch(term, filterTypes, requestId);
		}, 500);
	}, [performSearch, resetGridScroll]);

	useEffect(() => () => {
		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
			searchDebounceRef.current = null;
		}
		activeSearchRequestIdRef.current += 1;
		loadingMoreRef.current = false;
	}, []);

	useEffect(() => {
		const normalizedTerm = searchTerm.trim();
		const cachedFilterTypes = buildFilterTypes(selectedFilterIds);
		paginationRef.current.term = normalizedTerm;
		paginationRef.current.filterTypes = cachedFilterTypes;
		if (paginationRef.current.nextStartIndex < results.length) {
			paginationRef.current.nextStartIndex = results.length;
		}
	}, [buildFilterTypes, results.length, searchTerm, selectedFilterIds]);

	useEffect(() => {
		if (typeof onCacheState !== 'function') return;
		onCacheState({
			searchTerm,
			results,
			hasSearched,
			selectedFilterIds,
			hasMore,
			nextStartIndex: paginationRef.current.nextStartIndex,
			focusedItemId: lastFocusedItemIdRef.current
		});
	}, [hasMore, hasSearched, onCacheState, results, searchTerm, selectedFilterIds]);

	const handleSearchChange = useCallback((e) => {
		const value = e.value;
		lastFocusedItemIdRef.current = null;
		setSearchTerm(value);
		const filterTypes = buildFilterTypes(selectedFilterIds);
		scheduleSearch(value, filterTypes);
	}, [buildFilterTypes, scheduleSearch, selectedFilterIds]);

	const handleFilterSelection = useCallback((nextSelectedFilterIds) => {
		lastFocusedItemIdRef.current = null;
		setSelectedFilterIds(nextSelectedFilterIds);
		if (searchTerm.trim().length >= 2) {
			scheduleSearch(searchTerm, buildFilterTypes(nextSelectedFilterIds));
		}
	}, [buildFilterTypes, scheduleSearch, searchTerm]);

	const handleItemClick = useCallback(async (item) => {
		if (item.Type === 'Person') {
			return;
		}
		if (item.Type === 'Season') {
			if (!item.SeriesId) {
				console.warn('[Search] Cannot open season without its parent series id.');
				return;
			}
			try {
				const series = await jellyfinService.getItem(item.SeriesId);
				if (!series) return;
				onItemSelect({...series, __initialSeasonId: item.Id});
			} catch (error) {
				console.error('Failed to open season search result:', error);
			}
			return;
		}
		onItemSelect(item);
	}, [onItemSelect]);

	const handlePanelBack = useCallback(() => {
		if (filterPopupOpen) {
			closeFilterPopup();
			return true;
		}
		return false;
	}, [closeFilterPopup, filterPopupOpen]);

	const toolbarActions = usePanelToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		isActive,
		onPanelBack: handlePanelBack
	});

	const handleFilterToggleClick = useCallback((event) => {
		const filterId = event.currentTarget.dataset.filterId;
		if (!filterId) return;
		const isCurrentlySelected = selectedFilterIds.includes(filterId);
		let nextSelected;

		if (isCurrentlySelected) {
			if (selectedFilterIds.length === 1) return;
			nextSelected = selectedFilterIds.filter((id) => id !== filterId);
		} else {
			nextSelected = [...selectedFilterIds, filterId];
		}

		handleFilterSelection(nextSelected);
	}, [handleFilterSelection, selectedFilterIds]);

	const handleSelectAllFilters = useCallback(() => {
		handleFilterSelection(ALL_FILTER_IDS);
	}, [handleFilterSelection]);

	const handleResultCardClick = useCallback((event) => {
		const itemIndex = Number(event.currentTarget.dataset.index);
		const selectedItem = Number.isInteger(itemIndex) ? resultsRef.current[itemIndex] : null;
		if (!selectedItem) return;
		lastFocusedItemIdRef.current = selectedItem.Id || null;
		onCacheState?.({
			searchTerm,
			results: resultsRef.current,
			hasSearched,
			selectedFilterIds,
			hasMore,
			nextStartIndex: paginationRef.current.nextStartIndex,
			focusedItemId: lastFocusedItemIdRef.current
		});
		handleItemClick(selectedItem);
	}, [handleItemClick, hasMore, hasSearched, onCacheState, searchTerm, selectedFilterIds]);

	const renderSearchResult = useCallback(({index, items, ...itemProps}) => {
		const item = items[index];
		if (!item) return null;
		const {onVirtualItemFocusEvent, ...cardProps} = itemProps;
		const presentation = getMediaCardPresentation(item, {includePersonRole: true});
		const imageCandidates = getPosterCardImageUrls(item, {
			maxWidth: 400,
			personMaxWidth: 200,
			includeBackdrop: true,
			includeSeriesFallback: true
		});
		return (
			<PosterMediaCard
				{...cardProps}
				data-index={index}
				itemId={item.Id}
				className={css.resultCard}
				imageCandidates={imageCandidates}
				title={presentation.title}
				subtitle={presentation.subtitle}
				contextBadge={presentation.contextBadge}
				ariaLabel={presentation.ariaLabel}
				placeholderText={item.Name?.charAt(0) || '?'}
				showWatched={item.UserData?.Played === true}
				progressPercent={item.UserData?.PlayedPercentage}
				onClick={handleResultCardClick}
				onFocus={onVirtualItemFocusEvent}
			/>
		);
	}, [handleResultCardClick]);

	return (
		<Panel {...rest}>
			<Header title="Search" />
			<Toolbar
				activeSection="search"
				isActive={isActive}
				{...toolbarActions}
			/>
			<div className={`${css.searchContainer} ${browseCss.panelLayout}`}>
				<MediaPanelBackdrop item={results[0] || null} />
				<MediaBrowseOverlay>
					<MediaBrowseControls
						searchVisible
						searchExpanded
						searchValue={searchTerm}
						searchPlaceholder="Search movies, shows, people..."
						searchSpotlightId="search-input"
						filterSpotlightId="search-filter-trigger"
						onSearchChange={handleSearchChange}
						activeFilterCount={appliedFilterCount}
						onFilterClick={openFilterPopup}
						filterLabel="Search filters"
					/>
				</MediaBrowseOverlay>
				<div className={css.resultsViewport}>
					<MediaVirtualGrid
						id={SEARCH_GRID_ID}
						spotlightId={SEARCH_GRID_ID}
						className={css.resultsVirtualGrid}
						items={loading ? [] : results}
						itemRenderer={renderSearchResult}
						cbScrollTo={captureGridScrollTo}
						isActive={isActive}
						queryKey={`${searchTerm}:${selectedFilterIds.join(',')}`}
						restoreItemId={lastFocusedItemIdRef.current}
						hasMore={hasMore}
						loadingMore={loadingMore}
						loadMoreThreshold={SEARCH_FOCUS_PREFETCH_THRESHOLD}
						onLoadMore={loadNextPage}
						focusedItemIdRef={lastFocusedItemIdRef}
						data-spotlight-container-disabled={loading || results.length === 0}
						verticalScrollbar="auto"
					/>
					{loading ? (
						<div className={css.resultsStateOverlay}>
							<BreezyLoadingOverlay />
						</div>
					) : hasSearched && results.length === 0 ? (
						<div className={css.resultsStateOverlay}>
							<BodyText>No results found for {searchTerm}</BodyText>
						</div>
					) : !hasSearched ? (
						<div className={css.resultsStateOverlay}>
							<BodyText>Enter a search term to find movies, shows, and more</BodyText>
						</div>
					) : null}
				</div>

				<Popup open={filterPopupOpen} onClose={closeFilterPopup} css={popupShellCss}>
					<div
						ref={filterPopupContentRef}
						className={`${popupStyles.popupSurface} ${browseCss.filterPopupContent}`}
						data-popup-focus-scope="true"
					>
						<BodyText className={browseCss.filterPopupTitle}>Search Filters</BodyText>
						<div className={browseCss.filterPopupActions}>
							<Button size="small" onClick={handleSelectAllFilters} className={browseCss.filterPopupActionButton}>
								Select All
							</Button>
							<Button size="small" onClick={closeFilterPopup} className={browseCss.filterPopupActionButton}>
								Done
							</Button>
						</div>
						<div className={browseCss.filterPopupOptions}>
							{FILTER_OPTIONS.map((filter) => (
								<Button
									key={filter.id}
									data-filter-id={filter.id}
									selected={selectedFilterIds.includes(filter.id)}
									onClick={handleFilterToggleClick}
									size="small"
									className={`${browseCss.filterPopupOptionButton} ${selectedFilterIds.includes(filter.id) ? browseCss.filterPopupOptionButtonSelected : ''}`}
								>
									{filter.label}
								</Button>
							))}
						</div>
					</div>
				</Popup>
			</div>
		</Panel>
	);
};

export default SearchPanel;
