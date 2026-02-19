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
const SearchResultsSpotlightContainer = createLastFocusedSpotlightContainer();

const SearchPanel = ({ onItemSelect, onNavigate, onSwitchUser, onLogout, onExit, registerBackHandler, isActive = false, ...rest }) => {
	const [searchTerm, setSearchTerm] = useState('');
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const {disclosures, openDisclosure, closeDisclosure} = useDisclosureMap(INITIAL_SEARCH_DISCLOSURES);
	const filterPopupOpen = disclosures[SEARCH_DISCLOSURE_KEYS.FILTER_POPUP] === true;
	const [selectedFilterIds, setSelectedFilterIds] = useState(ALL_FILTER_IDS);
	const searchDebounceRef = useRef(null);
	const activeSearchRequestIdRef = useRef(0);
	const toolbarBackHandlerRef = useRef(null);
	const filtersById = useMapById(FILTER_OPTIONS, 'id');
	const resultsById = useMapById(results);
	const appliedFilterCount = useMemo(
		() => (selectedFilterIds.length < FILTER_OPTIONS.length ? selectedFilterIds.length : 0),
		[selectedFilterIds]
	);

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
		if (!term || term.trim().length < 2) {
			if (requestId !== activeSearchRequestIdRef.current) return;
			setResults([]);
			setHasSearched(false);
			setLoading(false);
			return;
		}

		if (requestId !== activeSearchRequestIdRef.current) return;
		setLoading(true);
		setHasSearched(true);
		try {
			const items = await jellyfinService.search(term.trim(), filterTypes, 50);
			if (requestId !== activeSearchRequestIdRef.current) return;
			setResults(Array.isArray(items) ? items : []);
		} catch (error) {
			if (requestId !== activeSearchRequestIdRef.current) return;
			console.error('Search failed:', error);
			setResults([]);
		} finally {
			if (requestId === activeSearchRequestIdRef.current) {
				setLoading(false);
			}
		}
	}, []);

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
			return;
		}
		searchDebounceRef.current = setTimeout(() => {
			performSearch(term, filterTypes, requestId);
		}, 500);
	}, [performSearch]);

	useEffect(() => () => {
		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
			searchDebounceRef.current = null;
		}
		activeSearchRequestIdRef.current += 1;
	}, []);

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
			// Could navigate to person detail view in the future
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
			// Keep at least one selected option.
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
				<Scroller className={css.resultsScroller}>
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
								<SearchResultsSpotlightContainer className={css.resultsGrid} spotlightId="search-results-grid">
									{results.map(item => {
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
												className={css.resultCard}
												{...posterCardClassProps}
												imageUrl={imageUrl}
												title={item.Name}
												subtitle={getMediaItemSubtitle(item, {includePersonRole: true})}
												placeholderText={item.Name?.charAt(0) || '?'}
												onClick={handleResultCardClick}
												onKeyDown={handleResultCardKeyDown}
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
