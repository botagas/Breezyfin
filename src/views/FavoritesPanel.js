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
import {KeyCodes} from '../utils/keyCodes';

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
	const favoritesGridRef = useRef(null);
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

	const handleRemoveFavorite = useCallback(async (event, item) => {
		event.stopPropagation();
		try {
			await jellyfinService.unmarkFavorite(item.Id);
			setFavorites(prev => prev.filter(f => f.Id !== item.Id));
		} catch (error) {
			console.error('Failed to remove favorite:', error);
		}
	}, []);

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
	}, [favoritesById, handleRemoveFavorite]);

	const handleToggleWatchedClick = useCallback(async (event) => {
		event.stopPropagation();
		const itemId = event.currentTarget.dataset.itemId;
		const item = favoritesById.get(itemId);
		if (!item) return;
		const currentWatchedState = item.UserData?.Played === true;
		try {
			await jellyfinService.toggleWatched(item.Id, currentWatchedState);
			const refreshedItem = await jellyfinService.getItem(item.Id).catch(() => null);
			const fallbackPlayedState = !currentWatchedState;
			setFavorites((previousFavorites) => previousFavorites.map((entry) => {
				if (entry.Id !== item.Id) return entry;
				if (!refreshedItem) {
					return {
						...entry,
						UserData: {
							...(entry.UserData || {}),
							Played: fallbackPlayedState,
							PlayedPercentage: fallbackPlayedState ? 100 : 0
						}
					};
				}
				const nextPlayedState = refreshedItem.UserData?.Played ?? fallbackPlayedState;
				return {
					...entry,
					...refreshedItem,
					UserData: {
						...(entry.UserData || {}),
						...(refreshedItem.UserData || {}),
						Played: nextPlayedState,
						PlayedPercentage: typeof refreshedItem.UserData?.PlayedPercentage === 'number'
							? refreshedItem.UserData.PlayedPercentage
							: (nextPlayedState ? 100 : 0)
					}
				};
			}));
		} catch (error) {
			console.error('Failed to toggle watched state:', error);
		}
	}, [favoritesById]);

	const getFavoriteCards = useCallback(() => {
		return Array.from(favoritesGridRef.current?.querySelectorAll(`.${css.favoriteCard}`) || []);
	}, []);

	const focusFavoriteCardByIndex = useCallback((index) => {
		const cards = getFavoriteCards();
		if (index < 0 || index >= cards.length) return false;
		const card = cards[index];
		if (!card?.focus) return false;
		card.focus();
		return true;
	}, [getFavoriteCards]);

	const focusFavoriteActionButtonByIndex = useCallback((index, actionType = 'favorite') => {
		const cards = getFavoriteCards();
		if (index < 0 || index >= cards.length) return false;
		const selector = actionType === 'watched' ? `.${css.watchedToggleButton}` : `.${css.unfavoriteButton}`;
		const target = cards[index].querySelector(selector);
		if (!target?.focus) return false;
		target.focus();
		return true;
	}, [getFavoriteCards]);

	const handleFavoriteCardKeyDown = useCallback((event) => {
		const cardIndex = Number(event.currentTarget.dataset.cardIndex);
		if (!Number.isInteger(cardIndex)) return;
		const code = event.keyCode || event.which;
		if (code === KeyCodes.LEFT) {
			event.preventDefault();
			event.stopPropagation();
			focusFavoriteCardByIndex(cardIndex - 1);
		} else if (code === KeyCodes.RIGHT) {
			event.preventDefault();
			event.stopPropagation();
			focusFavoriteCardByIndex(cardIndex + 1);
		} else if (code === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			focusFavoriteActionButtonByIndex(cardIndex, 'favorite');
		}
	}, [focusFavoriteActionButtonByIndex, focusFavoriteCardByIndex]);

	const handleFavoriteActionKeyDown = useCallback((event) => {
		const cardIndex = Number(event.currentTarget.dataset.cardIndex);
		if (!Number.isInteger(cardIndex)) return;
		const actionType = event.currentTarget.dataset.actionType || 'favorite';
		const code = event.keyCode || event.which;
		if (code === KeyCodes.ENTER || code === KeyCodes.OK || code === KeyCodes.SPACE) {
			event.stopPropagation();
			return;
		}
		if (code === KeyCodes.UP) {
			event.stopPropagation();
			return;
		}
		if (code === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			focusFavoriteCardByIndex(cardIndex);
			return;
		}
		if (code === KeyCodes.LEFT) {
			event.preventDefault();
			event.stopPropagation();
			if (actionType === 'watched') {
				focusFavoriteActionButtonByIndex(cardIndex, 'favorite');
				return;
			}
			if (!focusFavoriteActionButtonByIndex(cardIndex - 1, 'favorite')) {
				focusFavoriteCardByIndex(cardIndex - 1);
			}
			return;
		}
		if (code === KeyCodes.RIGHT) {
			event.preventDefault();
			event.stopPropagation();
			if (actionType === 'favorite') {
				if (!focusFavoriteActionButtonByIndex(cardIndex, 'watched')) {
					if (!focusFavoriteActionButtonByIndex(cardIndex + 1, 'favorite')) {
						focusFavoriteCardByIndex(cardIndex + 1);
					}
				}
				return;
			}
			if (!focusFavoriteActionButtonByIndex(cardIndex + 1, 'watched')) {
				focusFavoriteCardByIndex(cardIndex + 1);
			}
		}
	}, [focusFavoriteActionButtonByIndex, focusFavoriteCardByIndex]);

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
								<div className={css.favoritesGrid} ref={favoritesGridRef}>
									{favorites.map((item, index) => {
										const imageUrl = getPosterCardImageUrl(item);
										return (
											<PosterMediaCard
												key={item.Id}
												itemId={item.Id}
												data-card-index={index}
												className={css.favoriteCard}
												{...posterCardClassProps}
												imageUrl={imageUrl}
												title={item.Name}
												subtitle={getMediaItemSubtitle(item)}
												placeholderText={item.Name?.charAt(0) || '?'}
												onClick={handleFavoriteCardClick}
												onKeyDown={handleFavoriteCardKeyDown}
												overlayContent={(
													<MediaCardStatusOverlay
														progressPercent={item.UserData?.PlayedPercentage}
														progressBarClassName={css.progressBar}
														progressClassName={css.progress}
													>
														<div className={css.favoriteOverlayFrame}>
															<div className={css.favoriteBadgeColumn}>
																<div className={css.favoriteBadge}>{'\u2665'}</div>
																{item.UserData?.Played === true ? (
																	<div className={css.watchedBadge}>{'\u2713'}</div>
																) : null}
															</div>
															<div className={css.favoriteActionColumn}>
																<Button
																	className={css.unfavoriteButton}
																	icon="heart"
																	css={{icon: css.favoriteActionIcon}}
																	size="small"
																	data-item-id={item.Id}
																	data-card-index={index}
																	data-action-type="favorite"
																	onClick={handleUnfavoriteClick}
																	onKeyDown={handleFavoriteActionKeyDown}
																	title="Remove from favorites"
																/>
																<Button
																	className={`${css.watchedToggleButton} ${item.UserData?.Played ? css.watchedToggleButtonActive : ''}`}
																	icon="check"
																	css={{icon: css.watchedActionIcon}}
																	size="small"
																	data-item-id={item.Id}
																	data-card-index={index}
																	data-action-type="watched"
																	onClick={handleToggleWatchedClick}
																	onKeyDown={handleFavoriteActionKeyDown}
																	title={item.UserData?.Played ? 'Mark as unwatched' : 'Mark as watched'}
																/>
															</div>
														</div>
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
