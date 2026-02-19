export const BREEZYFIN_TRACK_PREFERENCES_KEY = 'breezyfinTrackPrefs';

const normalizePreferences = (value) => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return {};
	}
	return value;
};

const parsePreferences = (raw) => {
	if (!raw || typeof raw !== 'string') return {};
	try {
		return normalizePreferences(JSON.parse(raw));
	} catch (error) {
		console.warn('Failed to parse track preferences:', error);
		return {};
	}
};

export const readTrackPreferences = (rawOverride) => {
	if (typeof rawOverride === 'string') {
		return parsePreferences(rawOverride);
	}
	if (typeof window === 'undefined') return {};
	return parsePreferences(window.localStorage.getItem(BREEZYFIN_TRACK_PREFERENCES_KEY));
};

export const writeTrackPreferences = (preferences) => {
	if (typeof window === 'undefined') return false;
	const normalized = normalizePreferences(preferences);
	try {
		window.localStorage.setItem(BREEZYFIN_TRACK_PREFERENCES_KEY, JSON.stringify(normalized));
		return true;
	} catch (error) {
		console.warn('Failed to persist track preferences:', error);
		return false;
	}
};

export const createAudioPreference = (index, stream) => ({
	index,
	language: stream?.Language || null
});

export const createSubtitlePreference = (index, stream) => {
	if (index === -1) return {off: true};
	return {
		index,
		language: stream?.Language || null,
		isForced: !!stream?.IsForced
	};
};
