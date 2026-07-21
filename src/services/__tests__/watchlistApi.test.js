import {
	addItemToLikesWatchlist,
	getLikesWatchlist,
	removeItemFromLikesWatchlist
} from '../jellyfin/watchlistApi';

const createService = () => ({
	serverUrl: 'https://server.test',
	userId: 'user-1',
	accessToken: 'token-1',
	_request: jest.fn()
});

describe('watchlistApi', () => {
	it('sorts by SortName, Name, and ID before paging', async () => {
		const service = createService();
		service._request.mockResolvedValueOnce({
			Items: [
				{Id: 'b', Type: 'Movie', SortName: 'Same', Name: 'Same'},
				{Id: 'a', Type: 'Series', SortName: 'Same', Name: 'Same'},
				{Id: 'z', Type: 'Movie', SortName: 'Alpha', Name: 'Zed'}
			],
			TotalRecordCount: 3
		});
		await expect(getLikesWatchlist(service, 2, 1)).resolves.toEqual({
			items: [
				{Id: 'a', Type: 'Series', SortName: 'Same', Name: 'Same'},
				{Id: 'b', Type: 'Movie', SortName: 'Same', Name: 'Same'}
			],
			totalRecordCount: 3,
			nextStartIndex: 3,
			hasMore: false
		});
	});

	it('uses Likes=true and deletes ratings to return to unset', async () => {
		const service = createService();
		service._request.mockResolvedValue(undefined);
		await addItemToLikesWatchlist(service, 'item 1');
		await removeItemFromLikesWatchlist(service, 'item 1');
		expect(service._request).toHaveBeenNthCalledWith(
			1,
			'/Users/user-1/Items/item%201/Rating?likes=true',
			expect.objectContaining({method: 'POST'})
		);
		expect(service._request).toHaveBeenNthCalledWith(
			2,
			'/Users/user-1/Items/item%201/Rating',
			expect.objectContaining({method: 'DELETE'})
		);
	});
});
