import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import MediaRow from '../components/MediaRow';
import PanelActionButton from '../components/PanelActionButton';
import IntegrationPanelLayout from '../components/IntegrationPanelLayout';
import PanelTabNavigation from '../components/PanelTabNavigation';
import ProviderItemPopup from '../components/ProviderItemPopup';
import jellyfinService from '../services/jellyfinService';
import {useProviderPanelShell} from '../hooks/useProviderPanelShell';
import {usePluginMediaItemActivation} from '../hooks/usePluginMediaItemActivation';
import {getLandscapeCardImageUrls, uniqueImageCandidates} from '../utils/mediaItemUtils';

import css from './IntegrationPanels.module.less';

const PAGE_SIZE = 60;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CALENDAR_RANGE_DAYS = 90;
const CALENDAR_FILTER_TABS = Object.freeze([
	{id: 'all', label: 'All'},
	{id: 'movies', label: 'Movies'},
	{id: 'series', label: 'Series'}
]);
const EMPTY_MESSAGES = Object.freeze({
	'no-provider-events': 'No calendar events were returned by the configured providers.',
	'item-type-filter': 'Calendar events are available, but none match the selected type filters.',
	'requested-only-filter': 'No calendar events match media requested by this user.'
});

const mergeWarnings = (current, incoming) => {
	const warnings = new Map();
	[...(current || []), ...(incoming || [])].forEach((warning) => {
		warnings.set(`${warning.code}|${warning.provider}|${warning.reason}`, warning);
	});
	return [...warnings.values()];
};

const toMediaItem = (event) => {
	const linkedImageItemId = event.JellyfinImageItemId || event.JellyfinItemId;
	const linkedImageItem = linkedImageItemId
		? {...event, Id: linkedImageItemId, Type: event.Type === 'Episode' ? 'Series' : event.Type}
		: null;
	return {
		...event,
		Name: event.Title,
		SeriesName: event.SeriesTitle || '',
		ParentIndexNumber: Number.isInteger(event.SeasonNumber) ? event.SeasonNumber : null,
		IndexNumber: Number.isInteger(event.EpisodeNumber) ? event.EpisodeNumber : null,
		ImageCandidates: uniqueImageCandidates([
			event.AuthenticatedImageUrl,
			...(linkedImageItem
				? getLandscapeCardImageUrls(linkedImageItem, {width: 640, quality: 76})
				: [])
		])
	};
};

const getLocalDateKey = (utcDate) => {
	const date = new Date(utcDate);
	return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString(undefined, {
		weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
	});
};

const formatUtcDate = (date) => date.toISOString().slice(0, 10);

const createCalendarRange = (now = new Date()) => {
	const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const endDate = new Date(startDate);
	endDate.setUTCDate(endDate.getUTCDate() + CALENDAR_RANGE_DAYS);
	return {start: formatUtcDate(startDate), end: formatUtcDate(endDate)};
};

const getCalendarEventId = (event) => String(
	event?.Id ||
	event?.EventId ||
	[
		event?.Provider,
		event?.Type,
		event?.UtcDate,
		event?.SeriesTitle,
		event?.Title,
		event?.SeasonNumber,
		event?.EpisodeNumber
	].join('|')
);

const mergeCalendarEvents = (currentItems, incomingItems) => (
	[...new Map(
		[...(currentItems || []), ...(incomingItems || [])]
			.map((item) => [getCalendarEventId(item), item])
	).values()]
);

const CalendarPanel = ({
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
	const cacheIsFresh = Date.now() - (Number(cachedState?.cachedAt) || 0) < CACHE_TTL_MS;
	const [itemTypes, setItemTypes] = useState(() => (
		cacheIsFresh && Array.isArray(cachedState?.itemTypes) ? cachedState.itemTypes : ['Movie', 'Episode']
	));
	const [items, setItems] = useState(() => cacheIsFresh && Array.isArray(cachedState?.items) ? cachedState.items : []);
	const [loading, setLoading] = useState(() => !cacheIsFresh);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(() => cacheIsFresh && cachedState?.hasMore === true);
	const [nextStartIndex, setNextStartIndex] = useState(() => cacheIsFresh && Number.isInteger(cachedState?.nextStartIndex)
		? cachedState.nextStartIndex : 0);
	const [emptyReason, setEmptyReason] = useState(() => cacheIsFresh ? (cachedState?.emptyReason || null) : null);
	const [initialError, setInitialError] = useState('');
	const [paginationError, setPaginationError] = useState('');
	const [activationError, setActivationError] = useState('');
	const [warnings, setWarnings] = useState(() => cacheIsFresh && Array.isArray(cachedState?.warnings)
		? cachedState.warnings : []);
	const warningsRef = useRef(warnings);
	warningsRef.current = warnings;
	const itemsRef = useRef(items);
	itemsRef.current = items;
	const lastLoadedAtRef = useRef(cacheIsFresh ? Number(cachedState?.cachedAt) : 0);
	const itemTypesRef = useRef(itemTypes);
	itemTypesRef.current = itemTypes;
	const pageRequestsRef = useRef(new Map());
	const providerShell = useProviderPanelShell({
		cachedState, isActive, onCacheState, onNavigate, onSwitchUser, onLogout, onExit, registerBackHandler
	});
	const {cachePanelState, reportProviderDiagnostic, reportProviderFailure, requestIdRef} = providerShell;
	const calendarRange = useMemo(() => createCalendarRange(), []);

	const persistPage = useCallback((pageState) => {
		cachePanelState({
			items: pageState.items,
			itemTypes: itemTypesRef.current,
			hasMore: pageState.hasMore,
			nextStartIndex: pageState.nextStartIndex,
			warnings: pageState.warnings,
			emptyReason: pageState.emptyReason,
			cachedAt: lastLoadedAtRef.current
		});
	}, [cachePanelState]);

	const loadPage = useCallback(async ({startIndex = 0, append = false} = {}) => {
		const requestKey = [
			calendarRange.start,
			calendarRange.end,
			[...itemTypesRef.current].sort().join(','),
			startIndex
		].join('|');
		if (pageRequestsRef.current.has(requestKey)) {
			return pageRequestsRef.current.get(requestKey);
		}
		const requestId = append ? requestIdRef.current : requestIdRef.current + 1;
		if (!append) {
			requestIdRef.current = requestId;
			setLoading(true);
			setInitialError('');
			setActivationError('');
		}
		setPaginationError('');
		setLoadingMore(append);
		let request;
		request = (async () => {
			try {
				const response = await jellyfinService.getCalendarEvents({
					start: calendarRange.start,
					end: calendarRange.end,
					itemTypes: itemTypesRef.current,
					limit: PAGE_SIZE,
					startIndex,
					allowPartial: true
				});
				if (requestId !== requestIdRef.current) return;
				if (response?.available !== true) {
					reportProviderFailure('Calendar', response);
					const message = response?.problemDetails?.detail || 'Calendar providers are unavailable.';
					if (append) setPaginationError(message);
					else setInitialError(message);
					return;
				}
				const pageItems = response.result.items.map(toMediaItem);
				if (!append && pageItems.length === 0) {
					reportProviderDiagnostic('Calendar empty result', {
						emptyReason: response.result.emptyReason || 'unspecified',
						configuredRange: calendarRange,
						providerDiagnostics: response.result.providerDiagnostics || null,
						warningCount: response.result.warnings?.length || 0
					});
				}
				const nextItems = append
					? mergeCalendarEvents(itemsRef.current, pageItems)
					: mergeCalendarEvents([], pageItems);
				itemsRef.current = nextItems;
				lastLoadedAtRef.current = Date.now();
				setItems(nextItems);
				setNextStartIndex(response.result.nextStartIndex);
				setHasMore(response.result.hasMore);
				setEmptyReason(response.result.emptyReason);
				const nextWarnings = append
					? mergeWarnings(warningsRef.current, response.result.warnings)
					: (response.result.warnings || []);
				warningsRef.current = nextWarnings;
				setWarnings(nextWarnings);
				(response.result.warnings || []).forEach((warning) => {
					reportProviderFailure('Calendar partial result', warning);
				});
				persistPage({
					items: nextItems,
					nextStartIndex: response.result.nextStartIndex,
					hasMore: response.result.hasMore,
					warnings: nextWarnings,
					emptyReason: response.result.emptyReason
				});
			} catch (error) {
				if (requestId !== requestIdRef.current) return;
				reportProviderFailure('Calendar', error);
				const message = error?.problemDetails?.detail || 'Calendar providers are unavailable.';
				if (append) setPaginationError(message);
				else setInitialError(message);
			} finally {
				if (pageRequestsRef.current.get(requestKey) === request) {
					pageRequestsRef.current.delete(requestKey);
				}
				if (requestId === requestIdRef.current) {
					setLoading(false);
					setLoadingMore(false);
				}
			}
		})();
		pageRequestsRef.current.set(requestKey, request);
		return request;
	}, [calendarRange, persistPage, reportProviderDiagnostic, reportProviderFailure, requestIdRef]);

	useEffect(() => {
		if (!isActive) return undefined;
		const pageRequests = pageRequestsRef.current;
		if (Date.now() - lastLoadedAtRef.current >= CACHE_TTL_MS) loadPage();
		else setLoading(false);
		return () => {
			requestIdRef.current += 1;
			pageRequests.clear();
		};
	}, [isActive, itemTypes, loadPage, requestIdRef]);

	const selectTypes = useCallback((next) => {
		if (next.length === itemTypes.length && next.every((value) => itemTypes.includes(value))) return;
		itemTypesRef.current = next;
		itemsRef.current = [];
		warningsRef.current = [];
		lastLoadedAtRef.current = 0;
		setItemTypes(next);
		setItems([]);
		setWarnings([]);
		setEmptyReason(null);
		setHasMore(false);
		setNextStartIndex(0);
		setPaginationError('');
		setInitialError('');
		setLoading(true);
		cachePanelState({
			items: [],
			itemTypes: next,
			hasMore: false,
			nextStartIndex: 0,
			warnings: [],
			emptyReason: null,
			cachedAt: 0
		});
	}, [cachePanelState, itemTypes]);

	const handleItemClick = usePluginMediaItemActivation({
		onItemSelect,
		onExternalItem: providerShell.setExternalItem,
		onUnavailable: setActivationError,
		isActive
	});
	const groupedRows = useMemo(() => {
		const groups = new Map();
		items.forEach((item) => {
			const key = getLocalDateKey(item.UtcDate);
			groups.set(key, [...(groups.get(key) || []), item]);
		});
		return [...groups.entries()].map(([title, groupItems]) => ({title, items: groupItems}));
	}, [items]);
	const backdropItem = useMemo(() => {
		const firstItem = items[0];
		const linkedImageItemId = firstItem?.JellyfinImageItemId || firstItem?.JellyfinItemId;
		return linkedImageItemId
			? {...firstItem, Id: linkedImageItemId, Type: firstItem.Type === 'Episode' ? 'Series' : firstItem.Type}
			: null;
	}, [items]);
	const backdropUrl = items[0]?.ImageCandidates?.[0] || '';
	const showAll = useCallback(() => selectTypes(['Movie', 'Episode']), [selectTypes]);
	const showMovies = useCallback(() => selectTypes(['Movie']), [selectTypes]);
	const showSeries = useCallback(() => selectTypes(['Episode']), [selectTypes]);
	const activeFilterTab = itemTypes.length === 2
		? 'all'
		: (itemTypes[0] === 'Movie' ? 'movies' : 'series');
	const selectFilterTab = useCallback((tabId) => {
		if (tabId === 'movies') showMovies();
		else if (tabId === 'series') showSeries();
		else showAll();
	}, [showAll, showMovies, showSeries]);
	const getImageCandidates = useCallback((id, item) => item.ImageCandidates, []);
	const loadNextPage = useCallback(() => {
		loadPage({startIndex: nextStartIndex, append: true});
	}, [loadPage, nextStartIndex]);
	const firstFocusId = 'calendar-filter-all';
	const retryInitial = useCallback(() => loadPage(), [loadPage]);
	const emptyMessage = !loading && !initialError && groupedRows.length === 0
		? (EMPTY_MESSAGES[emptyReason] || 'No calendar events are available.')
		: '';

	return (
		<IntegrationPanelLayout
			{...rest}
			title="Calendar"
			activeSection="calendar"
			isActive={isActive}
			toolbarActions={providerShell.toolbarActions}
			firstFocusId={firstFocusId}
			backdropItem={backdropItem}
			backdropUrl={backdropUrl}
			loading={loading && items.length === 0}
			captureScrollTo={providerShell.captureScrollTo}
			onScrollStop={providerShell.handleScrollStop}
			errorMessage={items.length === 0 ? (initialError || activationError) : activationError}
			onRetry={items.length === 0 && initialError ? retryInitial : null}
		>
			<PanelTabNavigation
				activeId={activeFilterTab}
				ariaLabel="Calendar media types"
				onSelect={selectFilterTab}
				spotlightIdPrefix="calendar-filter"
				tabs={CALENDAR_FILTER_TABS}
			/>
			{emptyMessage ? (
				<div className={`${css.feedState} ${css.emptyState}`}>
					<BodyText>{emptyMessage}</BodyText>
				</div>
			) : null}
			{warnings.length > 0 ? (
				<BodyText className={css.warning}>Results may be incomplete because one or more configured providers failed.</BodyText>
			) : null}
			{groupedRows.map((row, index) => (
				<MediaRow
					key={row.title}
					title={row.title}
					items={row.items}
					onItemClick={handleItemClick}
					getImageCandidates={getImageCandidates}
					rowIndex={index}
				/>
			))}
			{paginationError ? (
				<section className={css.feedState}>
					<BodyText>{paginationError}</BodyText>
					<PanelActionButton spotlightId="calendar-pagination-retry" onClick={loadNextPage}>
						Retry
					</PanelActionButton>
				</section>
			) : null}
			{hasMore && !paginationError ? (
				<PanelActionButton spotlightId="calendar-load-more" disabled={loadingMore} onClick={loadNextPage}>
					{loadingMore ? 'Loading...' : 'Load More'}
				</PanelActionButton>
			) : null}
			<ProviderItemPopup
				open={providerShell.externalItemOpen}
				title={providerShell.externalItem?.Name || 'Calendar event'}
				detail={providerShell.externalItem ? new Date(providerShell.externalItem.UtcDate).toLocaleString() : ''}
				item={providerShell.externalItem}
				onClose={providerShell.closeExternalItem}
				onHide={providerShell.handleExternalItemHide}
				spotlightId="calendar-event-close"
			/>
		</IntegrationPanelLayout>
	);
};

export default CalendarPanel;
