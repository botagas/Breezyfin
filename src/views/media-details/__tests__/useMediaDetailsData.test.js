import {act, renderHook, waitFor} from '@testing-library/react';
import jellyfinService from '../../../services/jellyfinService';
import {useMediaDetailsData} from '../useMediaDetailsData';
import {fetchEpisodes, fetchSeasons, fetchSeriesItem} from '../mediaDetailsRequests';
import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../../../constants/integrationEvents';

jest.mock('../../../services/jellyfinService', () => ({__esModule: true, default: {
	getItem: jest.fn(), getPlaybackInfo: jest.fn(), getEpisodes: jest.fn(), getSeasons: jest.fn(),
	toggleWatched: jest.fn(), toggleFavorite: jest.fn()
}}));
jest.mock('../../../hooks/useTrackPreferences', () => ({useTrackPreferences: () => ({
	resolveDefaultTrackSelection: () => ({selectedAudioTrack: null, selectedSubtitleTrack: -1})
})}));

const item = {Id: 'episode-1', Type: 'Episode', SeriesId: 'series-1', SeasonId: 'season-1'};
const episode = (updated) => ({...item, UserData: {Played: updated, IsFavorite: updated}});
const mountEpisode = async () => {
	const showToast = jest.fn();
	const hook = renderHook(() => useMediaDetailsData({item, showToast}));
	await waitFor(() => expect(hook.result.current.state.loading).toBe(false));
	await fetchSeasons('series-1');
	await fetchSeriesItem('series-1');
	return {...hook, showToast};
};
const updateServerData = () => {
	jellyfinService.getEpisodes.mockResolvedValue([episode(true)]);
	jellyfinService.getSeasons.mockResolvedValue([{Id: 'season-1', UserData: {Played: true}}]);
	jellyfinService.getItem.mockImplementation(async (id) => id === item.Id ? episode(true) : {Id: id, UserData: {Played: true}});
};

describe('Media Details mutation cache ownership', () => {
	beforeEach(() => {
		jest.resetAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => {});
		Object.assign(jellyfinService, {serverUrl: 'https://review.test', userId: 'review-user', accessToken: 'review-token', sessionGeneration: 1});
		window.dispatchEvent(new CustomEvent(BREEZYFIN_USER_DATA_INVALIDATED_EVENT));
		jellyfinService.getItem.mockImplementation(async (id) => id === item.Id ? episode(false) : {Id: id, UserData: {Played: false}});
		jellyfinService.getPlaybackInfo.mockResolvedValue({MediaSources: []});
		jellyfinService.getEpisodes.mockResolvedValue([episode(false)]);
		jellyfinService.getSeasons.mockResolvedValue([{Id: 'season-1', UserData: {Played: false}}]);
	});
	afterEach(() => jest.restoreAllMocks());

	it.each([['toggleWatched', 'isWatched'], ['toggleFavorite', 'isFavorite']])('refreshes parent caches after %s on a standalone episode', async (method, stateKey) => {
		const {result} = await mountEpisode();
		updateServerData();
		jellyfinService[method].mockResolvedValue(true);
		await act(async () => result.current[method]());
		expect(await fetchEpisodes('series-1', 'season-1')).toEqual([episode(true)]);
		expect((await fetchSeasons('series-1'))[0].UserData.Played).toBe(true);
		expect((await fetchSeriesItem('series-1')).UserData.Played).toBe(true);
		expect(result.current.state[stateKey]).toBe(true);
	});

	it.each(['toggleWatched', 'toggleFavorite'])('keeps cached data when %s fails', async (method) => {
		const {result, showToast} = await mountEpisode();
		updateServerData();
		jellyfinService[method].mockRejectedValue(new Error('save failed'));
		await act(async () => result.current[method]());
		expect(await fetchEpisodes('series-1', 'season-1')).toEqual([episode(false)]);
		expect(jellyfinService.getEpisodes).toHaveBeenCalledTimes(1);
		expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Failed'));
	});

	it.each(['toggleWatched', 'toggleFavorite'])('invalidates cached lists when %s completes after navigation away', async (method) => {
		const {result, unmount, showToast} = await mountEpisode();
		let finish;
		jellyfinService[method].mockImplementation(() => new Promise((resolve) => {finish = resolve;}));
		const mutation = result.current[method]();
		unmount();
		updateServerData();
		await act(async () => { finish(true); await mutation; });
		expect(await fetchEpisodes('series-1', 'season-1')).toEqual([episode(true)]);
		expect(showToast).not.toHaveBeenCalled();
	});

	it.each(['toggleWatched', 'toggleFavorite'])('does not invalidate a newer session after %s completes', async (method) => {
		const {result, showToast} = await mountEpisode();
		let finish;
		jellyfinService[method].mockImplementation(() => new Promise((resolve) => {finish = resolve;}));
		const mutation = result.current[method]();
		jellyfinService.userId = 'new-user';
		jellyfinService.sessionGeneration += 1;
		await fetchEpisodes('series-1', 'season-1');
		await act(async () => { finish(true); await mutation; });
		await fetchEpisodes('series-1', 'season-1');
		expect(jellyfinService.getEpisodes).toHaveBeenCalledTimes(2);
		expect(showToast).not.toHaveBeenCalled();
	});
});
