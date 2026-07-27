export const BREEZYFIN_INTEGRATION_PREFERENCES_KEY = 'breezyfinIntegrationPreferences.v1';
export const INTEGRATION_PREFERENCES_CHANGED_EVENT = 'breezyfin-integration-preferences-changed';

const DEFAULT_PREFERENCES = Object.freeze({
	homeSource: 'builtin',
	watchlistEnabled: true
});

const getScopeKey = (service) => {
	if (!service?.serverUrl || !service?.userId) return '';
	return JSON.stringify([
		String(service.serverUrl).replace(/\/$/, '').toLocaleLowerCase(),
		String(service.userId)
	]);
};

const readStore = () => {
	if (typeof window === 'undefined') return {};
	try {
		const parsed = JSON.parse(window.localStorage.getItem(BREEZYFIN_INTEGRATION_PREFERENCES_KEY) || '{}');
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch (_) {
		return {};
	}
};

const normalizePreferences = (value) => ({
	homeSource: value?.homeSource === 'server' ? 'server' : 'builtin',
	watchlistEnabled: value?.watchlistEnabled !== false
});

export const readIntegrationPreferences = (service) => {
	const scopeKey = getScopeKey(service);
	if (!scopeKey) return {...DEFAULT_PREFERENCES};
	return normalizePreferences(readStore()[scopeKey]);
};

export const writeIntegrationPreferences = (service, patch) => {
	const scopeKey = getScopeKey(service);
	if (!scopeKey || typeof window === 'undefined') return false;
	const store = readStore();
	const preferences = normalizePreferences({...store[scopeKey], ...patch});
	try {
		window.localStorage.setItem(
			BREEZYFIN_INTEGRATION_PREFERENCES_KEY,
			JSON.stringify({...store, [scopeKey]: preferences})
		);
		window.dispatchEvent(new CustomEvent(INTEGRATION_PREFERENCES_CHANGED_EVENT, {
			detail: {scopeKey, preferences}
		}));
		return true;
	} catch (_) {
		return false;
	}
};
