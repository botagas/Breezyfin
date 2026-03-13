import {JELLYFIN_TICKS_PER_SECOND} from '../../constants/time';

export const getLatestMediaItems = async (service, includeItemTypes = ['Movie', 'Series'], limit = 16) => {
	try {
		const types = Array.isArray(includeItemTypes) ? includeItemTypes.join(',') : includeItemTypes;
		return await service._fetchItems(
			`/Users/${service.userId}/Items?includeItemTypes=${types}&limit=${limit}&sortBy=DateCreated&sortOrder=Descending&recursive=true&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber,Tags,TagItems,UserData,ChildCount&imageTypeLimit=1`,
			{},
			'getLatestMedia'
		);
	} catch (error) {
		console.error(`getLatestMedia ${includeItemTypes} error:`, error);
		return [];
	}
};

export const getRecentlyAddedItems = async (service, limit = 20) => {
	try {
		return await service._fetchItems(
			`/Users/${service.userId}/Items?limit=${limit}&sortBy=DateCreated&sortOrder=Descending&recursive=true&includeItemTypes=Movie,Series&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber&imageTypeLimit=1`,
			{},
			'getRecentlyAdded'
		);
	} catch (error) {
		console.error('getRecentlyAdded error:', error);
		return [];
	}
};

export const getNextUpItems = async (service, limit = 24) => {
	try {
		return await service._fetchItems(
			`/Shows/NextUp?userId=${service.userId}&limit=${limit}&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,SeriesId,ParentIndexNumber,IndexNumber&imageTypeLimit=1&enableTotalRecordCount=false`,
			{},
			'getNextUp'
		);
	} catch (error) {
		console.error('Failed to get next up:', error);
		return [];
	}
};

export const getResumeMediaItems = async (service, limit = 10) => {
	try {
		return await service._fetchItems(
			`/Users/${service.userId}/Items/Resume?limit=${limit}&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,SeriesId,ParentIndexNumber,IndexNumber&imageTypeLimit=1`,
			{},
			'getResumeItems'
		);
	} catch (error) {
		console.error('getResumeItems error:', error);
		return [];
	}
};

export const getLibraryViewItems = async (service) => {
	try {
		return await service._fetchItems(
			`/Users/${service.userId}/Views`,
			{},
			'getLibraryViews'
		);
	} catch (error) {
		console.error('getLibraryViews error:', error);
		return [];
	}
};

export const getLibraryChildItems = async (service, parentId, itemTypes, limit = 100, startIndex = 0) => {
	try {
		let url = `${service.serverUrl}/Users/${service.userId}/Items?parentId=${parentId}&limit=${limit}&startIndex=${startIndex}&recursive=true&sortBy=SortName&sortOrder=Ascending&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,ParentIndexNumber,IndexNumber,UserData,ChildCount`;

		if (itemTypes) {
			const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
			url += `&includeItemTypes=${types}`;
		}

		return await service._fetchItems(url, {}, 'getLibraryItems');
	} catch (error) {
		console.error('getLibraryItems error:', error);
		return [];
	}
};

export const getItemDetails = async (service, itemId) => {
	try {
		return await service._request(
			`/Users/${service.userId}/Items/${itemId}?fields=Overview,Genres,People,Studios,MediaStreams`,
			{
				context: 'getItem'
			}
		);
	} catch (error) {
		console.error('getItem error:', error);
		return null;
	}
};

export const getSeriesSeasons = async (service, seriesId) => {
	try {
		return await service._fetchItems(
			`/Shows/${seriesId}/Seasons?userId=${service.userId}&fields=Overview`,
			{},
			'getSeasons'
		);
	} catch (error) {
		console.error('getSeasons error:', error);
		return [];
	}
};

export const getSeasonEpisodes = async (service, seriesId, seasonId) => {
	try {
		return await service._fetchItems(
			`/Shows/${seriesId}/Episodes?seasonId=${seasonId}&userId=${service.userId}&fields=Overview,SeriesName,ParentIndexNumber,IndexNumber`,
			{},
			'getEpisodes'
		);
	} catch (error) {
		console.error('getEpisodes error:', error);
		return [];
	}
};

export const getNextUpEpisodeForSeries = async (service, seriesId) => {
	try {
		const data = await service._request(
			`/Shows/NextUp?seriesId=${seriesId}&userId=${service.userId}&fields=Overview,SeriesName,ParentIndexNumber,IndexNumber`,
			{
				context: 'getNextUpEpisode'
			}
		);
		if (data.Items && data.Items.length > 0) {
			return data.Items[0];
		}
		const seasonsData = await service._request(
			`/Shows/${seriesId}/Seasons?userId=${service.userId}`,
			{
				context: 'getNextUpEpisode seasons'
			}
		);
		if (seasonsData.Items && seasonsData.Items.length > 0) {
			const firstSeason = seasonsData.Items.find((season) => season.IndexNumber > 0) || seasonsData.Items[0];
			const episodes = await service.getEpisodes(seriesId, firstSeason.Id);
			return episodes[0] || null;
		}

		return null;
	} catch (error) {
		console.error('getNextUpEpisode error:', error);
		return null;
	}
};

export const searchLibraryItems = async (service, searchTerm, itemTypes = null, limit = 25, startIndex = 0) => {
	try {
		let url = `${service.serverUrl}/Users/${service.userId}/Items?searchTerm=${encodeURIComponent(searchTerm)}&limit=${limit}&startIndex=${Math.max(0, Number(startIndex) || 0)}&recursive=true&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber,UserData&imageTypeLimit=1&enableTotalRecordCount=false`;

		if (itemTypes && itemTypes.length > 0) {
			const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
			url += `&includeItemTypes=${types}`;
		}

		return await service._fetchItems(url, {}, 'search');
	} catch (error) {
		console.error('search error:', error);
		return [];
	}
};

export const getFavoriteMediaItems = async (service, itemTypes = ['Movie', 'Series'], limit = 100) => {
	try {
		const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
		return await service._fetchItems(
			`/Users/${service.userId}/Items?filters=IsFavorite&includeItemTypes=${types}&limit=${limit}&recursive=true&sortBy=SortName&sortOrder=Ascending&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber,UserData&imageTypeLimit=1`,
			{},
			'getFavorites'
		);
	} catch (error) {
		console.error('getFavorites error:', error);
		return [];
	}
};

export const getSystemInfo = async (service) => {
	try {
		return await service._request('/System/Info', {
			context: 'getServerInfo'
		});
	} catch (error) {
		console.error('getServerInfo error:', error);
		return null;
	}
};

export const getPublicSystemInfo = async (service) => {
	try {
		return await service._request('/System/Info/Public', {
			includeAuth: false,
			context: 'getPublicServerInfo',
			suppressAuthHandling: true
		});
	} catch (error) {
		console.error('getPublicServerInfo error:', error);
		return null;
	}
};

const SEGMENT_TICKS_PER_SECOND = JELLYFIN_TICKS_PER_SECOND;
const MIN_SEGMENT_DURATION_TICKS = 1 * SEGMENT_TICKS_PER_SECOND;
const MAX_INTRO_LIKE_SEGMENT_DURATION_SECONDS = 8 * 60;
const MAX_SEGMENT_SHARE_OF_RUNTIME = 0.85;
const MAX_INTRO_LIKE_SEGMENT_SHARE_OF_RUNTIME = 0.35;

const INTRO_LIKE_SEGMENT_TYPES = new Set(['intro', 'recap', 'preview']);
const CANONICAL_SEGMENT_TYPE_BY_KEY = {
	intro: 'Intro',
	recap: 'Recap',
	preview: 'Preview',
	outro: 'Outro',
	credits: 'Credits'
};

const toFiniteTick = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return null;
	return Math.trunc(parsed);
};

const normalizeSegmentType = (value) => {
	const raw = String(value || '').trim();
	if (!raw) return 'Segment';
	const normalizedKey = raw.toLowerCase();
	return CANONICAL_SEGMENT_TYPE_BY_KEY[normalizedKey] || raw;
};

const normalizeRuntimeTicks = (value) => {
	const ticks = toFiniteTick(value);
	if (ticks === null || ticks <= 0) return null;
	return ticks;
};

const normalizeMediaSegment = (segment, index, runtimeTicks = null) => {
	const startTicksRaw = toFiniteTick(segment?.StartTicks);
	const endTicksRaw = toFiniteTick(segment?.EndTicks);
	if (startTicksRaw === null || endTicksRaw === null) return null;

	const startTicks = Math.max(0, startTicksRaw);
	let endTicks = endTicksRaw;
	if (runtimeTicks !== null) {
		if (startTicks >= runtimeTicks) return null;
		endTicks = Math.min(endTicks, runtimeTicks);
	}
	if (endTicks <= startTicks) return null;

	const durationTicks = endTicks - startTicks;
	if (durationTicks < MIN_SEGMENT_DURATION_TICKS) return null;

	const normalizedType = normalizeSegmentType(segment?.Type);
	const normalizedTypeKey = normalizedType.toLowerCase();
	const isIntroLike = INTRO_LIKE_SEGMENT_TYPES.has(normalizedTypeKey);
	const durationSeconds = durationTicks / SEGMENT_TICKS_PER_SECOND;
	if (isIntroLike && durationSeconds > MAX_INTRO_LIKE_SEGMENT_DURATION_SECONDS) return null;
	if (runtimeTicks !== null) {
		const segmentShare = durationTicks / runtimeTicks;
		if (segmentShare >= MAX_SEGMENT_SHARE_OF_RUNTIME) return null;
		if (isIntroLike && segmentShare >= MAX_INTRO_LIKE_SEGMENT_SHARE_OF_RUNTIME) return null;
	}

	const normalizedId = segment?.Id || `${normalizedTypeKey || 'segment'}-${startTicks}-${endTicks}-${index}`;
	return {
		...segment,
		Id: normalizedId,
		Type: normalizedType,
		StartTicks: startTicks,
		EndTicks: endTicks
	};
};

export const getItemMediaSegments = async (service, itemId, options = {}) => {
	if (!service.serverUrl || !service.accessToken || !itemId) return [];
	try {
		const data = await service._request(`/MediaSegments/${itemId}`, {
			context: 'getMediaSegments'
		});
		const runtimeTicks = normalizeRuntimeTicks(options?.itemRunTimeTicks);
		const rawSegments = Array.isArray(data?.Items) ? data.Items : [];
		const normalizedSegments = rawSegments
			.map((segment, index) => normalizeMediaSegment(segment, index, runtimeTicks))
			.filter(Boolean);
		const droppedCount = rawSegments.length - normalizedSegments.length;
		if (droppedCount > 0) {
			console.warn(
				`[libraryApi] Filtered ${droppedCount}/${rawSegments.length} invalid media segments for item ${itemId}.`
			);
		}
		return normalizedSegments;
	} catch (error) {
		console.error('getMediaSegments error:', error);
		return [];
	}
};
