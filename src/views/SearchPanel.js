import { useState, useCallback } from 'react';
import { Panel, Header } from '@enact/sandstone/Panels';
import Input from '@enact/sandstone/Input';
import Button from '@enact/sandstone/Button';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import Spottable from '@enact/spotlight/Spottable';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';

import css from './SearchPanel.module.less';

const SpottableDiv = Spottable('div');

// Debounce helper
const debounce = (func, wait) => {
	let timeout;
	return (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(null, args), wait);
	};
};

const SearchPanel = ({ onItemSelect, onNavigate, onLogout, onExit, ...rest }) => {
	const [searchTerm, setSearchTerm] = useState('');
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const [activeFilter, setActiveFilter] = useState('all');

	const filters = [
		{ id: 'all', label: 'All', types: null },
		{ id: 'movies', label: 'Movies', types: ['Movie'] },
		{ id: 'series', label: 'Series', types: ['Series'] },
		{ id: 'episodes', label: 'Episodes', types: ['Episode'] },
		{ id: 'people', label: 'People', types: ['Person'] }
	];

	const performSearch = useCallback(
		debounce(async (term, filterTypes) => {
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
		}, 500),
		[]
	);

	const handleSearchChange = (e) => {
		const value = e.value;
		setSearchTerm(value);
		const filterTypes = filters.find(f => f.id === activeFilter)?.types;
		performSearch(value, filterTypes);
	};

	const handleFilterChange = (filterId) => {
		setActiveFilter(filterId);
		const filterTypes = filters.find(f => f.id === filterId)?.types;
		if (searchTerm.trim().length >= 2) {
			setLoading(true);
			performSearch(searchTerm, filterTypes);
		}
	};

	const handleItemClick = (item) => {
		if (item.Type === 'Person') {
			// Could navigate to person detail view in the future
			console.log('Person clicked:', item);
			return;
		}
		onItemSelect(item);
	};

	const getImageUrl = (item) => {
		if (item.Type === 'Person') {
			if (item.PrimaryImageTag) {
				return `${jellyfinService.serverUrl}/Items/${item.Id}/Images/Primary?maxWidth=200&tag=${item.PrimaryImageTag}`;
			}
			return null;
		}
		
		if (item.ImageTags && item.ImageTags.Primary) {
			return `${jellyfinService.serverUrl}/Items/${item.Id}/Images/Primary?maxWidth=400&tag=${item.ImageTags.Primary}`;
		}
		if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return `${jellyfinService.serverUrl}/Items/${item.Id}/Images/Backdrop/0?maxWidth=400`;
		}
		// For episodes, try series image
		if (item.SeriesId && item.SeriesPrimaryImageTag) {
			return `${jellyfinService.serverUrl}/Items/${item.SeriesId}/Images/Primary?maxWidth=400&tag=${item.SeriesPrimaryImageTag}`;
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
				onLogout={onLogout}
				onExit={onExit}
			/>
			<div className={css.searchContainer}>
				<div className={css.searchBox}>
					<Input
						className={css.searchInput}
						placeholder="Search movies, shows, people..."
						value={searchTerm}
						onChange={handleSearchChange}
						dismissOnEnter
					/>
				</div>
				
				<div className={css.filters}>
					{filters.map(filter => (
						<Button
							key={filter.id}
							className={css.filterButton}
							selected={activeFilter === filter.id}
							onClick={() => handleFilterChange(filter.id)}
							size="small"
						>
							{filter.label}
						</Button>
					))}
				</div>

				{loading ? (
					<div className={css.loadingState}>
						<Spinner />
					</div>
				) : hasSearched && results.length === 0 ? (
					<div className={css.emptyState}>
						<BodyText>No results found for "{searchTerm}"</BodyText>
					</div>
				) : !hasSearched ? (
					<div className={css.emptyState}>
						<BodyText>Enter a search term to find movies, shows, and more</BodyText>
					</div>
				) : (
					<Scroller className={css.resultsScroller}>
						<div className={css.resultsGrid}>
							{results.map(item => (
								<SpottableDiv
									key={item.Id}
									className={css.resultCard}
									onClick={() => handleItemClick(item)}
									onKeyDown={(e) => {
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
									}}
								>
									<div className={css.cardImage}>
										{getImageUrl(item) ? (
											<img
												src={getImageUrl(item)}
												alt={item.Name}
												onError={(e) => {
													e.target.style.display = 'none';
													e.target.parentElement.classList.add(css.placeholder);
												}}
											/>
										) : (
											<div className={css.placeholderInner}>
												<BodyText>{item.Name?.charAt(0) || '?'}</BodyText>
											</div>
										)}
										{item.UserData?.Played && (
											<div className={css.watchedBadge}>✓</div>
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
							))}
						</div>
					</Scroller>
				)}
			</div>
		</Panel>
	);
};

export default SearchPanel;
