import {getMyRequestItems} from '../jellyfin/requestsApi';

let serviceCounter = 0;

const createService = () => {
	serviceCounter += 1;
	return {
		serverUrl: `https://server-${serviceCounter}.test`,
		userId: `user-${serviceCounter}`,
		_request: jest.fn(),
		getLibraryItems: jest.fn()
	};
};

const makeItem = (id, tags = [], userData = {}) => ({
	Id: id,
	Tags: tags,
	UserData: userData
});

describe('requestsApi', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('uses plugin results first when available and returns paging metadata', async () => {
		const service = createService();
		const pluginItems = [
			makeItem('played-plugin', [], {Played: true}),
			makeItem('unplayed-plugin-1')
		];
		service._request.mockResolvedValueOnce({
			Items: pluginItems,
			TotalRecordCount: 5
		});

		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie', 'Series'],
			limit: 2,
			startIndex: 0,
			username: 'requester'
		})).resolves.toEqual({
			items: pluginItems,
			source: 'plugin',
			scannedCount: 2,
			nextStartIndex: 2,
			hasMore: true,
			diagnosticReason: 'plugin'
		});
		expect(service._request).toHaveBeenCalledWith(
			`/Breezyfin/MyRequests?userId=${service.userId}&limit=2&startIndex=0&includeItemTypes=Movie%2CSeries`,
			{context: 'getMyRequests plugin'}
		);
		expect(service.getLibraryItems).not.toHaveBeenCalled();
	});

	it('fills fallback pages by scanning raw library pages for request tags', async () => {
		const service = createService();
		service._request.mockRejectedValue(new Error('plugin unavailable'));
		service.getLibraryItems
			.mockResolvedValueOnce([
				makeItem('match-1', ['1 - requester']),
				makeItem('other-1', ['1 - someone']),
				makeItem('other-2'),
				makeItem('other-3'),
				makeItem('other-4'),
				makeItem('other-5'),
				makeItem('other-6'),
				makeItem('other-7')
			])
			.mockResolvedValueOnce([
				makeItem('other-8'),
				makeItem('played-match', ['2-requester'], {Played: true}),
				makeItem('other-9')
			]);

		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie', 'Series'],
			limit: 2,
			startIndex: 0,
			username: 'requester'
		})).resolves.toEqual({
			items: [
				makeItem('match-1', ['1 - requester']),
				makeItem('played-match', ['2-requester'], {Played: true})
			],
			source: 'tags-fallback',
			scannedCount: 10,
			nextStartIndex: 10,
			hasMore: true,
			diagnosticReason: 'plugin-error'
		});

		expect(service.getLibraryItems).toHaveBeenCalledTimes(2);
		expect(service.getLibraryItems).toHaveBeenNthCalledWith(
			1,
			null,
			['Movie', 'Series'],
			8,
			0
		);
		expect(service.getLibraryItems).toHaveBeenNthCalledWith(
			2,
			null,
			['Movie', 'Series'],
			8,
			8
		);
	});

	it('caches missing plugin state for the current service session', async () => {
		const service = createService();
		service._request.mockRejectedValue(new Error('getMyRequests plugin failed with status 404'));
		service.getLibraryItems
			.mockResolvedValueOnce([
					makeItem('match-1', ['1 - requester'])
			])
			.mockResolvedValueOnce([
					makeItem('match-2', ['2 - requester'])
			]);

		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie'],
			limit: 1,
			startIndex: 0,
			username: 'requester'
		})).resolves.toEqual({
			items: [makeItem('match-1', ['1 - requester'])],
			source: 'tags-fallback',
			scannedCount: 1,
			nextStartIndex: 1,
			hasMore: false,
			diagnosticReason: 'plugin-missing'
		});

		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie'],
			limit: 1,
			startIndex: 1,
			username: 'requester'
		})).resolves.toEqual({
			items: [makeItem('match-2', ['2 - requester'])],
			source: 'tags-fallback',
			scannedCount: 1,
			nextStartIndex: 2,
			hasMore: false,
			diagnosticReason: 'plugin-missing-cached'
		});

		expect(service._request).toHaveBeenCalledTimes(1);
		expect(service.getLibraryItems).toHaveBeenCalledTimes(2);
	});
});
