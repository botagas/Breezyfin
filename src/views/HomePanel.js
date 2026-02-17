import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel } from '../components/BreezyPanels';
import BodyText from '@enact/sandstone/BodyText';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import Spotlight from '@enact/spotlight';
import jellyfinService from '../services/jellyfinService';
import MediaRow from '../components/MediaRow';
import HeroBanner from '../components/HeroBanner';
import Toolbar from '../components/Toolbar';
import {KeyCodes} from '../utils/keyCodes';
import {getLandscapeCardImageUrl} from '../utils/mediaItemUtils';
import { useBreezyfinSettingsSync } from '../hooks/useBreezyfinSettingsSync';

import css from './HomePanel.module.less';

const HOME_ROW_ORDER = [
	'myRequests',
	'continueWatching',
	'nextUp',
	'recentlyAdded',
	'latestMovies',
	'latestShows'
];

const HomePanel = ({ onItemSelect, onNavigate, onSwitchUser, onLogout, onExit, registerBackHandler, ...rest }) => {
	const [loading, setLoading] = useState(true);
	const [heroItems, setHeroItems] = useState([]);
	const [recentlyAdded, setRecentlyAdded] = useState([]);
	const [continueWatching, setContinueWatching] = useState([]);
	const [nextUp, setNextUp] = useState([]);
	const [latestMovies, setLatestMovies] = useState([]);
	const [latestShows, setLatestShows] = useState([]);
	const [myRequests, setMyRequests] = useState([]);
	const [homeRowSettings, setHomeRowSettings] = useState({
		recentlyAdded: true,
		continueWatching: true,
		nextUp: true,
		latestMovies: true,
		latestShows: true,
		myRequests: true
	});
	const [homeRowOrder, setHomeRowOrder] = useState(HOME_ROW_ORDER);
	const [showMediaBar, setShowMediaBar] = useState(true);
	const homeScrollToRef = useRef(null);

	const loadContent = useCallback(async () => {
		setLoading(true);
		try {
			// Load multiple content sections in parallel
			const [recently, resume, next, movies, shows, taggedLatest] = await Promise.all([
				jellyfinService.getRecentlyAdded(20).catch(err => {
					console.error('Failed to load recently added:', err);
					return [];
				}),
				jellyfinService.getResumeItems(50).catch(err => {
					console.error('Failed to load resume items:', err);
					return [];
				}),
				jellyfinService.getNextUp(24).catch(err => {
					console.error('Failed to load next up:', err);
					return [];
				}),
				jellyfinService.getLatestMedia(['Movie'], 20).catch(err => {
					console.error('Failed to load latest movies:', err);
					return [];
				}),
				jellyfinService.getLatestMedia(['Series'], 20).catch(err => {
					console.error('Failed to load latest shows:', err);
					return [];
				}),
				jellyfinService.getLatestMedia(['Movie', 'Series'], 60).catch(err => {
					console.error('Failed to load tagged latest media:', err);
					return [];
				})
			]);

			const userName = jellyfinService.username || (await jellyfinService.getCurrentUser())?.Name || '';
			const userNeedle = userName.trim();
			const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const userTagPattern = userNeedle
				? new RegExp(`^\\s*\\d+\\s*-\\s*${escapeRegex(userNeedle)}\\s*$`, 'i')
				: null;
			const tagMatchesUser = (item) => {
				if (!userTagPattern) return false;
				const tags = [
					...(item?.Tags || []),
					...(item?.TagItems?.map(tag => tag.Name) || [])
				].filter(Boolean);
				return tags.some(tag => userTagPattern.test(tag));
			};

			const requestItems = (taggedLatest || []).filter(tagMatchesUser);

			// For episodes in resume/next, fetch series data to get unwatched count
			const enhanceEpisodes = async (episodes) => {
				const seriesIds = [...new Set(episodes.filter(e => e.Type === 'Episode' && e.SeriesId).map(e => e.SeriesId))];
				const seriesDataMap = {};

				await Promise.all(seriesIds.map(async (seriesId) => {
					try {
						const series = await jellyfinService.getItem(seriesId);
						if (series && series.UserData) {
							seriesDataMap[seriesId] = series.UserData.UnplayedItemCount || 0;
						}
					} catch (err) {
						console.error('Failed to fetch series data:', err);
					}
				}));

				return episodes.map(episode => {
					if (episode.Type === 'Episode' && episode.SeriesId && seriesDataMap[episode.SeriesId]) {
						return { ...episode, UnplayedItemCount: seriesDataMap[episode.SeriesId] };
					}
					return episode;
				});
			};

			const enhancedResume = await enhanceEpisodes(resume);
			const enhancedNext = await enhanceEpisodes(next);

			// Use recently added for hero banner (movies/shows with backdrops)
			const heroContent = recently.filter(item =>
				(item.Type === 'Movie' || item.Type === 'Series') &&
				item.BackdropImageTags && item.BackdropImageTags.length > 0
			).slice(0, 5);

			setHeroItems(heroContent);
			setRecentlyAdded(recently || []);
			setContinueWatching(enhancedResume || []);
			setNextUp(enhancedNext || []);
			setLatestMovies(movies || []);
			setLatestShows(shows || []);
			setMyRequests(requestItems || []);
		} catch (error) {
			console.error('Failed to load content:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	const applyHomeSettings = useCallback((settingsPayload) => {
		const settings = settingsPayload || {};
		if (settings.homeRows) {
			setHomeRowSettings({
				recentlyAdded: settings.homeRows.recentlyAdded !== false,
				continueWatching: settings.homeRows.continueWatching !== false,
				nextUp: settings.homeRows.nextUp !== false,
				latestMovies: settings.homeRows.latestMovies !== false,
				latestShows: settings.homeRows.latestShows !== false,
				myRequests: settings.homeRows.myRequests !== false
			});
		}
		if (Array.isArray(settings.homeRowOrder)) {
			const normalized = settings.homeRowOrder.filter((key) => HOME_ROW_ORDER.includes(key));
			const resolved = [
				...normalized,
				...HOME_ROW_ORDER.filter((key) => !normalized.includes(key))
			];
			setHomeRowOrder(resolved);
		}
		setShowMediaBar(settings.showMediaBar !== false);
	}, []);

	useBreezyfinSettingsSync(applyHomeSettings);

	useEffect(() => {
		loadContent();
	}, [loadContent]);

	const handleItemClick = useCallback((item) => {
		onItemSelect(item);
	}, [onItemSelect]);

	const getCardImageUrl = useCallback((item) => {
		return getLandscapeCardImageUrl(item, {width: 640});
	}, []);

	const getMediaRowImageUrl = useCallback((id, mediaItem) => {
		return getCardImageUrl(mediaItem);
	}, [getCardImageUrl]);

	const handleNavigation = useCallback((section, data) => {
		if (onNavigate) {
			onNavigate(section, data);
		}
	}, [onNavigate]);

	const captureHomeScrollTo = useCallback((fn) => {
		homeScrollToRef.current = fn;
	}, []);

	const focusTopToolbarAction = useCallback(() => {
		if (Spotlight?.focus?.('toolbar-home')) return true;
		const target = document.querySelector('[data-spotlight-id="toolbar-home"]') ||
			document.querySelector('[data-spotlight-id="toolbar-user"]');
		if (target?.focus) {
			target.focus({preventScroll: true});
			return true;
		}
		return false;
	}, []);

	const handleHomeCardKeyDown = useCallback((e) => {
		const code = e.keyCode || e.which;
		if (code !== KeyCodes.UP) return;
		const rowIndex = Number(e.currentTarget.dataset.rowIndex);
		if (!Number.isInteger(rowIndex) || rowIndex !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		if (typeof homeScrollToRef.current === 'function') {
			homeScrollToRef.current({align: 'top', animate: true});
		}
		focusTopToolbarAction();
	}, [focusTopToolbarAction]);

	const rowConfig = {
		recentlyAdded: {
			title: 'Recently Added',
			items: recentlyAdded,
			showEpisodeProgress: false
		},
		continueWatching: {
			title: 'Continue Watching',
			items: continueWatching,
			showEpisodeProgress: false
		},
		nextUp: {
			title: 'Next Up',
			items: nextUp,
			showEpisodeProgress: false
		},
		latestMovies: {
			title: 'Latest Movies',
			items: latestMovies,
			showEpisodeProgress: false
		},
		latestShows: {
			title: 'Latest TV Shows',
			items: latestShows,
			showEpisodeProgress: false
		},
		myRequests: {
			title: 'My Requests',
			items: myRequests,
			showEpisodeProgress: true
		}
	};

	const visibleRows = homeRowOrder
		.map((key) => ({key, row: rowConfig[key]}))
		.filter(({key, row}) => row && homeRowSettings[key] && row.items.length > 0);
	const hasContent = visibleRows.length > 0;
	const hasHero = showMediaBar && heroItems.length > 0;
	const showEmptyState = !hasContent && !hasHero;

	if (loading) {
		return (
			<Panel {...rest}>
					<Toolbar
						activeSection="home"
						onNavigate={handleNavigation}
						onSwitchUser={onSwitchUser}
						onLogout={onLogout}
						onExit={onExit}
						registerBackHandler={registerBackHandler}
					/>
				<div className={css.loading}>
					<Spinner />
				</div>
			</Panel>
		);
	}

	return (
		<Panel {...rest}>
				<Toolbar
					activeSection="home"
					onNavigate={handleNavigation}
					onSwitchUser={onSwitchUser}
					onLogout={onLogout}
					onExit={onExit}
					registerBackHandler={registerBackHandler}
				/>
			{showEmptyState && (
				<div className={css.emptyStateCenter}>
					<div className={css.emptyState}>
						<BodyText>No content found. Check browser console (F12) for API errors.</BodyText>
					</div>
				</div>
			)}
			<Scroller className={css.scroller} cbScrollTo={captureHomeScrollTo}>
				<div className={css.content}>
					{hasHero && (
						<HeroBanner
							items={heroItems}
							onPlayClick={handleItemClick}
						/>
					)}

					{visibleRows.map(({key, row}, rowIndex) => (
						<MediaRow
							key={key}
							title={row.title}
							items={row.items}
							onItemClick={handleItemClick}
							getImageUrl={getMediaRowImageUrl}
							showEpisodeProgress={row.showEpisodeProgress}
							rowIndex={rowIndex}
							onCardKeyDown={handleHomeCardKeyDown}
						/>
					))}
				</div>
			</Scroller>
		</Panel>
	);
};

export default HomePanel;
