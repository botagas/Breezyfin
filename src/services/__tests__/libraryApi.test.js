import {
	getItemMediaSegments,
	getLibraryChildItems,
	getNextUpEpisodeForSeries,
	getPublicSystemInfo,
	searchLibraryItems
} from '../jellyfin/libraryApi';

const createService = () => ({
	userId: 'user-1',
	serverUrl: 'http://media.local',
	accessToken: 'token-1',
	_fetchItems: jest.fn(),
	_request: jest.fn(),
	getEpisodes: jest.fn()
});

describe('libraryApi', () => {
	let warnSpy;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => {});
		warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		console.error.mockRestore();
		warnSpy.mockRestore();
	});

	it('builds library item request with parent, paging, and type filters', async () => {
		const service = createService();
		service._fetchItems.mockResolvedValue([{Id: 'item-1'}]);

		await expect(
			getLibraryChildItems(service, 'parent-1', ['Movie', 'Series'], 50, 10)
		).resolves.toEqual([{Id: 'item-1'}]);

		expect(service._fetchItems).toHaveBeenCalledTimes(1);
		const requestedUrl = service._fetchItems.mock.calls[0][0];
		expect(requestedUrl).toContain('http://media.local/Users/user-1/Items?');
		expect(requestedUrl).toContain('parentId=parent-1');
		expect(requestedUrl).toContain('limit=50');
		expect(requestedUrl).toContain('startIndex=10');
		expect(requestedUrl).toContain('includeItemTypes=Movie,Series');
		expect(service._fetchItems).toHaveBeenCalledWith(requestedUrl, {}, 'getLibraryItems');
	});

	it('normalizes search inputs for encoded term and non-negative start index', async () => {
		const service = createService();
		service._fetchItems.mockResolvedValue([]);

		await expect(
			searchLibraryItems(service, 'The Expanse', ['Series'], 25, -99)
		).resolves.toEqual([]);

		const requestedUrl = service._fetchItems.mock.calls[0][0];
		expect(requestedUrl).toContain('searchTerm=The%20Expanse');
		expect(requestedUrl).toContain('startIndex=0');
		expect(requestedUrl).toContain('includeItemTypes=Series');
	});

	it('returns next-up episode immediately when API has one', async () => {
		const service = createService();
		service._request.mockResolvedValueOnce({
			Items: [{Id: 'next-episode-1'}]
		});

		await expect(getNextUpEpisodeForSeries(service, 'series-1')).resolves.toEqual({Id: 'next-episode-1'});
		expect(service._request).toHaveBeenCalledTimes(1);
		expect(service.getEpisodes).not.toHaveBeenCalled();
	});

	it('falls back to first episode from first non-zero season when next-up is missing', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce({Items: []})
			.mockResolvedValueOnce({
				Items: [
					{Id: 'season-0', IndexNumber: 0},
					{Id: 'season-2', IndexNumber: 2}
				]
			});
		service.getEpisodes.mockResolvedValue([{Id: 'episode-s2e1'}]);

		await expect(getNextUpEpisodeForSeries(service, 'series-1')).resolves.toEqual({Id: 'episode-s2e1'});
		expect(service.getEpisodes).toHaveBeenCalledWith('series-1', 'season-2');
	});

	it('requests public system info with auth handling disabled', async () => {
		const service = createService();
		service._request.mockResolvedValue({ServerName: 'Public'});

		await expect(getPublicSystemInfo(service)).resolves.toEqual({ServerName: 'Public'});
		expect(service._request).toHaveBeenCalledWith('/System/Info/Public', {
			includeAuth: false,
			context: 'getPublicServerInfo',
			suppressAuthHandling: true
		});
	});

	it('short-circuits media segments when required service state is missing', async () => {
		await expect(getItemMediaSegments(createService(), null)).resolves.toEqual([]);
		await expect(getItemMediaSegments({...createService(), serverUrl: null}, 'item-1')).resolves.toEqual([]);
		await expect(getItemMediaSegments({...createService(), accessToken: null}, 'item-1')).resolves.toEqual([]);
	});

	it('normalizes and filters malformed media segments using runtime guards', async () => {
		const service = createService();
		const runtimeTicks = 20 * 60 * 10000000;
		service._request.mockResolvedValue({
			Items: [
				{
					Id: 'valid-intro',
					Type: 'intro',
					StartTicks: 0,
					EndTicks: 900000000
				},
				{
					Id: 'bad-full-runtime-intro',
					Type: 'Intro',
					StartTicks: 0,
					EndTicks: runtimeTicks
				},
				{
					Type: 'Credits',
					StartTicks: runtimeTicks - 150000000,
					EndTicks: runtimeTicks + 20000000
				},
				{
					Id: 'bad-reversed',
					Type: 'Recap',
					StartTicks: 50000000,
					EndTicks: 10000000
				}
			]
		});

		const result = await getItemMediaSegments(service, 'item-1', {itemRunTimeTicks: runtimeTicks});

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual(expect.objectContaining({
			Id: 'valid-intro',
			Type: 'Intro',
			StartTicks: 0,
			EndTicks: 900000000
		}));
		expect(result[1]).toEqual(expect.objectContaining({
			Type: 'Credits',
			StartTicks: runtimeTicks - 150000000,
			EndTicks: runtimeTicks
		}));
		expect(result[1].Id).toMatch(/^credits-/);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('Filtered 2/4 invalid media segments')
		);
	});
});
