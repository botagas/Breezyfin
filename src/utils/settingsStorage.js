export const BREEZYFIN_SETTINGS_KEY = 'breezyfinSettings';

const normalizeSettingsObject = (value) => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return {};
	}
	return value;
};

const parseSettingsJson = (raw) => {
	if (!raw || typeof raw !== 'string') return {};
	try {
		return normalizeSettingsObject(JSON.parse(raw));
	} catch (error) {
		console.error('Failed to parse Breezyfin settings payload:', error);
		return {};
	}
};

export const readBreezyfinSettings = (rawOverride) => {
	if (typeof rawOverride === 'string') {
		return parseSettingsJson(rawOverride);
	}
	if (typeof window === 'undefined') return {};
	return parseSettingsJson(window.localStorage.getItem(BREEZYFIN_SETTINGS_KEY));
};

export const writeBreezyfinSettings = (settings) => {
	if (typeof window === 'undefined') return false;
	const normalizedSettings = normalizeSettingsObject(settings);
	const serializedSettings = JSON.stringify(normalizedSettings);

	try {
		window.localStorage.setItem(BREEZYFIN_SETTINGS_KEY, serializedSettings);
		if (typeof window.dispatchEvent === 'function') {
			window.dispatchEvent(
				new CustomEvent('breezyfin-settings-changed', {detail: normalizedSettings})
			);
		}
		return true;
	} catch (error) {
		console.error('Failed to persist Breezyfin settings:', error);
		return false;
	}
};
