import {useCallback, useEffect, useRef, useState} from 'react';
import jellyfinService from '../../../services/jellyfinService';
import {
	areMediaFilterSelectionsEqual,
	buildMediaFilterState,
	mediaItemMatchesFilters
} from '../../../utils/mediaFilters';
import {getJellyfinUsername} from '../../../utils/jellyfinUser';

const REQUESTS_FALLBACK_SCAN_LIMIT = 6;

export const useLibraryPagination = ({
	activeLibraryId = null,
	activeLibraryCollectionType = null,
	getItemTypesForLibrary,
	pageSize = 60,
	activeFilterIds = ['all'],
	searchTerm = '',
	cachedState = null,
	onStateChange = null
}) => {
	const normalizedSearchTerm = String(searchTerm || '').trim();
	const canRestoreCachedPage =
		Array.isArray(cachedState?.items) &&
		areMediaFilterSelectionsEqual(cachedState?.activeFilterIds, activeFilterIds) &&
		String(cachedState?.searchTerm || '').trim() === normalizedSearchTerm;
	const [loading, setLoading] = useState(!canRestoreCachedPage);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(canRestoreCachedPage && cachedState?.hasMore === true);
	const [items, setItems] = useState(canRestoreCachedPage ? cachedState.items : []);

	const paginationRef = useRef({
		nextStartIndex: canRestoreCachedPage && Number.isFinite(Number(cachedState?.nextStartIndex))
			? Math.max(0, Math.trunc(Number(cachedState.nextStartIndex)))
			: 0,
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
	const skipInitialLoadRef = useRef(canRestoreCachedPage);

	const buildFilterState = useCallback((filterIds) => buildMediaFilterState(filterIds), []);

	const fetchRawPage = useCallback(async ({
		itemTypes,
		startIndex,
		filterState,
		limit
	}) => {
		const requestedLimit = Math.max(1, Math.trunc(Number(limit) || pageSize));
		if (filterState.useMyRequestsSource) {
			const username = paginationRef.current.username || await getJellyfinUsername(jellyfinService);
			paginationRef.current.username = username;
			const myRequestsResult = await jellyfinService.getMyRequests(
				activeLibraryId,
				itemTypes,
				requestedLimit,
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
				sourceHasMore: myRequestsResult?.hasMore === true
			};
		}

		const libraryResult = await jellyfinService.getLibraryItems(
			activeLibraryId,
			itemTypes,
			requestedLimit,
			startIndex,
			{
				filters: filterState.serverFilters,
				searchTerm: normalizedSearchTerm
			}
		);
		const rawItems = Array.isArray(libraryResult) ? libraryResult : [];
		return {
			items: rawItems,
			scannedCount: rawItems.length,
			sourceHasMore: rawItems.length >= requestedLimit
		};
	}, [activeLibraryId, normalizedSearchTerm, pageSize]);

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
			const remainingCapacity = pageSize - collected.length;
			const rawPage = await fetchRawPage({
				itemTypes,
				startIndex: cursor,
				filterState,
				limit: remainingCapacity
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
			const filteredItems = safeItems.filter((item) => mediaItemMatchesFilters(item, filterState, {
				requestMembershipSatisfied: filterState.useMyRequestsSource
			}));
			if (filteredItems.length > 0) {
				collected = [...collected, ...filteredItems];
			}
			sourceHasMore = rawPage?.sourceHasMore === true;
			scans += 1;
		}
		return {
			items: collected,
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
			if (skipInitialLoadRef.current) {
				skipInitialLoadRef.current = false;
				return;
			}
			loadLibraryItems();
		}
	}, [activeLibraryId, loadLibraryItems]);

	useEffect(() => {
		if (loading || typeof onStateChange !== 'function') return;
		onStateChange({
			items,
			hasMore,
			nextStartIndex: paginationRef.current.nextStartIndex
		});
	}, [hasMore, items, loading, onStateChange]);

	return {
		loading,
		loadingMore,
		hasMore,
		items,
		loadNextPage,
		loadingMoreRef
	};
};
