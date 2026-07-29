const normalizeNonNegativeInteger = (value, fallback = 0) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
};

export const normalizeHomeSectionPage = (value, {
	startIndex = 0,
	requestedLimit = 30
} = {}) => {
	const safeStartIndex = normalizeNonNegativeInteger(startIndex);
	const safeRequestedLimit = Math.max(1, normalizeNonNegativeInteger(requestedLimit, 30));
	const items = Array.isArray(value)
		? value
		: (Array.isArray(value?.items) ? value.items : []);
	const explicitNextStartIndex = normalizeNonNegativeInteger(value?.nextStartIndex, -1);
	const nextStartIndex = explicitNextStartIndex > safeStartIndex
		? explicitNextStartIndex
		: safeStartIndex + items.length;
	const totalRecordCount = Number(value?.totalRecordCount);
	const hasKnownTotal = Number.isFinite(totalRecordCount) && totalRecordCount >= 0;
	const hasMore = typeof value?.hasMore === 'boolean'
		? value.hasMore
		: (hasKnownTotal
			? nextStartIndex < totalRecordCount
			: items.length >= safeRequestedLimit);

	return {
		items,
		nextStartIndex,
		hasMore: hasMore === true,
		madeProgress: nextStartIndex > safeStartIndex
	};
};

export const collectFilteredHomeSectionPage = async ({
	fetchPage,
	matchesItem,
	isStale = () => false,
	startIndex = 0,
	pageSize = 30,
	scanLimit = 6
} = {}) => {
	if (typeof fetchPage !== 'function') {
		return {items: [], nextStartIndex: normalizeNonNegativeInteger(startIndex), hasMore: false};
	}

	const safePageSize = Math.max(1, normalizeNonNegativeInteger(pageSize, 30));
	const safeScanLimit = Math.max(1, normalizeNonNegativeInteger(scanLimit, 1));
	const matches = typeof matchesItem === 'function' ? matchesItem : () => true;
	const seenIds = new Set();
	let cursor = normalizeNonNegativeInteger(startIndex);
	let collected = [];
	let scans = 0;
	let sourceHasMore = true;

	while (collected.length < safePageSize && scans < safeScanLimit && sourceHasMore) {
		const requestedLimit = safePageSize - collected.length;
		const rawPage = await fetchPage({
			startIndex: cursor,
			limit: requestedLimit
		});
		if (isStale()) {
			return {items: [], nextStartIndex: cursor, hasMore: false, stale: true};
		}

		const page = normalizeHomeSectionPage(rawPage, {
			startIndex: cursor,
			requestedLimit
		});
		if (!page.madeProgress) {
			sourceHasMore = false;
			break;
		}

		page.items.forEach((item) => {
			if (!matches(item)) return;
			const itemId = String(item?.Id || '');
			if (itemId && seenIds.has(itemId)) return;
			if (itemId) seenIds.add(itemId);
			collected.push(item);
		});
		cursor = page.nextStartIndex;
		sourceHasMore = page.hasMore;
		scans += 1;
	}

	return {
		items: collected.slice(0, safePageSize),
		nextStartIndex: cursor,
		hasMore: sourceHasMore
	};
};
