import { useState, useEffect, useCallback, useMemo } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Button from '../components/BreezyButton';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';
import PosterMediaCard from '../components/PosterMediaCard';
import {getMediaItemSubtitle, getPosterCardImageUrl} from '../utils/mediaItemUtils';

import css from './FavoritesPanel.module.less';

const FILTERS = [
	{ id: 'all', label: 'All', types: ['Movie', 'Series', 'Episode'] },
	{ id: 'movies', label: 'Movies', types: ['Movie'] },
	{ id: 'series', label: 'Series', types: ['Series'] },
	{ id: 'episodes', label: 'Episodes', types: ['Episode'] }
];

const FavoritesPanel = ({ onItemSelect, onNavigate, onSwitchUser, onLogout, onExit, registerBackHandler, ...rest }) => {
	const [favorites, setFavorites] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeFilter, setActiveFilter] = useState('all');
	const favoritesById = useMemo(() => {
		const map = new Map();
		favorites.forEach((favorite) => {
			map.set(String(favorite.Id), favorite);
		});
		return map;
	}, [favorites]);

	const loadFavorites = useCallback(async () => {
		setLoading(true);
		try {
			const filterTypes = FILTERS.find(f => f.id === activeFilter)?.types;
			const items = await jellyfinService.getFavorites(filterTypes, 100);
			setFavorites(items);
		} catch (error) {
			console.error('Failed to load favorites:', error);
			setFavorites([]);
		} finally {
			setLoading(false);
		}
	}, [activeFilter]);

	useEffect(() => {
		loadFavorites();
	}, [loadFavorites]);

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

	const handleFilterButtonClick = useCallback((event) => {
		const filterId = event.currentTarget.dataset.filterId;
		if (!filterId) return;
		setActiveFilter(filterId);
	}, []);

	const handleFavoriteCardClick = useCallback((event) => {
		const itemId = event.currentTarget.dataset.itemId;
		const item = favoritesById.get(itemId);
		if (!item) return;
		onItemSelect(item);
	}, [favoritesById, onItemSelect]);

	const handleUnfavoriteClick = useCallback((event) => {
		const itemId = event.currentTarget.dataset.itemId;
		const item = favoritesById.get(itemId);
		if (!item) return;
		handleRemoveFavorite(event, item);
	}, [favoritesById]);

	return (
		<Panel {...rest}>
			<Header title="Favorites" />
				<Toolbar
					activeSection="favorites"
					onNavigate={onNavigate}
					onSwitchUser={onSwitchUser}
					onLogout={onLogout}
					onExit={onExit}
					registerBackHandler={registerBackHandler}
				/>
			<div className={css.favoritesContainer}>
				<Scroller className={css.favoritesScroller}>
					<div className={css.favoritesContent}>
						<div className={css.filters}>
							{FILTERS.map(filter => (
								<Button
									key={filter.id}
									data-filter-id={filter.id}
									className={css.filterButton}
									selected={activeFilter === filter.id}
									onClick={handleFilterButtonClick}
									size="small"
								>
									{filter.label}
								</Button>
							))}
						</div>

						<div className={css.favoritesBody}>
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
								<div className={css.favoritesGrid}>
									{favorites.map(item => {
										const imageUrl = getPosterCardImageUrl(item);
										return (
											<PosterMediaCard
												key={item.Id}
												itemId={item.Id}
												className={css.favoriteCard}
												imageClassName={css.cardImage}
												placeholderClassName={css.placeholder}
												placeholderInnerClassName={css.placeholderInner}
												infoClassName={css.cardInfo}
												titleClassName={css.cardTitle}
												subtitleClassName={css.cardSubtitle}
												imageUrl={imageUrl}
												title={item.Name}
												subtitle={getMediaItemSubtitle(item)}
												placeholderText={item.Name?.charAt(0) || '?'}
												onClick={handleFavoriteCardClick}
												overlayContent={(
													<>
													<Button
														className={css.unfavoriteButton}
														icon="hearthollow"
														size="small"
														data-item-id={item.Id}
														onClick={handleUnfavoriteClick}
														title="Remove from favorites"
													/>
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
													</>
												)}
											/>
										);
									})}
								</div>
							)}
						</div>
					</div>
				</Scroller>
			</div>
		</Panel>
	);
};

export default FavoritesPanel;
