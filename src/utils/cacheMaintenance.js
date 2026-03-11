const deleteIndexedDbDatabase = (indexedDbApi, databaseName) => new Promise((resolve) => {
	if (!indexedDbApi || !databaseName) {
		resolve(false);
		return;
	}

	try {
		const request = indexedDbApi.deleteDatabase(databaseName);
		request.onsuccess = () => resolve(true);
		request.onerror = () => resolve(false);
		request.onblocked = () => resolve(false);
	} catch (_) {
		resolve(false);
	}
});

const clearIndexedDbStorage = async () => {
	const indexedDbApi = typeof window !== 'undefined' ? window.indexedDB : undefined;
	if (!indexedDbApi || typeof indexedDbApi.databases !== 'function') {
		return {supported: false, deleted: 0, attempted: 0};
	}

	try {
		const databaseEntries = await indexedDbApi.databases();
		const names = (databaseEntries || [])
			.map((entry) => entry?.name)
			.filter((name) => typeof name === 'string' && name.length > 0);

		if (names.length === 0) {
			return {supported: true, deleted: 0, attempted: 0};
		}

		const results = await Promise.all(names.map((name) => deleteIndexedDbDatabase(indexedDbApi, name)));
		return {
			supported: true,
			attempted: names.length,
			deleted: results.filter(Boolean).length
		};
	} catch (_) {
		return {supported: true, deleted: 0, attempted: 0};
	}
};

const clearCacheStorage = async () => {
	const cacheApi = typeof window !== 'undefined' ? window.caches : undefined;
	if (!cacheApi || typeof cacheApi.keys !== 'function') {
		return {supported: false, deleted: 0, attempted: 0};
	}

	try {
		const keys = await cacheApi.keys();
		const results = await Promise.all(keys.map((key) => cacheApi.delete(key)));
		return {
			supported: true,
			attempted: keys.length,
			deleted: results.filter(Boolean).length
		};
	} catch (_) {
		return {supported: true, deleted: 0, attempted: 0};
	}
};

const clearServiceWorkers = async () => {
	if (
		typeof navigator === 'undefined' ||
		!navigator.serviceWorker ||
		typeof navigator.serviceWorker.getRegistrations !== 'function'
	) {
		return {supported: false, removed: 0, attempted: 0};
	}

	try {
		const registrations = await navigator.serviceWorker.getRegistrations();
		const results = await Promise.all(registrations.map((registration) => registration.unregister()));
		return {
			supported: true,
			attempted: registrations.length,
			removed: results.filter(Boolean).length
		};
	} catch (_) {
		return {supported: true, removed: 0, attempted: 0};
	}
};

const normalizePreservedLocalStorageKeys = (keys) => {
	if (!Array.isArray(keys)) return new Set();
	return new Set(
		keys
			.map((key) => String(key || '').trim())
			.filter(Boolean)
	);
};

const clearLocalStorage = (preservedKeys = new Set()) => {
	if (typeof window === 'undefined' || !window.localStorage) return false;
	try {
		const storage = window.localStorage;
		const keys = [];
		for (let index = 0; index < storage.length; index += 1) {
			const key = storage.key(index);
			if (typeof key === 'string' && key.length > 0) {
				keys.push(key);
			}
		}
		keys.forEach((key) => {
			if (!preservedKeys.has(key)) {
				storage.removeItem(key);
			}
		});
		return true;
	} catch (_) {
		return false;
	}
};

export const wipeAllAppCache = async ({preserveLocalStorageKeys = []} = {}) => {
	const preservedKeys = normalizePreservedLocalStorageKeys(preserveLocalStorageKeys);
	const summary = {
		localStorageCleared: false,
		preservedLocalStorageKeys: Array.from(preservedKeys),
		sessionStorageCleared: false,
		cacheStorage: {supported: false, deleted: 0, attempted: 0},
		indexedDb: {supported: false, deleted: 0, attempted: 0},
		serviceWorkers: {supported: false, removed: 0, attempted: 0}
	};

	if (typeof window === 'undefined') {
		return summary;
	}

	summary.localStorageCleared = clearLocalStorage(preservedKeys);

	try {
		window.sessionStorage.clear();
		summary.sessionStorageCleared = true;
	} catch (_) {
		summary.sessionStorageCleared = false;
	}

	summary.cacheStorage = await clearCacheStorage();
	summary.indexedDb = await clearIndexedDbStorage();
	summary.serviceWorkers = await clearServiceWorkers();

	return summary;
};
