import jellyfinService from '../../../services/jellyfinService';
import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../../../constants/integrationEvents';
import {fetchEpisodes, fetchSeasons, invalidateEpisodes} from '../mediaDetailsRequests';

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

	it('does not repopulate invalidated watched state from an in-flight request', async () => {
		let resolveOld;
		jellyfinService.getEpisodes.mockImplementationOnce(() => new Promise((resolve) => {resolveOld = resolve;}));
		const oldRequest = fetchEpisodes('series-1', 'season-1');
		invalidateEpisodes('series-1', 'season-1');
		jellyfinService.getEpisodes.mockResolvedValue([{Id: 'episode-1', UserData: {Played: true}}]);
		resolveOld([{Id: 'episode-1', UserData: {Played: false}}]);
		expect(await oldRequest).toEqual([{Id: 'episode-1', UserData: {Played: true}}]);
		expect(await fetchEpisodes('series-1', 'season-1')).toEqual([{Id: 'episode-1', UserData: {Played: true}}]);
	});
});
