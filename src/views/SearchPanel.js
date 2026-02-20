import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Input from '@enact/sandstone/Input';
import Button from '../components/BreezyButton';
import SandstoneButton from '@enact/sandstone/Button';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import Popup from '@enact/sandstone/Popup';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';
import PosterMediaCard from '../components/PosterMediaCard';
import MediaCardStatusOverlay from '../components/MediaCardStatusOverlay';
import {getMediaItemSubtitle, getPosterCardImageUrl} from '../utils/mediaItemUtils';
import {getPosterCardClassProps} from '../utils/posterCardClassProps';
import { usePanelBackHandler } from '../hooks/usePanelBackHandler';
import { useDisclosureMap } from '../hooks/useDisclosureMap';
import { useMapById } from '../hooks/useMapById';
import { useCachedScrollTopState, useScrollerScrollMemory } from '../hooks/useScrollerScrollMemory';
import { createLastFocusedSpotlightContainer } from '../utils/spotlightContainerUtils';

import css from './SearchPanel.module.less';
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
const INITIAL_SEARCH_DISCLOSURES = {
	[SEARCH_DISCLOSURE_KEYS.FILTER_POPUP]: false
};
const ALL_FILTER_IDS = FILTER_OPTIONS.map((filter) => filter.id);
const SEARCH_PAGE_SIZE = 60;
const SEARCH_FOCUS_PREFETCH_THRESHOLD = 12;
const SearchResultsSpotlightContainer = createLastFocusedSpotlightContainer();
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
	const filterPopupOpen = disclosures[SEARCH_DISCLOSURE_KEYS.FILTER_POPUP] === true;
	const [selectedFilterIds, setSelectedFilterIds] = useState(() => (
		sanitizeSelectedFilterIds(cachedState?.selectedFilterIds)
	));
	const [hasMore, setHasMore] = useState(() => cachedState?.hasMore === true);
	const [scrollTop, setScrollTop] = useCachedScrollTopState(cachedState?.scrollTop);
	const searchDebounceRef = useRef(null);
	const activeSearchRequestIdRef = useRef(0);
	const loadingMoreRef = useRef(false);
	const lastCachedStateRef = useRef(cachedState);
	const paginationRef = useRef({
		nextStartIndex: getCachedNextStartIndex(cachedState?.nextStartIndex) ?? (
			Array.isArray(cachedState?.results) ? cachedState.results.length : 0
		),
		term: typeof cachedState?.searchTerm === 'string' ? cachedState.searchTerm.trim() : '',
		filterTypes: null
	});
	const toolbarBackHandlerRef = useRef(null);
	const filtersById = useMapById(FILTER_OPTIONS, 'id');
	const resultsById = useMapById(results);
	const {
		captureScrollTo: captureSearchScrollRestore,
		handleScrollStop: handleSearchScrollMemoryStop
	} = useScrollerScrollMemory({
		isActive,
		scrollTop,
		onScrollTopChange: setScrollTop
	});
	const appliedFilterCount = useMemo(
		() => (selectedFilterIds.length < FILTER_OPTIONS.length ? selectedFilterIds.length : 0),
		[selectedFilterIds]
	);

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
		closeDisclosure(SEARCH_DISCLOSURE_KEYS.FILTER_POPUP);
		paginationRef.current = {
			nextStartIndex: 0,
			term: '',
			filterTypes: null
		};
		setSearchTerm('');
		setResults([]);
		setLoading(false);
		setLoadingMore(false);
		setHasSearched(false);
		setSelectedFilterIds(ALL_FILTER_IDS);
		setHasMore(false);
		setScrollTop(0);
	}, [cachedState, closeDisclosure, setScrollTop]);

	const buildFilterTypes = useCallback((filterIds) => {
		if (!Array.isArray(filterIds) || filterIds.length === 0) return null;
		if (filterIds.length >= FILTER_OPTIONS.length) return null;
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
			setHasSearched(false);
			setLoading(false);
			setLoadingMore(false);
			setHasMore(false);
			setScrollTop(0);
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
		setScrollTop(0);
		loadingMoreRef.current = false;
		try {
			const items = await jellyfinService.search(normalizedTerm, filterTypes, SEARCH_PAGE_SIZE, 0);
			if (requestId !== activeSearchRequestIdRef.current) return;
			const safeItems = Array.isArray(items) ? items : [];
			setResults(safeItems);
			setHasMore(safeItems.length === SEARCH_PAGE_SIZE);
			paginationRef.current = {
				nextStartIndex: safeItems.length,
				term: normalizedTerm,
				filterTypes
			};
		} catch (error) {
			if (requestId !== activeSearchRequestIdRef.current) return;
			console.error('Search failed:', error);
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
	}, [setScrollTop]);

	const loadNextPage = useCallback(async () => {
		if (loading || loadingMoreRef.current || !hasSearched || !hasMore) return;
		const {nextStartIndex, term, filterTypes} = paginationRef.current;
		if (!term || term.length < 2) return;

		const requestId = activeSearchRequestIdRef.current;
		loadingMoreRef.current = true;
		setLoadingMore(true);
		try {
			const nextBatch = await jellyfinService.search(term, filterTypes, SEARCH_PAGE_SIZE, nextStartIndex);
			if (requestId !== activeSearchRequestIdRef.current) return;

			const safeBatch = Array.isArray(nextBatch) ? nextBatch : [];
			if (safeBatch.length === 0) {
				setHasMore(false);
				return;
			}

			paginationRef.current.nextStartIndex = nextStartIndex + safeBatch.length;
			setResults((prevResults) => {
				const existingIds = new Set(prevResults.map((item) => String(item.Id)));
				const dedupedBatch = safeBatch.filter((item) => !existingIds.has(String(item.Id)));
				return dedupedBatch.length ? [...prevResults, ...dedupedBatch] : prevResults;
			});
			if (safeBatch.length < SEARCH_PAGE_SIZE) {
				setHasMore(false);
			}
		} catch (error) {
			console.error('Failed to load additional search results:', error);
		} finally {
			if (requestId === activeSearchRequestIdRef.current) {
				setLoadingMore(false);
			}
			loadingMoreRef.current = false;
		}
	}, [hasMore, hasSearched, loading]);

	const scheduleSearch = useCallback((term, filterTypes) => {
		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
		}
		activeSearchRequestIdRef.current += 1;
		const requestId = activeSearchRequestIdRef.current;
		if (!term || term.trim().length < 2) {
			setResults([]);
			setHasSearched(false);
			setLoading(false);
			setLoadingMore(false);
			setHasMore(false);
			setScrollTop(0);
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
	}, [performSearch, setScrollTop]);

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
			scrollTop
		});
	}, [hasMore, hasSearched, onCacheState, results, scrollTop, searchTerm, selectedFilterIds]);

	const handleSearchChange = useCallback((e) => {
		const value = e.value;
		setSearchTerm(value);
		const filterTypes = buildFilterTypes(selectedFilterIds);
		scheduleSearch(value, filterTypes);
	}, [buildFilterTypes, scheduleSearch, selectedFilterIds]);

	const handleFilterSelection = useCallback((nextSelectedFilterIds) => {
		setSelectedFilterIds(nextSelectedFilterIds);
		if (searchTerm.trim().length >= 2) {
			scheduleSearch(searchTerm, buildFilterTypes(nextSelectedFilterIds));
		}
	}, [buildFilterTypes, scheduleSearch, searchTerm]);

	const handleItemClick = useCallback((item) => {
		if (item.Type === 'Person') {
			return;
		}
		onItemSelect(item);
	}, [onItemSelect]);

	const openFilterPopup = useCallback(() => {
		openDisclosure(SEARCH_DISCLOSURE_KEYS.FILTER_POPUP);
	}, [openDisclosure]);

	const closeFilterPopup = useCallback(() => {
		closeDisclosure(SEARCH_DISCLOSURE_KEYS.FILTER_POPUP);
	}, [closeDisclosure]);

	const registerToolbarBackHandler = useCallback((handler) => {
		toolbarBackHandlerRef.current = handler;
	}, []);

	const handleInternalBack = useCallback(() => {
		if (filterPopupOpen) {
			closeDisclosure(SEARCH_DISCLOSURE_KEYS.FILTER_POPUP);
			return true;
		}
		if (typeof toolbarBackHandlerRef.current === 'function') {
			return toolbarBackHandlerRef.current() === true;
		}
		return false;
	}, [closeDisclosure, filterPopupOpen]);

	usePanelBackHandler(registerBackHandler, handleInternalBack, {enabled: isActive});

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
		const itemId = event.currentTarget.dataset.itemId;
		const selectedItem = resultsById.get(itemId);
		if (!selectedItem) return;
		handleItemClick(selectedItem);
	}, [handleItemClick, resultsById]);
	const posterCardClassProps = getPosterCardClassProps(css);

	const handleResultCardKeyDown = useCallback((e) => {
		const card = e.currentTarget;
		const cards = Array.from(card.parentElement.querySelectorAll(`.${css.resultCard}`));
		const idx = cards.indexOf(card);
		const columns = Math.floor(card.parentElement.clientWidth / card.clientWidth) || 1;
		if (e.keyCode === 37 && idx > 0) { // left
			e.preventDefault();
			cards[idx - 1].focus();
		} else if (e.keyCode === 39 && idx < cards.length - 1) { // right
			e.preventDefault();
			cards[idx + 1].focus();
		} else if (e.keyCode === 38 && idx - columns >= 0) { // up
			e.preventDefault();
			cards[idx - columns].focus();
		} else if (e.keyCode === 40 && idx + columns < cards.length) { // down
			e.preventDefault();
			cards[idx + columns].focus();
		}
	}, []);

	const handleResultCardFocus = useCallback((event) => {
		if (!hasMore || loadingMoreRef.current) return;
		const itemIndex = Number(event.currentTarget.dataset.itemIndex);
		if (!Number.isInteger(itemIndex)) return;
		const remainingItems = results.length - itemIndex - 1;
		if (remainingItems <= SEARCH_FOCUS_PREFETCH_THRESHOLD) {
			loadNextPage();
		}
	}, [hasMore, loadNextPage, results.length]);

	const handleScrollerScrollStop = useCallback((event) => {
		handleSearchScrollMemoryStop(event);
		if (event?.reachedEdgeInfo?.bottom) {
			loadNextPage();
		}
	}, [handleSearchScrollMemoryStop, loadNextPage]);

	return (
		<Panel {...rest}>
			<Header title="Search" />
				<Toolbar
					activeSection="search"
					onNavigate={onNavigate}
					onSwitchUser={onSwitchUser}
					onLogout={onLogout}
					onExit={onExit}
					registerBackHandler={registerToolbarBackHandler}
				/>
			<div className={css.searchContainer}>
				<div className={css.searchBox}>
					<div className={css.searchControls}>
						<div className={css.searchFieldShell}>
							<Input
								className={`bf-input-trigger ${css.searchInput}`}
								placeholder="Search movies, shows, people..."
								value={searchTerm}
								onChange={handleSearchChange}
								dismissOnEnter
								size="small"
							/>
						</div>
						<Button
							className={css.filterTriggerButton}
							onClick={openFilterPopup}
							size="small"
							icon="edit"
							aria-label={`Filters${appliedFilterCount ? `, ${appliedFilterCount} applied` : ''}`}
						>
							{appliedFilterCount > 0 && (
								<span className={css.filterAppliedBadge}>{appliedFilterCount}</span>
							)}
						</Button>
					</div>
				</div>
				<Scroller
					className={css.resultsScroller}
					cbScrollTo={captureSearchScrollRestore}
					onScrollStop={handleScrollerScrollStop}
				>
					<div className={css.resultsContent}>
						<div className={css.resultsBody}>
							{loading ? (
								<div className={css.loadingState}>
									<Spinner />
								</div>
							) : hasSearched && results.length === 0 ? (
								<div className={css.emptyState}>
									<BodyText>No results found for {searchTerm}</BodyText>
								</div>
							) : !hasSearched ? (
								<div className={css.emptyState}>
									<BodyText>Enter a search term to find movies, shows, and more</BodyText>
								</div>
							) : (
								<>
									<SearchResultsSpotlightContainer className={css.resultsGrid} spotlightId="search-results-grid">
										{results.map((item, index) => {
											const imageUrl = getPosterCardImageUrl(item, {
												maxWidth: 400,
												personMaxWidth: 200,
												includeBackdrop: true,
												includeSeriesFallback: true
											});
											return (
												<PosterMediaCard
													key={item.Id}
													itemId={item.Id}
													data-item-index={index}
													className={css.resultCard}
													{...posterCardClassProps}
													imageUrl={imageUrl}
													title={item.Name}
													subtitle={getMediaItemSubtitle(item, {includePersonRole: true})}
													placeholderText={item.Name?.charAt(0) || '?'}
													onClick={handleResultCardClick}
													onKeyDown={handleResultCardKeyDown}
													onFocus={handleResultCardFocus}
													overlayContent={(
														<MediaCardStatusOverlay
															showWatched={item.UserData?.Played === true}
															watchedClassName={css.watchedBadge}
															progressPercent={item.UserData?.PlayedPercentage}
															progressBarClassName={css.progressBar}
															progressClassName={css.progress}
														/>
													)}
												/>
											);
										})}
									</SearchResultsSpotlightContainer>
									{loadingMore && (
										<div className={css.loadingMore}>
											<Spinner size="small" />
										</div>
									)}
								</>
							)}
							</div>
					</div>
				</Scroller>

				<Popup open={filterPopupOpen} onClose={closeFilterPopup} css={popupShellCss}>
					<div className={`${popupStyles.popupSurface} ${css.filterPopupContent}`}>
						<BodyText className={css.filterPopupTitle}>Search Filters</BodyText>
						<div className={css.filterPopupActions}>
							<SandstoneButton size="small" onClick={handleSelectAllFilters} className={css.filterPopupActionButton}>
								Select All
							</SandstoneButton>
							<SandstoneButton size="small" onClick={closeFilterPopup} className={css.filterPopupActionButton}>
								Done
							</SandstoneButton>
						</div>
						<div className={css.filterPopupOptions}>
							{FILTER_OPTIONS.map((filter) => (
								<SandstoneButton
									key={filter.id}
									data-filter-id={filter.id}
									selected={selectedFilterIds.includes(filter.id)}
									onClick={handleFilterToggleClick}
									size="small"
									className={css.filterPopupOptionButton}
								>
									{filter.label}
								</SandstoneButton>
							))}
						</div>
					</div>
				</Popup>
			</div>
		</Panel>
	);
};

export default SearchPanel;
