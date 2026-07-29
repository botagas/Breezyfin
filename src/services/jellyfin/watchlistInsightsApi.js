import {BREEZYFIN_FEATURE_IDS, getBreezyfinCapabilities} from './requestsApi';
import {createPluginPaging, getPluginFeaturePage} from './pluginFeaturesApi';

const getSummaryItem = (summary) => (
	summary?.Item && typeof summary.Item === 'object' ? summary.Item : summary
);

const hasSummaryIdentity = (summary) => {
	const item = getSummaryItem(summary);
	return item && typeof item.Id === 'string' && (
		typeof item.Name === 'string' || typeof item.Title === 'string'
	);
};

const isSeriesSummary = (item) => (
	hasSummaryIdentity(item) &&
	Number.isInteger(item.WatchedEpisodeCount) && Number.isInteger(item.TotalEpisodeCount) &&
	Number.isInteger(item.RemainingEpisodeCount)
);

const isMovieHistorySummary = (item) => (
	hasSummaryIdentity(item) && (
		item.LastPlayedDate == null || typeof item.LastPlayedDate === 'string'
	)
);

const isTopMovieSummary = (item) => (
	hasSummaryIdentity(item) &&
	Number.isInteger(item.PlayCount) &&
	(item.LastPlayedDate == null || typeof item.LastPlayedDate === 'string')
);

const normalizeSummaryItem = (summary) => {
	const item = getSummaryItem(summary);
	const title = item.Name || item.Title || '';
	const runtimeTicks = Number(item.RunTimeTicks);
	return {
		...item,
		...summary,
		Id: item.Id,
		Name: title,
		Title: title,
		LastWatchedEpisodeTitle: summary.LastWatchedEpisodeName || summary.LastWatchedEpisodeTitle || null,
		RuntimeMinutes: Number.isFinite(runtimeTicks) && runtimeTicks > 0
			? Math.round(runtimeTicks / 600000000)
			: (summary.RuntimeMinutes || 0)
	};
};

const normalizeWatchlistPage = (response) => {
	if (response?.available !== true) return response;
	return {
		...response,
		result: {
			...response.result,
			items: response.result.items.map(normalizeSummaryItem)
		}
	};
};

const getWatchlistInsightPage = async (service, path, context, limit, startIndex, validateItem) => {
	const paging = createPluginPaging(limit, startIndex, 30);
	const separator = path.includes('?') ? '&' : '?';
	const response = await getPluginFeaturePage(service, {
		featureId: BREEZYFIN_FEATURE_IDS.WATCHLIST_INSIGHTS,
		path: `${path}${separator}limit=${paging.limit}&startIndex=${paging.startIndex}`,
		context,
		startIndex: paging.startIndex,
		validateItem
	});
	return normalizeWatchlistPage(response);
};

export const getWatchlistSeriesInsights = (service, state, limit = 30, startIndex = 0) => (
	getWatchlistInsightPage(
		service,
		`/Breezyfin/Watchlist/Series?state=${state === 'Completed' ? 'Completed' : 'InProgress'}`,
		'getBreezyfinWatchlistSeries plugin',
		limit,
		startIndex,
		isSeriesSummary
	)
);

export const getWatchlistMovieHistory = (service, limit = 30, startIndex = 0) => (
	getWatchlistInsightPage(
		service,
		'/Breezyfin/Watchlist/MovieHistory',
		'getBreezyfinWatchlistMovieHistory plugin',
		limit,
		startIndex,
		isMovieHistorySummary
	)
);

export const getWatchlistStatistics = async (service) => {
	const capabilities = await getBreezyfinCapabilities(service);
	if (capabilities.available !== true) return capabilities;
	if (capabilities.features?.[BREEZYFIN_FEATURE_IDS.WATCHLIST_INSIGHTS] !== true) {
		return {available: false, diagnosticReason: 'plugin-feature-disabled'};
	}
	try {
		const result = await service._request('/Breezyfin/Watchlist/Statistics', {
			context: 'getBreezyfinWatchlistStatistics plugin'
		});
		if (
			!result ||
			!Number.isInteger(result.SeriesStarted) ||
			!Number.isInteger(result.SeriesWatched) ||
			!Number.isInteger(result.EpisodesWatched) ||
			!Number.isInteger(result.MoviesWatched) ||
			!Array.isArray(result.TopShows) ||
			!result.TopShows.every((show) => (
				hasSummaryIdentity(show) && Number.isInteger(show.WatchedEpisodeCount)
			)) ||
			(result.TopMovies != null && (
				!Array.isArray(result.TopMovies) ||
				!result.TopMovies.every(isTopMovieSummary)
			))
		) {
			return {available: false, diagnosticReason: 'plugin-response-malformed'};
		}
		return {
			available: true,
			result: {
				...result,
				TopShows: result.TopShows.map(normalizeSummaryItem),
				TopMovies: (result.TopMovies || []).map(normalizeSummaryItem)
			}
		};
	} catch (error) {
		return {available: false, diagnosticReason: error?.problemDetails?.reason || 'plugin-unavailable'};
	}
};
