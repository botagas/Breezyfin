import {act, renderHook, waitFor} from '@testing-library/react';
import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../../../../constants/integrationEvents';
import jellyfinService from '../../../../services/jellyfinService';
import {useWatchlistInsights} from '../useWatchlistInsights';

jest.mock('../../../../services/jellyfinService', () => ({
	getWatchlistSeriesInsights: jest.fn(),
	getWatchlistMovieHistory: jest.fn(),
	getWatchlistStatistics: jest.fn()
}));

const createPage = (items = []) => ({
	available: true,
	result: {
		items,
		nextStartIndex: items.length,
		hasMore: false
	}
});

const createDeferred = () => {
	let resolve;
	const promise = new Promise((resolvePromise) => {
		resolve = resolvePromise;
	});
	return {promise, resolve};
};

describe('useWatchlistInsights', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jellyfinService.getWatchlistSeriesInsights.mockResolvedValue(createPage());
		jellyfinService.getWatchlistMovieHistory.mockResolvedValue(createPage());
		jellyfinService.getWatchlistStatistics.mockResolvedValue({
			available: true,
			result: {
				SeriesStarted: 0,
				SeriesWatched: 0,
				EpisodesWatched: 0,
				MoviesWatched: 0,
				TopShows: [],
				TopMovies: []
			}
		});
	});

	it('renders a fresh cached tab immediately and warms missing tabs sequentially', async () => {
		const completed = createDeferred();
		jellyfinService.getWatchlistSeriesInsights.mockImplementation((state) => (
			state === 'Completed' ? completed.promise : Promise.resolve(createPage())
		));

		const {result} = renderHook(() => useWatchlistInsights({
			activeTab: 'progress',
			cachedEntries: {
				progress: {
					items: [{Id: 'cached-series'}],
					cachedAt: Date.now(),
					hasMore: false,
					nextStartIndex: 1
				}
			},
			isActive: true
		}));

		expect(result.current.entry.items).toEqual([{Id: 'cached-series'}]);
		await waitFor(() => expect(jellyfinService.getWatchlistSeriesInsights).toHaveBeenCalledWith('Completed', 30, 0));
		expect(jellyfinService.getWatchlistMovieHistory).not.toHaveBeenCalled();

		await act(async () => {
			completed.resolve(createPage());
			await completed.promise;
		});

		await waitFor(() => expect(jellyfinService.getWatchlistMovieHistory).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(jellyfinService.getWatchlistStatistics).toHaveBeenCalledTimes(1));
		expect(jellyfinService.getWatchlistSeriesInsights).not.toHaveBeenCalledWith('InProgress', 30, 0);
	});

	it('keeps stale content visible while refreshing it', async () => {
		const refresh = createDeferred();
		jellyfinService.getWatchlistSeriesInsights.mockImplementation((state) => (
			state === 'InProgress' ? refresh.promise : Promise.resolve(createPage())
		));

		const {result} = renderHook(() => useWatchlistInsights({
			activeTab: 'progress',
			cachedEntries: {
				progress: {
					items: [{Id: 'stale-series'}],
					cachedAt: Date.now() - 120000,
					hasMore: false,
					nextStartIndex: 1
				}
			},
			isActive: true
		}));

		await waitFor(() => expect(result.current.entry.refreshing).toBe(true));
		expect(result.current.entry.items).toEqual([{Id: 'stale-series'}]);

		await act(async () => {
			refresh.resolve(createPage([{Id: 'fresh-series'}]));
			await refresh.promise;
		});

		await waitFor(() => expect(result.current.entry.items).toEqual([{Id: 'fresh-series'}]));
		expect(result.current.entry.refreshing).toBe(false);
	});

	it('stops warming when the panel becomes inactive', async () => {
		const completed = createDeferred();
		jellyfinService.getWatchlistSeriesInsights.mockImplementation((state) => (
			state === 'Completed' ? completed.promise : Promise.resolve(createPage())
		));
		const {rerender} = renderHook(
			({isActive}) => useWatchlistInsights({activeTab: 'progress', isActive}),
			{initialProps: {isActive: true}}
		);

		await waitFor(() => expect(jellyfinService.getWatchlistSeriesInsights).toHaveBeenCalledWith('Completed', 30, 0));
		rerender({isActive: false});
		await act(async () => {
			completed.resolve(createPage());
			await completed.promise;
		});

		expect(jellyfinService.getWatchlistMovieHistory).not.toHaveBeenCalled();
		expect(jellyfinService.getWatchlistStatistics).not.toHaveBeenCalled();
	});

	it('clears cached insights and reloads the active tab after user-data invalidation', async () => {
		const {result} = renderHook(() => useWatchlistInsights({
			activeTab: 'progress',
			cachedEntries: {
				progress: {
					items: [{Id: 'cached-series'}],
					cachedAt: Date.now(),
					hasMore: false,
					nextStartIndex: 1
				}
			},
			isActive: true
		}));

		act(() => {
			window.dispatchEvent(new CustomEvent(BREEZYFIN_USER_DATA_INVALIDATED_EVENT));
		});

		await waitFor(() => (
			expect(jellyfinService.getWatchlistSeriesInsights).toHaveBeenCalledWith('InProgress', 30, 0)
		));
		await waitFor(() => expect(result.current.entry.loading).toBe(false));
		expect(result.current.entry.items).toEqual([]);
	});

	it('deduplicates rapid load-more requests and appended item IDs', async () => {
		const nextPage = createDeferred();
		jellyfinService.getWatchlistSeriesInsights.mockImplementation((state, limit, startIndex) => (
			state === 'InProgress' && startIndex === 30
				? nextPage.promise
				: Promise.resolve(createPage())
		));
		const {result} = renderHook(() => useWatchlistInsights({
			activeTab: 'progress',
			cachedEntries: {
				progress: {
					items: [{Id: 'series-1'}],
					cachedAt: Date.now(),
					hasMore: true,
					nextStartIndex: 30
				}
			},
			isActive: true
		}));

		act(() => {
			result.current.loadMore();
			result.current.loadMore();
		});

		expect(jellyfinService.getWatchlistSeriesInsights)
			.toHaveBeenCalledWith('InProgress', 30, 30);
		expect(jellyfinService.getWatchlistSeriesInsights.mock.calls.filter((call) => call[2] === 30))
			.toHaveLength(1);

		await act(async () => {
			nextPage.resolve({
				available: true,
				result: {
					items: [{Id: 'series-1'}, {Id: 'series-2'}],
					nextStartIndex: 60,
					hasMore: false
				}
			});
			await nextPage.promise;
		});

		await waitFor(() => expect(result.current.entry.items.map((item) => item.Id))
			.toEqual(['series-1', 'series-2']));
	});
});
