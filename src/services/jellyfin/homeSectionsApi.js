import {BREEZYFIN_FEATURE_IDS} from './requestsApi';
import {createPluginPaging, getPluginFeaturePage} from './pluginFeaturesApi';

const VIEW_MODES = new Set(['Portrait', 'Landscape', 'Square', 'Small']);
const HOME_SECTION_KINDS = new Set(['JellyfinItems', 'Discovery']);
const DISCOVERY_FEEDS = new Set([
	'Trending',
	'PopularMovies',
	'PopularSeries',
	'UpcomingMovies',
	'UpcomingSeries'
]);

const isHomeSection = (item) => (
	item &&
	typeof item.Id === 'string' && item.Id.length >= 32 &&
	typeof item.Title === 'string' && item.Title.trim().length > 0 &&
	VIEW_MODES.has(item.ViewMode) &&
	Number.isInteger(item.Order) &&
	typeof item.SupportsPaging === 'boolean' &&
	(item.Kind == null || HOME_SECTION_KINDS.has(item.Kind)) &&
	(item.Feed == null || DISCOVERY_FEEDS.has(item.Feed)) &&
	(item.Kind !== 'Discovery' || DISCOVERY_FEEDS.has(item.Feed))
);

const normalizeHomeSection = (item) => ({
	...item,
	Kind: item.Kind === 'Discovery' ? 'Discovery' : 'JellyfinItems',
	Feed: item.Kind === 'Discovery' && DISCOVERY_FEEDS.has(item.Feed) ? item.Feed : null
});

const isJellyfinItem = (item) => (
	item && typeof item === 'object' && typeof item.Id === 'string' && item.Id.trim().length > 0
);

export const getHomeSectionDescriptors = async (service, limit = 20, startIndex = 0) => {
	const paging = createPluginPaging(limit, startIndex, 20);
	const params = new URLSearchParams({
		limit: String(paging.limit),
		startIndex: String(paging.startIndex)
	});
	const response = await getPluginFeaturePage(service, {
		featureId: BREEZYFIN_FEATURE_IDS.HOME_SECTIONS,
		path: `/Breezyfin/HomeSections?${params.toString()}`,
		context: 'getBreezyfinHomeSections plugin',
		startIndex: paging.startIndex,
		validateItem: isHomeSection
	});
	if (response?.available !== true) return response;
	return {
		...response,
		result: {
			...response.result,
			items: response.result.items.map(normalizeHomeSection)
		}
	};
};

export const getHomeSectionItems = async (service, sectionId, limit = 60, startIndex = 0) => {
	if (typeof sectionId !== 'string' || !sectionId.trim()) {
		throw Object.assign(new Error('Home section ID is required'), {status: 400});
	}
	const paging = createPluginPaging(limit, startIndex, 60);
	const params = new URLSearchParams({
		limit: String(paging.limit),
		startIndex: String(paging.startIndex)
	});
	return getPluginFeaturePage(service, {
		featureId: BREEZYFIN_FEATURE_IDS.HOME_SECTIONS,
		path: `/Breezyfin/HomeSections/${encodeURIComponent(sectionId)}/Items?${params.toString()}`,
		context: 'getBreezyfinHomeSectionItems plugin',
		startIndex: paging.startIndex,
		validateItem: isJellyfinItem
	});
};
