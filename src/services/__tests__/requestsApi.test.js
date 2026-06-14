import {getMyRequestItems} from '../jellyfin/requestsApi';

const createService = () => ({
	userId: 'user-1',
	_request: jest.fn(),
	getLibraryItems: jest.fn()
});

const makeItem = (id, tags = [], userData = {}) => ({
	Id: id,
	Tags: tags,
	UserData: userData
});

describe('requestsApi', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('uses plugin results first when available', async () => {
		const service = createService();
		const pluginItems = [
			makeItem('played-plugin', [], {Played: true}),
			makeItem('unplayed-plugin-1'),
			makeItem('unplayed-plugin-2')
		];
		service._request.mockResolvedValueOnce({Items: pluginItems});

		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie', 'Series'],
			limit: 2,
			startIndex: 0,
			username: 'teka'
		})).resolves.toEqual({
			items: pluginItems,
			scannedCount: 3,
			source: 'plugin'
		});
		expect(service._request).toHaveBeenCalledWith(
			'/Breezyfin/MyRequests?userId=user-1&limit=2&startIndex=0&includeItemTypes=Movie%2CSeries',
			{context: 'getMyRequests plugin'}
		);
		expect(service.getLibraryItems).not.toHaveBeenCalled();
	});

	it('falls back to one library page and filters request tags', async () => {
		const service = createService();
		service._request.mockRejectedValue(new Error('plugin unavailable'));
		service.getLibraryItems.mockResolvedValueOnce([
			makeItem('match-1', ['1 - teka']),
			makeItem('other-1', ['1 - someone']),
			makeItem('played-match', ['2-teka'], {Played: true}),
			makeItem('other-2')
		]);

		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie', 'Series'],
			limit: 2,
			startIndex: 0,
			username: 'teka'
		})).resolves.toEqual({
			items: [
				makeItem('match-1', ['1 - teka']),
				makeItem('played-match', ['2-teka'], {Played: true})
			],
			scannedCount: 4,
			source: 'tags-fallback'
		});

		expect(service.getLibraryItems).toHaveBeenCalledTimes(1);
		expect(service.getLibraryItems).toHaveBeenCalledWith(
			null,
			['Movie', 'Series'],
			2,
			0
		);
	});
});
