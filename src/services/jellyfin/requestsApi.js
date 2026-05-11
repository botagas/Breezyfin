import {filterItemsByUserRequestTags} from '../../utils/myRequests';

const REQUESTS_PLUGIN_ENDPOINT = '/Breezyfin/MyRequests';

const getMyRequestsFromPlugin = async (service, {
	parentId,
	itemTypes,
	limit = 60,
	startIndex = 0
} = {}) => {
	try {
		if (!service?.userId) return null;
		const params = new URLSearchParams();
		params.set('userId', service.userId);
		if (parentId) params.set('parentId', parentId);
		if (Number.isFinite(limit)) params.set('limit', String(Math.max(1, Math.trunc(limit))));
		if (Number.isFinite(startIndex)) params.set('startIndex', String(Math.max(0, Math.trunc(startIndex))));
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

export const getMyRequestItems = async (service, {
	parentId,
	itemTypes,
	limit = 60,
	startIndex = 0,
	username = ''
} = {}) => {
	const pluginItems = await getMyRequestsFromPlugin(service, {
		parentId,
		itemTypes,
		limit,
		startIndex
	});
	if (pluginItems !== null) {
		return {items: pluginItems, source: 'plugin', scannedCount: pluginItems.length};
	}

	const libraryItems = await service.getLibraryItems(parentId, itemTypes, limit, startIndex);
	const safeLibraryItems = Array.isArray(libraryItems) ? libraryItems : [];
	return {
		items: filterItemsByUserRequestTags(safeLibraryItems, username),
		source: 'tags-fallback',
		scannedCount: safeLibraryItems.length
	};
};
