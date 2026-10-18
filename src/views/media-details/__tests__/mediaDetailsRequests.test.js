import jellyfinService from '../../../services/jellyfinService';
import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../../../constants/integrationEvents';
import {fetchEpisodes, fetchSeasons, invalidateEpisodes, invalidateSeriesUserData} from '../mediaDetailsRequests';

jest.mock('../../../services/jellyfinService', () => ({
	__esModule: true,
	default: {getEpisodes: jest.fn(), getSeasons: jest.fn()}
}));

describe('Media Details request cache ownership', () => {
	beforeEach(() => {
		jest.resetAllMocks();
		Object.assign(jellyfinService, {
			serverUrl: 'https://server-a.test', userId: 'user-a', accessToken: 'token-a', sessionGeneration: 1
		});
		window.dispatchEvent(new CustomEvent(BREEZYFIN_USER_DATA_INVALIDATED_EVENT));
	});

	it('reuses results within the same authenticated session', async () => {
		jellyfinService.getEpisodes.mockResolvedValue([{Id: 'episode-1'}]);
		await fetchEpisodes('series-1', 'season-1');
		await fetchEpisodes('series-1', 'season-1');
		expect(jellyfinService.getEpisodes).toHaveBeenCalledTimes(1);
	});

	it.each([
		{userId: 'user-b'},
		{serverUrl: 'https://server-b.test'},
		{accessToken: 'token-b', sessionGeneration: 2}
	])('does not reuse watched state after session changes: %j', async (sessionChange) => {
		jellyfinService.getEpisodes
			.mockResolvedValueOnce([{Id: 'episode-1', UserData: {Played: true}}])
			.mockResolvedValueOnce([{Id: 'episode-1', UserData: {Played: false}}]);
		await fetchEpisodes('series-1', 'season-1');
		Object.assign(jellyfinService, sessionChange);
		expect(await fetchEpisodes('series-1', 'season-1')).toEqual([{Id: 'episode-1', UserData: {Played: false}}]);
	});

	it('refreshes episode and season state after playback invalidation', async () => {
		jellyfinService.getEpisodes.mockResolvedValueOnce([{UserData: {Played: false}}]).mockResolvedValue([{UserData: {Played: true}}]);
		jellyfinService.getSeasons.mockResolvedValue([{Id: 'season-1'}]);
		await fetchEpisodes('series-1', 'season-1');
		await fetchSeasons('series-1');
		window.dispatchEvent(new CustomEvent(BREEZYFIN_USER_DATA_INVALIDATED_EVENT));
		expect(await fetchEpisodes('series-1', 'season-1')).toEqual([{UserData: {Played: true}}]);
		await fetchSeasons('series-1');
		expect(jellyfinService.getSeasons).toHaveBeenCalledTimes(2);
	});

	it('discards an old account response that finishes after switching users', async () => {
		let resolveOld;
		jellyfinService.getEpisodes.mockImplementationOnce(() => new Promise((resolve) => {resolveOld = resolve;}));
		const oldRequest = fetchEpisodes('series-1', 'season-1');
		jellyfinService.userId = 'user-b';
		jellyfinService.sessionGeneration += 1;
		jellyfinService.getEpisodes.mockResolvedValue([{Id: 'new-account-episode'}]);
		await fetchEpisodes('series-1', 'season-1');
		resolveOld([{Id: 'old-account-episode'}]);
		expect(await oldRequest).toEqual([]);
		expect(await fetchEpisodes('series-1', 'season-1')).toEqual([{Id: 'new-account-episode'}]);
	});

	it('invalidates all seasons of one series while preserving another series cache', async () => {
		jellyfinService.getEpisodes.mockResolvedValue([{Id: 'old'}]);
		await fetchEpisodes('series-1', 'season-1');
		await fetchEpisodes('series-1', 'season-2');
		await fetchEpisodes('series-2', 'season-3');
		invalidateSeriesUserData('series-1');
		jellyfinService.getEpisodes.mockResolvedValue([{Id: 'new'}]);
		expect(await fetchEpisodes('series-1', 'season-1')).toEqual([{Id: 'new'}]);
		expect(await fetchEpisodes('series-1', 'season-2')).toEqual([{Id: 'new'}]);
		expect(await fetchEpisodes('series-2', 'season-3')).toEqual([{Id: 'old'}]);
	});

	it.each([invalidateEpisodes, invalidateSeriesUserData])('does not repopulate invalidated watched state from an in-flight request after %p', async (invalidate) => {
		let resolveOld;
		jellyfinService.getEpisodes.mockImplementationOnce(() => new Promise((resolve) => {resolveOld = resolve;}));
		const oldRequest = fetchEpisodes('series-1', 'season-1');
		invalidate('series-1', 'season-1');
		jellyfinService.getEpisodes.mockResolvedValue([{Id: 'episode-1', UserData: {Played: true}}]);
		resolveOld([{Id: 'episode-1', UserData: {Played: false}}]);
		expect(await oldRequest).toEqual([{Id: 'episode-1', UserData: {Played: true}}]);
		expect(await fetchEpisodes('series-1', 'season-1')).toEqual([{Id: 'episode-1', UserData: {Played: true}}]);
	});
 it.each([
  ['episodes', () => fetchEpisodes('series-1', 'season-1'), 'getEpisodes'],
  ['seasons', () => fetchSeasons('series-1'), 'getSeasons']
 ])('retains usable %s after repeated invalidation without caching a stale retry', async (_name, load, method) => {
  let finishFirst, finishRetry;
  jellyfinService[method].mockImplementationOnce(() => new Promise(resolve => {finishFirst = resolve;}))
   .mockImplementationOnce(() => new Promise(resolve => {finishRetry = resolve;}));
  const request = load();
  invalidateSeriesUserData('series-1');
  finishFirst([{Id: 'old'}]);
  // Allow the original request and its retry to enter the service mock.
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(finishRetry).toBeDefined();
  invalidateSeriesUserData('series-1');
  finishRetry([{Id: 'usable'}]);
  expect(await request).toEqual([{Id: 'usable'}]);
  expect(jellyfinService[method]).toHaveBeenCalledTimes(2);
  jellyfinService[method].mockResolvedValue([{Id: 'fresh'}]);
  expect(await load()).toEqual([{Id: 'fresh'}]);
  expect(jellyfinService[method]).toHaveBeenCalledTimes(3);
 });

});
