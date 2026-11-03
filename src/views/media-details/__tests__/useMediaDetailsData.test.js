import {act, renderHook, waitFor} from '@testing-library/react';
import jellyfinService from '../../../services/jellyfinService';
import {useMediaDetailsData} from '../useMediaDetailsData';
import {fetchEpisodes, fetchSeasons, fetchSeriesItem} from '../mediaDetailsRequests';
import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../../../constants/integrationEvents';

jest.mock('../../../services/jellyfinService', () => ({__esModule: true, default: {
	getItem: jest.fn(), getPlaybackInfo: jest.fn(), getEpisodes: jest.fn(), getSeasons: jest.fn(),
	toggleWatched: jest.fn(), toggleFavorite: jest.fn(),
	addToLikesWatchlist: jest.fn(), removeFromLikesWatchlist: jest.fn()
}}));
jest.mock('../../../hooks/useTrackPreferences', () => ({useTrackPreferences: () => ({
	resolveDefaultTrackSelection: () => ({selectedAudioTrack: null, selectedSubtitleTrack: -1})
})}));

const item = {Id: 'episode-1', Type: 'Episode', SeriesId: 'series-1', SeasonId: 'season-1'};
const episode = (updated) => ({...item, UserData: {Played: updated, IsFavorite: updated}});
const mountEpisode = async () => {
	const showToast = jest.fn();
	const utils = renderHook(() => useMediaDetailsData({item, showToast}));
	await waitFor(() => expect(utils.result.current.state.loading).toBe(false));
	await fetchSeasons('series-1');
	await fetchSeriesItem('series-1');
	return {...utils, showToast};
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
 it('ignores old-season selections while switching and keeps playback metadata aligned', async () => {
  jellyfinService.getEpisodes.mockResolvedValue([{Id: 'old-1'}, {Id: 'old-2'}]);
  jellyfinService.getPlaybackInfo.mockImplementation(async id => ({MediaSources: [{Id: id}]}));
  const {result} = renderHook(() => useMediaDetailsData({item: {Id: 'series-1', Type: 'Series'}, showToast: jest.fn()}));
  await waitFor(() => expect(result.current.state.loading).toBe(false));
  let finishSeason;
  jellyfinService.getEpisodes.mockImplementationOnce(() => new Promise(resolve => {finishSeason = resolve;}));
  let switching;
  act(() => {switching = result.current.selectSeason('season-2');});
  expect(result.current.state.episodes).toEqual([]);
  expect(result.current.state.playbackInfo).toBeNull();
  await act(async () => result.current.selectEpisode('old-2'));
  expect(jellyfinService.getPlaybackInfo).not.toHaveBeenCalledWith('old-2');
  await act(async () => {finishSeason([{Id: 'new-1'}, {Id: 'new-2'}]); await switching;});
  expect(result.current.state).toMatchObject({selectedEpisodeId: 'new-1', playbackItemId: 'new-1'});
  await act(async () => result.current.selectEpisode('new-2'));
  expect(result.current.state).toMatchObject({selectedEpisodeId: 'new-2', playbackItemId: 'new-2'});
 });

 it('keeps the latest season when an earlier season finishes after it', async () => {
  jellyfinService.getPlaybackInfo.mockImplementation(async id => ({MediaSources: [{Id: id}]}));
  const {result} = renderHook(() => useMediaDetailsData({item: {Id: 'series-1', Type: 'Series'}, showToast: jest.fn()}));
  await waitFor(() => expect(result.current.state.loading).toBe(false));
  let finishOld;
  jellyfinService.getEpisodes.mockImplementationOnce(() => new Promise(resolve => {finishOld = resolve;}))
   .mockResolvedValueOnce([{Id: 'latest-episode'}]);
  let oldRequest;
  act(() => {oldRequest = result.current.selectSeason('season-2');});
  await act(async () => result.current.selectSeason('season-3'));
  await act(async () => {finishOld([{Id: 'stale-episode'}]); await oldRequest;});
  expect(result.current.state).toMatchObject({selectedSeasonId: 'season-3', selectedEpisodeId: 'latest-episode', playbackItemId: 'latest-episode'});
 });

	it.each(['Movie', 'Episode', 'Series'].flatMap((type) => [[type, true], [type, false]]))(
		'replaces stale %s card flags with freshly loaded UserData=%s', async (type, fresh) => {
			const stale = !fresh;
			const card = {Id: 'review-item', Type: type, UserData: {IsFavorite: stale, Played: stale, Likes: stale}};
			jellyfinService.getItem.mockResolvedValue({...card, UserData: {IsFavorite: fresh, Played: fresh, Likes: fresh}});
			const {result} = renderHook(() => useMediaDetailsData({item: card, showToast: jest.fn()}));
			await waitFor(() => expect(result.current.state.loading).toBe(false));
			expect(result.current.state).toMatchObject({isFavorite: fresh, isWatched: fresh, isWatchlisted: fresh});
		}
	);

	it('uses refreshed flags as the baseline for subsequent item actions', async () => {
		const card = {Id: 'movie-1', Type: 'Movie'};
		jellyfinService.getItem.mockResolvedValue({...card, UserData: {IsFavorite: true, Played: true, Likes: true}});
		jellyfinService.toggleFavorite.mockResolvedValue(false);
		jellyfinService.toggleWatched.mockResolvedValue(false);
		const {result} = renderHook(() => useMediaDetailsData({item: card, showToast: jest.fn()}));
		await waitFor(() => expect(result.current.state.loading).toBe(false));
		await act(async () => result.current.toggleFavorite());
		await act(async () => result.current.toggleWatched());
		await act(async () => result.current.toggleWatchlist());
		expect(jellyfinService.toggleFavorite).toHaveBeenCalledWith(card.Id, true);
		expect(jellyfinService.toggleWatched).toHaveBeenCalledWith(card.Id, true);
		expect(jellyfinService.removeFromLikesWatchlist).toHaveBeenCalledWith(card.Id);
		expect(jellyfinService.addToLikesWatchlist).not.toHaveBeenCalled();
	});

	it.each([
		['toggleFavorite', 'isFavorite', 'toggleFavorite', 'IsFavorite'],
		['toggleWatched', 'isWatched', 'toggleWatched', 'Played'],
		['toggleWatchlist', 'isWatchlisted', 'addToLikesWatchlist', 'Likes']
	])('preserves a completed %s while late details refresh the other flags', async (action, flag, method, field) => {
		const card = {Id: 'movie-1', Type: 'Movie'};
		let finishDetails;
		jellyfinService.getItem.mockImplementationOnce(() => new Promise((resolve) => {finishDetails = resolve;}));
		jellyfinService[method].mockResolvedValue(true);
		const {result} = renderHook(() => useMediaDetailsData({item: card, showToast: jest.fn()}));
		await act(async () => result.current[action]());
		expect(result.current.state[flag]).toBe(true);
		const userData = {IsFavorite: true, Played: true, Likes: true, [field]: false};
		await act(async () => finishDetails({...card, UserData: userData}));
		await waitFor(() => expect(result.current.state.loading).toBe(false));
		expect(result.current.state).toMatchObject({isFavorite: true, isWatched: true, isWatchlisted: true});
	});

	it.each([null, {Id: 'movie-1'}])('retains card flags when loaded details have no UserData: %j', async (details) => {
		const card = {Id: 'movie-1', Type: 'Movie', UserData: {IsFavorite: true, Played: true, Likes: true}};
		jellyfinService.getItem.mockResolvedValue(details);
		const {result} = renderHook(() => useMediaDetailsData({item: card, showToast: jest.fn()}));
		await waitFor(() => expect(result.current.state.loading).toBe(false));
		expect(result.current.state).toMatchObject({isFavorite: true, isWatched: true, isWatchlisted: true});
	});

	it.each([
		['toggleFavorite', 'toggleFavorite'],
		['toggleWatched', 'toggleWatched'],
		['toggleWatchlist', 'addToLikesWatchlist']
	])('still applies fresh flags when an earlier %s failed', async (action, method) => {
		const card = {Id: 'movie-1', Type: 'Movie'};
		let finishDetails;
		jellyfinService.getItem.mockImplementationOnce(() => new Promise((resolve) => {finishDetails = resolve;}));
		jellyfinService[method].mockRejectedValue(new Error('save failed'));
		const {result} = renderHook(() => useMediaDetailsData({item: card, showToast: jest.fn()}));
		await act(async () => result.current[action]());
		await act(async () => finishDetails({...card, UserData: {IsFavorite: true, Played: true, Likes: true}}));
		await waitFor(() => expect(result.current.state.loading).toBe(false));
		expect(result.current.state).toMatchObject({isFavorite: true, isWatched: true, isWatchlisted: true});
	});

	it.each(['unmount', 'session'])('ignores a watchlist completion after %s', async (reason) => {
		const card = {Id: 'movie-1', Type: 'Movie'};
		const showToast = jest.fn();
		const {result, unmount} = renderHook(() => useMediaDetailsData({item: card, showToast}));
		await waitFor(() => expect(result.current.state.loading).toBe(false));
		let finishSave;
		jellyfinService.addToLikesWatchlist.mockImplementationOnce(() => new Promise((resolve) => {finishSave = resolve;}));
		const saving = result.current.toggleWatchlist();
		if (reason === 'unmount') unmount();
		else jellyfinService.sessionGeneration += 1;
		await act(async () => {finishSave(); await saving;});
		expect(showToast).not.toHaveBeenCalled();
		expect(result.current.state.isWatchlisted).toBe(false);
	});

});
