import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import {VirtualList} from '@enact/sandstone/VirtualList';
import Spottable from '@enact/spotlight/Spottable';
import ri from '@enact/ui/resolution';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import MediaRow from '../components/MediaRow';
import PanelActionButton from '../components/PanelActionButton';
import IntegrationPanelLayout from '../components/IntegrationPanelLayout';
import PanelTabNavigation from '../components/PanelTabNavigation';
import PanelLandscapeVirtualGrid from '../components/PanelLandscapeVirtualGrid';
import MediaCardImage from '../components/MediaCardImage';
import jellyfinService from '../services/jellyfinService';
import {useMapById} from '../hooks/useMapById';
import {usePanelScrollState} from '../hooks/usePanelScrollState';
import {usePanelToolbarActions} from '../hooks/usePanelToolbarActions';
import {useRuntimeDiagnosticsEnabled} from '../hooks/useRuntimeDiagnostics';
import {SCROLLER_OVERSCROLL_EFFECT_OFF} from '../constants/scroller';
import {getLandscapeCardImageUrls} from '../utils/mediaItemUtils';
import {useWatchlistInsights} from './watchlist-panel/hooks/useWatchlistInsights';

import css from './WatchlistPanel.module.less';

const SpottableDiv = Spottable('div');
const PAGE_SIZE = 30;
const PREVIEW_SIZE = 10;
const INSIGHT_ITEM_SIZE = ri.scale(256);
const VIRTUAL_TABS = Object.freeze(['progress', 'completed', 'movies']);
const TABS = Object.freeze([
	{id: 'watchlist', label: 'Watchlist'},
	{id: 'progress', label: 'Series Progress'},
	{id: 'completed', label: 'Completed Series'},
	{id: 'movies', label: 'Movie History'},
	{id: 'statistics', label: 'Statistics'}
]);

const formatDate = (value) => {
	const date = new Date(value || '');
	return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
};

const InsightArtwork = ({item}) => (
	<div className={css.insightImage}>
		<MediaCardImage
			candidates={getLandscapeCardImageUrls(item, {width: 480, quality: 74})}
			alt=""
			width={480}
			height={270}
		/>
	</div>
);

const InsightRow = ({
	index,
	items,
	onItemClick,
	onMarkWatched,
	onViewUnwatched,
	pendingSeriesIds,
	...rest
}) => {
	const item = items[index];
	if (!item) return null;
	const watched = item.WatchedEpisodeCount ?? 0;
	const total = item.TotalEpisodeCount ?? 0;
	const remaining = item.RemainingEpisodeCount ?? Math.max(0, total - watched);
	const mutationPending = pendingSeriesIds?.includes(item.Id) === true;
	return (
		<SpottableDiv
			{...rest}
			className={css.insightRow}
			data-series-id={item.Id}
			role="button"
			aria-label={`${item.Title}. ${watched} of ${total} watched. ${remaining} remaining.`}
			onClick={onItemClick}
		>
				<InsightArtwork item={item} />
			<div className={css.insightCopy}>
				<BodyText className={css.insightTitle}>{item.Title}</BodyText>
				<BodyText>{watched} of {total} watched · {remaining} remaining</BodyText>
				<BodyText size="small">
					Last watched: {item.LastWatchedEpisodeTitle || 'Unknown'} · {formatDate(item.LastPlayedDate)}
				</BodyText>
			</div>
			<div className={css.insightActions}>
				<PanelActionButton
					size="small"
					minWidth={false}
					data-series-id={item.Id}
					disabled={mutationPending}
					onClick={onMarkWatched}
				>
					{mutationPending ? 'Marking...' : 'Mark All Watched'}
				</PanelActionButton>
				{remaining > 0 ? (
					<PanelActionButton
						size="small"
						minWidth={false}
						data-series-id={item.Id}
						data-series-title={item.Title}
						onClick={onViewUnwatched}
					>
						View Unwatched
					</PanelActionButton>
				) : null}
			</div>
		</SpottableDiv>
	);
};

const MovieHistoryRow = ({index, items, onItemClick, ...rest}) => {
	const item = items[index];
	if (!item) return null;
	return (
		<SpottableDiv
			{...rest}
			className={css.insightRow}
			data-item-id={item.Id}
			role="button"
			aria-label={`${item.Title}. ${item.ProductionYear || 'Year unknown'}. Watched ${formatDate(item.LastPlayedDate)}.`}
			onClick={onItemClick}
		>
				<InsightArtwork item={item} />
			<div className={css.insightCopy}>
				<BodyText className={css.insightTitle}>{item.Title}</BodyText>
				<BodyText>{item.ProductionYear || 'Year unknown'} · {item.RuntimeMinutes || 0} min</BodyText>
				<BodyText size="small">Watched {formatDate(item.LastPlayedDate)}</BodyText>
			</div>
		</SpottableDiv>
	);
};

const StatisticsRanking = ({emptyMessage, items, metric, title}) => (
	<section className={css.ranking}>
		<BodyText className={css.heading}>{title}</BodyText>
		{items.length > 0 ? (
			<ol className={css.rankingList}>
				{items.map((item) => (
					<li key={item.Id}>
						<span className={css.rankingTitle}>{item.Title}</span>
						<span className={css.rankingMetric}>{metric(item)}</span>
					</li>
				))}
			</ol>
		) : (
			<BodyText className={css.rankingEmpty}>{emptyMessage}</BodyText>
		)}
	</section>
);

const getShowRankingMetric = (show) => `${show.WatchedEpisodeCount} episodes`;
const getMovieRankingMetric = (movie) => `${movie.PlayCount} ${movie.PlayCount === 1 ? 'play' : 'plays'}`;

const WatchlistPanel = ({
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
	const [activeTab, setActiveTab] = useState(cachedState?.activeTab || 'watchlist');
	const [nestedView, setNestedView] = useState(null);
	const [shows, setShows] = useState([]);
	const [movies, setMovies] = useState([]);
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [nextStartIndex, setNextStartIndex] = useState(0);
	const [error, setError] = useState('');
	const [pendingSeriesIds, setPendingSeriesIds] = useState([]);
	const generationRef = useRef(0);
	const nestedRequestRef = useRef(new Map());
	const pendingSeriesMutationRef = useRef(new Set());
	const cacheSnapshotRef = useRef(cachedState || {});
	const focusedItemIdRef = useRef(cachedState?.focusedItemId || null);
	const focusFirstItemRef = useRef(false);
	const itemsById = useMapById(items);
	const diagnosticsEnabled = useRuntimeDiagnosticsEnabled();

	useEffect(() => {
		if (cachedState && typeof cachedState === 'object') cacheSnapshotRef.current = cachedState;
	}, [cachedState]);

	const cachePanelState = useCallback((patch) => {
		const nextState = {...cacheSnapshotRef.current, ...(patch || {})};
		cacheSnapshotRef.current = nextState;
		onCacheState?.(nextState);
	}, [onCacheState]);
	const cacheInsightEntries = useCallback((insightEntries) => {
		cachePanelState({insightEntries});
	}, [cachePanelState]);
	const {
		entry: insightEntry,
		invalidateTabs,
		loadMore: loadMoreInsights,
		refreshTab
	} = useWatchlistInsights({
		activeTab,
		cachedEntries: cachedState?.insightEntries,
		diagnosticsEnabled,
		isActive,
		onCacheEntries: cacheInsightEntries
	});
	const insightItemsById = useMapById(insightEntry.items);
	const {captureScrollTo, handleScrollStop} = usePanelScrollState({
		cachedState,
		isActive,
		onCacheState: cachePanelState
	});
	const closeNestedView = useCallback(() => {
		if (!nestedView) return false;
		setNestedView(null);
		return true;
	}, [nestedView]);
	const toolbarActions = usePanelToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		isActive,
		onPanelBack: closeNestedView
	});

	const loadNativePreview = useCallback(async () => {
		const generation = ++generationRef.current;
		setLoading(true);
		setError('');
		try {
			const [showPage, moviePage] = await Promise.all([
				jellyfinService.getLikesWatchlist(PREVIEW_SIZE, 0, ['Series']),
				jellyfinService.getLikesWatchlist(PREVIEW_SIZE, 0, ['Movie'])
			]);
			if (generation !== generationRef.current) return;
			setShows(showPage.items);
			setMovies(moviePage.items);
		} catch (_) {
			if (generation === generationRef.current) setError('Watchlist items could not be loaded.');
		} finally {
			if (generation === generationRef.current) setLoading(false);
		}
	}, []);

	const loadNested = useCallback(async ({append = false} = {}) => {
		if (!nestedView) return;
		const generation = append ? generationRef.current : ++generationRef.current;
		const startIndex = append ? nextStartIndex : 0;
		const viewSignature = `${nestedView.kind}:${nestedView.itemType || nestedView.seriesId || ''}`;
		const requestKey = `${viewSignature}:${startIndex}`;
		if (nestedRequestRef.current.has(requestKey)) {
			return nestedRequestRef.current.get(requestKey);
		}
		if (!append) {
			setLoading(true);
			setItems([]);
		}
		setLoadingMore(append);
		let request;
		request = (async () => {
			try {
				const page = nestedView.kind === 'watchlist'
					? await jellyfinService.getLikesWatchlist(PAGE_SIZE, startIndex, [nestedView.itemType])
					: await jellyfinService.getUnwatchedSeriesEpisodes(nestedView.seriesId, PAGE_SIZE, startIndex);
				if (generation !== generationRef.current) return;
				setItems((current) => {
					const nextItems = append ? [...current, ...page.items] : page.items;
					return [...new Map(nextItems.map((entry) => [entry.Id, entry])).values()];
				});
				setNextStartIndex(page.nextStartIndex);
				setHasMore(page.hasMore);
			} catch (_) {
				if (generation === generationRef.current) setError('This Watchlist view could not be loaded.');
			} finally {
				if (nestedRequestRef.current.get(requestKey) === request) {
					nestedRequestRef.current.delete(requestKey);
				}
				if (generation === generationRef.current) {
					setLoading(false);
					setLoadingMore(false);
				}
			}
		})();
		nestedRequestRef.current.set(requestKey, request);
		return request;
	}, [nestedView, nextStartIndex]);

	useEffect(() => {
		if (!isActive) return undefined;
		const nestedRequests = nestedRequestRef.current;
		setError('');
		if (nestedView) {
			setNextStartIndex(0);
			setHasMore(false);
			loadNested();
		} else if (activeTab === 'watchlist') {
			loadNativePreview();
		}
		cachePanelState({activeTab});
		return () => {
			generationRef.current += 1;
			nestedRequests.clear();
		};
	}, [activeTab, isActive, nestedView]); // eslint-disable-line react-hooks/exhaustive-deps

	const selectTab = useCallback((tabId) => {
		setNestedView(null);
		setActiveTab(tabId);
	}, []);
	const viewMore = useCallback((type) => {
		setNestedView({kind: 'watchlist', itemType: type, title: type === 'Series' ? 'Watchlist Shows' : 'Watchlist Movies'});
	}, []);
	const handleGridItemClick = useCallback((event) => {
		const item = itemsById.get(event.currentTarget.dataset.itemId);
		if (item) onItemSelect(item);
	}, [itemsById, onItemSelect]);
	const handleInsightItemClick = useCallback((event) => {
		const itemId = event.currentTarget.dataset.seriesId || event.currentTarget.dataset.itemId;
		const item = insightItemsById.get(itemId);
		if (item) onItemSelect(item);
	}, [insightItemsById, onItemSelect]);
	const gridItemRendererProps = useMemo(() => ({onItemClick: handleGridItemClick}), [handleGridItemClick]);
	const markAllWatched = useCallback(async (event) => {
		event.stopPropagation();
		const seriesId = event.currentTarget.dataset.seriesId;
		if (!seriesId || pendingSeriesMutationRef.current.has(seriesId)) return;
		pendingSeriesMutationRef.current.add(seriesId);
		setPendingSeriesIds((current) => [...new Set([...current, seriesId])]);
		try {
			await jellyfinService.markWatched(seriesId);
			invalidateTabs(['progress', 'completed', 'statistics']);
			await refreshTab(activeTab);
		} catch (mutationError) {
			setError(mutationError?.message || 'The series could not be marked as watched.');
		} finally {
			pendingSeriesMutationRef.current.delete(seriesId);
			setPendingSeriesIds((current) => current.filter((id) => id !== seriesId));
		}
	}, [activeTab, invalidateTabs, refreshTab]);
	const viewUnwatched = useCallback((event) => {
		event.stopPropagation();
		setNestedView({
			kind: 'unwatched',
			seriesId: event.currentTarget.dataset.seriesId,
			title: `${event.currentTarget.dataset.seriesTitle || 'Series'} · Unwatched`
		});
	}, []);
	const loadMore = useCallback(() => {
		if (!nestedView) {
			loadMoreInsights();
			return;
		}
		if (!hasMore || loadingMore) return;
		loadNested({append: true});
	}, [hasMore, loadMoreInsights, loadNested, loadingMore, nestedView]);
	const handleInsightScrollStop = useCallback(({moreInfo} = {}) => {
		if (
			insightEntry.hasMore &&
			insightEntry.items.length - (moreInfo?.lastVisibleIndex || 0) < 8
		) {
			loadMoreInsights();
		}
	}, [insightEntry.hasMore, insightEntry.items.length, loadMoreInsights]);
	const retryActiveInsight = useCallback(() => {
		void refreshTab(activeTab);
	}, [activeTab, refreshTab]);
	const retryStatistics = useCallback(() => {
		void refreshTab('statistics');
	}, [refreshTab]);
	const getImageCandidates = useCallback((id, item) => (
		getLandscapeCardImageUrls(item, {width: 640, quality: 76})
	), []);
	const firstBackdrop = nestedView ? items[0] : shows[0] || movies[0] || insightEntry.items[0] || null;
	const title = nestedView?.title || 'Watchlist';
	const statistics = insightEntry.statistics;
	const statisticsUsesStaticViewport = activeTab === 'statistics' && !statistics;
	const nativeWatchlistIsEmpty = activeTab === 'watchlist' && !loading && shows.length === 0 && movies.length === 0;
	const nativeWatchlistUsesStaticViewport = activeTab === 'watchlist' && (loading || nativeWatchlistIsEmpty);
	const insightChildProps = useMemo(() => ({
		items: insightEntry.items,
		onItemClick: handleInsightItemClick,
		onMarkWatched: markAllWatched,
		onViewUnwatched: viewUnwatched,
		pendingSeriesIds
	}), [handleInsightItemClick, insightEntry.items, markAllWatched, pendingSeriesIds, viewUnwatched]);

	return (
		<IntegrationPanelLayout
			{...rest}
			title={title}
			activeSection="watchlist"
			isActive={isActive}
			toolbarActions={toolbarActions}
			firstFocusId={nestedView ? 'watchlist-grid' : `watchlist-tab-${activeTab}`}
			backdropItem={firstBackdrop}
			loading={nestedView && loading}
			errorMessage={error}
			captureScrollTo={captureScrollTo}
			onScrollStop={handleScrollStop}
			scrollable={
				!nestedView &&
				!VIRTUAL_TABS.includes(activeTab) &&
				!statisticsUsesStaticViewport &&
				!nativeWatchlistUsesStaticViewport
			}
		>
			{!nestedView ? (
				<PanelTabNavigation
					activeId={activeTab}
					ariaLabel="Watchlist views"
					onSelect={selectTab}
					spotlightIdPrefix="watchlist-tab"
					tabs={TABS}
				/>
			) : null}
			{!nestedView && activeTab === 'watchlist' && !error ? (
				<div className={css.watchlistContent}>
					{loading ? (
						<BreezyLoadingOverlay
							className={css.loadingState}
							label="Loading Watchlist..."
						/>
					) : null}
					<MediaRow
						title="Shows"
						items={shows}
						sectionKey="Series"
						onItemClick={onItemSelect}
						onMoreClick={viewMore}
						getImageCandidates={getImageCandidates}
					/>
					<MediaRow
						title="Movies"
						items={movies}
						sectionKey="Movie"
						onItemClick={onItemSelect}
						onMoreClick={viewMore}
						getImageCandidates={getImageCandidates}
					/>
					{nativeWatchlistIsEmpty ? (
						<BodyText className={css.empty}>Your Watchlist is empty.</BodyText>
					) : null}
				</div>
			) : null}
			{nestedView ? (
				<div className={css.gridViewport}>
					<PanelLandscapeVirtualGrid
						id="watchlist-grid"
						items={items}
						itemRendererProps={gridItemRendererProps}
						isActive={isActive && !loading && !error}
						queryKey={`${nestedView.kind}:${nestedView.itemType || nestedView.seriesId}`}
						hasMore={hasMore}
						loadingMore={loadingMore}
						onLoadMore={loadMore}
						focusedItemIdRef={focusedItemIdRef}
						focusFirstItemRef={focusFirstItemRef}
					/>
				</div>
			) : null}
			{!nestedView && VIRTUAL_TABS.includes(activeTab) ? (
				<div className={css.listViewport}>
					{insightEntry.loading ? (
						<BreezyLoadingOverlay
							className={css.loadingState}
							label={`Loading ${TABS.find((tab) => tab.id === activeTab)?.label || 'Watchlist'}...`}
						/>
					) : null}
					{insightEntry.error ? (
						<div className={css.inlineState} role="alert">
							<BodyText>{insightEntry.error}</BodyText>
							<PanelActionButton onClick={retryActiveInsight}>Retry</PanelActionButton>
						</div>
					) : null}
					<VirtualList
						key={activeTab}
						id={`watchlist-${activeTab}-list`}
						spotlightId={`watchlist-${activeTab}-list`}
						className={css.insightList}
						dataSize={insightEntry.items.length}
						itemSize={INSIGHT_ITEM_SIZE}
						itemRenderer={activeTab === 'movies' ? MovieHistoryRow : InsightRow}
						childProps={insightChildProps}
						onScrollStop={handleInsightScrollStop}
						overscrollEffectOn={SCROLLER_OVERSCROLL_EFFECT_OFF}
						snapToCenter={false}
					/>
					{insightEntry.items.length === 0 && !insightEntry.loading && !insightEntry.error ? (
						<BodyText className={css.emptyList}>No Watchlist insight items are available.</BodyText>
					) : null}
				</div>
			) : null}
			{!nestedView && activeTab === 'statistics' ? (
				<div className={css.listViewport}>
					{insightEntry.loading ? (
						<BreezyLoadingOverlay
							className={css.loadingState}
							label="Loading Statistics..."
						/>
					) : null}
					{insightEntry.error ? (
						<div className={css.inlineState} role="alert">
							<BodyText>{insightEntry.error}</BodyText>
							<PanelActionButton onClick={retryStatistics}>Retry</PanelActionButton>
						</div>
					) : null}
					{statistics ? (
						<>
							<div className={css.statistics}>
								<div><strong>{statistics.SeriesStarted ?? 0}</strong><span>Series Started</span></div>
								<div><strong>{statistics.SeriesWatched ?? 0}</strong><span>Series Watched</span></div>
								<div><strong>{statistics.EpisodesWatched ?? 0}</strong><span>Episodes Watched</span></div>
								<div><strong>{statistics.MoviesWatched ?? 0}</strong><span>Movies Watched</span></div>
							</div>
							<div className={css.rankings}>
								<StatisticsRanking
									title="Top 5 Shows"
									items={statistics.TopShows || []}
									emptyMessage="No watched shows are available."
									metric={getShowRankingMetric}
								/>
								<StatisticsRanking
									title="Top 5 Movies"
									items={statistics.TopMovies || []}
									emptyMessage="No watched movies are available."
									metric={getMovieRankingMetric}
								/>
							</div>
						</>
					) : null}
				</div>
			) : null}
		</IntegrationPanelLayout>
	);
};

export default WatchlistPanel;
