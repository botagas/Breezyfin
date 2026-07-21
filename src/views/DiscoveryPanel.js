import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import MediaRow from '../components/MediaRow';
import Button from '../components/BreezyButton';
import IntegrationPanelLayout from '../components/IntegrationPanelLayout';
import ProviderItemPopup from '../components/ProviderItemPopup';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import jellyfinService from '../services/jellyfinService';
import {DISCOVERY_FEEDS} from '../constants/integrationEvents';
import {useProviderPanelShell} from '../hooks/useProviderPanelShell';
import {usePluginMediaItemActivation} from '../hooks/usePluginMediaItemActivation';
import {getLandscapeCardImageUrls, uniqueImageCandidates} from '../utils/mediaItemUtils';

import css from './IntegrationPanels.module.less';

const FEED_LABELS = Object.freeze({
	Trending: 'Trending',
	PopularMovies: 'Popular Movies',
	PopularSeries: 'Popular Series',
	UpcomingMovies: 'Upcoming Movies',
	UpcomingSeries: 'Upcoming Series'
});
const PAGE_SIZE = 30;
const CACHE_TTL_MS = 5 * 60 * 1000;
const FEED_CONCURRENCY = 2;

const mergeWarnings = (current, incoming) => {
	const warnings = new Map();
	[...(current || []), ...(incoming || [])].forEach((warning) => {
		warnings.set(`${warning.code}|${warning.provider}|${warning.reason}`, warning);
	});
	return [...warnings.values()];
};

const toMediaItem = (item) => {
	const linkedItem = item.JellyfinItemId ? {...item, Id: item.JellyfinItemId} : null;
	return {
		...item,
		Name: item.Title,
		Type: item.Type,
		ImageCandidates: uniqueImageCandidates([
			item.AuthenticatedImageUrl,
			...(linkedItem ? getLandscapeCardImageUrls(linkedItem, {width: 640, quality: 76}) : [])
		])
	};
};

const createFeedRow = (feed, state = {}) => ({
	feed,
	items: Array.isArray(state.items) ? state.items : [],
	nextStartIndex: Number.isInteger(state.nextStartIndex) ? state.nextStartIndex : 0,
	hasMore: state.hasMore === true,
	status: state.status === 'loading' ? 'idle' : (state.status || 'idle'),
	loadingMore: false,
	error: state.error || null,
	warnings: Array.isArray(state.warnings) ? state.warnings : []
});

const createRows = (cachedRows = []) => DISCOVERY_FEEDS.map((feed) => (
	createFeedRow(feed, cachedRows.find((row) => row.feed === feed))
));

const buildFailure = (response) => ({
	message: response?.problemDetails?.detail || `${FEED_LABELS[response?.feed] || 'This discovery feed'} is unavailable.`,
	diagnosticReason: response?.diagnosticReason || 'plugin-unavailable',
	retryable: response?.retryable !== false
});

const DiscoveryPanel = ({
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
	const cachedAt = Number(cachedState?.cachedAt) || 0;
	const cachedRows = Date.now() - cachedAt < CACHE_TTL_MS ? cachedState?.rows : [];
	const [rows, setRows] = useState(() => createRows(cachedRows));
	const [initialLoading, setInitialLoading] = useState(() => !Array.isArray(cachedRows) || cachedRows.length === 0);
	const [activationError, setActivationError] = useState('');
	const rowsRef = useRef(rows);
	rowsRef.current = rows;
	const lastLoadedAtRef = useRef(cachedAt);
	const providerShell = useProviderPanelShell({
		cachedState, isActive, onCacheState, onNavigate, onSwitchUser, onLogout, onExit, registerBackHandler
	});
	const {cachePanelState, reportProviderFailure, requestIdRef} = providerShell;

	const persistRows = useCallback((nextRows, cachedAtValue = lastLoadedAtRef.current) => {
		cachePanelState({rows: nextRows, cachedAt: cachedAtValue});
	}, [cachePanelState]);

	const updateRow = useCallback((feed, updater) => {
		const next = rowsRef.current.map((row) => row.feed === feed ? updater(row) : row);
		rowsRef.current = next;
		setRows(next);
		persistRows(next);
	}, [persistRows]);

	const requestFeed = useCallback(async (feed, requestId, startIndex = 0) => {
		const append = startIndex > 0;
		updateRow(feed, (row) => ({
			...row,
			status: append ? row.status : 'loading',
			loadingMore: append,
			error: null
		}));
		try {
			const response = await jellyfinService.getDiscoveryFeed(feed, {limit: PAGE_SIZE, startIndex});
			if (requestId !== requestIdRef.current) return;
			if (response?.available !== true) {
				reportProviderFailure(`Discovery ${feed}`, response);
				updateRow(feed, (row) => ({
					...row,
					status: row.items.length > 0 ? 'ready' : 'error',
					loadingMore: false,
					error: buildFailure({...response, feed})
				}));
				return;
			}
			lastLoadedAtRef.current = Date.now();
			(response.result.warnings || []).forEach((warning) => {
				reportProviderFailure(`Discovery ${feed} partial result`, warning);
			});
			updateRow(feed, (row) => ({
				...row,
				status: response.result.items.length > 0 || append ? 'ready' : 'empty',
				items: append
					? [...row.items, ...response.result.items.map(toMediaItem)]
					: response.result.items.map(toMediaItem),
				nextStartIndex: response.result.nextStartIndex,
				hasMore: response.result.hasMore,
				loadingMore: false,
				error: null,
				warnings: append
					? mergeWarnings(row.warnings, response.result.warnings)
					: (response.result.warnings || [])
			}));
		} catch (error) {
			if (requestId !== requestIdRef.current) return;
			reportProviderFailure(`Discovery ${feed}`, error);
			updateRow(feed, (row) => ({
				...row,
				status: row.items.length > 0 ? 'ready' : 'error',
				loadingMore: false,
				error: {
					message: error?.problemDetails?.detail || `${FEED_LABELS[feed]} is unavailable.`,
					diagnosticReason: error?.problemDetails?.reason || 'plugin-unavailable',
					retryable: error?.problemDetails?.retryable !== false
				}
			}));
		}
	}, [reportProviderFailure, requestIdRef, updateRow]);

	const loadFeeds = useCallback(async () => {
		const requestId = requestIdRef.current + 1;
		requestIdRef.current = requestId;
		setInitialLoading(true);
		setActivationError('');
		const resetRows = createRows().map((row) => ({...row, status: 'loading'}));
		setRows(resetRows);
		rowsRef.current = resetRows;
		await requestFeed(DISCOVERY_FEEDS[0], requestId);
		if (requestId !== requestIdRef.current) return;
		setInitialLoading(false);
		const queue = DISCOVERY_FEEDS.slice(1);
		let cursor = 0;
		const worker = async () => {
			while (cursor < queue.length && requestId === requestIdRef.current) {
				const feed = queue[cursor];
				cursor += 1;
				await requestFeed(feed, requestId);
			}
		};
		await Promise.all(Array.from({length: FEED_CONCURRENCY}, worker));
		if (requestId === requestIdRef.current) {
			lastLoadedAtRef.current = Date.now();
			persistRows(rowsRef.current, lastLoadedAtRef.current);
		}
	}, [persistRows, requestFeed, requestIdRef]);

	const resumePendingFeeds = useCallback(async (feeds) => {
		if (feeds.length === 0) return;
		const requestId = requestIdRef.current + 1;
		requestIdRef.current = requestId;
		let cursor = 0;
		const worker = async () => {
			while (cursor < feeds.length && requestId === requestIdRef.current) {
				const feed = feeds[cursor];
				cursor += 1;
				await requestFeed(feed, requestId);
			}
		};
		await Promise.all(Array.from({length: Math.min(FEED_CONCURRENCY, feeds.length)}, worker));
		if (requestId === requestIdRef.current) persistRows(rowsRef.current, lastLoadedAtRef.current);
	}, [persistRows, requestFeed, requestIdRef]);

	useEffect(() => {
		if (!isActive) return undefined;
		const cacheIsFresh = Date.now() - lastLoadedAtRef.current < CACHE_TTL_MS
			&& rowsRef.current.some((row) => ['ready', 'empty'].includes(row.status));
		if (cacheIsFresh) {
			setInitialLoading(false);
			const pendingFeeds = rowsRef.current
				.filter((row) => ['idle', 'loading'].includes(row.status))
				.map((row) => row.feed);
			resumePendingFeeds(pendingFeeds);
		} else loadFeeds();
		return () => {
			requestIdRef.current += 1;
		};
	}, [isActive, loadFeeds, requestIdRef, resumePendingFeeds]);

	const retryFeed = useCallback((event) => {
		const feed = event.currentTarget.dataset.feed;
		if (!DISCOVERY_FEEDS.includes(feed)) return;
		const row = rowsRef.current.find((entry) => entry.feed === feed);
		const retryStartIndex = row?.items.length > 0 ? row.nextStartIndex : 0;
		requestFeed(feed, requestIdRef.current, retryStartIndex);
	}, [requestFeed, requestIdRef]);

	const loadMore = useCallback((feed) => {
		const row = rowsRef.current.find((entry) => entry.feed === feed);
		if (!row?.hasMore || row.loadingMore) return;
		requestFeed(feed, requestIdRef.current, row.nextStartIndex);
	}, [requestFeed, requestIdRef]);

	const handleItemClick = usePluginMediaItemActivation({
		onItemSelect,
		onExternalItem: providerShell.setExternalItem,
		onUnavailable: setActivationError,
		isActive
	});
	const hasItems = useMemo(() => rows.some((row) => row.items.length > 0), [rows]);
	const allSettled = rows.every((row) => row.status !== 'loading');
	const allFailed = allSettled && rows.every((row) => row.status === 'error');
	const firstReadyRow = rows.find((row) => row.items.length > 0);
	const firstErrorRow = rows.find((row) => row.status === 'error' && row.error?.retryable !== false);
	const firstFocusId = firstReadyRow
		? `${FEED_LABELS[firstReadyRow.feed]}-0`
		: firstErrorRow ? `discovery-retry-${firstErrorRow.feed}` : '';
	const firstBackdropItem = firstReadyRow?.items?.[0] || null;
	const backdropItem = firstBackdropItem?.JellyfinItemId
		? {...firstBackdropItem, Id: firstBackdropItem.JellyfinItemId}
		: null;
	const backdropUrl = firstBackdropItem?.ImageCandidates?.[0] || '';
	const getImageCandidates = useCallback((id, item) => item.ImageCandidates, []);

	return (
		<IntegrationPanelLayout
			{...rest}
			title="Discovery"
			activeSection="discovery"
			isActive={isActive}
			toolbarActions={providerShell.toolbarActions}
			firstFocusId={firstFocusId}
			backdropItem={backdropItem}
			backdropUrl={backdropUrl}
			loading={initialLoading}
			captureScrollTo={providerShell.captureScrollTo}
			onScrollStop={providerShell.handleScrollStop}
			errorMessage={allFailed ? 'Discovery providers are unavailable.' : activationError}
			onRetry={allFailed ? loadFeeds : null}
			emptyMessage={!allFailed && allSettled && !hasItems ? 'No discovery titles are available.' : ''}
		>
			{rows.map((row, rowIndex) => (
				<div key={row.feed}>
					{row.status === 'loading' && row.items.length === 0 ? (
						<section className={css.feedState}>
							<BodyText className={css.feedTitle}>{FEED_LABELS[row.feed]}</BodyText>
							<BreezyLoadingOverlay label={`Loading ${FEED_LABELS[row.feed]}...`} />
						</section>
					) : null}
					{row.status === 'error' ? (
						<section className={css.feedState}>
							<BodyText className={css.feedTitle}>{FEED_LABELS[row.feed]}</BodyText>
							<BodyText>{row.error?.message || 'This feed is unavailable.'}</BodyText>
							{row.error?.retryable !== false ? (
								<Button
									spotlightId={`discovery-retry-${row.feed}`}
									data-feed={row.feed}
									onClick={retryFeed}
								>Retry</Button>
							) : null}
						</section>
					) : null}
					{row.warnings.length > 0 ? (
						<BodyText className={css.warning}>Some {FEED_LABELS[row.feed]} results may be incomplete.</BodyText>
					) : null}
					{row.error && row.status !== 'error' ? (
						<section className={css.feedState}>
							<BodyText>{row.error.message || 'More results could not be loaded.'}</BodyText>
							<Button
								spotlightId={`discovery-retry-${row.feed}`}
								data-feed={row.feed}
								onClick={retryFeed}
							>Retry</Button>
						</section>
					) : null}
					{row.items.length > 0 ? (
						<MediaRow
							title={FEED_LABELS[row.feed]}
							items={row.items}
							onItemClick={handleItemClick}
							getImageCandidates={getImageCandidates}
							onMoreClick={row.hasMore ? loadMore : undefined}
							sectionKey={row.feed}
							rowIndex={rowIndex}
							loading={row.loadingMore && row.items.length === 0}
						/>
					) : null}
				</div>
			))}
			<ProviderItemPopup
				open={providerShell.externalItemOpen}
				title={providerShell.externalItem?.Name || 'Discovery'}
				detail={providerShell.externalItem?.Overview || 'No overview is available.'}
				onClose={providerShell.closeExternalItem}
				onHide={providerShell.handleExternalItemHide}
			/>
		</IntegrationPanelLayout>
	);
};

export default DiscoveryPanel;
