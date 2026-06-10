import {itemMatchesUserRequestTag} from '../../utils/myRequests';
import {normalizeOptionalQueryValue} from './queryParams';

const REQUESTS_PLUGIN_ENDPOINT = '/Breezyfin/MyRequests';
const FALLBACK_SCAN_MULTIPLIER = 4;
const MAX_SCAN_PAGES = 8;

const isWatchedItem = (item) => {
	const userData = item?.UserData || {};
	if (userData.Played === true) return true;
	if (Number.isFinite(userData.PlayedPercentage)) return Number(userData.PlayedPercentage) >= 100;
	return false;
};

const normalizePositiveInteger = (value, fallback) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(1, Math.trunc(parsed));
};

const normalizeStartIndex = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return 0;
	return Math.max(0, Math.trunc(parsed));
};

const getMyRequestsFromPlugin = async (service, {
	parentId,
	itemTypes,
	limit = 60,
	startIndex = 0
} = {}) => {
	try {
		if (!service?.userId) return null;
		const safeLimit = normalizePositiveInteger(limit, 60);
		const safeStartIndex = normalizeStartIndex(startIndex);
		const params = new URLSearchParams();
		params.set('userId', service.userId);
		const safeParentId = normalizeOptionalQueryValue(parentId);
		if (safeParentId) params.set('parentId', safeParentId);
		params.set('limit', String(safeLimit));
		params.set('startIndex', String(safeStartIndex));
		if (Array.isArray(itemTypes) && itemTypes.length > 0) {
			params.set('includeItemTypes', itemTypes.join(','));
		} else if (typeof itemTypes === 'string' && itemTypes.trim()) {
			params.set('includeItemTypes', itemTypes.trim());
		}
		const data = await service._request(`${REQUESTS_PLUGIN_ENDPOINT}?${params.toString()}`, {
			context: 'getMyRequests plugin'
		});
		return Array.isArray(data?.Items) ? data.Items : [];
	} catch (_) {
		return null;
	}
};

const collectFilledPage = async ({
	fetchPage,
	matchesItem,
	limit,
	startIndex
}) => {
	const safeLimit = normalizePositiveInteger(limit, 60);
	let cursor = normalizeStartIndex(startIndex);
	let collected = [];
	let scannedCount = 0;
	let scans = 0;
	let hasMore = true;
	const rawPageLimit = Math.max(safeLimit, safeLimit * FALLBACK_SCAN_MULTIPLIER);

	while (collected.length < safeLimit && scans < MAX_SCAN_PAGES && hasMore) {
		const rawItems = await fetchPage({
			limit: rawPageLimit,
			startIndex: cursor
		});
		const safeItems = Array.isArray(rawItems) ? rawItems : [];
		const pageScannedCount = safeItems.length;
		if (pageScannedCount <= 0) {
			hasMore = false;
			break;
		}
		scannedCount += pageScannedCount;
		cursor += pageScannedCount;
		collected = [
			...collected,
			...safeItems.filter(matchesItem)
		];
		hasMore = pageScannedCount >= rawPageLimit;
		scans += 1;
	}

	return {
		items: collected.slice(0, safeLimit),
		scannedCount,
		nextStartIndex: cursor,
		hasMore
	};
};

export const getMyRequestItems = async (service, {
	parentId,
	itemTypes,
	limit = 60,
	startIndex = 0,
	username = ''
} = {}) => {
	const safeParentId = normalizeOptionalQueryValue(parentId);
	const matchesRequestedUnwatchedItem = (item) => (
		!isWatchedItem(item) &&
		itemMatchesUserRequestTag(item, username)
	);
	const matchesUnwatchedPluginItem = (item) => !isWatchedItem(item);

	const pluginProbe = await getMyRequestsFromPlugin(service, {
		parentId: safeParentId,
		itemTypes,
		limit: 1,
		startIndex
	});
	if (pluginProbe !== null) {
		const pluginPage = await collectFilledPage({
			limit,
			startIndex,
			matchesItem: matchesUnwatchedPluginItem,
			fetchPage: ({limit: pageLimit, startIndex: pageStartIndex}) => getMyRequestsFromPlugin(service, {
				parentId: safeParentId,
				itemTypes,
				limit: pageLimit,
				startIndex: pageStartIndex
			})
		});
		return {
			...pluginPage,
			source: 'plugin'
		};
	}

	const fallbackPage = await collectFilledPage({
		limit,
		startIndex,
		matchesItem: matchesRequestedUnwatchedItem,
		fetchPage: ({limit: pageLimit, startIndex: pageStartIndex}) => (
			service.getLibraryItems(safeParentId, itemTypes, pageLimit, pageStartIndex, {filters: 'IsUnplayed'})
		)
	});
	return {
		...fallbackPage,
		source: 'tags-fallback'
	};
};
