export const normalizeSearchPage = (value, fallbackStartIndex = 0) => {
	if (Array.isArray(value)) {
		return {
			items: value,
			startIndex: fallbackStartIndex,
			totalRecordCount: null
		};
	}
	const items = Array.isArray(value?.items) ? value.items : [];
	const hasStartIndex = value?.startIndex !== null && value?.startIndex !== undefined;
	const hasTotalRecordCount = value?.totalRecordCount !== null && value?.totalRecordCount !== undefined;
	const startIndex = hasStartIndex ? Number(value.startIndex) : Number.NaN;
	const totalRecordCount = hasTotalRecordCount ? Number(value.totalRecordCount) : Number.NaN;
	return {
		items,
		startIndex: Number.isFinite(startIndex) ? Math.max(0, startIndex) : fallbackStartIndex,
		totalRecordCount: Number.isFinite(totalRecordCount) ? Math.max(0, totalRecordCount) : null
	};
};

export const resolveSearchPageProgress = ({
	page,
	existingItems = [],
	pageSize = 30,
	fallbackStartIndex = 0
} = {}) => {
	const normalizedPage = normalizeSearchPage(page, fallbackStartIndex);
	const existingIds = new Set(existingItems.map((item) => String(item?.Id || '')));
	const uniqueItems = normalizedPage.items.filter((item) => {
		const itemId = String(item?.Id || '');
		if (!itemId || existingIds.has(itemId)) return false;
		existingIds.add(itemId);
		return true;
	});
	const nextStartIndex = normalizedPage.startIndex + normalizedPage.items.length;
	const hasMoreByTotal = normalizedPage.totalRecordCount !== null
		? nextStartIndex < normalizedPage.totalRecordCount
		: normalizedPage.items.length >= pageSize;
	return {
		...normalizedPage,
		uniqueItems,
		nextStartIndex,
		hasMore: uniqueItems.length > 0 && hasMoreByTotal,
		madeProgress: uniqueItems.length > 0
	};
};

export const shouldLoadMoreSearchResults = ({
	lastVisibleIndex,
	resultCount,
	threshold = 12
} = {}) => {
	if (lastVisibleIndex === null || lastVisibleIndex === undefined) return false;
	if (resultCount === null || resultCount === undefined) return false;
	const normalizedLastVisibleIndex = Number(lastVisibleIndex);
	const normalizedResultCount = Number(resultCount);
	const normalizedThreshold = Number(threshold);
	if (
		!Number.isInteger(normalizedLastVisibleIndex) ||
		!Number.isInteger(normalizedResultCount) ||
		normalizedResultCount <= 0 ||
		normalizedLastVisibleIndex < 0
	) {
		return false;
	}
	const safeThreshold = Number.isFinite(normalizedThreshold)
		? Math.max(0, normalizedThreshold)
		: 0;
	return normalizedResultCount - normalizedLastVisibleIndex - 1 <= safeThreshold;
};
