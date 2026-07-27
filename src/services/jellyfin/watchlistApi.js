import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../../constants/integrationEvents';

export const invalidateWatchlistCache = (service) => {
	void service;
};

export const notifyUserDataInvalidated = (itemIds = []) => {
	if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
	window.dispatchEvent(new CustomEvent(BREEZYFIN_USER_DATA_INVALIDATED_EVENT, {
		detail: {itemIds: Array.isArray(itemIds) ? itemIds.filter(Boolean) : []}
	}));
};

export const getLikesWatchlist = async (
	service,
	limit = 60,
	startIndex = 0,
	itemTypes = ['Movie', 'Series']
) => {
	const safeLimit = Math.min(500, Math.max(1, Math.trunc(Number(limit) || 60)));
	const safeStartIndex = Math.max(0, Math.trunc(Number(startIndex) || 0));
	const safeItemTypes = [...new Set((Array.isArray(itemTypes) ? itemTypes : [itemTypes])
		.filter((type) => ['Movie', 'Series'].includes(type)))];
	const params = new URLSearchParams({
		recursive: 'true',
		includeItemTypes: (safeItemTypes.length ? safeItemTypes : ['Movie', 'Series']).join(','),
		filters: 'Likes',
		sortBy: 'SortName,Name',
		sortOrder: 'Ascending',
		fields: 'PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,UserData,ChildCount,Tags',
		enableTotalRecordCount: 'true',
		limit: String(safeLimit),
		startIndex: String(safeStartIndex)
	});
	const data = await service._request(`/Users/${service.userId}/Items?${params.toString()}`, {
		context: 'getLikesWatchlist'
	});
	if (!data || !Array.isArray(data.Items) || !Number.isInteger(data.TotalRecordCount)) {
		throw new Error('Likes watchlist returned a malformed response');
	}
	const items = data.Items.filter((item) => item && typeof item.Id === 'string');
	const nextStartIndex = safeStartIndex + data.Items.length;
	return {
		items,
		totalRecordCount: data.TotalRecordCount,
		nextStartIndex,
		hasMore: nextStartIndex < data.TotalRecordCount
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
