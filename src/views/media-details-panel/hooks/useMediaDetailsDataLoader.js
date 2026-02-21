import {useCallback, useEffect} from 'react';
import jellyfinService from '../../../services/jellyfinService';

const DETAILS_REQUEST_CACHE_TTL_MS = 2 * 60 * 1000;

export const useMediaDetailsDataLoader = ({
	item,
	onItemSelect,
	resolveDefaultTrackSelection,
	setSelectedAudioTrack,
	setSelectedSubtitleTrack,
	setPlaybackInfo,
	setLoading,
	setSeasons,
	setEpisodes,
	setSelectedSeason,
	setSelectedEpisode,
	setEpisodeNavList,
	playbackInfoRequestRef,
	episodesRequestRef,
	seasonsRequestRef,
	seriesItemCacheRef,
	seasonsCacheRef,
	episodesCacheRef
}) => {
	const createPlaybackRequestToken = useCallback(() => {
		playbackInfoRequestRef.current += 1;
		return playbackInfoRequestRef.current;
	}, [playbackInfoRequestRef]);

	const isPlaybackRequestCurrent = useCallback((token) => {
		return playbackInfoRequestRef.current === token;
	}, [playbackInfoRequestRef]);

	const readDetailsCache = useCallback((cacheRef, key) => {
		if (!key) return null;
		const entry = cacheRef.current.get(String(key));
		if (!entry) return null;
		if (Date.now() - entry.timestamp > DETAILS_REQUEST_CACHE_TTL_MS) {
			cacheRef.current.delete(String(key));
			return null;
		}
		return entry.value;
	}, []);

	const writeDetailsCache = useCallback((cacheRef, key, value) => {
		if (!key || value == null) return value;
		cacheRef.current.set(String(key), {
			value,
			timestamp: Date.now()
		});
		return value;
	}, []);

	const getSeriesItemCached = useCallback(async (seriesId) => {
		if (!seriesId) return null;
		const cached = readDetailsCache(seriesItemCacheRef, seriesId);
		if (cached) return cached;
		const value = await jellyfinService.getItem(seriesId);
		return writeDetailsCache(seriesItemCacheRef, seriesId, value);
	}, [readDetailsCache, seriesItemCacheRef, writeDetailsCache]);

	const getSeasonsCached = useCallback(async (seriesId) => {
		if (!seriesId) return [];
		const cached = readDetailsCache(seasonsCacheRef, seriesId);
		if (Array.isArray(cached)) return cached;
		const value = await jellyfinService.getSeasons(seriesId);
		const normalized = Array.isArray(value) ? value : [];
		if (normalized.length > 0) {
			return writeDetailsCache(seasonsCacheRef, seriesId, normalized);
		}
		return normalized;
	}, [readDetailsCache, seasonsCacheRef, writeDetailsCache]);

	const getEpisodesCached = useCallback(async (seriesId, seasonId) => {
		if (!seriesId || !seasonId) return [];
		const cacheKey = `${seriesId}:${seasonId}`;
		const cached = readDetailsCache(episodesCacheRef, cacheKey);
		if (Array.isArray(cached)) return cached;
		const value = await jellyfinService.getEpisodes(seriesId, seasonId);
		const normalized = Array.isArray(value) ? value : [];
		if (normalized.length > 0) {
			return writeDetailsCache(episodesCacheRef, cacheKey, normalized);
		}
		return normalized;
	}, [episodesCacheRef, readDetailsCache, writeDetailsCache]);

	const applyDefaultTracks = useCallback((mediaStreams) => {
		const {
			selectedAudioTrack: nextAudioTrack,
			selectedSubtitleTrack: nextSubtitleTrack
		} = resolveDefaultTrackSelection(mediaStreams);
		setSelectedAudioTrack(nextAudioTrack);
		setSelectedSubtitleTrack(nextSubtitleTrack);
	}, [resolveDefaultTrackSelection, setSelectedAudioTrack, setSelectedSubtitleTrack]);

	const loadPlaybackInfoForItem = useCallback(async (targetItemId, options = {}) => {
		const {clearLoading = false, episodeRequestToken = null} = options;
		if (!targetItemId) return;
		const playbackRequestToken = createPlaybackRequestToken();
		try {
			const info = await jellyfinService.getPlaybackInfo(targetItemId);
			const staleEpisodeRequest = episodeRequestToken !== null && episodeRequestToken !== episodesRequestRef.current;
			if (!isPlaybackRequestCurrent(playbackRequestToken) || staleEpisodeRequest) return;
			setPlaybackInfo(info || null);
			applyDefaultTracks(info?.MediaSources?.[0]?.MediaStreams);
		} catch (error) {
			const staleEpisodeRequest = episodeRequestToken !== null && episodeRequestToken !== episodesRequestRef.current;
			if (!isPlaybackRequestCurrent(playbackRequestToken) || staleEpisodeRequest) return;
			console.error('Failed to load playback info:', error);
			setPlaybackInfo(null);
			applyDefaultTracks(null);
		} finally {
			if (clearLoading && isPlaybackRequestCurrent(playbackRequestToken)) {
				setLoading(false);
			}
		}
	}, [
		applyDefaultTracks,
		createPlaybackRequestToken,
		episodesRequestRef,
		isPlaybackRequestCurrent,
		setLoading,
		setPlaybackInfo
	]);

	const loadPlaybackInfo = useCallback(async () => {
		if (!item) return;
		if (item.Type === 'Series') {
			const playbackRequestToken = createPlaybackRequestToken();
			if (isPlaybackRequestCurrent(playbackRequestToken)) {
				setPlaybackInfo(null);
				applyDefaultTracks(null);
				setLoading(false);
			}
			return;
		}
		setLoading(true);
		await loadPlaybackInfoForItem(item.Id, {clearLoading: true});
	}, [
		applyDefaultTracks,
		createPlaybackRequestToken,
		isPlaybackRequestCurrent,
		item,
		loadPlaybackInfoForItem,
		setLoading,
		setPlaybackInfo
	]);

	const loadEpisodes = useCallback(async (seasonId) => {
		if (!item || !seasonId) return;
		episodesRequestRef.current += 1;
		const episodeRequestToken = episodesRequestRef.current;
		try {
			const episodesDataRaw = await getEpisodesCached(item.Id, seasonId);
			if (episodeRequestToken !== episodesRequestRef.current) return;
			const episodesData = Array.isArray(episodesDataRaw) ? episodesDataRaw : [];
			setEpisodes(episodesData);
			if (episodesData.length > 0) {
				const resumeEpisode =
					episodesData.find((episode) => (episode?.UserData?.PlaybackPositionTicks || 0) > 0) ||
					episodesData.find((episode) => (episode?.UserData?.PlayedPercentage || 0) > 0 && (episode?.UserData?.PlayedPercentage || 0) < 100) ||
					episodesData.find((episode) => episode?.UserData?.Played !== true) ||
					episodesData[0];
				setSelectedEpisode(resumeEpisode);
				setPlaybackInfo(null);
				applyDefaultTracks(null);
				void loadPlaybackInfoForItem(resumeEpisode.Id, {episodeRequestToken});
				return;
			}
			setSelectedEpisode(null);
			setPlaybackInfo(null);
			applyDefaultTracks(null);
		} catch (error) {
			if (episodeRequestToken !== episodesRequestRef.current) return;
			console.error('Failed to load episodes:', error);
			setEpisodes([]);
			setSelectedEpisode(null);
			setPlaybackInfo(null);
			applyDefaultTracks(null);
		}
	}, [
		applyDefaultTracks,
		episodesRequestRef,
		getEpisodesCached,
		item,
		loadPlaybackInfoForItem,
		setEpisodes,
		setPlaybackInfo,
		setSelectedEpisode
	]);

	const loadSeasons = useCallback(async () => {
		if (!item) return;
		seasonsRequestRef.current += 1;
		const seasonRequestToken = seasonsRequestRef.current;
		setLoading(true);
		try {
			const seasonsDataRaw = await getSeasonsCached(item.Id);
			if (seasonRequestToken !== seasonsRequestRef.current) return;
			const seasonsData = Array.isArray(seasonsDataRaw) ? seasonsDataRaw : [];
			setSeasons(seasonsData);
			if (seasonsData.length > 0) {
				const preferredSeasonId = item?.__initialSeasonId || null;
				const initialSeason = (preferredSeasonId && seasonsData.find((season) => season.Id === preferredSeasonId)) || seasonsData[0];
				setSelectedSeason(initialSeason);
				await loadEpisodes(initialSeason.Id);
				return;
			}
			setSelectedSeason(null);
			setEpisodes([]);
			setSelectedEpisode(null);
			setPlaybackInfo(null);
			applyDefaultTracks(null);
		} catch (error) {
			if (seasonRequestToken !== seasonsRequestRef.current) return;
			console.error('Failed to load seasons:', error);
			setSeasons([]);
			setSelectedSeason(null);
			setEpisodes([]);
			setSelectedEpisode(null);
			setPlaybackInfo(null);
			applyDefaultTracks(null);
		} finally {
			if (seasonRequestToken === seasonsRequestRef.current) {
				setLoading(false);
			}
		}
	}, [
		applyDefaultTracks,
		getSeasonsCached,
		item,
		loadEpisodes,
		seasonsRequestRef,
		setEpisodes,
		setLoading,
		setPlaybackInfo,
		setSeasons,
		setSelectedEpisode,
		setSelectedSeason
	]);

	const openSeriesFromEpisode = useCallback(async (seasonId = null) => {
		if (item?.Type !== 'Episode' || !item.SeriesId || !onItemSelect) return false;
		try {
			const series = await getSeriesItemCached(item.SeriesId);
			if (!series) return false;
			const target = seasonId ? {...series, __initialSeasonId: seasonId} : series;
			onItemSelect(target, item);
			return true;
		} catch (error) {
			console.error('Error opening series from episode details:', error);
			return false;
		}
	}, [getSeriesItemCached, item, onItemSelect]);

	const handleSeasonClick = useCallback(async (season) => {
		setSelectedSeason(season);
		setEpisodes([]);
		setSelectedEpisode(null);
		await loadEpisodes(season.Id);
	}, [loadEpisodes, setEpisodes, setSelectedEpisode, setSelectedSeason]);

	const handleEpisodeClick = useCallback(async (episode) => {
		setSelectedEpisode(episode);
		await loadPlaybackInfoForItem(episode.Id);
	}, [loadPlaybackInfoForItem, setSelectedEpisode]);

	useEffect(() => {
		let cancelled = false;
		const loadEpisodeNavList = async () => {
			if (item?.Type !== 'Episode' || !item.SeriesId || !item.SeasonId) {
				setEpisodeNavList([]);
				return;
			}
			try {
				const seasonEpisodes = await getEpisodesCached(item.SeriesId, item.SeasonId);
				if (!cancelled) {
					setEpisodeNavList(seasonEpisodes || []);
				}
			} catch (error) {
				console.error('Failed to load episode navigation list:', error);
				if (!cancelled) {
					setEpisodeNavList([]);
				}
			}
		};
		loadEpisodeNavList();
		return () => {
			cancelled = true;
		};
	}, [getEpisodesCached, item, setEpisodeNavList]);

	useEffect(() => {
		if (item?.Type !== 'Episode' || !item.SeriesId) return;
		void getSeriesItemCached(item.SeriesId).catch(() => {});
		void getSeasonsCached(item.SeriesId).catch(() => {});
		if (item.SeasonId) {
			void getEpisodesCached(item.SeriesId, item.SeasonId).catch(() => {});
		}
	}, [getEpisodesCached, getSeasonsCached, getSeriesItemCached, item]);

	return {
		applyDefaultTracks,
		getSeriesItemCached,
		getSeasonsCached,
		getEpisodesCached,
		loadPlaybackInfoForItem,
		loadPlaybackInfo,
		loadEpisodes,
		loadSeasons,
		openSeriesFromEpisode,
		handleSeasonClick,
		handleEpisodeClick
	};
};
