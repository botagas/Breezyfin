import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel } from '../components/BreezyPanels';
import BodyText from '@enact/sandstone/BodyText';
import Scroller from '../components/AppScroller';
import Spotlight from '@enact/spotlight';
import jellyfinService from '../services/jellyfinService';
import MediaRow from '../components/MediaRow';
import HeroBanner from '../components/HeroBanner';
import Toolbar from '../components/Toolbar';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import MediaPanelBackdrop from '../components/MediaPanelBackdrop';
import {HOME_ROW_ORDER} from '../constants/homeRows';
import {getHomeSectionDescriptor} from '../constants/homeSections';
import {KeyCodes} from '../utils/keyCodes';
import {getLandscapeCardImageUrls} from '../utils/mediaItemUtils';
import { useBreezyfinSettingsSync } from '../hooks/useBreezyfinSettingsSync';
import { usePanelToolbarActions } from '../hooks/usePanelToolbarActions';
import { usePanelScrollState } from '../hooks/usePanelScrollState';
import {focusToolbarSpotlightTargets} from '../utils/toolbarFocus';
import {
	findVerticalScrollableAncestor,
	getVerticalVisibilityDelta
} from '../utils/verticalFocusScroll';

import css from './HomePanel.module.less';

const SERIES_UNPLAYED_CACHE_TTL_MS = 5 * 60 * 1000;
const SERIES_UNPLAYED_CACHE_MAX_ENTRIES = 40;
const HOME_ROW_PREVIEW_LIMIT = 10;
const HOME_DESIGN_CURRENT = 'current';
const HOME_DESIGN_CINEMATIC = 'cinematic';
const HOME_DESIGN_VARIANT = process.env.REACT_APP_HOME_DESIGN_VARIANT === HOME_DESIGN_CURRENT
	? HOME_DESIGN_CURRENT
	: HOME_DESIGN_CINEMATIC;

const pruneSeriesUnplayedCache = (cache, now = Date.now()) => {
	if (!cache || typeof cache.entries !== 'function') return;
	for (const [seriesId, value] of cache.entries()) {
		if (!value?.timestamp || now - value.timestamp >= SERIES_UNPLAYED_CACHE_TTL_MS) {
			cache.delete(seriesId);
		}
	}
	if (cache.size <= SERIES_UNPLAYED_CACHE_MAX_ENTRIES) return;
	const oldestEntries = [...cache.entries()]
		.sort(([, left], [, right]) => (left?.timestamp || 0) - (right?.timestamp || 0));
	oldestEntries
		.slice(0, Math.max(0, cache.size - SERIES_UNPLAYED_CACHE_MAX_ENTRIES))
		.forEach(([seriesId]) => cache.delete(seriesId));
};

const HomePanel = ({
	onItemSelect,
	onNavigate,
	onSwitchUser,
	onLogout,
	onExit,
	registerBackHandler,
	isActive = false,
	screensaverActive = false,
	cachedState = null,
	onCacheState = null,
	...rest
}) => {
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
	const [activatedRowCount, setActivatedRowCount] = useState(2);
	const homeScrollToRef = useRef(null);
	const homeVerticalScrollerRef = useRef(null);
	const homeHeaderBottomRef = useRef(0);
	const lastFocusedRowRef = useRef(-1);
	const rowVisibilityFrameRef = useRef(0);
	const seriesUnplayedCacheRef = useRef(new Map());
	const contentLoadRequestIdRef = useRef(0);
	const handleNavigation = useCallback((section, data) => {
		if (onNavigate) {
			onNavigate(section, data);
		}
	}, [onNavigate]);
	const toolbarActions = usePanelToolbarActions({
		onNavigate: handleNavigation,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		isActive
	});
	const {
		captureScrollTo: captureHomeScrollRestore,
		handleScrollStop: handleHomeScrollMemoryStop
	} = usePanelScrollState({
		cachedState,
		isActive,
		onCacheState
	});

	const hydrateEpisodeSeriesProgress = useCallback(async (episodeGroups = []) => {
		const normalizedGroups = episodeGroups.map((group) => (Array.isArray(group) ? group : []));
		const allEpisodes = normalizedGroups.reduce((episodes, group) => episodes.concat(group), []);
		const seriesIds = [...new Set(
			allEpisodes
				.filter((episode) => episode?.Type === 'Episode' && episode?.SeriesId)
				.map((episode) => episode.SeriesId)
		)];
		if (seriesIds.length === 0) {
			return normalizedGroups;
		}

		const cache = seriesUnplayedCacheRef.current;
		const now = Date.now();
		pruneSeriesUnplayedCache(cache, now);
		const missingSeriesIds = seriesIds.filter((seriesId) => {
			const cached = cache.get(seriesId);
			return !(cached && now - cached.timestamp < SERIES_UNPLAYED_CACHE_TTL_MS);
		});

		await Promise.all(missingSeriesIds.map(async (seriesId) => {
			try {
				const series = await jellyfinService.getItem(seriesId);
				const count = Number(series?.UserData?.UnplayedItemCount);
				cache.set(seriesId, {
					count: Number.isFinite(count) ? count : 0,
					timestamp: Date.now()
				});
				pruneSeriesUnplayedCache(cache);
			} catch (error) {
				console.error('Failed to fetch series data:', error);
			}
		}));

		return normalizedGroups.map((episodes) => episodes.map((episode) => {
			if (episode?.Type !== 'Episode' || !episode?.SeriesId) return episode;
			const cached = cache.get(episode.SeriesId);
			if (!cached || cached.count <= 0) return episode;
			return {
				...episode,
				UnplayedItemCount: cached.count
			};
		}));
	}, []);

	const loadContent = useCallback(async () => {
		contentLoadRequestIdRef.current += 1;
		const loadRequestId = contentLoadRequestIdRef.current;
		setLoading(true);
		setActivatedRowCount(2);
		try {
			const [recently, resume, next, movies, shows] = await Promise.all([
				jellyfinService.getRecentlyAdded(HOME_ROW_PREVIEW_LIMIT).catch(err => {
					console.error('Failed to load recently added:', err);
					return [];
				}),
				jellyfinService.getResumeItems(HOME_ROW_PREVIEW_LIMIT).catch(err => {
					console.error('Failed to load resume items:', err);
					return [];
				}),
				jellyfinService.getNextUp(HOME_ROW_PREVIEW_LIMIT).catch(err => {
					console.error('Failed to load next up:', err);
					return [];
				}),
				jellyfinService.getLatestMedia(['Movie'], HOME_ROW_PREVIEW_LIMIT).catch(err => {
					console.error('Failed to load latest movies:', err);
					return [];
				}),
				jellyfinService.getLatestMedia(['Series'], HOME_ROW_PREVIEW_LIMIT).catch(err => {
					console.error('Failed to load latest shows:', err);
					return [];
				})
			]);

			const userName = jellyfinService.username || (await jellyfinService.getCurrentUser())?.Name || '';
			let requestItems = [];
			try {
				const myRequestsResult = await jellyfinService.getMyRequests(
					null,
					['Movie', 'Series'],
					HOME_ROW_PREVIEW_LIMIT,
					0,
					userName
				);
				if (Array.isArray(myRequestsResult?.items)) {
					requestItems = myRequestsResult.items;
				}
			} catch (_) {
				requestItems = [];
			}
			const [enhancedResume, enhancedNext] = await hydrateEpisodeSeriesProgress([resume, next]);
			if (loadRequestId !== contentLoadRequestIdRef.current) return;
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
			setMyRequests((requestItems || []).slice(0, HOME_ROW_PREVIEW_LIMIT));
		} catch (error) {
			if (loadRequestId !== contentLoadRequestIdRef.current) return;
			console.error('Failed to load content:', error);
		} finally {
			if (loadRequestId === contentLoadRequestIdRef.current) {
				setLoading(false);
			}
		}
	}, [hydrateEpisodeSeriesProgress]);

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

	useBreezyfinSettingsSync(applyHomeSettings, {enabled: isActive});

	useEffect(() => {
		if (!isActive) return undefined;
		loadContent();
		return () => {
			contentLoadRequestIdRef.current += 1;
		};
	}, [isActive, loadContent]);

	const handleItemClick = useCallback((item) => {
		onItemSelect(item);
	}, [onItemSelect]);

	const handleViewMoreSection = useCallback((sectionKey) => {
		const descriptor = getHomeSectionDescriptor(sectionKey);
		if (!descriptor) return;
		handleNavigation('homeSection', descriptor);
	}, [handleNavigation]);

	const getCardImageCandidates = useCallback((item) => {
		return getLandscapeCardImageUrls(item, {width: 640, quality: 76});
	}, []);

	const getMediaRowImageCandidates = useCallback((id, mediaItem) => {
		return getCardImageCandidates(mediaItem);
	}, [getCardImageCandidates]);

	const handleRowVisible = useCallback((rowIndex) => {
		setActivatedRowCount((currentCount) => Math.max(currentCount, rowIndex + 2));
	}, []);

	const handleRowFocus = useCallback((rowIndex, rowNode) => {
		if (!rowNode || lastFocusedRowRef.current === rowIndex) return;
		lastFocusedRowRef.current = rowIndex;
		window.cancelAnimationFrame(rowVisibilityFrameRef.current);
		rowVisibilityFrameRef.current = window.requestAnimationFrame(() => {
			const scroller = homeVerticalScrollerRef.current || findVerticalScrollableAncestor(rowNode);
			if (!scroller) return;
			homeVerticalScrollerRef.current = scroller;
			if (!homeHeaderBottomRef.current) {
				const toolbar = document.querySelector('[data-bf-navbar="true"]');
				homeHeaderBottomRef.current = toolbar?.getBoundingClientRect().bottom || 0;
			}
			const delta = getVerticalVisibilityDelta({
				targetRect: rowNode.getBoundingClientRect(),
				scrollerRect: scroller.getBoundingClientRect(),
				topBoundary: homeHeaderBottomRef.current,
				topPadding: 12,
				bottomPadding: 16
			});
			if (delta) scroller.scrollTop = Math.max(0, scroller.scrollTop + delta);
			rowVisibilityFrameRef.current = 0;
		});
	}, []);

	useEffect(() => {
		if (!isActive) return undefined;
		const resetCachedGeometry = () => {
			homeVerticalScrollerRef.current = null;
			homeHeaderBottomRef.current = 0;
			lastFocusedRowRef.current = -1;
		};
		window.addEventListener('resize', resetCachedGeometry);
		return () => {
			window.removeEventListener('resize', resetCachedGeometry);
			window.cancelAnimationFrame(rowVisibilityFrameRef.current);
			resetCachedGeometry();
		};
	}, [isActive]);

	const captureHomeScrollTo = useCallback((fn) => {
		homeScrollToRef.current = fn;
		captureHomeScrollRestore(fn);
	}, [captureHomeScrollRestore]);

	const focusTopToolbarAction = useCallback(() => (
		focusToolbarSpotlightTargets(['toolbar-home', 'toolbar-user'])
	), []);

	const focusHeroPrimaryAction = useCallback(() => {
		Spotlight.focus('home-hero-play');
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
	const panelBackdropItem = heroItems[0] || visibleRows[0]?.row?.items?.[0] || null;
	const handleToolbarNavigateDown = useCallback(() => {
		if (!showMediaBar || heroItems.length === 0) return false;
		focusHeroPrimaryAction();
		return true;
	}, [focusHeroPrimaryAction, heroItems.length, showMediaBar]);
	const handleHomePanelKeyDownCapture = useCallback((event) => {
		const code = event.keyCode || event.which;
		if (code !== KeyCodes.DOWN) return;
		const activeElement = document.activeElement;
		const spotlightId = activeElement?.dataset?.spotlightId || '';
		if (!spotlightId.startsWith('home-hero-') || visibleRows.length === 0) return;
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation?.();
		Spotlight.focus(`home-row-more-${visibleRows[0].key}`);
	}, [visibleRows]);
	const hasContent = visibleRows.length > 0;
	const hasHero = showMediaBar && heroItems.length > 0;
	const showEmptyState = !hasContent && !hasHero;
	const useCinematicHome = HOME_DESIGN_VARIANT === HOME_DESIGN_CINEMATIC;
	const topToolbar = (
		<Toolbar
			activeSection="home"
			isActive={isActive}
			onNavigateDown={handleToolbarNavigateDown}
			{...toolbarActions}
		/>
	);

	if (loading) {
		return (
			<Panel {...rest}>
				{topToolbar}
				<div className={css.loading}>
					<BreezyLoadingOverlay />
				</div>
			</Panel>
		);
	}

	return (
		<Panel {...rest} onKeyDownCapture={handleHomePanelKeyDownCapture}>
			{topToolbar}
			{showEmptyState && (
				<div className={css.emptyStateCenter}>
					<div className={css.emptyState}>
						<BodyText>No content found. Check browser console (F12) for API errors.</BodyText>
					</div>
				</div>
			)}
			{useCinematicHome ? <MediaPanelBackdrop item={panelBackdropItem} /> : null}
			<Scroller
				className={`${css.scroller} ${useCinematicHome ? css.scrollerCinematic : ''}`}
				cbScrollTo={captureHomeScrollTo}
				onScrollStop={handleHomeScrollMemoryStop}
				verticalScrollbar={useCinematicHome ? 'hidden' : 'auto'}
			>
				<div className={`${css.content} ${useCinematicHome ? css.contentCinematic : ''}`}>
					{!useCinematicHome ? <MediaPanelBackdrop item={panelBackdropItem} /> : null}
					{hasHero && (
						<HeroBanner
							items={heroItems}
							onPlayClick={handleItemClick}
							isActive={isActive && !screensaverActive}
							variant={HOME_DESIGN_VARIANT}
						/>
					)}

					{visibleRows.map(({key, row}, rowIndex) => (
						<MediaRow
							key={key}
							title={row.title}
							items={row.items}
							onItemClick={handleItemClick}
							getImageCandidates={getMediaRowImageCandidates}
							imagesActive={rowIndex < activatedRowCount}
							onRowVisible={handleRowVisible}
							onRowFocus={handleRowFocus}
							showEpisodeProgress={row.showEpisodeProgress}
							rowIndex={rowIndex}
							onCardKeyDown={handleHomeCardKeyDown}
							onMoreClick={handleViewMoreSection}
							moreSpotlightId={`home-row-more-${key}`}
							sectionKey={key}
							variant={HOME_DESIGN_VARIANT}
						/>
					))}
				</div>
			</Scroller>
		</Panel>
	);
};

export default HomePanel;
