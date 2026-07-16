import {getMyRequestItems} from '../jellyfin/requestsApi';

let serviceCounter = 0;

const createService = () => {
	serviceCounter += 1;
	return {
		serverUrl: `https://server-${serviceCounter}.test`,
		userId: `user-${serviceCounter}`,
		accessToken: `token-${serviceCounter}`,
		_request: jest.fn(),
		getLibraryItems: jest.fn()
	};
};

const makeCapabilities = (enabled = true) => ({
	PluginVersion: '0.1.0',
	ContractVersion: '1.0',
	ServerAbi: '10.11.11',
	Features: [{Id: 'myRequests.v1', Enabled: enabled}]
});

const makeRequestError = (status) => Object.assign(
	new Error(`plugin request failed with status ${status}`),
	{status}
);

const makeItem = (id, tags = [], userData = {}) => ({
	Id: id,
	Tags: tags,
	UserData: userData
});

const expectCapabilitiesRequest = (service, callNumber = 1) => {
	expect(service._request).toHaveBeenNthCalledWith(
		callNumber,
		'/Breezyfin/Capabilities',
		expect.objectContaining({
			context: 'getBreezyfinCapabilities plugin',
			signal: expect.anything()
		})
	);
};

describe('requestsApi', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('discovers capabilities once per service session and returns plugin paging metadata', async () => {
		const service = createService();
		const firstItems = [
			makeItem('played-plugin', [], {Played: true}),
			makeItem('unplayed-plugin-1')
		];
		service._request
			.mockResolvedValueOnce(makeCapabilities())
			.mockResolvedValueOnce({Items: firstItems, TotalRecordCount: 5})
			.mockResolvedValueOnce({Items: [makeItem('plugin-3')], TotalRecordCount: 5});

		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie', 'Series'],
			limit: 2,
			startIndex: 0,
			username: 'requester'
		})).resolves.toEqual({
			items: firstItems,
			source: 'plugin',
			scannedCount: 2,
			nextStartIndex: 2,
			hasMore: true,
			diagnosticReason: 'plugin'
		});
		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie', 'Series'],
			limit: 2,
			startIndex: 2,
			username: 'requester'
		})).resolves.toEqual(expect.objectContaining({
			items: [makeItem('plugin-3')],
			source: 'plugin',
			nextStartIndex: 3,
			hasMore: true
		}));

		expectCapabilitiesRequest(service);
		expect(service._request).toHaveBeenNthCalledWith(
			2,
			`/Breezyfin/MyRequests?userId=${service.userId}&limit=2&startIndex=0&includeItemTypes=Movie%2CSeries`,
			expect.objectContaining({context: 'getMyRequests plugin', signal: expect.anything()})
		);
		expect(service._request).toHaveBeenCalledTimes(3);
		expect(service.getLibraryItems).not.toHaveBeenCalled();
	});

	it('invalidates capability discovery when the authenticated token changes', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(makeCapabilities())
			.mockResolvedValueOnce({Items: [], TotalRecordCount: 0})
			.mockResolvedValueOnce(makeCapabilities())
			.mockResolvedValueOnce({Items: [], TotalRecordCount: 0});

		await getMyRequestItems(service, {username: 'requester'});
		service.accessToken = 'replacement-token';
		await getMyRequestItems(service, {username: 'requester'});

		expect(service._request).toHaveBeenCalledTimes(4);
		expectCapabilitiesRequest(service, 1);
		expectCapabilitiesRequest(service, 3);
	});

	it('preserves a valid empty plugin response without tag fallback', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(makeCapabilities())
			.mockResolvedValueOnce({Items: [], TotalRecordCount: 0});

		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie'],
			limit: 30,
			username: 'requester'
		})).resolves.toEqual({
			items: [],
			source: 'plugin',
			scannedCount: 0,
			nextStartIndex: 0,
			hasMore: false,
			diagnosticReason: 'plugin'
		});
		expect(service.getLibraryItems).not.toHaveBeenCalled();
	});

	it('fills fallback pages by scanning raw library pages after a plugin server failure', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(makeCapabilities())
			.mockRejectedValueOnce(makeRequestError(503));
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
			diagnosticReason: 'plugin-server-error'
		});
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

	it('caches a missing My Requests endpoint for the authenticated session', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(makeCapabilities())
			.mockRejectedValueOnce(makeRequestError(404));
		service.getLibraryItems
			.mockResolvedValueOnce([makeItem('match-1', ['1 - requester'])])
			.mockResolvedValueOnce([makeItem('match-2', ['2 - requester'])]);

		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie'],
			limit: 1,
			startIndex: 0,
			username: 'requester'
		})).resolves.toEqual(expect.objectContaining({
			items: [makeItem('match-1', ['1 - requester'])],
			diagnosticReason: 'plugin-missing'
		}));
		await expect(getMyRequestItems(service, {
			itemTypes: ['Movie'],
			limit: 1,
			startIndex: 1,
			username: 'requester'
		})).resolves.toEqual(expect.objectContaining({
			items: [makeItem('match-2', ['2 - requester'])],
			diagnosticReason: 'plugin-missing-cached'
		}));

		expect(service._request).toHaveBeenCalledTimes(2);
		expect(service.getLibraryItems).toHaveBeenCalledTimes(2);
	});

	it('caches a missing capabilities endpoint and does not probe My Requests', async () => {
		const service = createService();
		service._request.mockRejectedValueOnce(makeRequestError(404));
		service.getLibraryItems.mockResolvedValue([]);

		await getMyRequestItems(service, {username: 'requester'});
		await getMyRequestItems(service, {username: 'requester'});

		expect(service._request).toHaveBeenCalledTimes(1);
		expect(service.getLibraryItems).toHaveBeenCalledTimes(2);
	});

	it.each([
		['disabled feature', makeCapabilities(false), 'plugin-feature-disabled'],
		['unsupported contract', {...makeCapabilities(), ContractVersion: '2.0'}, 'plugin-contract-unsupported'],
		['malformed capabilities', {PluginVersion: '0.1.0'}, 'plugin-capabilities-malformed']
	])('uses tag fallback for %s', async (_, capabilities, diagnosticReason) => {
		const service = createService();
		service._request.mockResolvedValueOnce(capabilities);
		service.getLibraryItems.mockResolvedValue([]);

		await expect(getMyRequestItems(service, {username: 'requester'})).resolves.toEqual(
			expect.objectContaining({source: 'tags-fallback', diagnosticReason})
		);
		expect(service._request).toHaveBeenCalledTimes(1);
	});

	it.each([
		undefined,
		{},
		{Items: 'not-an-array', TotalRecordCount: 0},
		{Items: [], TotalRecordCount: '0'},
		{Items: [], TotalRecordCount: 'not-a-number'},
		{Items: [{}], TotalRecordCount: 1},
		{Items: [{Id: 123}], TotalRecordCount: 1}
	])('uses tag fallback for a malformed My Requests payload %#', async (payload) => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(makeCapabilities())
			.mockResolvedValueOnce(payload);
		service.getLibraryItems.mockResolvedValue([]);

		await expect(getMyRequestItems(service, {username: 'requester'})).resolves.toEqual(
			expect.objectContaining({
				source: 'tags-fallback',
				diagnosticReason: 'plugin-response-malformed'
			})
		);
	});

	it('uses tag fallback when a plugin request times out', async () => {
		const service = createService();
		const timeoutError = Object.assign(new Error('timed out'), {name: 'TimeoutError'});
		service._request
			.mockResolvedValueOnce(makeCapabilities())
			.mockRejectedValueOnce(timeoutError);
		service.getLibraryItems.mockResolvedValue([]);

		await expect(getMyRequestItems(service, {username: 'requester'})).resolves.toEqual(
			expect.objectContaining({source: 'tags-fallback', diagnosticReason: 'plugin-timeout'})
		);
	});

	it.each([400, 401, 403])('propagates capability HTTP %i without tag fallback', async (status) => {
		const service = createService();
		const error = makeRequestError(status);
		service._request.mockRejectedValueOnce(error);

		await expect(getMyRequestItems(service, {username: 'requester'})).rejects.toBe(error);
		expect(service.getLibraryItems).not.toHaveBeenCalled();
	});

	it.each([400, 401, 403])('propagates My Requests HTTP %i without tag fallback', async (status) => {
		const service = createService();
		const error = makeRequestError(status);
		service._request
			.mockResolvedValueOnce(makeCapabilities())
			.mockRejectedValueOnce(error);

		await expect(getMyRequestItems(service, {username: 'requester'})).rejects.toBe(error);
		expect(service.getLibraryItems).not.toHaveBeenCalled();
	});
});
