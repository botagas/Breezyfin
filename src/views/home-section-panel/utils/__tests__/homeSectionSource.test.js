jest.mock('../../../../utils/discoveryMediaItems', () => ({
	normalizeDiscoveryMediaItem: (item) => item
}));

import {fetchHomeSectionPage} from '../homeSectionSource';

describe('Home section data sources', () => {
	it('uses authoritative My Requests paging for an HSS My Requests View More section', async () => {
		const expectedPage = {
			items: [{Id: 'request-1'}],
			nextStartIndex: 30,
			hasMore: true
		};
		const service = {
			username: 'viewer',
			getCurrentUser: jest.fn(),
			getMyRequests: jest.fn().mockResolvedValue(expectedPage),
			getBreezyfinHomeSectionItems: jest.fn()
		};

		await expect(fetchHomeSectionPage(service, {
			id: 'server:opaque',
			pluginSectionId: 'opaque',
			kind: 'MyRequests',
			source: 'plugin'
		}, {
			limit: 30,
			startIndex: 60
		})).resolves.toBe(expectedPage);

		expect(service.getMyRequests).toHaveBeenCalledWith(
			null,
			['Movie', 'Series'],
			30,
			60,
			'viewer'
		);
		expect(service.getBreezyfinHomeSectionItems).not.toHaveBeenCalled();
	});

	it('keeps ordinary HSS sections on the HSS items endpoint', async () => {
		const expectedPage = {items: [{Id: 'item-1'}], hasMore: false};
		const service = {
			getBreezyfinHomeSectionItems: jest.fn().mockResolvedValue({
				available: true,
				result: expectedPage
			}),
			getMyRequests: jest.fn()
		};

		await expect(fetchHomeSectionPage(service, {
			id: 'server:opaque',
			pluginSectionId: 'opaque',
			kind: 'JellyfinItems',
			source: 'plugin'
		}, {
			limit: 30,
			startIndex: 0
		})).resolves.toBe(expectedPage);

		expect(service.getBreezyfinHomeSectionItems).toHaveBeenCalledWith('opaque', 30, 0);
		expect(service.getMyRequests).not.toHaveBeenCalled();
	});
});
