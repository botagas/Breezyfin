import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Panel, Header} from '../components/BreezyPanels';
import BodyText from '@enact/sandstone/BodyText';
import Toolbar from '../components/Toolbar';
import MediaFilterControls from '../components/MediaFilterControls';
import MediaBrowseOverlay from '../components/MediaBrowseOverlay';
import PanelLandscapeVirtualGrid from '../components/PanelLandscapeVirtualGrid';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import MediaPanelBackdrop from '../components/MediaPanelBackdrop';
import ProviderItemPopup from '../components/ProviderItemPopup';
import jellyfinService from '../services/jellyfinService';
import {useMapById} from '../hooks/useMapById';
import {usePanelToolbarActions} from '../hooks/usePanelToolbarActions';
import {useMediaFilterState} from '../hooks/useMediaFilterState';
import {HOME_SECTION_IDS, getHomeSectionDescriptor} from '../constants/homeSections';
import {MEDIA_GRID_PAGE_SIZE} from '../constants/pagination';
import {getJellyfinUsername} from '../utils/jellyfinUser';
import {
	MEDIA_FILTER_OPTIONS,
	mediaItemMatchesFilters
} from '../utils/mediaFilters';
import {buildGridQuerySignature} from '../utils/gridScrollRestore';
import {focusSpotlightTarget} from '../utils/gridFocus';
import {normalizeDiscoveryMediaItem} from '../utils/discoveryMediaItems';
import {usePluginMediaItemPopup} from '../hooks/usePluginMediaItemPopup';

import css from './LibraryPanel.module.less';
import browseCss from '../components/MediaBrowseControls.module.less';

const PAGE_SIZE = MEDIA_GRID_PAGE_SIZE;
const FILTERED_PAGE_SCAN_LIMIT = 6;
const HOME_SECTION_IMAGE_OPTIONS = Object.freeze({includeBackdrop: true, includeSeriesFallback: true});

const fetchHomeSectionPage = async (section, {
	limit = PAGE_SIZE,
	startIndex = 0
} = {}) => {
	const sectionId = section?.id || section;
	if (section?.source === 'plugin' && section?.pluginSectionId) {
		if (section.kind === 'Discovery' && section.feed) {
			const discoveryResponse = await jellyfinService.getDiscoveryFeed(section.feed, {limit, startIndex});
			if (discoveryResponse?.available !== true) throw new Error('Discovery feed is unavailable');
			return {
				...discoveryResponse.result,
				items: discoveryResponse.result.items.map(normalizeDiscoveryMediaItem)
			};
		}
		const response = await jellyfinService.getBreezyfinHomeSectionItems(
			section.pluginSectionId,
			limit,
			startIndex
		);
		if (response?.available !== true) throw new Error('Server Home section is unavailable');
		return response.result;
	}
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
		case HOME_SECTION_IDS.WATCHLIST:
			return jellyfinService.getLikesWatchlist(limit, startIndex);
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
	const activeSection = section?.source === 'plugin'
		? section
		: getHomeSectionDescriptor(section?.id || section);
	const activeSectionId = activeSection?.id || null;
	const requestIdRef = useRef(0);
	const loadingMoreRef = useRef(false);
	const focusResultsAfterFilterRef = useRef(false);
	const lastFocusedCardIdRef = useRef(cachedState?.focusedItemId || null);
	const nextStartIndexRef = useRef(
		Number.isFinite(Number(cachedState?.nextStartIndex))
			? Math.max(0, Math.trunc(Number(cachedState.nextStartIndex)))
			: 0
	);
	const handleFilterApply = useCallback(() => {
		nextStartIndexRef.current = 0;
		lastFocusedCardIdRef.current = null;
		focusResultsAfterFilterRef.current = true;
	}, []);
	const {
		activeFilterIds,
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
		applyDraftFilters,
		handleFilterPopupHide
	} = useMediaFilterState({
		cachedState,
		resetKey: activeSectionId,
		onCacheState,
		triggerSpotlightId: 'home-section-filter-trigger',
		onApplyFilters: handleFilterApply
	});
	const querySignature = buildGridQuerySignature(activeSectionId, activeFilterIds);
	const cachedQueryMatches = cachedState?.querySignature === querySignature;
	const cachedItems = cachedQueryMatches && Array.isArray(cachedState?.items) ? cachedState.items : [];
	const skipInitialCachedLoadRef = useRef(cachedQueryMatches && cachedState?.loaded === true);
	const [loading, setLoading] = useState(() => !skipInitialCachedLoadRef.current);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(() => cachedQueryMatches && cachedState?.hasMore === true);
	const [items, setItems] = useState(() => cachedItems);
	const [error, setError] = useState('');
	const {
		activateItem: activateDiscoveryItem,
		externalItem,
		externalItemOpen,
		closeExternalItem,
		clearExternalItem
	} = usePluginMediaItemPopup({onItemSelect, isActive});
	if (!cachedQueryMatches && skipInitialCachedLoadRef.current) {
		skipInitialCachedLoadRef.current = false;
		nextStartIndexRef.current = cachedItems.length;
		lastFocusedCardIdRef.current = null;
	}
	const toolbarActions = usePanelToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		isActive,
		onPanelBack: () => {
			if (externalItemOpen) {
				closeExternalItem();
				return true;
			}
			if (filterPopupOpen) {
				closeFilterPopup();
				return true;
			}
			return false;
		}
	});
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
		const userName = currentFilterState.useMyRequestsSource ? await getJellyfinUsername(jellyfinService) : '';

		while (collected.length < PAGE_SIZE && scans < FILTERED_PAGE_SCAN_LIMIT && sourceHasMore) {
			const rawLimit = PAGE_SIZE - collected.length;
			const rawPage = await fetchHomeSectionPage(activeSection, {
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
			items: collected,
			nextStartIndex: cursor,
			hasMore: sourceHasMore
		};
	}, [activeSection, activeSectionId]);

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
				: await fetchHomeSectionPage(activeSection, {
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
	}, [activeSection, activeSectionId, fetchFilteredHomeSectionPage, filterState, hasActiveFilters]);

	const loadNextPage = useCallback(async () => {
		if (!activeSectionId || loading || !hasMore || loadingMoreRef.current) return;
		loadingMoreRef.current = true;
		setLoadingMore(true);
		await loadPage({
			startIndex: nextStartIndexRef.current,
			append: true
		});
	}, [activeSectionId, hasMore, loadPage, loading]);

	useEffect(() => {
		if (skipInitialCachedLoadRef.current) {
			skipInitialCachedLoadRef.current = false;
			return undefined;
		}
		loadPage({startIndex: 0, append: false});
		return () => {
			requestIdRef.current += 1;
		};
	}, [loadPage, querySignature]);

	useEffect(() => {
		if (!activeSectionId) return;
		cacheStateWithFilters(activeSectionId, {
			items,
			hasMore,
			nextStartIndex: nextStartIndexRef.current,
			loaded: !loading,
			querySignature,
			focusedItemId: lastFocusedCardIdRef.current
		});
	}, [activeSectionId, cacheStateWithFilters, hasMore, items, loading, querySignature]);

	const handleGridCardClick = useCallback((event) => {
		const itemId = event.currentTarget.dataset.itemId;
		lastFocusedCardIdRef.current = itemId || null;
		cacheStateWithFilters(activeSectionId, {focusedItemId: lastFocusedCardIdRef.current});
		const selectedItem = itemsById.get(itemId);
		if (!selectedItem) return;
		if (selectedItem.IsDiscoveryItem) activateDiscoveryItem(selectedItem);
		else onItemSelect(selectedItem);
	}, [activateDiscoveryItem, activeSectionId, cacheStateWithFilters, itemsById, onItemSelect]);

	const gridItemRendererProps = useMemo(() => ({
		onItemClick: handleGridCardClick,
		cardClassName: css.gridCard,
		imageOptions: HOME_SECTION_IMAGE_OPTIONS
	}), [handleGridCardClick]);
	const handleToolbarNavigateDown = useCallback(() => focusSpotlightTarget('home-section-filter-trigger'), []);

	const topToolbar = (
		<Toolbar
			activeSection="home"
			isActive={isActive}
			onNavigateDown={handleToolbarNavigateDown}
			{...toolbarActions}
		/>
	);
	const title = activeSection?.title || 'Home Section';
	const showEmpty = !loading && !error && items.length === 0;

	return (
		<Panel {...rest}>
			<Header title={title} />
			{topToolbar}
			<div
				className={`${css.libraryContainer} ${browseCss.panelLayout}`}
				data-input-mode={inputMode}
			>
				<MediaPanelBackdrop item={items[0] || null} />
				<MediaBrowseOverlay compact>
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
									onHide={handleFilterPopupHide}
									onReset={resetDraftFilters}
									onApply={applyDraftFilters}
									onDraftSelect={selectDraftFilter}
								/>
				</MediaBrowseOverlay>
				<div className={`${css.virtualGridViewport} ${browseCss.panelResultsOffset}`}>
					{loading ? <div className={css.loading}><BreezyLoadingOverlay /></div> : null}
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
						<PanelLandscapeVirtualGrid
							id="home-section-grid"
							className={css.virtualGrid}
							items={loading || error ? [] : items}
							itemRendererProps={gridItemRendererProps}
							isActive={isActive && !loading && !error}
							queryKey={querySignature}
							hasMore={!loading && !error && hasMore}
							loadingMore={loadingMore}
							onLoadMore={loadNextPage}
							focusedItemIdRef={lastFocusedCardIdRef}
							focusFirstItemRef={focusResultsAfterFilterRef}
							data-spotlight-container-disabled={loading || Boolean(error) || items.length === 0}
						/>
				</div>
			</div>
			<ProviderItemPopup
				open={externalItemOpen}
				title={externalItem?.Name || 'Discovery'}
				detail={externalItem?.Overview || 'No overview is available.'}
				item={externalItem}
				onClose={closeExternalItem}
				onHide={clearExternalItem}
			/>
		</Panel>
	);
};

export default HomeSectionPanel;
