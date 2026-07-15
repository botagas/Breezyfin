import {useCallback, useEffect, useRef, useState} from 'react';

import {focusSpotlightTarget} from '../utils/gridFocus';
import {getBrowseSearchEventValue, normalizeBrowseSearchValue} from '../utils/browseSearch';

export const useCollapsibleBrowseSearch = ({
	initialValue = '',
	spotlightId,
	debounceMs = 300,
	onApplySearch
} = {}) => {
	const normalizedInitialValue = normalizeBrowseSearchValue(initialValue);
	const [searchValue, setSearchValue] = useState(normalizedInitialValue);
	const [appliedSearchValue, setAppliedSearchValue] = useState(normalizedInitialValue.trim());
	const [searchExpanded, setSearchExpanded] = useState(false);
	const debounceTimerRef = useRef(null);
	const collapseTimerRef = useRef(null);
	const focusTimerRef = useRef(null);
	const onApplySearchRef = useRef(onApplySearch);
	onApplySearchRef.current = onApplySearch;

	const clearTimer = useCallback((timerRef) => {
		if (timerRef.current === null) return;
		clearTimeout(timerRef.current);
		timerRef.current = null;
	}, []);

	useEffect(() => () => {
		clearTimer(debounceTimerRef);
		clearTimer(collapseTimerRef);
		clearTimer(focusTimerRef);
	}, [clearTimer]);

	const restoreSearchState = useCallback((value) => {
		clearTimer(debounceTimerRef);
		clearTimer(collapseTimerRef);
		clearTimer(focusTimerRef);
		const normalizedValue = normalizeBrowseSearchValue(value);
		setSearchValue(normalizedValue);
		setAppliedSearchValue(normalizedValue.trim());
		setSearchExpanded(false);
	}, [clearTimer]);

	const handleSearchReveal = useCallback(() => {
		clearTimer(collapseTimerRef);
		clearTimer(focusTimerRef);
		setSearchExpanded(true);
		focusTimerRef.current = setTimeout(() => {
			focusTimerRef.current = null;
			if (spotlightId) focusSpotlightTarget(spotlightId);
		}, 0);
	}, [clearTimer, spotlightId]);

	const handleSearchChange = useCallback((event) => {
		const nextValue = getBrowseSearchEventValue(event);
		setSearchValue(nextValue);
		clearTimer(debounceTimerRef);
		debounceTimerRef.current = setTimeout(() => {
			debounceTimerRef.current = null;
			const normalizedValue = nextValue.trim();
			setAppliedSearchValue(normalizedValue);
			onApplySearchRef.current?.(normalizedValue);
		}, debounceMs);
	}, [clearTimer, debounceMs]);

	const handleSearchBlur = useCallback((event) => {
		const nextFocused = event?.relatedTarget;
		if (nextFocused && event.currentTarget?.contains?.(nextFocused)) return;
		clearTimer(collapseTimerRef);
		collapseTimerRef.current = setTimeout(() => {
			collapseTimerRef.current = null;
			setSearchExpanded(false);
		}, 0);
	}, [clearTimer]);

	return {
		searchValue,
		appliedSearchValue,
		searchExpanded,
		restoreSearchState,
		handleSearchReveal,
		handleSearchChange,
		handleSearchBlur
	};
};

export default useCollapsibleBrowseSearch;
