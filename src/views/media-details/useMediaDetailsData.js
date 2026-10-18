import {useCallback, useEffect, useMemo, useReducer, useRef} from 'react';

import jellyfinService from '../../services/jellyfinService';
import {useTrackPreferences} from '../../hooks/useTrackPreferences';
import {isPlayableMediaItem} from '../../utils/mediaItemUtils';
import {getTrackPreferenceScopeId} from '../../utils/trackPreferences';
import {captureRuntimeSessionIdentity, isRuntimeSessionIdentityCurrent} from '../../utils/savedSessionIdentity';
import {updateItemsPlayedState} from '../media-details-panel/utils/mediaDetailsHelpers';
import {
    fetchEpisodes,
    fetchItemDetails,
    fetchPlaybackInfo,
    fetchSeasons,
    fetchSeriesItem,
    invalidateSeriesUserData,
    pickResumeEpisode
} from './mediaDetailsRequests';

const mergeState = (state, update) => ({
    ...state,
    ...(typeof update === 'function' ? update(state) : update)
});

const createInitialState = (item) => ({
    loading: true,
    details: null,
    playbackInfo: null,
    playbackItemId: null,
    audioTrack: null,
    subtitleTrack: -1,
    seasons: [],
    selectedSeasonId: null,
    episodes: [],
    selectedEpisodeId: null,
    episodeNavList: [],
    isFavorite: Boolean(item?.UserData?.IsFavorite),
    isWatched: Boolean(item?.UserData?.Played),
    isWatchlisted: item?.UserData?.Likes === true
});

const loadSafely = (promise, fallback, label) => promise.catch((error) => {
    console.error(`Failed to load ${label}:`, error);
    return fallback;
});

const patchUserData = (items, itemId, patch) => items.map((entry) => (
    entry?.Id === itemId ? {...entry, UserData: {...(entry.UserData || {}), ...patch}} : entry
));

const markAllPlayed = (items, played) => items.map((entry) => ({
    ...entry,
    UserData: {...(entry.UserData || {}), Played: played, PlayedPercentage: played ? 100 : 0}
}));

export const useMediaDetailsData = ({item, onItemSelect, showToast}) => {
    const [state, dispatch] = useReducer(mergeState, item, createInitialState);
    const stateRef = useRef(state);
    const playbackRequestRef = useRef(0);
    const episodesRequestRef = useRef(0);
    const pendingSeasonRef = useRef(null);
    const unmountedRef = useRef(false);
    const {resolveDefaultTrackSelection, saveAudioSelection, saveSubtitleSelection} = useTrackPreferences(
        getTrackPreferenceScopeId(item)
    );

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const playbackPatch = useCallback((playbackInfo, playbackItemId) => {
        const {selectedAudioTrack, selectedSubtitleTrack} = resolveDefaultTrackSelection(
            playbackInfo?.MediaSources?.[0]?.MediaStreams
        );
        return {
            playbackInfo,
            playbackItemId: playbackInfo ? playbackItemId : null,
            audioTrack: selectedAudioTrack,
            subtitleTrack: selectedSubtitleTrack
        };
    }, [resolveDefaultTrackSelection]);

    const itemId = item?.Id;
    const itemType = item?.Type;
    const seriesId = itemType === 'Series' ? itemId : item?.SeriesId;

    useEffect(() => {
        unmountedRef.current = false;
        if (!itemId) return undefined;
        const token = ++playbackRequestRef.current;
        const episodesToken = ++episodesRequestRef.current;
        const isCurrent = () => !unmountedRef.current && token === playbackRequestRef.current;
        const detailsPromise = fetchItemDetails(itemId);

        const loadSeries = async () => {
            const initialSeasonId = item.__initialSeasonId || null;
            const earlyEpisodes = initialSeasonId
                ? loadSafely(fetchEpisodes(itemId, initialSeasonId), null, 'episodes')
                : null;
            const seasons = await loadSafely(fetchSeasons(itemId), [], 'seasons');
            const season = seasons.find((entry) => entry.Id === initialSeasonId) || seasons[0] || null;
            let episodes = [];
            if (season) {
                const early = season.Id === initialSeasonId ? await earlyEpisodes : null;
                episodes = early || await loadSafely(fetchEpisodes(itemId, season.Id), [], 'episodes');
            }
            const resumeEpisode = pickResumeEpisode(episodes);
            const [details, playbackInfo] = await Promise.all([
                detailsPromise,
                resumeEpisode ? fetchPlaybackInfo(resumeEpisode.Id) : null
            ]);
            if (!isCurrent() || episodesToken !== episodesRequestRef.current) return;
            dispatch({
                loading: false,
                details,
                seasons,
                selectedSeasonId: season?.Id || null,
                episodes,
                selectedEpisodeId: resumeEpisode?.Id || null,
                ...playbackPatch(playbackInfo, resumeEpisode?.Id)
            });
        };

        const loadItem = async () => {
            const isEpisode = itemType === 'Episode' && item.SeriesId && item.SeasonId;
            const [details, playbackInfo, episodeNavList] = await Promise.all([
                detailsPromise,
                isPlayableMediaItem(item) ? fetchPlaybackInfo(itemId) : null,
                isEpisode ? loadSafely(fetchEpisodes(item.SeriesId, item.SeasonId), [], 'episode navigation list') : []
            ]);
            if (!isCurrent()) return;
            dispatch({
                loading: false,
                details,
                episodeNavList,
                ...playbackPatch(playbackInfo, itemId)
            });
            if (isEpisode) {
                fetchSeriesItem(item.SeriesId).catch(() => {
                });
                fetchSeasons(item.SeriesId).catch(() => {
                });
            }
        };

        if (itemType === 'Series') {
            loadSeries();
        } else {
            loadItem();
        }
        return () => {
            unmountedRef.current = true;
        };
        // The page is keyed by item id, so the item object is only read once per mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemId]);

    const selectEpisode = useCallback(async (episodeId) => {
        if (pendingSeasonRef.current !== null || !episodeId || episodeId === stateRef.current.selectedEpisodeId ||
            !stateRef.current.episodes.some((episode) => episode.Id === episodeId)) return;
        dispatch({selectedEpisodeId: episodeId});
        const token = ++playbackRequestRef.current;
        const playbackInfo = await fetchPlaybackInfo(episodeId);
        if (unmountedRef.current || token !== playbackRequestRef.current) return;
        dispatch(playbackPatch(playbackInfo, episodeId));
    }, [playbackPatch]);

    const selectSeason = useCallback(async (seasonId) => {
        if (!itemId || !seasonId || seasonId === stateRef.current.selectedSeasonId) return;
        const episodesToken = ++episodesRequestRef.current;
        pendingSeasonRef.current = episodesToken;
        dispatch({selectedSeasonId: seasonId, episodes: [], selectedEpisodeId: null, ...playbackPatch(null, null)});
        const playbackToken = ++playbackRequestRef.current;
        const episodes = await loadSafely(fetchEpisodes(itemId, seasonId), [], 'episodes');
        if (unmountedRef.current || episodesToken !== episodesRequestRef.current) return;
        pendingSeasonRef.current = null;
        const resumeEpisode = pickResumeEpisode(episodes);
        dispatch({episodes, selectedEpisodeId: resumeEpisode?.Id || null});
        if (!resumeEpisode) {
            dispatch(playbackPatch(null, null));
            return;
        }
        const playbackInfo = await fetchPlaybackInfo(resumeEpisode.Id);
        if (unmountedRef.current || playbackToken !== playbackRequestRef.current) return;
        dispatch(playbackPatch(playbackInfo, resumeEpisode.Id));
    }, [itemId, playbackPatch]);

    const selectTrack = useCallback((type, trackKey) => {
        const mediaStreams = stateRef.current.playbackInfo?.MediaSources?.[0]?.MediaStreams || [];
        if (type === 'audio') {
            dispatch({audioTrack: trackKey});
            saveAudioSelection(trackKey, mediaStreams.filter((stream) => stream.Type === 'Audio'));
            return;
        }
        dispatch({subtitleTrack: trackKey});
        saveSubtitleSelection(trackKey, mediaStreams.filter((stream) => stream.Type === 'Subtitle'));
    }, [saveAudioSelection, saveSubtitleSelection]);

    const toggleFavorite = useCallback(async (targetId = itemId, currentState) => {
        if (!targetId) return;
        const isMainItem = targetId === itemId;
        const current = isMainItem ? stateRef.current.isFavorite : currentState === true;
        const session = captureRuntimeSessionIdentity(jellyfinService);
        try {
            const nextState = await jellyfinService.toggleFavorite(targetId, current);
            if (!isRuntimeSessionIdentityCurrent(session, jellyfinService)) return;
            invalidateSeriesUserData(seriesId);
            if (unmountedRef.current) return;
            if (isMainItem) {
                dispatch({isFavorite: nextState});
            } else {
                dispatch((latest) => ({episodes: patchUserData(latest.episodes, targetId, {IsFavorite: nextState})}));
            }
            showToast(nextState ? 'Added to favorites' : 'Removed from favorites');
        } catch (error) {
            if (unmountedRef.current || !isRuntimeSessionIdentityCurrent(session, jellyfinService)) return;
            console.error('Failed to toggle favorite:', error);
            showToast('Failed to update favorite');
        }
    }, [itemId, seriesId, showToast]);

    const toggleWatched = useCallback(async (targetId = itemId, currentState) => {
        if (!targetId) return;
        const isMainItem = targetId === itemId;
        const current = isMainItem ? stateRef.current.isWatched : currentState === true;
        const session = captureRuntimeSessionIdentity(jellyfinService);
        try {
            const played = await jellyfinService.toggleWatched(targetId, current);
            if (!isRuntimeSessionIdentityCurrent(session, jellyfinService)) return;
            invalidateSeriesUserData(seriesId);
            if (unmountedRef.current) return;
            const {selectedSeasonId} = stateRef.current;
            if (isMainItem) {
                dispatch((latest) => ({
                    isWatched: played,
                    ...(itemType === 'Series' ? {
                        seasons: markAllPlayed(latest.seasons, played),
                        episodes: markAllPlayed(latest.episodes, played)
                    } : {})
                }));
            } else if (targetId === selectedSeasonId) {
                dispatch((latest) => ({
                    seasons: updateItemsPlayedState(latest.seasons, targetId, played),
                    episodes: markAllPlayed(latest.episodes, played)
                }));
            } else {
                dispatch((latest) => ({
                    seasons: updateItemsPlayedState(latest.seasons, targetId, played),
                    episodes: updateItemsPlayedState(latest.episodes, targetId, played)
                }));
            }
            showToast(played ? 'Marked as watched' : 'Marked as unwatched');
        } catch (error) {
            if (unmountedRef.current || !isRuntimeSessionIdentityCurrent(session, jellyfinService)) return;
            console.error('Error toggling watched status:', error);
            showToast('Failed to update watched status');
        }
    }, [itemId, itemType, seriesId, showToast]);

    const toggleWatchlist = useCallback(async () => {
        if (!itemId) return;
        const current = stateRef.current.isWatchlisted;
        try {
            if (current) {
                await jellyfinService.removeFromLikesWatchlist(itemId);
            } else {
                await jellyfinService.addToLikesWatchlist(itemId);
            }
            dispatch({isWatchlisted: !current});
            showToast(current ? 'Removed from watchlist' : 'Added to watchlist');
        } catch (error) {
            console.error('Failed to update watchlist:', error);
            showToast('Failed to update watchlist');
        }
    }, [itemId, showToast]);

    const openSeriesFromEpisode = useCallback(async () => {
        if (itemType !== 'Episode' || !item.SeriesId || typeof onItemSelect !== 'function') return;
        try {
            const series = await fetchSeriesItem(item.SeriesId);
            if (!series) return;
            onItemSelect(item.SeasonId ? {...series, __initialSeasonId: item.SeasonId} : series, item);
        } catch (error) {
            console.error('Error opening series from episode details:', error);
        }
    }, [item, itemType, onItemSelect]);

    const selectedEpisode = useMemo(() => (
        state.selectedEpisodeId
            ? state.episodes.find((episode) => episode.Id === state.selectedEpisodeId) || null
            : null
    ), [state.episodes, state.selectedEpisodeId]);

    return {
        state,
        selectedEpisode,
        selectEpisode,
        selectSeason,
        selectTrack,
        toggleFavorite,
        toggleWatched,
        toggleWatchlist,
        openSeriesFromEpisode
    };
};
