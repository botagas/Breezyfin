import {wipeAllAppCache} from '../cacheMaintenance';

describe('cacheMaintenance', () => {
	const originalCaches = global.window?.caches;
	const originalIndexedDb = global.window?.indexedDB;
	const originalServiceWorker = global.navigator?.serviceWorker;

	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();

		Object.defineProperty(window, 'caches', {
			configurable: true,
			value: {
				keys: jest.fn().mockResolvedValue([]),
				delete: jest.fn().mockResolvedValue(true)
			}
		});

		Object.defineProperty(window, 'indexedDB', {
			configurable: true,
			value: {
				databases: jest.fn().mockResolvedValue([]),
				deleteDatabase: jest.fn()
			}
		});

		Object.defineProperty(navigator, 'serviceWorker', {
			configurable: true,
			value: {
				getRegistrations: jest.fn().mockResolvedValue([])
			}
		});
	});

	afterAll(() => {
		Object.defineProperty(window, 'caches', {
			configurable: true,
			value: originalCaches
		});
		Object.defineProperty(window, 'indexedDB', {
			configurable: true,
			value: originalIndexedDb
		});
		Object.defineProperty(navigator, 'serviceWorker', {
			configurable: true,
			value: originalServiceWorker
		});
	});

	it('preserves requested localStorage keys while clearing other cache layers', async () => {
		localStorage.setItem('breezyfin_servers', '{"ok":true}');
		localStorage.setItem('temporary_key', 'value');
		sessionStorage.setItem('temp_session', 'value');

		const summary = await wipeAllAppCache({
			preserveLocalStorageKeys: ['breezyfin_servers']
		});

		expect(localStorage.getItem('breezyfin_servers')).toBe('{"ok":true}');
		expect(localStorage.getItem('temporary_key')).toBe(null);
		expect(sessionStorage.getItem('temp_session')).toBe(null);
		expect(summary.localStorageCleared).toBe(true);
		expect(summary.sessionStorageCleared).toBe(true);
		expect(summary.preservedLocalStorageKeys).toContain('breezyfin_servers');
	});
});
