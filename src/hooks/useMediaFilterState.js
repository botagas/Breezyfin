import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Spotlight from '@enact/spotlight';
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
	triggerSpotlightId,
	onApplyFilters = null
} = {}) => {
	const filterPopupContentRef = useRef(null);
	const cachedFilterIds = useMemo(() => normalizeMediaFilterIds(cachedState?.activeFilterIds), [cachedState?.activeFilterIds]);
	const [activeFilterIds, setActiveFilterIds] = useState(cachedFilterIds);
	const [draftFilterIds, setDraftFilterIds] = useState(cachedFilterIds);
	const [filterPopupOpen, setFilterPopupOpen] = useState(false);

	useEffect(() => {
		setActiveFilterIds((currentIds) => (
			areMediaFilterSelectionsEqual(currentIds, cachedFilterIds) ? currentIds : cachedFilterIds
		));
		setDraftFilterIds((currentIds) => (
			areMediaFilterSelectionsEqual(currentIds, cachedFilterIds) ? currentIds : cachedFilterIds
		));
		setFilterPopupOpen(false);
	}, [cachedFilterIds, resetKey]);

	usePopupInitialFocus(filterPopupOpen, filterPopupContentRef);

	const cacheStateWithFilters = useCallback((cacheKey, nextState) => {
		if (typeof onCacheState !== 'function') return;
		onCacheState(cacheKey, {
			...(nextState || {}),
			activeFilterIds
		});
	}, [activeFilterIds, onCacheState]);

	const openFilterPopup = useCallback(() => {
		setDraftFilterIds(activeFilterIds);
		setFilterPopupOpen(true);
	}, [activeFilterIds]);

	const closeFilterPopup = useCallback(({restoreDraft = true} = {}) => {
		if (restoreDraft) {
			setDraftFilterIds(activeFilterIds);
		}
		setFilterPopupOpen(false);
		if (triggerSpotlightId) {
			setTimeout(() => {
				Spotlight.focus(triggerSpotlightId);
			}, 0);
		}
	}, [activeFilterIds, triggerSpotlightId]);

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
		if (!areMediaFilterSelectionsEqual(normalizedDraft, activeFilterIds)) {
			onApplyFilters?.(normalizedDraft);
			setActiveFilterIds(normalizedDraft);
		}
		closeFilterPopup({restoreDraft: false});
	}, [activeFilterIds, closeFilterPopup, draftFilterIds, onApplyFilters]);

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
		applyDraftFilters
	};
};
