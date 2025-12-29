import { useState, useEffect } from 'react';
import { Panel } from '@enact/sandstone/Panels';
import BodyText from '@enact/sandstone/BodyText';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import jellyfinService from '../services/jellyfinService';
import MediaRow from '../components/MediaRow';
import HeroBanner from '../components/HeroBanner';
import Toolbar from '../components/Toolbar';

import css from './HomePanel.module.less';

const HomePanel = ({ onItemSelect, onNavigate, onLogout, onExit, ...rest }) => {
	const [loading, setLoading] = useState(true);
	const [heroItems, setHeroItems] = useState([]);
	const [recentlyAdded, setRecentlyAdded] = useState([]);
	const [continueWatching, setContinueWatching] = useState([]);
	const [nextUp, setNextUp] = useState([]);
	const [latestMovies, setLatestMovies] = useState([]);
	const [latestShows, setLatestShows] = useState([]);
	const [homeRowSettings, setHomeRowSettings] = useState({
		recentlyAdded: true,
		continueWatching: true,
		nextUp: true,
		latestMovies: true,
		latestShows: true
	});

	useEffect(() => {
		try {
			const stored = localStorage.getItem('breezyfinSettings');
			if (stored) {
				const parsed = JSON.parse(stored);
				if (parsed.homeRows) {
					setHomeRowSettings({
						recentlyAdded: parsed.homeRows.recentlyAdded !== false,
						continueWatching: parsed.homeRows.continueWatching !== false,
						nextUp: parsed.homeRows.nextUp !== false,
						latestMovies: parsed.homeRows.latestMovies !== false,
						latestShows: parsed.homeRows.latestShows !== false
					});
				}
			}
		} catch (err) {
			console.warn('Failed to load home row settings:', err);
		}
		loadContent();
	}, []);

	const loadContent = async () => {
		setLoading(true);
		try {
			console.log('Loading content...');
			// Load multiple content sections in parallel
			const [recently, resume, next, movies, shows] = await Promise.all([
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
				})
			]);

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

			console.log('Loaded data:', {
				recently: recently.length,
				resume: resume.length,
				next: next.length,
				movies: movies.length,
				shows: shows.length
			});
			console.log('Recently added items:', recently);
			console.log('Resume items:', enhancedResume);
			console.log('Next up items:', enhancedNext);

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
		} catch (error) {
			console.error('Failed to load content:', error);
		} finally {
			setLoading(false);
		}
	};

	const handleItemClick = (item) => {
		onItemSelect(item);
	};

	const getCardImageUrl = (item) => {
		// Prefer episode-specific art when the item is an episode (e.g., Continue Watching / Next Up)
		if (item?.Type === 'Episode' && item?.ImageTags?.Primary) {
			return jellyfinService.getImageUrl(item.Id, 'Primary', 640);
		}

		if (item?.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return jellyfinService.getBackdropUrl(item.Id, 0, 640);
		}

		// Fallback to series backdrop if available
		if (item?.SeriesId && item?.ParentBackdropImageTags?.length) {
			return jellyfinService.getBackdropUrl(item.SeriesId, 0, 640);
		}

		// Fallback to primary art
		if (item?.ImageTags?.Primary) {
			return jellyfinService.getImageUrl(item.Id, 'Primary', 640);
		}

		// Last resort: series primary
		if (item?.SeriesId) {
			return jellyfinService.getImageUrl(item.SeriesId, 'Primary', 640);
		}

		return '';
	};

	const handleNavigation = (section, data) => {
		console.log('Navigate to:', section, data);
		if (onNavigate) {
			onNavigate(section, data);
		}
	};

	const hasContent =
		(homeRowSettings.recentlyAdded && recentlyAdded.length > 0) ||
		(homeRowSettings.continueWatching && continueWatching.length > 0) ||
		(homeRowSettings.nextUp && nextUp.length > 0) ||
		(homeRowSettings.latestMovies && latestMovies.length > 0) ||
		(homeRowSettings.latestShows && latestShows.length > 0);

	if (loading) {
		return (
			<Panel {...rest}>
				<Toolbar 
					activeSection="home"
					onNavigate={handleNavigation}
					onLogout={onLogout}
					onExit={onExit}
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
				onLogout={onLogout}
				onExit={onExit}
			/>
			<Scroller className={css.scroller}>
				<div className={css.content}>
					{heroItems.length > 0 && (
						<HeroBanner
							items={heroItems}
							onPlayClick={handleItemClick}
						/>
					)}

					{!hasContent && (
						<div className={css.emptyState}>
							<BodyText>No content found. Check browser console (F12) for API errors.</BodyText>
						</div>
					)}

					{homeRowSettings.recentlyAdded && recentlyAdded.length > 0 && (
						<MediaRow
							title="Recently Added"
							items={recentlyAdded}
							onItemClick={handleItemClick}
							getImageUrl={(id, item) => getCardImageUrl(item)}
						/>
					)}

					{homeRowSettings.continueWatching && continueWatching.length > 0 && (
						<MediaRow
							title="Continue Watching"
							items={continueWatching}
							onItemClick={handleItemClick}
							getImageUrl={(id, item) => getCardImageUrl(item)}
						/>
					)}

					{homeRowSettings.nextUp && nextUp.length > 0 && (
						<MediaRow
							title="Next Up"
							items={nextUp}
							onItemClick={handleItemClick}
							getImageUrl={(id, item) => getCardImageUrl(item)}
						/>
					)}

					{homeRowSettings.latestMovies && latestMovies.length > 0 && (
						<MediaRow
							title="Latest Movies"
							items={latestMovies}
							onItemClick={handleItemClick}
							getImageUrl={(id, item) => getCardImageUrl(item)}
						/>
					)}

					{homeRowSettings.latestShows && latestShows.length > 0 && (
						<MediaRow
							title="Latest TV Shows"
							items={latestShows}
							onItemClick={handleItemClick}
							getImageUrl={(id, item) => getCardImageUrl(item)}
						/>
					)}
				</div>
			</Scroller>
		</Panel>
	);
};

export default HomePanel;
