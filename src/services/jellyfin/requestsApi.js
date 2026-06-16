import {itemMatchesUserRequestTag} from '../../utils/myRequests';
import {normalizeOptionalQueryValue} from './queryParams';

const REQUESTS_PLUGIN_ENDPOINT = '/Breezyfin/MyRequests';
const FALLBACK_SCAN_MULTIPLIER = 4;
const FALLBACK_SCAN_PAGE_LIMIT = 8;
const pluginUnavailableSessionKeys = new Set();

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

const getPluginAvailabilityKey = (service) => (
	service?.serverUrl && service?.userId
		? `${service.serverUrl}|${service.userId}`
		: ''
);

const isPluginMissingError = (error) => /\bstatus\s+404\b/i.test(String(error?.message || error || ''));

const normalizePluginResponse = (data, {
	limit,
	startIndex
}) => {
	const items = Array.isArray(data?.Items) ? data.Items : [];
	const totalRecordCount = Number(data?.TotalRecordCount);
	const nextStartIndex = startIndex + items.length;
	const hasMore = Number.isFinite(totalRecordCount)
		? nextStartIndex < totalRecordCount
		: items.length >= limit;
	return {
		items,
		source: 'plugin',
		scannedCount: items.length,
		nextStartIndex,
		hasMore,
		diagnosticReason: 'plugin'
	};
};

const getMyRequestsFromPlugin = async (service, {
	parentId,
	itemTypes,
	limit = 60,
	startIndex = 0
} = {}) => {
	const cacheKey = getPluginAvailabilityKey(service);
	if (cacheKey && pluginUnavailableSessionKeys.has(cacheKey)) {
		return {
			available: false,
			diagnosticReason: 'plugin-missing-cached'
		};
	}

	try {
		if (!service?.userId) {
			return {
				available: false,
				diagnosticReason: 'missing-user-id'
			};
		}
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
		return {
			available: true,
			result: normalizePluginResponse(data, {
				limit: safeLimit,
				startIndex: safeStartIndex
			})
		};
	} catch (error) {
		if (isPluginMissingError(error) && cacheKey) {
			pluginUnavailableSessionKeys.add(cacheKey);
			return {
				available: false,
				diagnosticReason: 'plugin-missing'
			};
		}
		return {
			available: false,
			diagnosticReason: 'plugin-error'
		};
	}
};

const collectTaggedFallbackPage = async (service, {
	parentId,
	itemTypes,
	limit,
	startIndex,
	username,
	pluginDiagnosticReason
}) => {
	const safeLimit = normalizePositiveInteger(limit, 60);
	const safeStartIndex = normalizeStartIndex(startIndex);
	if (!String(username || '').trim()) {
		return {
			items: [],
			source: 'tags-fallback',
			scannedCount: 0,
			nextStartIndex: safeStartIndex,
			hasMore: false,
			diagnosticReason: 'missing-username'
		};
	}

	const rawLimit = Math.max(safeLimit, safeLimit * FALLBACK_SCAN_MULTIPLIER);
	let cursor = safeStartIndex;
	let scannedCount = 0;
	let scanPages = 0;
	let sourceHasMore = true;
	const collected = [];

	while (collected.length < safeLimit && scanPages < FALLBACK_SCAN_PAGE_LIMIT && sourceHasMore) {
		const rawItems = await service.getLibraryItems(parentId, itemTypes, rawLimit, cursor);
		const safeRawItems = Array.isArray(rawItems) ? rawItems : [];
		if (safeRawItems.length === 0) {
			sourceHasMore = false;
			break;
		}

		for (let index = 0; index < safeRawItems.length; index += 1) {
			const item = safeRawItems[index];
			scannedCount += 1;
			const rawItemIndex = cursor + index;
			if (!itemMatchesUserRequestTag(item, username)) continue;
			collected.push(item);
			if (collected.length >= safeLimit) {
				const nextStartIndex = rawItemIndex + 1;
				const rawPageEndIndex = cursor + safeRawItems.length;
				const hasMore = nextStartIndex < rawPageEndIndex || safeRawItems.length >= rawLimit;
				return {
					items: collected,
					source: 'tags-fallback',
					scannedCount: nextStartIndex - safeStartIndex,
					nextStartIndex,
					hasMore,
					diagnosticReason: pluginDiagnosticReason || 'tags-fallback-filled'
				};
			}
		}

		cursor += safeRawItems.length;
		sourceHasMore = safeRawItems.length >= rawLimit;
		scanPages += 1;
	}

	const stoppedByScanLimit = sourceHasMore && scanPages >= FALLBACK_SCAN_PAGE_LIMIT;
	return {
		items: collected,
		source: 'tags-fallback',
		scannedCount,
		nextStartIndex: safeStartIndex + scannedCount,
		hasMore: stoppedByScanLimit,
		diagnosticReason: stoppedByScanLimit
			? 'tags-fallback-scan-limit'
			: (pluginDiagnosticReason || 'tags-fallback-exhausted')
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
	const pluginResult = await getMyRequestsFromPlugin(service, {
		parentId: safeParentId,
		itemTypes,
		limit,
		startIndex
	});
	if (pluginResult.available === true) {
		return pluginResult.result;
	}

	return collectTaggedFallbackPage(service, {
		parentId: safeParentId,
		itemTypes,
		limit,
		startIndex,
		username,
		pluginDiagnosticReason: pluginResult.diagnosticReason
	});
};
