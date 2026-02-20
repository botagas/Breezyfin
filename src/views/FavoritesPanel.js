import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Button from '../components/BreezyButton';
import Scroller from '../components/AppScroller';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';
import PosterMediaCard from '../components/PosterMediaCard';
import MediaCardStatusOverlay from '../components/MediaCardStatusOverlay';
import { useMapById } from '../hooks/useMapById';
import { usePanelToolbarActions } from '../hooks/usePanelToolbarActions';
import { usePanelScrollState } from '../hooks/usePanelScrollState';
import {getMediaItemSubtitle, getPosterCardImageUrl} from '../utils/mediaItemUtils';
import {getPosterCardClassProps} from '../utils/posterCardClassProps';

import css from './FavoritesPanel.module.less';

const FILTERS = [
	{ id: 'all', label: 'All', types: ['Movie', 'Series', 'Episode'] },
	{ id: 'movies', label: 'Movies', types: ['Movie'] },
	{ id: 'series', label: 'Series', types: ['Series'] },
	{ id: 'episodes', label: 'Episodes', types: ['Episode'] }
];

const FavoritesPanel = ({
	onItemSelect,
	onNavigate,
	onSwitchUser,
	onLogout,
	onExit,
	registerBackHandler,
	isActive = false,
	cachedState = null,
	onCacheState = null,
	...rest
}) => {
	const [favorites, setFavorites] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeFilter, setActiveFilter] = useState('all');
	const loadRequestIdRef = useRef(0);
	const toolbarActions = usePanelToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		isActive
	});
	const favoritesById = useMapById(favorites);
	const {
		setScrollTop,
		captureScrollTo: captureFavoritesScrollRestore,
		handleScrollStop: handleFavoritesScrollMemoryStop
	} = usePanelScrollState({
		cachedState,
		isActive,
		onCacheState
	});

	const loadFavorites = useCallback(async () => {
		const requestId = loadRequestIdRef.current + 1;
		loadRequestIdRef.current = requestId;
		setLoading(true);
		try {
			const filterTypes = FILTERS.find(f => f.id === activeFilter)?.types;
			const items = await jellyfinService.getFavorites(filterTypes, 100);
			if (requestId !== loadRequestIdRef.current) return;
			setFavorites(items);
		} catch (error) {
			if (requestId !== loadRequestIdRef.current) return;
			console.error('Failed to load favorites:', error);
			setFavorites([]);
		} finally {
			if (requestId === loadRequestIdRef.current) {
				setLoading(false);
			}
		}
	}, [activeFilter]);

	useEffect(() => {
		loadFavorites();
		return () => {
			loadRequestIdRef.current += 1;
		};
	}, [loadFavorites]);

	const handleRemoveFavorite = async (e, item) => {
		e.stopPropagation();
		try {
			await jellyfinService.unmarkFavorite(item.Id);
			setFavorites(prev => prev.filter(f => f.Id !== item.Id));
		} catch (error) {
			console.error('Failed to remove favorite:', error);
		}
	};

	const handleFilterButtonClick = useCallback((event) => {
		const filterId = event.currentTarget.dataset.filterId;
		if (!filterId) return;
		setActiveFilter(filterId);
		setScrollTop(0);
	}, [setScrollTop]);

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
	const posterCardClassProps = getPosterCardClassProps(css);

	return (
		<Panel {...rest}>
			<Header title="Favorites" />
				<Toolbar
					activeSection="favorites"
					{...toolbarActions}
				/>
			<div className={css.favoritesContainer}>
				<Scroller
					className={css.favoritesScroller}
					cbScrollTo={captureFavoritesScrollRestore}
					onScrollStop={handleFavoritesScrollMemoryStop}
				>
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
												{...posterCardClassProps}
												imageUrl={imageUrl}
												title={item.Name}
												subtitle={getMediaItemSubtitle(item)}
												placeholderText={item.Name?.charAt(0) || '?'}
												onClick={handleFavoriteCardClick}
												overlayContent={(
													<MediaCardStatusOverlay
														showWatched={item.UserData?.Played === true}
														watchedClassName={css.watchedBadge}
														progressPercent={item.UserData?.PlayedPercentage}
														progressBarClassName={css.progressBar}
														progressClassName={css.progress}
													>
														<Button
															className={css.unfavoriteButton}
															icon="hearthollow"
															size="small"
															data-item-id={item.Id}
															onClick={handleUnfavoriteClick}
															title="Remove from favorites"
														/>
													</MediaCardStatusOverlay>
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
