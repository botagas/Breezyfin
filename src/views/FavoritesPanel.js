import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Button from '../components/BreezyButton';
import BodyText from '@enact/sandstone/BodyText';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';
import MediaBrowseOverlay from '../components/MediaBrowseOverlay';
import MediaFilterControls from '../components/MediaFilterControls';
import PosterMediaCard from '../components/PosterMediaCard';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import MediaVirtualGrid from '../components/MediaVirtualGrid';
import MediaPanelBackdrop from '../components/MediaPanelBackdrop';
import { useMapById } from '../hooks/useMapById';
import { usePanelToolbarActions } from '../hooks/usePanelToolbarActions';
import {useDisclosureMap} from '../hooks/useDisclosureMap';
import {usePopupInitialFocus} from '../hooks/usePopupInitialFocus';
import {useCollapsibleBrowseSearch} from '../hooks/useCollapsibleBrowseSearch';
import {getPosterCardImageUrls} from '../utils/mediaItemUtils';
import {getMediaCardPresentation} from '../utils/mediaCardPresentation';
import {MEDIA_GRID_PAGE_SIZE} from '../constants/pagination';
import {focusSpotlightTarget} from '../utils/gridFocus';

import css from './FavoritesPanel.module.less';
import browseCss from '../components/MediaBrowseControls.module.less';

const FAVORITES_PAGE_SIZE = MEDIA_GRID_PAGE_SIZE;
const FAVORITES_DISCLOSURE_KEYS = {
	FILTER_POPUP: 'filterPopup'
};
const INITIAL_FAVORITES_DISCLOSURES = {
	[FAVORITES_DISCLOSURE_KEYS.FILTER_POPUP]: false
};

const FILTERS = [
	{ id: 'all', label: 'All', types: ['Movie', 'Series', 'Episode'] },
	{ id: 'movies', label: 'Movies', types: ['Movie'] },
	{ id: 'series', label: 'Series', types: ['Series'] },
	{ id: 'episodes', label: 'Episodes', types: ['Episode'] }
];

const getFilterById = (filterId) => FILTERS.find((filter) => filter.id === filterId) || FILTERS[0];

const normalizeCachedFavorites = (cachedState) => (
	Array.isArray(cachedState?.favorites) ? cachedState.favorites : []
);

const normalizeCachedFilterId = (cachedState) => getFilterById(cachedState?.activeFilter)?.id || FILTERS[0].id;

const normalizeCachedNextStartIndex = (cachedState, fallbackItems) => {
	const nextStartIndex = Number(cachedState?.nextStartIndex);
	if (Number.isFinite(nextStartIndex)) {
		return Math.max(0, Math.trunc(nextStartIndex));
	}
	return Array.isArray(fallbackItems) ? fallbackItems.length : 0;
};

const FavoritesPanel = ({
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
	const cachedFavorites = normalizeCachedFavorites(cachedState);
	const cachedSearchTerm = String(cachedState?.searchTerm || '');
	const [favorites, setFavorites] = useState(() => cachedFavorites);
	const [loading, setLoading] = useState(() => cachedState?.loaded !== true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(() => cachedState?.hasMore === true);
	const [activeFilter, setActiveFilter] = useState(() => normalizeCachedFilterId(cachedState));
	const [draftFilter, setDraftFilter] = useState(() => normalizeCachedFilterId(cachedState));
	const {disclosures, openDisclosure, closeDisclosure} = useDisclosureMap(INITIAL_FAVORITES_DISCLOSURES);
	const filterPopupOpen = disclosures[FAVORITES_DISCLOSURE_KEYS.FILTER_POPUP] === true;
	const loadRequestIdRef = useRef(0);
	const loadingMoreRef = useRef(false);
	const lastCachedStateRef = useRef(cachedState);
	const skipInitialCachedLoadRef = useRef(cachedState?.loaded === true);
	const paginationRef = useRef({
		nextStartIndex: normalizeCachedNextStartIndex(cachedState, cachedFavorites),
		filterTypes: getFilterById(normalizeCachedFilterId(cachedState)).types,
		searchTerm: cachedSearchTerm.trim()
	});
	const lastFocusedCardIdRef = useRef(cachedState?.focusedItemId || null);
	const filterPopupContentRef = useRef(null);
	const pendingFilterRef = useRef(null);
	usePopupInitialFocus(filterPopupOpen, filterPopupContentRef);
	const toolbarActions = usePanelToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		isActive,
		onPanelBack: () => {
			if (!filterPopupOpen) return false;
			pendingFilterRef.current = null;
			closeDisclosure(FAVORITES_DISCLOSURE_KEYS.FILTER_POPUP);
			return true;
		}
	});
	const favoritesById = useMapById(favorites);
	const handleAppliedSearchChange = useCallback(() => {
		lastFocusedCardIdRef.current = null;
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
		initialValue: cachedSearchTerm,
		spotlightId: 'favorites-search-input',
		onApplySearch: handleAppliedSearchChange
	});

	const loadFavorites = useCallback(async (filterId = FILTERS[0].id, nextSearchTerm = '') => {
		const requestId = loadRequestIdRef.current + 1;
		loadRequestIdRef.current = requestId;
		const filterTypes = getFilterById(filterId).types;
		paginationRef.current = {
			nextStartIndex: 0,
			filterTypes,
			searchTerm: nextSearchTerm
		};
		loadingMoreRef.current = false;
		setLoading(true);
		setLoadingMore(false);
		setHasMore(false);
		setFavorites([]);
		try {
			const items = await jellyfinService.getFavorites(filterTypes, FAVORITES_PAGE_SIZE, 0, {
				searchTerm: nextSearchTerm
			});
			if (requestId !== loadRequestIdRef.current) return;
			const safeItems = Array.isArray(items) ? items : [];
			setFavorites(safeItems);
			paginationRef.current.nextStartIndex = safeItems.length;
			setHasMore(safeItems.length >= FAVORITES_PAGE_SIZE);
		} catch (error) {
			if (requestId !== loadRequestIdRef.current) return;
			console.error('Failed to load favorites:', error);
			setFavorites([]);
			setHasMore(false);
		} finally {
			if (requestId === loadRequestIdRef.current) {
				setLoading(false);
			}
		}
	}, []);

	const loadNextPage = useCallback(async () => {
		if (loading || loadingMoreRef.current || !hasMore) return;
		const requestId = loadRequestIdRef.current;
		const {nextStartIndex, filterTypes, searchTerm: pagedSearchTerm} = paginationRef.current;
		loadingMoreRef.current = true;
		setLoadingMore(true);
		try {
			const items = await jellyfinService.getFavorites(filterTypes, FAVORITES_PAGE_SIZE, nextStartIndex, {
				searchTerm: pagedSearchTerm
			});
			if (requestId !== loadRequestIdRef.current) return;
			const safeBatch = Array.isArray(items) ? items : [];
			paginationRef.current.nextStartIndex = nextStartIndex + safeBatch.length;
			if (safeBatch.length === 0) {
				setHasMore(false);
				return;
			}
			setFavorites((previousFavorites) => {
				const existingIds = new Set(previousFavorites.map((item) => String(item.Id)));
				const dedupedBatch = safeBatch.filter((item) => !existingIds.has(String(item.Id)));
				return dedupedBatch.length ? [...previousFavorites, ...dedupedBatch] : previousFavorites;
			});
			setHasMore(safeBatch.length >= FAVORITES_PAGE_SIZE);
		} catch (error) {
			console.error('Failed to load additional favorites:', error);
		} finally {
			if (requestId === loadRequestIdRef.current) {
				setLoadingMore(false);
			}
			loadingMoreRef.current = false;
		}
	}, [hasMore, loading]);

	useEffect(() => {
		if (skipInitialCachedLoadRef.current) {
			skipInitialCachedLoadRef.current = false;
			return undefined;
		}
		loadFavorites(activeFilter, appliedSearchTerm);
		return () => {
			loadRequestIdRef.current += 1;
		};
	}, [activeFilter, appliedSearchTerm, loadFavorites]);

	useEffect(() => {
		const hadCachedState = lastCachedStateRef.current !== null;
		lastCachedStateRef.current = cachedState;
		if (!hadCachedState || cachedState !== null) return;
		loadRequestIdRef.current += 1;
		loadingMoreRef.current = false;
		paginationRef.current = {
			nextStartIndex: 0,
			filterTypes: FILTERS[0].types,
			searchTerm: ''
		};
		const hadActiveSearch = Boolean(appliedSearchTerm);
		restoreSearchState('');
		setFavorites([]);
		setHasMore(false);
		setLoadingMore(false);
		if (activeFilter !== FILTERS[0].id) {
			setActiveFilter(FILTERS[0].id);
			return;
		}
		if (!hadActiveSearch) loadFavorites(FILTERS[0].id, '');
	}, [activeFilter, appliedSearchTerm, cachedState, loadFavorites, restoreSearchState]);

	useEffect(() => {
		if (typeof onCacheState !== 'function') return;
		onCacheState({
			favorites,
			activeFilter,
			hasMore,
			nextStartIndex: paginationRef.current.nextStartIndex,
			searchTerm: appliedSearchTerm,
			loaded: !loading,
			focusedItemId: lastFocusedCardIdRef.current
		});
	}, [activeFilter, appliedSearchTerm, favorites, hasMore, loading, onCacheState]);

	const handleRemoveFavorite = useCallback(async (event, item) => {
		event.stopPropagation();
		try {
			await jellyfinService.unmarkFavorite(item.Id);
			setFavorites(prev => prev.filter(f => f.Id !== item.Id));
		} catch (error) {
			console.error('Failed to remove favorite:', error);
		}
	}, []);

	const handleOpenFilterPopup = useCallback(() => {
		pendingFilterRef.current = null;
		setDraftFilter(activeFilter);
		openDisclosure(FAVORITES_DISCLOSURE_KEYS.FILTER_POPUP);
	}, [activeFilter, openDisclosure]);

	const handleCloseFilterPopup = useCallback(() => {
		pendingFilterRef.current = null;
		closeDisclosure(FAVORITES_DISCLOSURE_KEYS.FILTER_POPUP);
	}, [closeDisclosure]);

	const handleDraftFilterSelect = useCallback((event) => {
		const filterId = event.currentTarget.dataset.filterId;
		if (!filterId) return;
		setDraftFilter(getFilterById(filterId).id);
	}, []);

	const handleResetDraftFilter = useCallback(() => {
		setDraftFilter(FILTERS[0].id);
	}, []);

	const handleApplyDraftFilter = useCallback(() => {
		pendingFilterRef.current = draftFilter;
		closeDisclosure(FAVORITES_DISCLOSURE_KEYS.FILTER_POPUP);
	}, [closeDisclosure, draftFilter]);

	const handleFilterPopupHide = useCallback(() => {
		const nextFilter = pendingFilterRef.current;
		pendingFilterRef.current = null;
		if (!nextFilter || nextFilter === activeFilter) return;
		lastFocusedCardIdRef.current = null;
		setActiveFilter(nextFilter);
	}, [activeFilter]);

	const handleFavoriteCardClick = useCallback((event) => {
		const itemId = event.currentTarget.dataset.itemId;
		lastFocusedCardIdRef.current = itemId || null;
		onCacheState?.({
			favorites,
			activeFilter,
			hasMore,
			nextStartIndex: paginationRef.current.nextStartIndex,
			searchTerm: appliedSearchTerm,
			loaded: !loading,
			focusedItemId: lastFocusedCardIdRef.current
		});
		const item = favoritesById.get(itemId);
		if (!item) return;
		onItemSelect(item);
	}, [activeFilter, appliedSearchTerm, favorites, favoritesById, hasMore, loading, onCacheState, onItemSelect]);

	const handleUnfavoriteClick = useCallback((event) => {
		const itemId = event.currentTarget.dataset.itemId;
		const item = favoritesById.get(itemId);
		if (!item) return;
		handleRemoveFavorite(event, item);
	}, [favoritesById, handleRemoveFavorite]);

	const handleToggleWatchedClick = useCallback(async (event) => {
		event.stopPropagation();
		const itemId = event.currentTarget.dataset.itemId;
		const item = favoritesById.get(itemId);
		if (!item) return;
		const currentWatchedState = item.UserData?.Played === true;
		try {
			await jellyfinService.toggleWatched(item.Id, currentWatchedState);
			const refreshedItem = await jellyfinService.getItem(item.Id).catch(() => null);
			const fallbackPlayedState = !currentWatchedState;
			setFavorites((previousFavorites) => previousFavorites.map((entry) => {
				if (entry.Id !== item.Id) return entry;
				if (!refreshedItem) {
					return {
						...entry,
						UserData: {
							...(entry.UserData || {}),
							Played: fallbackPlayedState,
							PlayedPercentage: fallbackPlayedState ? 100 : 0
						}
					};
				}
				const nextPlayedState = refreshedItem.UserData?.Played ?? fallbackPlayedState;
				return {
					...entry,
					...refreshedItem,
					UserData: {
						...(entry.UserData || {}),
						...(refreshedItem.UserData || {}),
						Played: nextPlayedState,
						PlayedPercentage: typeof refreshedItem.UserData?.PlayedPercentage === 'number'
							? refreshedItem.UserData.PlayedPercentage
							: (nextPlayedState ? 100 : 0)
					}
				};
			}));
		} catch (error) {
			console.error('Failed to toggle watched state:', error);
		}
	}, [favoritesById]);

	const renderFavorite = useCallback(({index, items, onVirtualItemFocusEvent, ...itemProps}) => {
		const item = items[index];
		if (!item) return null;
		const imageCandidates = getPosterCardImageUrls(item);
		const presentation = getMediaCardPresentation(item);
		return (
			<PosterMediaCard
				{...itemProps}
				data-index={index}
				itemId={item.Id}
				className={css.favoriteCard}
				imageCandidates={imageCandidates}
				title={presentation.title}
				subtitle={presentation.subtitle}
				contextBadge={presentation.contextBadge}
				contextBadgeExtras={(
					<>
						<span className={css.favoriteBadge}>{'\u2665'}</span>
						{item.UserData?.Played === true ? <span className={css.watchedBadge}>{'\u2713'}</span> : null}
					</>
				)}
				ariaLabel={presentation.ariaLabel}
				placeholderText={item.Name?.charAt(0) || '?'}
				progressPercent={item.UserData?.PlayedPercentage}
				onClick={handleFavoriteCardClick}
				onFocus={onVirtualItemFocusEvent}
				overlayContent={(
					<div className={css.favoriteOverlayFrame}>
						<div className={css.favoriteActionColumn}>
							<Button
								className={css.unfavoriteButton}
								icon="heart"
								css={{icon: css.favoriteActionIcon}}
								size="small"
								data-item-id={item.Id}
								onClick={handleUnfavoriteClick}
								title="Remove from favorites"
							/>
							<Button
								className={`${css.watchedToggleButton} ${item.UserData?.Played ? css.watchedToggleButtonActive : ''}`}
								icon="check"
								css={{icon: css.watchedActionIcon}}
								size="small"
								data-item-id={item.Id}
								onClick={handleToggleWatchedClick}
								title={item.UserData?.Played ? 'Mark as unwatched' : 'Mark as watched'}
							/>
						</div>
					</div>
				)}
			/>
		);
	}, [handleFavoriteCardClick, handleToggleWatchedClick, handleUnfavoriteClick]);

	const handleToolbarNavigateDown = useCallback(() => (
		focusSpotlightTarget('favorites-filter-trigger')
	), []);

	return (
		<Panel {...rest}>
			<Header title="Favorites" />
				<Toolbar
					activeSection="favorites"
					isActive={isActive}
					onNavigateDown={handleToolbarNavigateDown}
					{...toolbarActions}
				/>
			<div
				className={`${css.favoritesContainer} ${browseCss.panelLayout}`}
			>
				<MediaPanelBackdrop item={favorites[0] || null} />
				<MediaBrowseOverlay compact expanded={searchExpanded} actionCount={2}>
					<MediaFilterControls
						title="Favorites"
						triggerSpotlightId="favorites-filter-trigger"
						activeFilterCount={activeFilter === FILTERS[0].id ? 0 : 1}
						filterPopupOpen={filterPopupOpen}
						filterPopupContentRef={filterPopupContentRef}
						draftFilterIds={[draftFilter]}
						filterOptions={FILTERS}
						searchVisible
						searchExpanded={searchExpanded}
						searchValue={searchTerm}
						searchPlaceholder="Search favorites..."
						searchSpotlightId="favorites-search-input"
						onSearchReveal={handleSearchReveal}
						onSearchChange={handleSearchChange}
						onSearchBlur={handleSearchBlur}
						onTrigger={handleOpenFilterPopup}
						onClose={handleCloseFilterPopup}
						onHide={handleFilterPopupHide}
						onReset={handleResetDraftFilter}
						onApply={handleApplyDraftFilter}
						onDraftSelect={handleDraftFilterSelect}
					/>
				</MediaBrowseOverlay>
				<div className={`${css.favoritesContent} ${browseCss.panelResultsOffset}`}>
						<div className={css.favoritesBody}>
							{loading ? (
								<div className={css.loadingState}>
									<BreezyLoadingOverlay />
								</div>
							) : favorites.length === 0 ? (
								<div className={css.emptyState}>
								<BodyText className={css.emptyTitle}>
									{appliedSearchTerm ? 'No matching favorites' : 'No favorites yet'}
								</BodyText>
								<BodyText className={css.emptyMessage}>
									{appliedSearchTerm
										? `No favorites match “${appliedSearchTerm}” with the current filter`
										: 'Mark items as favorites from the detail view to see them here'}
									</BodyText>
								</div>
							) : (
									<MediaVirtualGrid
										id="favorites-grid"
										spotlightId="favorites-grid"
										className={css.favoritesGrid}
										items={favorites}
										itemRenderer={renderFavorite}
										isActive={isActive}
										queryKey={`${activeFilter}:${appliedSearchTerm}`}
										restoreItemId={lastFocusedCardIdRef.current}
										hasMore={hasMore}
										loadingMore={loadingMore}
										onLoadMore={loadNextPage}
										focusedItemIdRef={lastFocusedCardIdRef}
									/>
							)}
						</div>
					</div>
			</div>
		</Panel>
	);
};

export default FavoritesPanel;
