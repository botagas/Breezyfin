import {useCallback, useEffect, useRef, useState} from 'react';
import jellyfinService from '../../../services/jellyfinService';

const REQUESTS_FALLBACK_SCAN_MULTIPLIER = 4;
const REQUESTS_FALLBACK_SCAN_LIMIT = 6;
const ALLOWED_FILTER_IDS = new Set(['all', 'unplayed', 'played', 'favorites', 'myRequests']);

const normalizeFilterIds = (filterIds = []) => {
	const candidateIds = Array.isArray(filterIds) ? filterIds : [];
	const unique = [];
	candidateIds.forEach((id) => {
		if (!ALLOWED_FILTER_IDS.has(id)) return;
		if (unique.includes(id)) return;
		unique.push(id);
	});
	if (unique.length === 0) return ['all'];
	const nonAll = unique.filter((id) => id !== 'all');
	return nonAll.length > 0 ? nonAll : ['all'];
};

const isFavoriteItem = (item) => item?.UserData?.IsFavorite === true;

const getItemPlayedState = (item) => {
	const userData = item?.UserData || {};
	if (Number.isFinite(userData.UnplayedItemCount)) {
		return Number(userData.UnplayedItemCount) <= 0;
	}
	if (userData.Played === true) return true;
	if (Number.isFinite(userData.PlayedPercentage)) {
		return Number(userData.PlayedPercentage) >= 100;
	}
	return false;
};

const matchesCombinedFilters = (item, {
	includeFavorites = false,
	requirePlayed = false,
	requireUnplayed = false
}) => {
	if (includeFavorites && !isFavoriteItem(item)) return false;
	if (requirePlayed && !getItemPlayedState(item)) return false;
	if (requireUnplayed && getItemPlayedState(item)) return false;
	return true;
};

export const useLibraryPagination = ({
	activeLibraryId = null,
	activeLibraryCollectionType = null,
	getItemTypesForLibrary,
	pageSize = 60,
	activeFilterIds = ['all']
}) => {
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [items, setItems] = useState([]);

	const paginationRef = useRef({
		nextStartIndex: 0,
		itemTypes: undefined,
		filterIds: ['all'],
		requestSource: null,
		username: '',
		filterState: {
			filterIds: ['all'],
			useMyRequestsSource: false,
			includeFavorites: false,
			requirePlayed: false,
			requireUnplayed: false,
			serverFilters: null
		}
	});
	const requestIdRef = useRef(0);
	const loadingMoreRef = useRef(false);

	const buildFilterState = useCallback((filterIds) => {
		const normalized = normalizeFilterIds(filterIds);
		const selected = new Set(normalized);
		const useMyRequestsSource = selected.has('myRequests');
		const includeFavorites = selected.has('favorites');
		const hasPlayed = selected.has('played');
		const hasUnplayed = selected.has('unplayed');
		const requirePlayed = hasPlayed && !hasUnplayed;
		const requireUnplayed = hasUnplayed && !hasPlayed;
		const serverFilters = [];
		if (includeFavorites) serverFilters.push('IsFavorite');
		if (requirePlayed) serverFilters.push('IsPlayed');
		if (requireUnplayed) serverFilters.push('IsUnplayed');
		return {
			filterIds: normalized,
			useMyRequestsSource,
			includeFavorites,
			requirePlayed,
			requireUnplayed,
			serverFilters: serverFilters.length > 0 ? serverFilters.join(',') : null
		};
	}, []);

	const getRequestUsername = useCallback(async () => {
		if (jellyfinService.username) return jellyfinService.username;
		try {
			const user = await jellyfinService.getCurrentUser();
			return user?.Name || '';
		} catch (_) {
			return '';
		}
	}, []);

	const fetchRawPage = useCallback(async ({
		itemTypes,
		startIndex,
		filterState
	}) => {
		if (filterState.useMyRequestsSource) {
			const username = paginationRef.current.username || await getRequestUsername();
			paginationRef.current.username = username;
			const myRequestsResult = await jellyfinService.getMyRequests(
				activeLibraryId,
				itemTypes,
				pageSize * REQUESTS_FALLBACK_SCAN_MULTIPLIER,
				startIndex,
				username
			);
			const myRequestItems = Array.isArray(myRequestsResult?.items) ? myRequestsResult.items : [];
			const scannedCount = Number.isFinite(Number(myRequestsResult?.scannedCount))
				? Math.max(0, Math.trunc(Number(myRequestsResult.scannedCount)))
				: myRequestItems.length;
			paginationRef.current.requestSource = myRequestsResult?.source || null;
			return {
				items: myRequestItems,
				scannedCount,
				sourceHasMore: scannedCount >= (pageSize * REQUESTS_FALLBACK_SCAN_MULTIPLIER)
			};
		}

		const libraryResult = await jellyfinService.getLibraryItems(
			activeLibraryId,
			itemTypes,
			pageSize * REQUESTS_FALLBACK_SCAN_MULTIPLIER,
			startIndex,
			{filters: filterState.serverFilters}
		);
		const rawItems = Array.isArray(libraryResult) ? libraryResult : [];
		return {
			items: rawItems,
			scannedCount: rawItems.length,
			sourceHasMore: rawItems.length >= (pageSize * REQUESTS_FALLBACK_SCAN_MULTIPLIER)
		};
	}, [activeLibraryId, getRequestUsername, pageSize]);

	const collectFilteredPage = useCallback(async ({
		itemTypes,
		startIndex,
		requestId,
		filterState
	}) => {
		let cursor = startIndex;
		let collected = [];
		let scans = 0;
		let sourceHasMore = true;
		while (collected.length < pageSize && scans < REQUESTS_FALLBACK_SCAN_LIMIT && sourceHasMore) {
			const rawPage = await fetchRawPage({
				itemTypes,
				startIndex: cursor,
				filterState
			});
			if (requestId !== requestIdRef.current) {
				return {items: [], nextStartIndex: cursor, hasMore: false};
			}
			const safeItems = Array.isArray(rawPage?.items) ? rawPage.items : [];
			const scannedCount = Number.isFinite(Number(rawPage?.scannedCount))
				? Math.max(0, Math.trunc(Number(rawPage.scannedCount)))
				: safeItems.length;
			if (scannedCount <= 0) {
				sourceHasMore = false;
				break;
			}
			cursor += scannedCount;
			const filteredItems = safeItems.filter((item) => matchesCombinedFilters(item, filterState));
			if (filteredItems.length > 0) {
				collected = [...collected, ...filteredItems];
			}
			sourceHasMore = rawPage?.sourceHasMore === true;
			scans += 1;
		}
		return {
			items: collected.slice(0, pageSize),
			nextStartIndex: cursor,
			hasMore: sourceHasMore
		};
	}, [fetchRawPage, pageSize]);

	const loadNextPage = useCallback(async () => {
		if (!activeLibraryId || loading || !hasMore || loadingMoreRef.current) return;

		loadingMoreRef.current = true;
		setLoadingMore(true);
		const requestId = requestIdRef.current;
		const {nextStartIndex, itemTypes, filterState} = paginationRef.current;

		try {
			const requestBatch = await collectFilteredPage({
				itemTypes,
				startIndex: nextStartIndex,
				requestId,
				filterState
			});
			const nextBatch = requestBatch.items;
			if (requestId !== requestIdRef.current) return;

			const safeBatch = Array.isArray(nextBatch) ? nextBatch : [];
			paginationRef.current.nextStartIndex = requestBatch.nextStartIndex;
			if (safeBatch.length === 0) {
				setHasMore(requestBatch.hasMore);
				return;
			}

			setItems((prevItems) => {
				const existingIds = new Set(prevItems.map((item) => String(item.Id)));
				const dedupedBatch = safeBatch.filter((item) => !existingIds.has(String(item.Id)));
				return dedupedBatch.length ? [...prevItems, ...dedupedBatch] : prevItems;
			});
			setHasMore(requestBatch.hasMore);
		} catch (error) {
			console.error('Failed to load additional library items:', error);
		} finally {
			if (requestId === requestIdRef.current) {
				setLoadingMore(false);
			}
			loadingMoreRef.current = false;
		}
	}, [activeLibraryId, collectFilteredPage, hasMore, loading]);

	const loadLibraryItems = useCallback(async () => {
		if (!activeLibraryId) return;
		const requestId = requestIdRef.current + 1;
		requestIdRef.current = requestId;
		const itemTypes = getItemTypesForLibrary(activeLibraryCollectionType);
		const filterState = buildFilterState(activeFilterIds);
		paginationRef.current = {
			nextStartIndex: 0,
			itemTypes,
			filterIds: filterState.filterIds,
			requestSource: null,
			username: '',
			filterState
		};
		loadingMoreRef.current = false;
		setLoading(true);
		setLoadingMore(false);
		setItems([]);
		setHasMore(false);
		try {
			const requestBatch = await collectFilteredPage({
				itemTypes,
				startIndex: 0,
				requestId,
				filterState
			});
			const firstBatch = requestBatch.items;
			if (requestId !== requestIdRef.current) return;

			const safeFirstBatch = Array.isArray(firstBatch) ? firstBatch : [];
			setItems(safeFirstBatch);
			paginationRef.current.nextStartIndex = requestBatch.nextStartIndex;
			setHasMore(requestBatch.hasMore);
		} catch (error) {
			console.error('Failed to load library items:', error);
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false);
			}
		}
	}, [
		activeFilterIds,
		activeLibraryCollectionType,
		activeLibraryId,
		buildFilterState,
		collectFilteredPage,
		getItemTypesForLibrary,
	]);

	useEffect(() => {
		if (activeLibraryId) {
			loadLibraryItems();
		}
	}, [activeLibraryId, loadLibraryItems]);

	return {
		loading,
		loadingMore,
		hasMore,
		items,
		loadNextPage,
		loadingMoreRef
	};
};
