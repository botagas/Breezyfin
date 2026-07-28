import {
	HOME_SECTION_IDS,
	isMyRequestsHomeSection
} from '../../../constants/homeSections';
import {normalizeDiscoveryMediaItem} from '../../../utils/discoveryMediaItems';

export const fetchHomeSectionPage = async (service, section, {
	limit,
	startIndex
}) => {
	const sectionId = section?.id || section;
	if (isMyRequestsHomeSection(section)) {
		const userName = service.username || (await service.getCurrentUser())?.Name || '';
		return service.getMyRequests(null, ['Movie', 'Series'], limit, startIndex, userName);
	}
	if (section?.source === 'plugin' && section?.pluginSectionId) {
		if (section.kind === 'Discovery' && section.feed) {
			const discoveryResponse = await service.getDiscoveryFeed(section.feed, {limit, startIndex});
			if (discoveryResponse?.available !== true) throw new Error('Discovery feed is unavailable');
			return {
				...discoveryResponse.result,
				items: discoveryResponse.result.items.map(normalizeDiscoveryMediaItem)
			};
		}
		const response = await service.getBreezyfinHomeSectionItems(
			section.pluginSectionId,
			limit,
			startIndex
		);
		if (response?.available !== true) throw new Error('Server Home section is unavailable');
		return response.result;
	}
	switch (sectionId) {
		case HOME_SECTION_IDS.RECENTLY_ADDED:
			return service.getRecentlyAdded(limit, startIndex);
		case HOME_SECTION_IDS.CONTINUE_WATCHING:
			return service.getResumeItems(limit, startIndex);
		case HOME_SECTION_IDS.NEXT_UP:
			return service.getNextUp(limit, startIndex);
		case HOME_SECTION_IDS.LATEST_MOVIES:
			return service.getLatestMedia(['Movie'], limit, startIndex);
		case HOME_SECTION_IDS.LATEST_SHOWS:
			return service.getLatestMedia(['Series'], limit, startIndex);
		case HOME_SECTION_IDS.MY_REQUESTS: {
			const userName = service.username || (await service.getCurrentUser())?.Name || '';
			return service.getMyRequests(null, ['Movie', 'Series'], limit, startIndex, userName);
		}
		case HOME_SECTION_IDS.WATCHLIST:
			return service.getLikesWatchlist(limit, startIndex);
		default:
			return [];
	}
};
