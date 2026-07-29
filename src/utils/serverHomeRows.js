const DEFAULT_MIN_BATCH_SIZE = 2;
const DEFAULT_MAX_BATCH_SIZE = 2;
const DEFAULT_PREFETCH_ROWS = 2;

export const SERVER_HOME_ROW_STATUS = Object.freeze({
	PENDING: 'pending',
	LOADING: 'loading',
	READY: 'ready',
	EMPTY: 'empty',
	ERROR: 'error'
});

export const getServerHomeRowStatus = (row) => {
	if (Object.values(SERVER_HOME_ROW_STATUS).includes(row?.status)) return row.status;
	if (row?.loading === true) return SERVER_HOME_ROW_STATUS.LOADING;
	if (row?.items === null || row?.items === undefined) return SERVER_HOME_ROW_STATUS.PENDING;
	return Array.isArray(row.items) && row.items.length > 0
		? SERVER_HOME_ROW_STATUS.READY
		: SERVER_HOME_ROW_STATUS.EMPTY;
};

const hasDisplayableItems = (row) => Array.isArray(row?.items) && row.items.length > 0;

export const isServerHomeSectionEnabled = (descriptor) => (
	descriptor?.Enabled !== false && descriptor?.enabled !== false
);

export const selectDisplayableServerHomeRows = (rows) => (
	(Array.isArray(rows) ? rows : []).filter((row) => (
		row?.descriptor &&
		isServerHomeSectionEnabled(row.descriptor) &&
		getServerHomeRowStatus(row) !== SERVER_HOME_ROW_STATUS.EMPTY
	))
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
	maxBatchSize = DEFAULT_MAX_BATCH_SIZE,
	prefetchRows = DEFAULT_PREFETCH_ROWS
} = {}) => {
	const sourceRows = (Array.isArray(rows) ? rows : []).filter((row) => (
		isServerHomeSectionEnabled(row?.descriptor) &&
		getServerHomeRowStatus(row) !== SERVER_HOME_ROW_STATUS.EMPTY
	));
	const target = Math.min(
		sourceRows.length,
		Math.max(0, Math.trunc(Number(desiredVisibleCount) || 0)) + Math.max(0, prefetchRows)
	);
	const loadingCount = sourceRows.filter((row) => (
		getServerHomeRowStatus(row) === SERVER_HOME_ROW_STATUS.LOADING
	)).length;
	const availableSlots = Math.max(0, maxBatchSize - loadingCount);
	if (availableSlots === 0 || target === 0) return [];
	const batchSize = Math.min(availableSlots, Math.max(1, minBatchSize));
	return sourceRows
		.slice(0, target)
		.filter((row) => getServerHomeRowStatus(row) === SERVER_HOME_ROW_STATUS.PENDING)
		.slice(0, batchSize);
};

export const shouldReloadHomeContent = ({
	hasLoaded = false,
	loadedAt = 0,
	loadedVersion = 0,
	invalidatedVersion = 0,
	now = Date.now(),
	maxAgeMs = 0
} = {}) => (
	hasLoaded !== true ||
	Number(loadedVersion) < Number(invalidatedVersion) ||
	!Number.isFinite(Number(loadedAt)) ||
	Number(loadedAt) <= 0 ||
	(Math.max(0, Number(now) - Number(loadedAt)) >= Math.max(0, Number(maxAgeMs)))
);

export const getServerHomeRowsStatus = (rows) => {
	const sourceRows = Array.isArray(rows) ? rows : [];
	return {
		hasDisplayableItems: sourceRows.some(hasDisplayableItems),
		pending: sourceRows.some((row) => [
			SERVER_HOME_ROW_STATUS.PENDING,
			SERVER_HOME_ROW_STATUS.LOADING
		].includes(getServerHomeRowStatus(row)))
	};
};

export const selectHomeRowsForSource = ({serverHomeActive = false, serverRows = [], builtInRows = []} = {}) => (
	serverHomeActive ? serverRows : builtInRows
);
