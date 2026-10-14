import jellyfinService from '../../services/jellyfinService';
import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../../constants/integrationEvents';
import {captureRuntimeSessionIdentity, isRuntimeSessionIdentityCurrent} from '../../utils/savedSessionIdentity';

const CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_CACHE_ENTRIES = 80;
const requestCache = new Map();
let cacheSession = null;
let cacheRevision = 0;

const clearRequestCache = () => {
	requestCache.clear();
	cacheRevision += 1;
};

const cached = async (key, load, {skipEmpty = false, retryInvalidated = true} = {}) => {
	const session = captureRuntimeSessionIdentity(jellyfinService);
	if (!isRuntimeSessionIdentityCurrent(cacheSession, jellyfinService)) {
		clearRequestCache();
		cacheSession = session;
	}
	if (!session) return load();
	const revision = cacheRevision;
	const now = Date.now();
	for (const [entryKey, cachedEntry] of requestCache) {
		if (now - cachedEntry.timestamp >= CACHE_TTL_MS) requestCache.delete(entryKey);
	}
	const entry = requestCache.get(key);
	if (entry) return entry.value;
	const value = await load();
	if (!isRuntimeSessionIdentityCurrent(session, jellyfinService)) return null;
	if (revision !== cacheRevision) {
		return retryInvalidated ? cached(key, load, {skipEmpty, retryInvalidated: false}) : null;
	}
	const isEmpty = value == null || (Array.isArray(value) && value.length === 0);
	if (!(skipEmpty && isEmpty) && value != null) {
		requestCache.set(key, {value, timestamp: Date.now()});
		while (requestCache.size > MAX_CACHE_ENTRIES) requestCache.delete(requestCache.keys().next().value);
	}
	return value;
};

if (typeof window !== 'undefined') {
	window.addEventListener(BREEZYFIN_USER_DATA_INVALIDATED_EVENT, clearRequestCache);
}

const toArray = (value) => (Array.isArray(value) ? value : []);

export const fetchSeriesItem = (seriesId) => (
	cached(`series:${seriesId}`, () => jellyfinService.getItem(seriesId))
);

export const fetchSeasons = (seriesId) => (
	cached(`seasons:${seriesId}`, async () => toArray(await jellyfinService.getSeasons(seriesId)), {skipEmpty: true}).then(toArray)
);

export const fetchEpisodes = (seriesId, seasonId) => (
	cached(`episodes:${seriesId}:${seasonId}`, async () => toArray(await jellyfinService.getEpisodes(seriesId, seasonId)), {skipEmpty: true}).then(toArray)
);

export const invalidateEpisodes = (seriesId, seasonId) => {
	requestCache.delete(`episodes:${seriesId}:${seasonId}`);
	cacheRevision += 1;
};

export const invalidateSeasons = (seriesId) => {
	requestCache.delete(`seasons:${seriesId}`);
	cacheRevision += 1;
};

export const fetchPlaybackInfo = async (itemId) => {
    try {
        return (await jellyfinService.getPlaybackInfo(itemId)) || null;
    } catch (error) {
        console.error('Failed to load playback info:', error);
        return null;
    }
};

export const fetchItemDetails = async (itemId) => {
    try {
        return (await jellyfinService.getItem(itemId)) || null;
    } catch (error) {
        console.error('Failed to load item metadata:', error);
        return null;
    }
};

export const pickResumeEpisode = (episodes) => (
    episodes.find((episode) => (episode?.UserData?.PlaybackPositionTicks || 0) > 0) ||
    episodes.find((episode) => {
        const percentage = episode?.UserData?.PlayedPercentage || 0;
        return percentage > 0 && percentage < 100;
    }) ||
    episodes.find((episode) => episode?.UserData?.Played !== true) ||
    episodes[0] ||
    null
);
