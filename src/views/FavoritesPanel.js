import { useState, useEffect } from 'react';
import { Panel, Header } from '@enact/sandstone/Panels';
import Button from '@enact/sandstone/Button';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import Spottable from '@enact/spotlight/Spottable';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';

import css from './FavoritesPanel.module.less';

const SpottableDiv = Spottable('div');

const FavoritesPanel = ({ onItemSelect, onNavigate, onLogout, onExit, ...rest }) => {
	const [favorites, setFavorites] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeFilter, setActiveFilter] = useState('all');

	const filters = [
		{ id: 'all', label: 'All', types: ['Movie', 'Series', 'Episode'] },
		{ id: 'movies', label: 'Movies', types: ['Movie'] },
		{ id: 'series', label: 'Series', types: ['Series'] },
		{ id: 'episodes', label: 'Episodes', types: ['Episode'] }
	];

	useEffect(() => {
		loadFavorites();
	}, [activeFilter]);

	const loadFavorites = async () => {
		setLoading(true);
		try {
			const filterTypes = filters.find(f => f.id === activeFilter)?.types;
			const items = await jellyfinService.getFavorites(filterTypes, 100);
			setFavorites(items);
		} catch (error) {
			console.error('Failed to load favorites:', error);
			setFavorites([]);
		} finally {
			setLoading(false);
		}
	};

	const handleFilterChange = (filterId) => {
		setActiveFilter(filterId);
	};

	const handleItemClick = (item) => {
		onItemSelect(item);
	};

	const handleRemoveFavorite = async (e, item) => {
		e.stopPropagation();
		try {
			await jellyfinService.unmarkFavorite(item.Id);
			// Remove from local state
			setFavorites(prev => prev.filter(f => f.Id !== item.Id));
		} catch (error) {
			console.error('Failed to remove favorite:', error);
		}
	};

	const getImageUrl = (item) => {
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
			default:
				return item.Type || '';
		}
	};

	return (
		<Panel {...rest}>
			<Header title="Favorites" />
			<Toolbar
				activeSection="favorites"
				onNavigate={onNavigate}
				onLogout={onLogout}
				onExit={onExit}
			/>
			<div className={css.favoritesContainer}>
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
					<Button
						className={css.refreshButton}
						onClick={loadFavorites}
						size="small"
						icon="refresh"
					>
						Refresh
					</Button>
				</div>

				{loading ? (
					<div className={css.loadingState}>
						<Spinner />
					</div>
				) : favorites.length === 0 ? (
					<div className={css.emptyState}>
						<BodyText className={css.emptyTitle}>No favorites yet</BodyText>
						<BodyText className={css.emptyMessage}>
							Mark items as favorites from the detail view to see them here
						</BodyText>
					</div>
				) : (
					<Scroller className={css.favoritesScroller}>
						<div className={css.favoritesGrid}>
							{favorites.map(item => (
								<SpottableDiv
									key={item.Id}
									className={css.favoriteCard}
									onClick={() => handleItemClick(item)}
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
										<Button
											className={css.unfavoriteButton}
											icon="hearthollow"
											size="small"
											onClick={(e) => handleRemoveFavorite(e, item)}
											title="Remove from favorites"
										/>
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

export default FavoritesPanel;
