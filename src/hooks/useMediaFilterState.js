import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {usePopupInitialFocus} from './usePopupInitialFocus';
import {
	areMediaFilterSelectionsEqual,
	buildMediaFilterState,
	normalizeMediaFilterIds
} from '../utils/mediaFilters';

export const useMediaFilterState = ({
	cachedState = null,
	resetKey = null,
	onCacheState = null,
	onApplyFilters = null
} = {}) => {
	const filterPopupContentRef = useRef(null);
	const cachedFilterIds = useMemo(() => normalizeMediaFilterIds(cachedState?.activeFilterIds), [cachedState?.activeFilterIds]);
	const [activeFilterIds, setActiveFilterIds] = useState(cachedFilterIds);
	const [draftFilterIds, setDraftFilterIds] = useState(cachedFilterIds);
	const [filterPopupOpen, setFilterPopupOpen] = useState(false);
	const pendingFilterIdsRef = useRef(null);
	const cacheSnapshotRef = useRef(cachedState || {});

	useEffect(() => {
		if (cachedState && typeof cachedState === 'object') {
			cacheSnapshotRef.current = cachedState;
		}
	}, [cachedState]);

	useEffect(() => {
		setActiveFilterIds((currentIds) => (
			areMediaFilterSelectionsEqual(currentIds, cachedFilterIds) ? currentIds : cachedFilterIds
		));
		setDraftFilterIds((currentIds) => (
			areMediaFilterSelectionsEqual(currentIds, cachedFilterIds) ? currentIds : cachedFilterIds
		));
		setFilterPopupOpen(false);
		pendingFilterIdsRef.current = null;
	}, [cachedFilterIds, resetKey]);

	usePopupInitialFocus(filterPopupOpen, filterPopupContentRef);

	const cacheStateWithFilters = useCallback((cacheKey, nextState) => {
		if (typeof onCacheState !== 'function') return;
		const mergedState = {
			...cacheSnapshotRef.current,
			...(nextState || {}),
			activeFilterIds
		};
		cacheSnapshotRef.current = mergedState;
		onCacheState(cacheKey, mergedState);
	}, [activeFilterIds, onCacheState]);

	const openFilterPopup = useCallback(() => {
		setDraftFilterIds(activeFilterIds);
		setFilterPopupOpen(true);
	}, [activeFilterIds]);

	const closeFilterPopup = useCallback(({restoreDraft = true} = {}) => {
		pendingFilterIdsRef.current = null;
		if (restoreDraft) {
			setDraftFilterIds(activeFilterIds);
		}
		setFilterPopupOpen(false);
	}, [activeFilterIds]);

	const resetDraftFilters = useCallback(() => {
		setDraftFilterIds(['all']);
	}, []);

	const selectDraftFilter = useCallback((event) => {
		const filterId = event.currentTarget?.dataset?.filterId;
		if (!filterId) return;
		setDraftFilterIds((previousIds) => {
			const previous = normalizeMediaFilterIds(previousIds);
			if (filterId === 'all') {
				return ['all'];
			}
			const next = previous.includes(filterId)
				? previous.filter((id) => id !== filterId)
				: [...previous.filter((id) => id !== 'all'), filterId];
			return normalizeMediaFilterIds(next);
		});
	}, []);

	const applyDraftFilters = useCallback(() => {
		const normalizedDraft = normalizeMediaFilterIds(draftFilterIds);
		pendingFilterIdsRef.current = areMediaFilterSelectionsEqual(normalizedDraft, activeFilterIds)
			? null
			: normalizedDraft;
		setFilterPopupOpen(false);
	}, [activeFilterIds, draftFilterIds]);

	const handleFilterPopupHide = useCallback(() => {
		const pendingFilterIds = pendingFilterIdsRef.current;
		pendingFilterIdsRef.current = null;
		if (!pendingFilterIds) {
			setDraftFilterIds(activeFilterIds);
			return;
		}
		setActiveFilterIds(pendingFilterIds);
		setDraftFilterIds(pendingFilterIds);
		onApplyFilters?.(pendingFilterIds);
	}, [activeFilterIds, onApplyFilters]);

	const activeFilterCount = useMemo(() => (
		activeFilterIds.includes('all') ? 0 : activeFilterIds.length
	), [activeFilterIds]);
	const filterState = useMemo(() => buildMediaFilterState(activeFilterIds), [activeFilterIds]);

	return {
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
	};
};
