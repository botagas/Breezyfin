const DEFAULT_MIN_BATCH_SIZE = 2;
const DEFAULT_MAX_BATCH_SIZE = 4;

const hasDisplayableItems = (row) => Array.isArray(row?.items) && row.items.length > 0;

export const selectDisplayableServerHomeRows = (rows) => (
	(Array.isArray(rows) ? rows : []).filter((row) => row?.loading === true || hasDisplayableItems(row))
);

export const loadServerHomeRowsProgressively = async (rows, loadRow, {
	onSettled,
	now = Date.now
} = {}) => {
	if (typeof loadRow !== 'function') return [];
	const sourceRows = Array.isArray(rows) ? rows : [];
	return Promise.all(sourceRows.map(async (row) => {
		const startedAt = now();
		let response = null;
		let error = null;
		try {
			response = await loadRow(row);
		} catch (loadError) {
			error = loadError;
		}
		const settled = {
			key: row?.key,
			row,
			response,
			error,
			latencyMs: Math.max(0, now() - startedAt)
		};
		onSettled?.(settled);
		return settled;
	}));
};

export const selectServerHomeRowsToLoad = (rows, desiredVisibleCount, {
	minBatchSize = DEFAULT_MIN_BATCH_SIZE,
	maxBatchSize = DEFAULT_MAX_BATCH_SIZE
} = {}) => {
	const sourceRows = Array.isArray(rows) ? rows : [];
	const target = Math.max(0, Math.trunc(Number(desiredVisibleCount) || 0));
	const visibleCount = sourceRows.filter(hasDisplayableItems).length;
	if (visibleCount >= target) return [];

	const rowsNeeded = target - visibleCount;
	const batchSize = Math.min(maxBatchSize, Math.max(minBatchSize, rowsNeeded * 2));
	return sourceRows
		.filter((row) => row?.items === null && row.loading !== true)
		.slice(0, batchSize);
};

export const getServerHomeRowsStatus = (rows) => {
	const sourceRows = Array.isArray(rows) ? rows : [];
	return {
		hasDisplayableItems: sourceRows.some(hasDisplayableItems),
		pending: sourceRows.some((row) => row?.items === null || row?.loading === true)
	};
};

export const selectHomeRowsForSource = ({serverHomeActive = false, serverRows = [], builtInRows = []} = {}) => (
	serverHomeActive ? serverRows : builtInRows
);
