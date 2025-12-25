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

	useEffect(() => {
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
			return jellyfinService.getImageUrl(item.Id, 'Primary', 800);
		}

		if (item?.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return jellyfinService.getBackdropUrl(item.Id, 0, 800);
		}

		if (item?.SeriesId) {
			return jellyfinService.getBackdropUrl(item.SeriesId, 0, 800);
		}

		return '';
	};

	const handleNavigation = (section, data) => {
		console.log('Navigate to:', section, data);
		if (onNavigate) {
			onNavigate(section, data);
		}
	};

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

	const hasContent = recentlyAdded.length > 0 || continueWatching.length > 0 || nextUp.length > 0 || latestMovies.length > 0 || latestShows.length > 0;

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

					{recentlyAdded.length > 0 && (
						<MediaRow
							title="Recently Added"
							items={recentlyAdded}
							onItemClick={handleItemClick}
							getImageUrl={(id, item) => getCardImageUrl(item)}
						/>
					)}

					{continueWatching.length > 0 && (
						<MediaRow
							title="Continue Watching"
							items={continueWatching}
							onItemClick={handleItemClick}
							getImageUrl={(id, item) => getCardImageUrl(item)}
						/>
					)}

					{nextUp.length > 0 && (
						<MediaRow
							title="Next Up"
							items={nextUp}
							onItemClick={handleItemClick}
							getImageUrl={(id, item) => getCardImageUrl(item)}
						/>
					)}

					{latestMovies.length > 0 && (
						<MediaRow
							title="Latest Movies"
							items={latestMovies}
							onItemClick={handleItemClick}
							getImageUrl={(id, item) => getCardImageUrl(item)}
						/>
					)}

					{latestShows.length > 0 && (
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
