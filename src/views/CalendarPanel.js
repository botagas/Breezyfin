import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import MediaRow from '../components/MediaRow';
import Button from '../components/BreezyButton';
import IntegrationPanelLayout from '../components/IntegrationPanelLayout';
import ProviderItemPopup from '../components/ProviderItemPopup';
import jellyfinService from '../services/jellyfinService';
import {useProviderPanelShell} from '../hooks/useProviderPanelShell';
import {usePluginMediaItemActivation} from '../hooks/usePluginMediaItemActivation';
import {getLandscapeCardImageUrls, uniqueImageCandidates} from '../utils/mediaItemUtils';

import css from './IntegrationPanels.module.less';

const PAGE_SIZE = 60;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CALENDAR_RANGE_DAYS = 90;
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
		const requestId = append ? requestIdRef.current : requestIdRef.current + 1;
		if (!append) {
			requestIdRef.current = requestId;
			setLoading(true);
			setInitialError('');
			setActivationError('');
		}
		setPaginationError('');
		setLoadingMore(append);
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
			const nextItems = append ? [...itemsRef.current, ...pageItems] : pageItems;
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
			if (requestId === requestIdRef.current) {
				setLoading(false);
				setLoadingMore(false);
			}
		}
	}, [calendarRange, persistPage, reportProviderDiagnostic, reportProviderFailure, requestIdRef]);

	useEffect(() => {
		if (!isActive) return undefined;
		if (Date.now() - lastLoadedAtRef.current >= CACHE_TTL_MS) loadPage();
		else setLoading(false);
		return () => {
			requestIdRef.current += 1;
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
	const getImageCandidates = useCallback((id, item) => item.ImageCandidates, []);
	const loadNextPage = useCallback(() => {
		loadPage({startIndex: nextStartIndex, append: true});
	}, [loadPage, nextStartIndex]);
	const firstFocusId = 'calendar-filter-all';
	const retryInitial = useCallback(() => loadPage(), [loadPage]);

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
			emptyMessage={!loading && !initialError && groupedRows.length === 0
				? (EMPTY_MESSAGES[emptyReason] || 'No calendar events are available.')
				: ''}
		>
			<div className={css.filterBar}>
				<Button spotlightId="calendar-filter-all" selected={itemTypes.length === 2} onClick={showAll}>All</Button>
				<Button spotlightId="calendar-filter-movies" selected={itemTypes.length === 1 && itemTypes[0] === 'Movie'} onClick={showMovies}>Movies</Button>
				<Button spotlightId="calendar-filter-series" selected={itemTypes.length === 1 && itemTypes[0] === 'Episode'} onClick={showSeries}>Series</Button>
			</div>
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
					<Button spotlightId="calendar-pagination-retry" onClick={loadNextPage}>Retry</Button>
				</section>
			) : null}
			{hasMore && !paginationError ? (
				<Button spotlightId="calendar-load-more" disabled={loadingMore} onClick={loadNextPage}>
					{loadingMore ? 'Loading...' : 'Load More'}
				</Button>
			) : null}
			<ProviderItemPopup
				open={providerShell.externalItemOpen}
				title={providerShell.externalItem?.Name || 'Calendar event'}
				detail={providerShell.externalItem ? new Date(providerShell.externalItem.UtcDate).toLocaleString() : ''}
				onClose={providerShell.closeExternalItem}
				onHide={providerShell.handleExternalItemHide}
				spotlightId="calendar-event-close"
			/>
		</IntegrationPanelLayout>
	);
};

export default CalendarPanel;
