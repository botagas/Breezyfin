import jellyfinService from '../../services/jellyfinService';

const CACHE_TTL_MS = 2 * 60 * 1000;
const requestCache = new Map();

const cached = async (key, load, {skipEmpty = false} = {}) => {
    const entry = requestCache.get(key);
    if (entry && Date.now() - entry.timestamp <= CACHE_TTL_MS) return entry.value;
    const value = await load();
    const isEmpty = value == null || (Array.isArray(value) && value.length === 0);
    if (!(skipEmpty && isEmpty) && value != null) {
        requestCache.set(key, {value, timestamp: Date.now()});
    }
    return value;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

export const fetchSeriesItem = (seriesId) => (
    cached(`series:${seriesId}`, () => jellyfinService.getItem(seriesId))
);

export const fetchSeasons = (seriesId) => (
    cached(`seasons:${seriesId}`, async () => toArray(await jellyfinService.getSeasons(seriesId)), {skipEmpty: true})
);

export const fetchEpisodes = (seriesId, seasonId) => (
    cached(`episodes:${seriesId}:${seasonId}`, async () => toArray(await jellyfinService.getEpisodes(seriesId, seasonId)), {skipEmpty: true})
);

export const invalidateEpisodes = (seriesId, seasonId) => {
    requestCache.delete(`episodes:${seriesId}:${seasonId}`);
};

export const invalidateSeasons = (seriesId) => {
    requestCache.delete(`seasons:${seriesId}`);
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
