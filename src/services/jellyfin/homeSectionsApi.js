import {BREEZYFIN_FEATURE_IDS} from './requestsApi';
import {createPluginPaging, getPluginFeaturePage} from './pluginFeaturesApi';

const VIEW_MODES = new Set(['Portrait', 'Landscape', 'Square', 'Small']);

const isHomeSection = (item) => (
	item &&
	typeof item.Id === 'string' && item.Id.length >= 32 &&
	typeof item.Title === 'string' && item.Title.trim().length > 0 &&
	VIEW_MODES.has(item.ViewMode) &&
	Number.isInteger(item.Order) &&
	typeof item.SupportsPaging === 'boolean'
);

const isJellyfinItem = (item) => (
	item && typeof item === 'object' && typeof item.Id === 'string' && item.Id.trim().length > 0
);

export const getHomeSectionDescriptors = async (service, limit = 20, startIndex = 0) => {
	const paging = createPluginPaging(limit, startIndex, 20);
	const params = new URLSearchParams({
		limit: String(paging.limit),
		startIndex: String(paging.startIndex)
	});
	return getPluginFeaturePage(service, {
		featureId: BREEZYFIN_FEATURE_IDS.HOME_SECTIONS,
		path: `/Breezyfin/HomeSections?${params.toString()}`,
		context: 'getBreezyfinHomeSections plugin',
		startIndex: paging.startIndex,
		validateItem: isHomeSection
	});
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
