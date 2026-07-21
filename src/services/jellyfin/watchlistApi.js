import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../../constants/integrationEvents';

const WATCHLIST_CACHE_TTL_MS = 30000;
const WATCHLIST_PAGE_SIZE = 500;
const WATCHLIST_MAX_ITEMS = 10000;
const cacheByService = new WeakMap();

const normalizeSortValue = (value) => String(value || '').trim().toLocaleLowerCase();

const compareWatchlistItems = (left, right) => (
	normalizeSortValue(left?.SortName).localeCompare(normalizeSortValue(right?.SortName)) ||
	normalizeSortValue(left?.Name).localeCompare(normalizeSortValue(right?.Name)) ||
	String(left?.Id || '').localeCompare(String(right?.Id || ''))
);

const getSessionKey = (service) => JSON.stringify([
	service?.serverUrl || '',
	service?.userId || '',
	service?.accessToken || ''
]);

export const invalidateWatchlistCache = (service) => {
	if (service && (typeof service === 'object' || typeof service === 'function')) {
		cacheByService.delete(service);
	}
};

export const notifyUserDataInvalidated = (itemIds = []) => {
	if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
	window.dispatchEvent(new CustomEvent(BREEZYFIN_USER_DATA_INVALIDATED_EVENT, {
		detail: {itemIds: Array.isArray(itemIds) ? itemIds.filter(Boolean) : []}
	}));
};

const loadWatchlistSnapshot = async (service) => {
	const items = [];
	let startIndex = 0;
	let totalRecordCount = 0;
	do {
		const params = new URLSearchParams({
			recursive: 'true',
			includeItemTypes: 'Movie,Series',
			filters: 'Likes',
			sortBy: 'SortName,Name',
			sortOrder: 'Ascending',
			fields: 'PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,UserData,ChildCount,Tags',
			enableTotalRecordCount: 'true',
			limit: String(WATCHLIST_PAGE_SIZE),
			startIndex: String(startIndex)
		});
		const data = await service._request(`/Users/${service.userId}/Items?${params.toString()}`, {
			context: 'getLikesWatchlist'
		});
		if (!data || !Array.isArray(data.Items) || !Number.isInteger(data.TotalRecordCount)) {
			throw new Error('Likes watchlist returned a malformed response');
		}
		totalRecordCount = Math.min(data.TotalRecordCount, WATCHLIST_MAX_ITEMS);
		items.push(...data.Items.filter((item) => (
			item && typeof item.Id === 'string' && ['Movie', 'Series'].includes(item.Type)
		)));
		startIndex += data.Items.length;
		if (data.Items.length === 0) break;
	} while (startIndex < totalRecordCount && startIndex < WATCHLIST_MAX_ITEMS);

	return items.sort(compareWatchlistItems);
};

const getWatchlistSnapshot = (service) => {
	const key = getSessionKey(service);
	const now = Date.now();
	const cached = cacheByService.get(service);
	if (cached?.key === key && cached.expiresAt > now) return cached.promise;
	const promise = loadWatchlistSnapshot(service).catch((error) => {
		if (cacheByService.get(service)?.promise === promise) cacheByService.delete(service);
		throw error;
	});
	cacheByService.set(service, {key, expiresAt: now + WATCHLIST_CACHE_TTL_MS, promise});
	return promise;
};

export const getLikesWatchlist = async (service, limit = 60, startIndex = 0) => {
	const safeLimit = Math.min(500, Math.max(1, Math.trunc(Number(limit) || 60)));
	const safeStartIndex = Math.max(0, Math.trunc(Number(startIndex) || 0));
	const snapshot = await getWatchlistSnapshot(service);
	const items = snapshot.slice(safeStartIndex, safeStartIndex + safeLimit);
	const nextStartIndex = safeStartIndex + items.length;
	return {
		items,
		totalRecordCount: snapshot.length,
		nextStartIndex,
		hasMore: nextStartIndex < snapshot.length
	};
};

export const addItemToLikesWatchlist = async (service, itemId) => {
	await service._request(
		`/Users/${service.userId}/Items/${encodeURIComponent(itemId)}/Rating?likes=true`,
		{method: 'POST', expectJson: false, context: 'addItemToLikesWatchlist'}
	);
	invalidateWatchlistCache(service);
	notifyUserDataInvalidated([itemId]);
	return true;
};

export const removeItemFromLikesWatchlist = async (service, itemId) => {
	await service._request(
		`/Users/${service.userId}/Items/${encodeURIComponent(itemId)}/Rating`,
		{method: 'DELETE', expectJson: false, context: 'removeItemFromLikesWatchlist'}
	);
	invalidateWatchlistCache(service);
	notifyUserDataInvalidated([itemId]);
	return null;
};
