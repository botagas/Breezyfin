import {BREEZYFIN_FEATURE_IDS} from './requestsApi';
import {DISCOVERY_FEEDS} from '../../constants/integrationEvents';
import {
	addAuthenticatedPluginImageUrls,
	createPluginPaging,
	getPluginFeaturePage
} from './pluginFeaturesApi';

const isDiscoveryItem = (item) => (
	item &&
	typeof item.Id === 'string' && item.Id.trim() &&
	['Movie', 'Series'].includes(item.Type) &&
	typeof item.Title === 'string' && item.Title.trim() &&
	typeof item.Overview === 'string' &&
	typeof item.ProviderIds === 'object' && !Array.isArray(item.ProviderIds) &&
	typeof item.CanPlay === 'boolean' &&
	(item.JellyfinItemId == null || typeof item.JellyfinItemId === 'string') &&
	(item.ImageUrl == null || (typeof item.ImageUrl === 'string' && item.ImageUrl.startsWith('/Breezyfin/ExternalImages/')))
);

export const getDiscoveryFeed = async (service, feed, {
	limit = 30,
	startIndex = 0,
	language = 'en'
} = {}) => {
	if (!DISCOVERY_FEEDS.includes(feed)) {
		throw Object.assign(new Error('Unsupported discovery feed'), {status: 400});
	}
	const paging = createPluginPaging(limit, startIndex, 30);
	const safeLanguage = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(String(language || ''))
		? String(language)
		: 'en';
	const params = new URLSearchParams({
		feed,
		limit: String(paging.limit),
		startIndex: String(paging.startIndex),
		language: safeLanguage
	});
	const response = await getPluginFeaturePage(service, {
		featureId: BREEZYFIN_FEATURE_IDS.DISCOVERY,
		path: `/Breezyfin/Discovery?${params.toString()}`,
		context: 'getBreezyfinDiscovery plugin',
		startIndex: paging.startIndex,
		validateItem: isDiscoveryItem
	});
	return addAuthenticatedPluginImageUrls(service, response);
};
