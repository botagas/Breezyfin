import {getHomeSectionDescriptors, getHomeSectionItems} from '../jellyfin/homeSectionsApi';
import {getDiscoveryFeed} from '../jellyfin/discoveryApi';
import {getCalendarEvents} from '../jellyfin/calendarApi';
import {getBreezyfinCapabilities, normalizePluginPage} from '../jellyfin/requestsApi';

let serviceId = 0;
const createService = () => {
	serviceId += 1;
	return {
		serverUrl: `https://server-${serviceId}.test`,
		userId: `user-${serviceId}`,
		accessToken: `token-${serviceId}`,
		_request: jest.fn()
	};
};

const capabilities = (features) => ({
	PluginVersion: '0.1.0',
	ContractVersion: '1.0',
	ServerAbi: '10.11.11',
	Features: features.map((Id) => ({Id, Enabled: true}))
});

describe('plugin feature APIs', () => {
	it('preserves valid empty HSS descriptor and item pages', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(capabilities(['homeSections.v1']))
			.mockResolvedValueOnce({Items: [], TotalRecordCount: 0})
			.mockResolvedValueOnce({Items: [], TotalRecordCount: 0});

		await expect(getHomeSectionDescriptors(service)).resolves.toEqual({
			available: true,
			result: {items: [], totalRecordCount: 0, nextStartIndex: 0, hasMore: false, warnings: []}
		});
		await expect(getHomeSectionItems(service, 'opaque-section-id')).resolves.toEqual({
			available: true,
			result: {items: [], totalRecordCount: 0, nextStartIndex: 0, hasMore: false, warnings: []}
		});
		expect(service._request).toHaveBeenCalledTimes(3);
	});

	it('adds only authenticated plugin image URLs to discovery results', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(capabilities(['discovery.v1']))
			.mockResolvedValueOnce({
				Items: [{
					Id: 'tmdb:1', Type: 'Movie', Title: 'Movie', Overview: '', ProviderIds: {Tmdb: '1'},
					CanPlay: false, JellyfinItemId: null, ImageUrl: '/Breezyfin/ExternalImages/signed'
				}],
				TotalRecordCount: 1
			});

		const response = await getDiscoveryFeed(service, 'Trending');
		const imageUrl = new URL(response.result.items[0].AuthenticatedImageUrl);
		expect(imageUrl.origin).toBe(service.serverUrl);
		expect(imageUrl.pathname).toBe('/Breezyfin/ExternalImages/signed');
		expect(imageUrl.searchParams.get('width')).toBe('500');
		expect(imageUrl.searchParams.get('api_key')).toBe(service.accessToken);
	});

	it('accepts omitted nullable discovery fields from Jellyfin JSON settings', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(capabilities(['discovery.v1']))
			.mockResolvedValueOnce({
				Items: [{
					Id: 'movie:tmdb:2', Type: 'Movie', Title: 'Movie', Overview: '', ProviderIds: {Tmdb: '2'},
					CanPlay: false
				}],
				TotalRecordCount: 1
			});

		await expect(getDiscoveryFeed(service, 'Trending')).resolves.toMatchObject({
			available: true,
			result: {items: [{Id: 'movie:tmdb:2'}]}
		});
	});

	it('returns unavailable rather than unrelated Calendar data after a provider failure', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(capabilities(['calendar.v1']))
			.mockRejectedValueOnce(Object.assign(new Error('status 503'), {status: 503}));

		await expect(getCalendarEvents(service)).resolves.toEqual({
			available: false,
			diagnosticReason: 'plugin-server-error',
			status: 503,
			problemDetails: null,
			retryable: true
		});
	});

	it('accepts omitted nullable Calendar fields and sends an explicit date range', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(capabilities(['calendar.v1']))
			.mockResolvedValueOnce({
				Items: [{
					Id: 'calendar-1', InstanceName: 'Sonarr', Type: 'Episode', Title: 'Episode',
					UtcDate: '2026-09-12T18:00:00Z', Monitored: true, HasFile: false,
					ProviderIds: {}, CanPlay: false
				}],
				TotalRecordCount: 1
			});

		const response = await getCalendarEvents(service, {start: '2026-09-01', end: '2026-11-30'});

		expect(response).toMatchObject({available: true, result: {items: [{Id: 'calendar-1'}]}});
		expect(service._request.mock.calls[1][0]).toContain('start=2026-09-01');
		expect(service._request.mock.calls[1][0]).toContain('end=2026-11-30');
	});

	it('accepts a linked series image fallback for Calendar episodes', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(capabilities(['calendar.v1']))
			.mockResolvedValueOnce({
				Items: [{
					Id: 'calendar-1', InstanceName: 'Sonarr', Type: 'Episode', Title: 'Episode',
					UtcDate: '2026-09-12T18:00:00Z', Monitored: true, HasFile: false,
					ProviderIds: {}, CanPlay: true, JellyfinItemId: 'episode-1',
					JellyfinImageItemId: 'series-1'
				}],
				TotalRecordCount: 1
			});

		await expect(getCalendarEvents(service)).resolves.toMatchObject({
			available: true,
			result: {items: [{JellyfinItemId: 'episode-1', JellyfinImageItemId: 'series-1'}]}
		});
	});

	it('opts Calendar into partial provider results and preserves structured warnings', async () => {
		const service = createService();
		service._request
			.mockResolvedValueOnce(capabilities(['calendar.v1']))
			.mockResolvedValueOnce({
				Items: [],
				TotalRecordCount: 0,
				NextStartIndex: 0,
				HasMore: false,
				Warnings: [{
					Code: 'provider_partial',
					Provider: 'Sonarr',
					Operation: 'Calendar',
					Reason: 'timeout',
					Retryable: true
				}]
			});

		const response = await getCalendarEvents(service);

		expect(response.result.warnings).toEqual([{
			code: 'provider_partial',
			provider: 'Sonarr',
			operation: 'Calendar',
			reason: 'timeout',
			retryable: true,
			upstreamStatus: null,
			failedPage: null
		}]);
		expect(service._request.mock.calls[1][0]).toContain('allowPartial=true');
	});

	it('preserves explicit paging and safe provider warnings', () => {
		expect(normalizePluginPage({
			Items: [],
			TotalRecordCount: 100,
			NextStartIndex: 30,
			HasMore: true,
			Warnings: [{Code: 'provider_partial', Provider: 'Radarr', Reason: 'timeout', Retryable: true}]
		}, {startIndex: 0})).toEqual({
			items: [],
			totalRecordCount: 100,
			nextStartIndex: 30,
			hasMore: true,
			warnings: [{
				code: 'provider_partial',
				provider: 'Radarr',
				operation: '',
				reason: 'timeout',
				retryable: true,
				upstreamStatus: null,
				failedPage: null
			}]
		});
	});

	it('preserves calendar empty reasons and provider HTTP diagnostics', () => {
		expect(normalizePluginPage({
			Items: [],
			TotalRecordCount: 0,
			NextStartIndex: 0,
			HasMore: false,
			EmptyReason: 'requested-only-filter',
			Warnings: [{
				Code: 'provider_partial',
				Provider: 'Sonarr',
				Operation: 'Calendar',
				Reason: 'upstream-http',
				Retryable: true,
				UpstreamStatus: 502,
				FailedPage: 2
			}]
		}, {startIndex: 0})).toMatchObject({
			emptyReason: 'requested-only-filter',
			warnings: [{
				provider: 'Sonarr',
				operation: 'Calendar',
				reason: 'upstream-http',
				upstreamStatus: 502,
				failedPage: 2
			}]
		});
	});

	it('preserves bounded Home Sections and Calendar diagnostics', () => {
		expect(normalizePluginPage({
			Items: [],
			TotalRecordCount: 0,
			EmptyReason: 'upstream-empty-with-enabled-sections',
			ConfiguredSectionCount: 6,
			Diagnostics: {
				ConfiguredProviderCount: 2,
				SuccessfulProviderCount: 2,
				ProviderEventCount: 12,
				TypeMatchedCount: 10,
				VisibilityMatchedCount: 0,
				VisibilityMode: 'RequestedOnly',
				Start: '2026-09-01',
				End: '2026-11-30'
			}
		}, {startIndex: 0})).toMatchObject({
			emptyReason: 'upstream-empty-with-enabled-sections',
			configuredSectionCount: 6,
			providerDiagnostics: {
				providerEventCount: 12,
				visibilityMatchedCount: 0,
				visibilityMode: 'RequestedOnly'
			}
		});
	});

	it('stops pagination when a plugin cursor does not advance', () => {
		expect(normalizePluginPage({
			Items: [],
			TotalRecordCount: 100,
			NextStartIndex: 30,
			HasMore: true
		}, {startIndex: 30})).toMatchObject({
			nextStartIndex: 30,
			hasMore: false
		});
	});

	it('retries transient capability failures after their short cache expires', async () => {
		jest.useFakeTimers();
		try {
			const service = createService();
			service._request
				.mockRejectedValueOnce(Object.assign(new Error('status 503'), {status: 503}))
				.mockResolvedValueOnce(capabilities(['discovery.v1']));

			await expect(getBreezyfinCapabilities(service)).resolves.toMatchObject({available: false});
			await expect(getBreezyfinCapabilities(service)).resolves.toMatchObject({available: false});
			expect(service._request).toHaveBeenCalledTimes(1);

			jest.advanceTimersByTime(15000);
			await expect(getBreezyfinCapabilities(service)).resolves.toMatchObject({available: true});
			expect(service._request).toHaveBeenCalledTimes(2);
		} finally {
			jest.useRealTimers();
		}
	});

	it('keeps permanent capability failures cached for the session', async () => {
		jest.useFakeTimers();
		try {
			const service = createService();
			service._request.mockRejectedValue(Object.assign(new Error('status 404'), {status: 404}));

			await expect(getBreezyfinCapabilities(service)).resolves.toMatchObject({
				available: false,
				diagnosticReason: 'plugin-capabilities-missing',
				retryable: false
			});
			jest.advanceTimersByTime(60000);
			await expect(getBreezyfinCapabilities(service)).resolves.toMatchObject({available: false});
			expect(service._request).toHaveBeenCalledTimes(1);
		} finally {
			jest.useRealTimers();
		}
	});

	it('propagates authentication failures', async () => {
		const service = createService();
		const error = Object.assign(new Error('status 401'), {status: 401});
		service._request.mockRejectedValueOnce(error);
		await expect(getDiscoveryFeed(service, 'Trending')).rejects.toBe(error);
	});
});
