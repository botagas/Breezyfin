import {createAudioTrackIdentity, createSubtitleTrackIdentity} from './trackMatching';

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

const MAX_SCOPED_PREFERENCES = 300;

// Movies keep their own choice; episodes and seasons share the choice of their series.
export const getTrackPreferenceScopeId = (item) => {
    const scopeId = item?.SeriesId || item?.Id;
    return scopeId ? String(scopeId) : null;
};

export const readScopedTrackPreference = (scopeId, rawOverride) => {
    if (!scopeId) return {};
    const entry = readTrackPreferences(rawOverride).items?.[scopeId];
    return entry && typeof entry === 'object' ? entry : {};
};

export const writeScopedTrackPreference = (scopeId, preference) => {
    if (!scopeId) return false;
    const items = {
        ...(readTrackPreferences().items || {}),
        [scopeId]: {...preference, updatedAt: Date.now()}
    };
    const scopeIds = Object.keys(items);
    if (scopeIds.length > MAX_SCOPED_PREFERENCES) {
        scopeIds
            .sort((a, b) => (items[a].updatedAt || 0) - (items[b].updatedAt || 0))
            .slice(0, scopeIds.length - MAX_SCOPED_PREFERENCES)
            .forEach((staleId) => delete items[staleId]);
    }
    return writeTrackPreferences({version: 2, items});
};

const LANGUAGE_CODE_ALIASES = {
    en: 'eng',
    es: 'spa',
    fr: 'fra',
    fre: 'fra',
    de: 'deu',
    ger: 'deu',
    it: 'ita',
    ja: 'jpn',
    ko: 'kor',
    zh: 'zho',
    chi: 'zho',
    pt: 'por',
    ru: 'rus'
};

export const normalizeLanguageCode = (language) => {
    const normalized = String(language || '').trim().toLowerCase();
    return LANGUAGE_CODE_ALIASES[normalized] || normalized;
};

export const createAudioPreference = (index, stream, streams = []) => ({
	...createAudioTrackIdentity(stream, streams),
	index
});

export const createSubtitlePreference = (index, stream, streams = []) => {
	if (index === -1) return {off: true};
	return {
		...createSubtitleTrackIdentity(stream, streams),
		index
	};
};
