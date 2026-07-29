import {useCallback, useEffect, useRef, useState} from 'react';
import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../../../constants/integrationEvents';
import jellyfinService from '../../../services/jellyfinService';

const PAGE_SIZE = 30;
const CACHE_TTL_MS = 60 * 1000;
const INSIGHT_TABS = Object.freeze(['progress', 'completed', 'movies', 'statistics']);
const WARM_ORDER = Object.freeze([...INSIGHT_TABS]);

const createEmptyEntry = (tabId) => ({
	items: [],
	statistics: null,
	nextStartIndex: 0,
	hasMore: false,
	loading: false,
	refreshing: false,
	error: '',
	cachedAt: 0,
	tabId
});

const normalizeCachedEntry = (tabId, value) => {
	const entry = value && typeof value === 'object' ? value : {};
	return {
		...createEmptyEntry(tabId),
		items: Array.isArray(entry.items) ? entry.items : [],
		statistics: entry.statistics && typeof entry.statistics === 'object' ? entry.statistics : null,
		nextStartIndex: Number.isInteger(entry.nextStartIndex) ? entry.nextStartIndex : 0,
		hasMore: entry.hasMore === true,
		cachedAt: Number.isFinite(Number(entry.cachedAt)) ? Number(entry.cachedAt) : 0
	};
};

const createInitialEntries = (cachedEntries) => Object.fromEntries(
	INSIGHT_TABS.map((tabId) => [tabId, normalizeCachedEntry(tabId, cachedEntries?.[tabId])])
);

const hasEntryContent = (entry) => (
	entry?.tabId === 'statistics'
		? entry.statistics !== null
		: Array.isArray(entry?.items) && entry.items.length > 0
);

const isEntryFresh = (entry, now = Date.now()) => (
	Number(entry?.cachedAt) > 0 && now - Number(entry.cachedAt) < CACHE_TTL_MS
);

const mergeUniqueItems = (currentItems, incomingItems) => (
	[...new Map(
		[...(currentItems || []), ...(incomingItems || [])]
			.filter((item) => item?.Id)
			.map((item) => [item.Id, item])
	).values()]
);

const buildCachedEntries = (entries) => Object.fromEntries(
	INSIGHT_TABS.map((tabId) => {
		const entry = entries[tabId] || createEmptyEntry(tabId);
		return [tabId, {
			items: entry.items,
			statistics: entry.statistics,
			nextStartIndex: entry.nextStartIndex,
			hasMore: entry.hasMore,
			cachedAt: entry.cachedAt
		}];
	})
);

const getInsightsUnavailableMessage = (response) => {
	switch (response?.diagnosticReason) {
		case 'plugin-feature-disabled':
			return 'The installed Breezyfin plugin does not advertise Watchlist insights. Restart Jellyfin after updating the plugin.';
		case 'plugin-response-malformed':
			return 'The Breezyfin plugin returned incompatible Watchlist insight data.';
		case 'plugin-server-error':
		case 'plugin-unavailable':
			return 'Watchlist insights failed on the Jellyfin server.';
		default:
			return 'Install or update the Breezyfin Jellyfin plugin to use Watchlist insights.';
	}
};

const requestInsightTab = async (tabId, startIndex = 0) => {
	if (tabId === 'statistics') return jellyfinService.getWatchlistStatistics();
	if (tabId === 'movies') return jellyfinService.getWatchlistMovieHistory(PAGE_SIZE, startIndex);
	return jellyfinService.getWatchlistSeriesInsights(
		tabId === 'completed' ? 'Completed' : 'InProgress',
		PAGE_SIZE,
		startIndex
	);
};

export const useWatchlistInsights = ({
	activeTab,
	cachedEntries,
	diagnosticsEnabled = false,
	isActive = false,
	onCacheEntries
}) => {
	const [entries, setEntries] = useState(() => createInitialEntries(cachedEntries));
	const entriesRef = useRef(entries);
	const activeRef = useRef(isActive);
	const activeTabRef = useRef(activeTab);
	const generationRef = useRef(0);
	const inFlightRef = useRef(new Map());
	const lastCachedEntriesRef = useRef(null);
	const warmGenerationRef = useRef(0);
	entriesRef.current = entries;
	activeRef.current = isActive;
	activeTabRef.current = activeTab;

	const updateEntry = useCallback((tabId, updater) => {
		setEntries((current) => {
			const nextEntry = typeof updater === 'function'
				? updater(current[tabId])
				: {...current[tabId], ...updater};
			return {...current, [tabId]: nextEntry};
		});
	}, []);

	const loadTab = useCallback(async (tabId, {
		append = false,
		background = false,
		force = false
	} = {}) => {
		if (!INSIGHT_TABS.includes(tabId)) return null;
		const currentEntry = entriesRef.current[tabId] || createEmptyEntry(tabId);
		if (!append && !force && isEntryFresh(currentEntry)) return currentEntry;
		const startIndex = append ? currentEntry.nextStartIndex : 0;
		const requestKey = `${tabId}:${startIndex}`;
		if (inFlightRef.current.has(requestKey)) return inFlightRef.current.get(requestKey);
		const generation = generationRef.current;
		const startedAt = Date.now();
		updateEntry(tabId, (entry) => ({
			...entry,
			loading: !append && !hasEntryContent(entry),
			refreshing: !append && hasEntryContent(entry),
			error: ''
		}));

		let request;
		request = (async () => {
			try {
				const response = await requestInsightTab(tabId, startIndex);
				if (generation !== generationRef.current || (background && !activeRef.current)) return null;
				if (response?.available !== true) throw new Error(getInsightsUnavailableMessage(response));
				const cachedAt = Date.now();
				updateEntry(tabId, (entry) => {
					if (tabId === 'statistics') {
						return {
							...entry,
							statistics: response.result,
							loading: false,
							refreshing: false,
							error: '',
							hasMore: false,
							nextStartIndex: 0,
							cachedAt
						};
					}
					return {
						...entry,
						items: append
							? mergeUniqueItems(entry.items, response.result.items)
							: mergeUniqueItems([], response.result.items),
						nextStartIndex: response.result.nextStartIndex,
						hasMore: response.result.hasMore,
						loading: false,
						refreshing: false,
						error: '',
						cachedAt
					};
				});
				if (diagnosticsEnabled) {
					console.info('[Watchlist] Insight request completed', {
						tabId,
						background,
						append,
						durationMs: Date.now() - startedAt,
						itemCount: tabId === 'statistics' ? 1 : response.result.items.length
					});
				}
				return response.result;
			} catch (error) {
				if (generation === generationRef.current && (!background || activeRef.current)) {
					updateEntry(tabId, (entry) => ({
						...entry,
						loading: false,
						refreshing: false,
						error: error?.message || 'Watchlist insights could not be loaded.'
					}));
				}
				return null;
			} finally {
				if (inFlightRef.current.get(requestKey) === request) {
					inFlightRef.current.delete(requestKey);
				}
			}
		})();
		inFlightRef.current.set(requestKey, request);
		return request;
	}, [diagnosticsEnabled, updateEntry]);

	const warmRemainingTabs = useCallback(async (sourceTabId) => {
		const warmGeneration = ++warmGenerationRef.current;
		for (const tabId of WARM_ORDER) {
			if (!activeRef.current || warmGeneration !== warmGenerationRef.current) break;
			if (tabId === sourceTabId) continue;
			const entry = entriesRef.current[tabId];
			if (isEntryFresh(entry)) continue;
			await loadTab(tabId, {background: true});
		}
	}, [loadTab]);

	const ensureTab = useCallback(async (tabId) => {
		const entry = entriesRef.current[tabId] || createEmptyEntry(tabId);
		const hadFreshEntry = isEntryFresh(entry);
		const result = await loadTab(tabId, {force: !hadFreshEntry});
		if (result && activeRef.current) void warmRemainingTabs(tabId);
		return result;
	}, [loadTab, warmRemainingTabs]);

	const loadMore = useCallback(() => {
		const entry = entriesRef.current[activeTab];
		if (!entry || activeTab === 'statistics' || !entry.hasMore || entry.loading || entry.refreshing) return;
		void loadTab(activeTab, {append: true, force: true});
	}, [activeTab, loadTab]);

	const invalidateTabs = useCallback((tabIds = INSIGHT_TABS) => {
		generationRef.current += 1;
		warmGenerationRef.current += 1;
		inFlightRef.current.clear();
		setEntries((current) => {
			const next = {...current};
			tabIds.forEach((tabId) => {
				if (INSIGHT_TABS.includes(tabId)) next[tabId] = createEmptyEntry(tabId);
			});
			return next;
		});
	}, []);

	const refreshTab = useCallback((tabId) => loadTab(tabId, {force: true}), [loadTab]);

	useEffect(() => {
		if (!isActive || !INSIGHT_TABS.includes(activeTab)) return;
		void ensureTab(activeTab);
	}, [activeTab, ensureTab, isActive]);

	useEffect(() => {
		const cached = buildCachedEntries(entries);
		const previous = lastCachedEntriesRef.current;
		const changed = !previous || INSIGHT_TABS.some((tabId) => (
			previous[tabId]?.items !== cached[tabId].items ||
			previous[tabId]?.statistics !== cached[tabId].statistics ||
			previous[tabId]?.nextStartIndex !== cached[tabId].nextStartIndex ||
			previous[tabId]?.hasMore !== cached[tabId].hasMore ||
			previous[tabId]?.cachedAt !== cached[tabId].cachedAt
		));
		if (!changed) return;
		lastCachedEntriesRef.current = cached;
		onCacheEntries?.(cached);
	}, [entries, onCacheEntries]);

	useEffect(() => {
		const handleInvalidation = () => {
			invalidateTabs();
			const tabId = activeTabRef.current;
			if (activeRef.current && INSIGHT_TABS.includes(tabId)) {
				void loadTab(tabId, {force: true});
			}
		};
		window.addEventListener(BREEZYFIN_USER_DATA_INVALIDATED_EVENT, handleInvalidation);
		return () => window.removeEventListener(BREEZYFIN_USER_DATA_INVALIDATED_EVENT, handleInvalidation);
	}, [invalidateTabs, loadTab]);

	useEffect(() => () => {
		generationRef.current += 1;
		warmGenerationRef.current += 1;
		inFlightRef.current.clear();
	}, []);

	return {
		entry: entries[activeTab] || createEmptyEntry(activeTab),
		entries,
		invalidateTabs,
		loadMore,
		refreshTab
	};
};

export const WATCHLIST_INSIGHT_CACHE_TTL_MS = CACHE_TTL_MS;
export const WATCHLIST_INSIGHT_TABS = INSIGHT_TABS;
