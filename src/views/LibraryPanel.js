import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import Popup from '@enact/sandstone/Popup';
import Toolbar from '../components/Toolbar';
import Button from '../components/BreezyButton';
import PosterMediaCard from '../components/PosterMediaCard';
import MediaCardStatusOverlay from '../components/MediaCardStatusOverlay';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import Spotlight from '@enact/spotlight';
import { createLastFocusedSpotlightContainer } from '../utils/spotlightContainerUtils';
import { useMapById } from '../hooks/useMapById';
import { usePanelToolbarActions } from '../hooks/usePanelToolbarActions';
import { usePanelScrollState } from '../hooks/usePanelScrollState';
import { usePopupInitialFocus } from '../hooks/usePopupInitialFocus';
import { useLibraryPagination } from './library-panel/hooks/useLibraryPagination';
import { useLibraryScrollPersistence } from './library-panel/hooks/useLibraryScrollPersistence';
import {
	getPlaybackProgressPercent,
	getPosterCardImageUrl,
	getSeriesUnplayedCount,
	hasStartedWatching
} from '../utils/mediaItemUtils';
import {ensureFocusTargetVisibleWithTopChrome} from '../utils/verticalFocusScroll';

import css from './LibraryPanel.module.less';
import searchCss from './SearchPanel.module.less';
import popupStyles from '../styles/popupStyles.module.less';
import {popupShellCss} from '../styles/popupStyles';

const FOCUS_PREFETCH_THRESHOLD = 12;
const LibraryGridSpotlightContainer = createLastFocusedSpotlightContainer('div');
const LIBRARY_FILTER_OPTIONS = [
	{id: 'all', label: 'All'},
	{id: 'unplayed', label: 'Unplayed'},
	{id: 'played', label: 'Played'},
	{id: 'favorites', label: 'Favorites'},
	{id: 'myRequests', label: 'My Requests'}
];
const normalizeFilterIds = (filterIds = []) => {
	const allowed = new Set(LIBRARY_FILTER_OPTIONS.map((entry) => entry.id));
	const incoming = Array.isArray(filterIds) ? filterIds : [];
	const unique = [];
	incoming.forEach((id) => {
		if (!allowed.has(id)) return;
		if (unique.includes(id)) return;
		unique.push(id);
	});
	if (unique.length === 0) return ['all'];
	const nonAll = unique.filter((id) => id !== 'all');
	return nonAll.length > 0 ? nonAll : ['all'];
};

const areFilterSelectionsEqual = (left = [], right = []) => {
	if (!Array.isArray(left) || !Array.isArray(right)) return false;
	if (left.length !== right.length) return false;
	return left.every((id, index) => id === right[index]);
};

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
	const filterPopupContentRef = useRef(null);
	const lastFocusedCardIdRef = useRef(null);
	const activeLibraryId = library?.Id || null;
	const activeLibraryCollectionType = library?.CollectionType || null;
	const isPointerInputMode = inputMode === 'pointer';
	const [activeFilterIds, setActiveFilterIds] = useState(['all']);
	const [draftFilterIds, setDraftFilterIds] = useState(['all']);
	const [filterPopupOpen, setFilterPopupOpen] = useState(false);

	useEffect(() => {
		const defaultFilters = ['all'];
		setActiveFilterIds(defaultFilters);
		setDraftFilterIds(defaultFilters);
		setFilterPopupOpen(false);
	}, [activeLibraryId]);
	usePopupInitialFocus(filterPopupOpen, filterPopupContentRef);
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
		isActive,
		onPanelBack: () => {
			if (!filterPopupOpen) return false;
			setFilterPopupOpen(false);
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
		pageSize: 60,
		activeFilterIds
	});
	const filterIds = useMemo(() => LIBRARY_FILTER_OPTIONS.map((entry) => entry.id), []);
	const filteredOptions = useMemo(() => {
		if (library?.CollectionType === 'movies') {
			return LIBRARY_FILTER_OPTIONS.filter((entry) => entry.id !== 'played');
		}
		return LIBRARY_FILTER_OPTIONS;
	}, [library?.CollectionType]);
	const activeFilterCount = useMemo(() => (
		activeFilterIds.includes('all') ? 0 : activeFilterIds.length
	), [activeFilterIds]);
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
		lastFocusedCardIdRef.current = event.currentTarget?.dataset?.itemId || null;
		if (isPointerInputMode) return;
		ensureFocusTargetVisibleWithTopChrome(event.currentTarget);
		if (!hasMore || loadingMoreRef.current) return;
		const itemIndex = Number(event.currentTarget.dataset.itemIndex);
		if (!Number.isInteger(itemIndex)) return;
		const remainingItems = items.length - itemIndex - 1;
		if (remainingItems <= FOCUS_PREFETCH_THRESHOLD) {
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
		const code = event.keyCode || event.which;
		if (code !== 39) return;
		const cards = Array.from(panelRootRef.current?.querySelectorAll(`.${css.gridCard}`) || []);
		const currentCard = event.currentTarget;
		if (!currentCard || cards.length === 0) return;
		const currentTop = currentCard.offsetTop;
		const currentLeft = currentCard.offsetLeft;
		const hasRightNeighbor = cards.some((candidate) => {
			if (candidate === currentCard) return false;
			return candidate.offsetTop === currentTop && candidate.offsetLeft > currentLeft;
		});
		if (!hasRightNeighbor) {
			event.preventDefault();
			event.stopPropagation();
			focusLibraryFilterTrigger();
		}
	}, [focusLibraryFilterTrigger]);

	const handleFilterTrigger = useCallback(() => {
		setDraftFilterIds(activeFilterIds);
		setFilterPopupOpen(true);
	}, [activeFilterIds]);

	const closeFilterPopup = useCallback(({restoreDraft = true} = {}) => {
		if (restoreDraft) {
			setDraftFilterIds(activeFilterIds);
		}
		setFilterPopupOpen(false);
		setTimeout(() => {
			Spotlight.focus('library-filter-trigger');
		}, 0);
	}, [activeFilterIds]);

	const handleResetFilters = useCallback(() => {
		setDraftFilterIds(['all']);
	}, []);

	const handleDraftFilterSelect = useCallback((event) => {
		const filterId = event.currentTarget?.dataset?.filterId;
		if (!filterId || !filterIds.includes(filterId)) return;
		setDraftFilterIds((previousIds) => {
			const previous = normalizeFilterIds(previousIds);
			if (filterId === 'all') {
				return ['all'];
			}
			const next = previous.includes(filterId)
				? previous.filter((id) => id !== filterId)
				: [...previous.filter((id) => id !== 'all'), filterId];
			return normalizeFilterIds(next);
		});
	}, [filterIds]);

	const handleApplyFilters = useCallback(() => {
		const normalizedDraft = normalizeFilterIds(draftFilterIds);
		if (!areFilterSelectionsEqual(normalizedDraft, activeFilterIds)) {
			commitCurrentScrollNow();
			setScrollTop(0);
			setActiveFilterIds(normalizedDraft);
		}
		closeFilterPopup({restoreDraft: false});
	}, [activeFilterIds, closeFilterPopup, commitCurrentScrollNow, draftFilterIds, setScrollTop]);

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
			<div className={css.libraryContainer} ref={panelRootRef} onKeyDownCapture={handlePanelKeyDownCapture}>
				<div
					ref={scrollerRef}
					className={css.nativeScroller}
					onScroll={handleScrollerScroll}
				>
					<div className={css.contentFrame}>
						<div className={css.filterOverlay}>
							<div className={`${css.filterOverlayControls} ${searchCss.searchControls}`}>
								<Button
									size="small"
									icon="edit"
									spotlightId="library-filter-trigger"
									onClick={handleFilterTrigger}
									className={searchCss.filterTriggerButton}
									aria-label={`Library filters${activeFilterCount > 0 ? `, ${activeFilterCount} applied` : ''}`}
									title={`Library filters${activeFilterCount > 0 ? `, ${activeFilterCount} applied` : ''}`}
								/>
								{activeFilterCount > 0 && (
									<span className={searchCss.filterAppliedBadge}>{activeFilterCount}</span>
								)}
							</div>
						</div>
						<LibraryGridSpotlightContainer className={css.gridContainer} spotlightId="library-grid">
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
										onKeyDown={handleGridCardKeyDown}
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
			<Popup open={filterPopupOpen} onClose={closeFilterPopup} css={popupShellCss}>
				<div
					ref={filterPopupContentRef}
					className={`${popupStyles.popupSurface} ${searchCss.filterPopupContent}`}
					role="dialog"
					aria-label="Library filters"
				>
					<BodyText className={searchCss.filterPopupTitle}>Library Filters</BodyText>
					<div className={searchCss.filterPopupActions}>
						<Button size="small" onClick={handleResetFilters} className={searchCss.filterPopupActionButton}>
							Reset
						</Button>
						<Button size="small" onClick={handleApplyFilters} className={searchCss.filterPopupActionButton}>
							Done
						</Button>
					</div>
					<div className={searchCss.filterPopupOptions}>
						{filteredOptions.map((option) => (
							<Button
								key={option.id}
								data-filter-id={option.id}
								selected={draftFilterIds.includes(option.id)}
								onClick={handleDraftFilterSelect}
								className={`${searchCss.filterPopupOptionButton} ${draftFilterIds.includes(option.id) ? searchCss.filterPopupOptionButtonSelected : ''}`}
							>
								{option.label}
							</Button>
						))}
					</div>
				</div>
			</Popup>
		</Panel>
	);
};

export default LibraryPanel;
