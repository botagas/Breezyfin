import {
	getServerHomeRowsStatus,
	getServerHomeRowStatus,
	isServerHomeSectionEnabled,
	loadServerHomeRowsProgressively,
	SERVER_HOME_ROW_STATUS,
	selectDisplayableServerHomeRows,
	selectHomeRowsForSource,
	selectServerHomeRowsToLoad,
	shouldReloadHomeContent
} from '../serverHomeRows';

const row = (key, items = null, loading = false, status) => ({
	key,
	descriptor: {title: key},
	items,
	loading,
	...(status ? {status} : {})
});

describe('server Home row loading', () => {
	it('loads only the bounded descriptor window with two concurrent requests', () => {
		const rows = [
			row('empty-1', []),
			row('empty-2', []),
			row('pending-1'),
			row('pending-2'),
			row('pending-3')
		];

		expect(selectServerHomeRowsToLoad(rows, 2).map((entry) => entry.key)).toEqual([
			'pending-1',
			'pending-2'
		]);
	});

	it('does not reload resolved or in-flight rows', () => {
		const rows = [
			row('ready', [{Id: 'item-1'}]),
			row('empty', []),
			row('loading', null, true),
			row('pending')
		];

		expect(selectServerHomeRowsToLoad(rows, 2).map((entry) => entry.key)).toEqual(['pending']);
	});

	it('reports an exhausted empty result separately from pending rows', () => {
		expect(getServerHomeRowsStatus([row('empty', [])])).toEqual({
			hasDisplayableItems: false,
			pending: false
		});
		expect(getServerHomeRowsStatus([row('pending')])).toEqual({
			hasDisplayableItems: false,
			pending: true
		});
	});

	it('keeps unresolved and failed descriptors visible but hides settled empty rows', () => {
		expect(selectDisplayableServerHomeRows([
			row('unresolved'),
			row('loading', null, true),
			row('empty', []),
			row('ready', [{Id: 'item-1'}]),
			row('failed', [], false, 'error')
		]).map((entry) => entry.key)).toEqual(['unresolved', 'loading', 'ready', 'failed']);
	});

	it('skips settled empty rows when filling the bounded loading window', () => {
		const rows = [
			row('empty-1', []),
			row('empty-2', []),
			row('empty-3', []),
			row('empty-4', []),
			row('pending-1'),
			row('pending-2')
		];

		expect(selectServerHomeRowsToLoad(rows, 2).map((entry) => entry.key)).toEqual([
			'pending-1',
			'pending-2'
		]);
	});

	it('defensively excludes explicitly disabled descriptors', () => {
		const disabled = row('disabled');
		disabled.descriptor.Enabled = false;
		const enabled = row('enabled');

		expect(isServerHomeSectionEnabled(disabled.descriptor)).toBe(false);
		expect(isServerHomeSectionEnabled(enabled.descriptor)).toBe(true);
		expect(selectDisplayableServerHomeRows([disabled, enabled])).toEqual([enabled]);
		expect(selectServerHomeRowsToLoad([disabled, enabled], 2)).toEqual([enabled]);
	});

	it('normalizes legacy and explicit row states', () => {
		expect(getServerHomeRowStatus(row('pending'))).toBe(SERVER_HOME_ROW_STATUS.PENDING);
		expect(getServerHomeRowStatus(row('loading', null, true))).toBe(SERVER_HOME_ROW_STATUS.LOADING);
		expect(getServerHomeRowStatus(row('ready', [{Id: 'item'}]))).toBe(SERVER_HOME_ROW_STATUS.READY);
		expect(getServerHomeRowStatus(row('empty', []))).toBe(SERVER_HOME_ROW_STATUS.EMPTY);
		expect(getServerHomeRowStatus(row('failed', [], false, 'error'))).toBe(SERVER_HOME_ROW_STATUS.ERROR);
	});

	it('does not exceed concurrency while earlier rows are loading', () => {
		const rows = [
			row('loading', null, true, 'loading'),
			row('pending-1'),
			row('pending-2')
		];
		expect(selectServerHomeRowsToLoad(rows, 3).map((entry) => entry.key)).toEqual(['pending-1']);
	});

	it('publishes row settlements independently while preserving final source order', async () => {
		const resolvers = new Map();
		const settledKeys = [];
		let now = 100;
		const loading = loadServerHomeRowsProgressively([
			row('slow'),
			row('fast')
		], (entry) => new Promise((resolve) => resolvers.set(entry.key, resolve)), {
			now: () => now,
			onSettled: ({key}) => settledKeys.push(key)
		});

		now = 120;
		resolvers.get('fast')({available: true, result: {items: [{Id: 'fast-item'}]}});
		await Promise.resolve();
		expect(settledKeys).toEqual(['fast']);

		now = 175;
		resolvers.get('slow')({available: true, result: {items: []}});
		const results = await loading;
		expect(settledKeys).toEqual(['fast', 'slow']);
		expect(results.map((entry) => entry.key)).toEqual(['slow', 'fast']);
		expect(results.map((entry) => entry.latencyMs)).toEqual([75, 20]);
	});
});

describe('Home content retention', () => {
	it('retains fresh mounted content across panel switches', () => {
		expect(shouldReloadHomeContent({
			hasLoaded: true,
			loadedAt: 1000,
			loadedVersion: 2,
			invalidatedVersion: 2,
			now: 2000,
			maxAgeMs: 60000
		})).toBe(false);
	});

	it('reloads initial, invalidated, and stale content', () => {
		expect(shouldReloadHomeContent({hasLoaded: false, now: 1000, maxAgeMs: 60000})).toBe(true);
		expect(shouldReloadHomeContent({
			hasLoaded: true,
			loadedAt: 1000,
			loadedVersion: 1,
			invalidatedVersion: 2,
			now: 2000,
			maxAgeMs: 60000
		})).toBe(true);
		expect(shouldReloadHomeContent({
			hasLoaded: true,
			loadedAt: 1000,
			loadedVersion: 2,
			invalidatedVersion: 2,
			now: 61000,
			maxAgeMs: 60000
		})).toBe(true);
	});
});

describe('Home row source selection', () => {
	it('treats server rows as authoritative without prepending built-in rows', () => {
		const serverRows = [{key: 'server:requests'}, {key: 'server:watchlist'}];
		const builtInRows = [{key: 'myRequests'}, {key: 'watchlist'}];

		expect(selectHomeRowsForSource({serverHomeActive: true, serverRows, builtInRows})).toBe(serverRows);
		expect(selectHomeRowsForSource({serverHomeActive: false, serverRows, builtInRows})).toBe(builtInRows);
	});
});
