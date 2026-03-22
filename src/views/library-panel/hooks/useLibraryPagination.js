import {useCallback, useEffect, useRef, useState} from 'react';
import jellyfinService from '../../../services/jellyfinService';

export const useLibraryPagination = ({
	activeLibraryId = null,
	activeLibraryCollectionType = null,
	getItemTypesForLibrary,
	pageSize = 60
}) => {
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [items, setItems] = useState([]);

	const paginationRef = useRef({nextStartIndex: 0, itemTypes: undefined});
	const requestIdRef = useRef(0);
	const loadingMoreRef = useRef(false);

	const loadNextPage = useCallback(async () => {
		if (!activeLibraryId || loading || !hasMore || loadingMoreRef.current) return;

		loadingMoreRef.current = true;
		setLoadingMore(true);
		const requestId = requestIdRef.current;
		const {nextStartIndex, itemTypes} = paginationRef.current;

		try {
			const nextBatch = await jellyfinService.getLibraryItems(
				activeLibraryId,
				itemTypes,
				pageSize,
				nextStartIndex
			);
			if (requestId !== requestIdRef.current) return;

			const safeBatch = Array.isArray(nextBatch) ? nextBatch : [];
			if (safeBatch.length === 0) {
				setHasMore(false);
				return;
			}

			paginationRef.current.nextStartIndex = nextStartIndex + safeBatch.length;
			setItems((prevItems) => {
				const existingIds = new Set(prevItems.map((item) => String(item.Id)));
				const dedupedBatch = safeBatch.filter((item) => !existingIds.has(String(item.Id)));
				return dedupedBatch.length ? [...prevItems, ...dedupedBatch] : prevItems;
			});
			if (safeBatch.length < pageSize) {
				setHasMore(false);
			}
		} catch (error) {
			console.error('Failed to load additional library items:', error);
		} finally {
			if (requestId === requestIdRef.current) {
				setLoadingMore(false);
			}
			loadingMoreRef.current = false;
		}
	}, [activeLibraryId, hasMore, loading, pageSize]);

	const loadLibraryItems = useCallback(async () => {
		if (!activeLibraryId) return;
		const requestId = requestIdRef.current + 1;
		requestIdRef.current = requestId;
		const itemTypes = getItemTypesForLibrary(activeLibraryCollectionType);
		paginationRef.current = {nextStartIndex: 0, itemTypes};
		loadingMoreRef.current = false;
		setLoading(true);
		setLoadingMore(false);
		setItems([]);
		setHasMore(false);
		try {
			const firstBatch = await jellyfinService.getLibraryItems(
				activeLibraryId,
				itemTypes,
				pageSize,
				0
			);
			if (requestId !== requestIdRef.current) return;

			const safeFirstBatch = Array.isArray(firstBatch) ? firstBatch : [];
			setItems(safeFirstBatch);
			paginationRef.current.nextStartIndex = safeFirstBatch.length;
			setHasMore(safeFirstBatch.length === pageSize);
		} catch (error) {
			console.error('Failed to load library items:', error);
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false);
			}
		}
	}, [activeLibraryCollectionType, activeLibraryId, getItemTypesForLibrary, pageSize]);

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
