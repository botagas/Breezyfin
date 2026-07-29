import {BREEZYFIN_FEATURE_IDS} from './requestsApi';
import {
	addAuthenticatedPluginImageUrls,
	createPluginPaging,
	getPluginFeaturePage
} from './pluginFeaturesApi';

const CALENDAR_TYPES = new Set(['Movie', 'Episode']);

const isCalendarEvent = (item) => (
	item &&
	typeof item.Id === 'string' && item.Id.trim() &&
	typeof item.InstanceName === 'string' && item.InstanceName.trim() &&
	CALENDAR_TYPES.has(item.Type) &&
	typeof item.Title === 'string' && item.Title.trim() &&
	!Number.isNaN(Date.parse(item.UtcDate)) &&
	typeof item.Monitored === 'boolean' &&
	typeof item.HasFile === 'boolean' &&
	typeof item.ProviderIds === 'object' && !Array.isArray(item.ProviderIds) &&
	typeof item.CanPlay === 'boolean' &&
	(item.JellyfinItemId == null || typeof item.JellyfinItemId === 'string') &&
	(item.JellyfinImageItemId == null || typeof item.JellyfinImageItemId === 'string') &&
	(item.ImageUrl == null || (typeof item.ImageUrl === 'string' && item.ImageUrl.startsWith('/Breezyfin/ExternalImages/')))
);

export const getCalendarEvents = async (service, {
	start,
	end,
	itemTypes = ['Movie', 'Episode'],
	limit = 60,
	startIndex = 0,
	allowPartial = true
} = {}) => {
	const paging = createPluginPaging(limit, startIndex, 60);
	const normalizedTypes = [...new Set(
		(Array.isArray(itemTypes) ? itemTypes : String(itemTypes || '').split(','))
			.map((value) => String(value || '').trim())
			.filter((value) => CALENDAR_TYPES.has(value))
	)];
	if (normalizedTypes.length === 0) {
		throw Object.assign(new Error('At least one calendar item type is required'), {status: 400});
	}
	const params = new URLSearchParams({
		itemTypes: normalizedTypes.join(','),
		limit: String(paging.limit),
		startIndex: String(paging.startIndex)
	});
	params.set('allowPartial', allowPartial === true ? 'true' : 'false');
	if (start) params.set('start', String(start));
	if (end) params.set('end', String(end));
	const response = await getPluginFeaturePage(service, {
		featureId: BREEZYFIN_FEATURE_IDS.CALENDAR,
		path: `/Breezyfin/Calendar?${params.toString()}`,
		context: 'getBreezyfinCalendar plugin',
		startIndex: paging.startIndex,
		validateItem: isCalendarEvent
	});
	return addAuthenticatedPluginImageUrls(service, response);
};
