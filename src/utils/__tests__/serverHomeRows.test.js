import {
	getServerHomeRowsStatus,
	loadServerHomeRowsProgressively,
	selectDisplayableServerHomeRows,
	selectHomeRowsForSource,
	selectServerHomeRowsToLoad
} from '../serverHomeRows';

const row = (key, items = null, loading = false) => ({key, items, loading});

describe('server Home row loading', () => {
	it('continues past valid empty rows until it can fill the visible row target', () => {
		const rows = [
			row('empty-1', []),
			row('empty-2', []),
			row('pending-1'),
			row('pending-2'),
			row('pending-3')
		];

		expect(selectServerHomeRowsToLoad(rows, 2).map((entry) => entry.key)).toEqual([
			'pending-1',
			'pending-2',
			'pending-3'
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

	it('keeps loading and resolved non-empty rows visible while hiding unresolved and empty rows', () => {
		expect(selectDisplayableServerHomeRows([
			row('unresolved'),
			row('loading', null, true),
			row('empty', []),
			row('ready', [{Id: 'item-1'}])
		]).map((entry) => entry.key)).toEqual(['loading', 'ready']);
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

describe('Home row source selection', () => {
	it('treats server rows as authoritative without prepending built-in rows', () => {
		const serverRows = [{key: 'server:requests'}, {key: 'server:watchlist'}];
		const builtInRows = [{key: 'myRequests'}, {key: 'watchlist'}];

		expect(selectHomeRowsForSource({serverHomeActive: true, serverRows, builtInRows})).toBe(serverRows);
		expect(selectHomeRowsForSource({serverHomeActive: false, serverRows, builtInRows})).toBe(builtInRows);
	});
});
