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
	it('requests deterministic server paging without building a client snapshot', async () => {
		const service = createService();
		service._request.mockResolvedValueOnce({
			Items: [
				{Id: 'a', Type: 'Series', SortName: 'Same', Name: 'Same'},
				{Id: 'b', Type: 'Movie', SortName: 'Same', Name: 'Same'}
			],
			TotalRecordCount: 5
		});
		await expect(getLikesWatchlist(service, 2, 1, ['Series'])).resolves.toEqual({
			items: [
				{Id: 'a', Type: 'Series', SortName: 'Same', Name: 'Same'},
				{Id: 'b', Type: 'Movie', SortName: 'Same', Name: 'Same'}
			],
			totalRecordCount: 5,
			nextStartIndex: 3,
			hasMore: true
		});
		const requestPath = service._request.mock.calls[0][0];
		expect(requestPath).toContain('includeItemTypes=Series');
		expect(requestPath).toContain('sortBy=SortName%2CName');
		expect(requestPath).toContain('limit=2');
		expect(requestPath).toContain('startIndex=1');
		expect(service._request).toHaveBeenCalledTimes(1);
	});

	it('advances paging by raw server results when malformed rows are discarded', async () => {
		const service = createService();
		service._request.mockResolvedValueOnce({
			Items: [{Id: 'valid'}, null],
			TotalRecordCount: 4
		});
		await expect(getLikesWatchlist(service, 2, 0)).resolves.toMatchObject({
			items: [{Id: 'valid'}],
			nextStartIndex: 2,
			hasMore: true
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
