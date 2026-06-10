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

	it('uses plugin results first and excludes watched items', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce({Items: [makeItem('probe')]})
			.mockResolvedValueOnce({
				Items: [
					makeItem('played-plugin', [], {Played: true}),
					makeItem('unplayed-plugin-1'),
					makeItem('unplayed-plugin-2')
				]
			});

		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie', 'Series'],
			limit: 2,
			startIndex: 0,
			username: 'teka'
		})).resolves.toEqual({
			items: [
				makeItem('unplayed-plugin-1'),
				makeItem('unplayed-plugin-2')
			],
			scannedCount: 3,
			nextStartIndex: 3,
			hasMore: false,
			source: 'plugin'
		});
		expect(service.getLibraryItems).not.toHaveBeenCalled();
	});

	it('fills fallback pages by scanning raw unplayed pages for matching request tags', async () => {
		const service = createService();
		service._request.mockRejectedValue(new Error('plugin unavailable'));
		service.getLibraryItems
			.mockResolvedValueOnce([
				makeItem('match-1', ['1 - teka']),
				makeItem('other-1', ['1 - someone']),
				makeItem('played-match', ['2-teka'], {Played: true}),
				makeItem('other-2'),
				makeItem('other-3'),
				makeItem('other-4'),
				makeItem('other-5'),
				makeItem('other-6')
			])
			.mockResolvedValueOnce([
				makeItem('match-2', ['3-teka']),
				makeItem('other-7'),
				makeItem('other-8')
			]);

		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie', 'Series'],
			limit: 2,
			startIndex: 0,
			username: 'teka'
		})).resolves.toEqual({
			items: [
				makeItem('match-1', ['1 - teka']),
				makeItem('match-2', ['3-teka'])
			],
			scannedCount: 11,
			nextStartIndex: 11,
			hasMore: false,
			source: 'tags-fallback'
		});

		expect(service.getLibraryItems).toHaveBeenCalledTimes(2);
		expect(service.getLibraryItems).toHaveBeenNthCalledWith(
			1,
			null,
			['Movie', 'Series'],
			8,
			0,
			{filters: 'IsUnplayed'}
		);
		expect(service.getLibraryItems).toHaveBeenNthCalledWith(
			2,
			null,
			['Movie', 'Series'],
			8,
			8,
			{filters: 'IsUnplayed'}
		);
	});
});
