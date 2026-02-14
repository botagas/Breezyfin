import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Input from '@enact/sandstone/Input';
import Button from '../components/BreezyButton';
import SandstoneButton from '@enact/sandstone/Button';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import Popup from '@enact/sandstone/Popup';
import Spottable from '@enact/spotlight/Spottable';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';

import css from './SearchPanel.module.less';

const SpottableDiv = Spottable('div');
const FILTER_OPTIONS = [
	{ id: 'movies', label: 'Movies', types: ['Movie'] },
	{ id: 'series', label: 'Series', types: ['Series'] },
	{ id: 'episodes', label: 'Episodes', types: ['Episode'] },
	{ id: 'people', label: 'People', types: ['Person'] }
];
const ALL_FILTER_IDS = FILTER_OPTIONS.map((filter) => filter.id);

const SearchPanel = ({ onItemSelect, onNavigate, onSwitchUser, onLogout, onExit, ...rest }) => {
	const [searchTerm, setSearchTerm] = useState('');
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const [filterPopupOpen, setFilterPopupOpen] = useState(false);
	const [selectedFilterIds, setSelectedFilterIds] = useState(ALL_FILTER_IDS);
	const searchDebounceRef = useRef(null);
	const filtersById = useMemo(() => {
		const map = new Map();
		FILTER_OPTIONS.forEach((filter) => {
			map.set(filter.id, filter);
		});
		return map;
	}, []);
	const resultsById = useMemo(() => {
		const map = new Map();
		results.forEach((item) => {
			map.set(String(item.Id), item);
		});
		return map;
	}, [results]);
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

	const performSearch = useCallback(async (term, filterTypes) => {
		if (!term || term.trim().length < 2) {
			setResults([]);
			setHasSearched(false);
			return;
		}

		setLoading(true);
		setHasSearched(true);
		try {
			const items = await jellyfinService.search(term.trim(), filterTypes, 50);
			setResults(items);
		} catch (error) {
			console.error('Search failed:', error);
			setResults([]);
		} finally {
			setLoading(false);
		}
	}, []);

	const scheduleSearch = useCallback((term, filterTypes) => {
		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
		}
		searchDebounceRef.current = setTimeout(() => {
			performSearch(term, filterTypes);
		}, 500);
	}, [performSearch]);

	useEffect(() => () => {
		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
			searchDebounceRef.current = null;
		}
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
			console.log('Person clicked:', item);
			return;
		}
		onItemSelect(item);
	}, [onItemSelect]);

	const openFilterPopup = useCallback(() => {
		setFilterPopupOpen(true);
	}, []);

	const closeFilterPopup = useCallback(() => {
		setFilterPopupOpen(false);
	}, []);

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

	const handleResultImageError = useCallback((e) => {
		e.target.style.display = 'none';
		e.target.parentElement.classList.add(css.placeholder);
	}, []);

	const getImageUrl = (item) => {
		if (!item || !jellyfinService.serverUrl || !jellyfinService.accessToken) return null;
		const base = `${jellyfinService.serverUrl}/Items`;

		if (item.Type === 'Person') {
			if (item.PrimaryImageTag) {
				return `${base}/${item.Id}/Images/Primary?maxWidth=200&tag=${item.PrimaryImageTag}&api_key=${jellyfinService.accessToken}`;
			}
			// Fallback without tag
			return `${base}/${item.Id}/Images/Primary?maxWidth=200&api_key=${jellyfinService.accessToken}`;
		}

		if (item.ImageTags?.Primary) {
			return `${base}/${item.Id}/Images/Primary?maxWidth=400&tag=${item.ImageTags.Primary}&api_key=${jellyfinService.accessToken}`;
		}
		if (item.BackdropImageTags?.length) {
			return `${base}/${item.Id}/Images/Backdrop/0?maxWidth=400&api_key=${jellyfinService.accessToken}`;
		}
		// For episodes, try series image
		if (item.SeriesId) {
			if (item.SeriesPrimaryImageTag) {
				return `${base}/${item.SeriesId}/Images/Primary?maxWidth=400&tag=${item.SeriesPrimaryImageTag}&api_key=${jellyfinService.accessToken}`;
			}
			return `${base}/${item.SeriesId}/Images/Primary?maxWidth=400&api_key=${jellyfinService.accessToken}`;
		}
		// Fallback without tag even if ImageTags missing
		if (item.Id) {
			return `${base}/${item.Id}/Images/Primary?maxWidth=400&api_key=${jellyfinService.accessToken}`;
		}
		return null;
	};

	const getItemSubtitle = (item) => {
		switch (item.Type) {
			case 'Episode':
				return `${item.SeriesName || ''} - S${item.ParentIndexNumber || 0}:E${item.IndexNumber || 0}`;
			case 'Movie':
				return item.ProductionYear ? `${item.ProductionYear}` : '';
			case 'Series':
				return item.ProductionYear ? `${item.ProductionYear}` : '';
			case 'Person':
				return item.Role || 'Person';
			default:
				return item.Type || '';
		}
	};

	return (
		<Panel {...rest}>
			<Header title="Search" />
				<Toolbar
					activeSection="search"
					onNavigate={onNavigate}
					onSwitchUser={onSwitchUser}
					onLogout={onLogout}
					onExit={onExit}
				/>
			<div className={css.searchContainer}>
				<Scroller className={css.resultsScroller}>
					<div className={css.resultsContent}>
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
							<div className={css.resultsGrid}>
								{results.map(item => {
									const imageUrl = getImageUrl(item);
									return (
										<SpottableDiv
											key={item.Id}
											data-item-id={item.Id}
											className={css.resultCard}
											onClick={handleResultCardClick}
											onKeyDown={handleResultCardKeyDown}
										>
											<div className={css.cardImage}>
												{imageUrl ? (
													<img
														src={imageUrl}
														alt={item.Name}
														onError={handleResultImageError}
														loading="lazy"
														decoding="async"
														draggable={false}
													/>
												) : (
													<div className={css.placeholderInner}>
														<BodyText>{item.Name?.charAt(0) || '?'}</BodyText>
													</div>
												)}
												{item.UserData?.Played && (
													<div className={css.watchedBadge}>{'\u2713'}</div>
												)}
												{item.UserData?.PlayedPercentage > 0 && item.UserData?.PlayedPercentage < 100 && (
													<div className={css.progressBar}>
														<div
															className={css.progress}
															style={{ width: `${item.UserData.PlayedPercentage}%` }}
														/>
													</div>
												)}
											</div>
											<div className={css.cardInfo}>
												<BodyText className={css.cardTitle}>{item.Name}</BodyText>
												<BodyText className={css.cardSubtitle}>{getItemSubtitle(item)}</BodyText>
											</div>
										</SpottableDiv>
									);
								})}
							</div>
						)}
					</div>
				</Scroller>

				<Popup open={filterPopupOpen} onClose={closeFilterPopup}>
					<div>
						<BodyText>Search Filters</BodyText>
						<div>
							<SandstoneButton size="small" onClick={handleSelectAllFilters}>
								Select All
							</SandstoneButton>
							<SandstoneButton size="small" onClick={closeFilterPopup}>
								Done
							</SandstoneButton>
						</div>
						<div>
							{FILTER_OPTIONS.map((filter) => (
								<SandstoneButton
									key={filter.id}
									data-filter-id={filter.id}
									selected={selectedFilterIds.includes(filter.id)}
									onClick={handleFilterToggleClick}
									size="small"
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
