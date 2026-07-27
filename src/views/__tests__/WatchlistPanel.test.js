/* eslint-disable react/prop-types */
import {act, fireEvent, render, screen} from '@testing-library/react';
import jellyfinService from '../../services/jellyfinService';
import WatchlistPanel from '../WatchlistPanel';

let layoutProps = null;
let virtualListProps = null;
const freshInsightEntries = (overrides = {}) => ({
	progress: {items: [], cachedAt: Date.now(), hasMore: false, nextStartIndex: 0},
	completed: {items: [], cachedAt: Date.now(), hasMore: false, nextStartIndex: 0},
	movies: {items: [], cachedAt: Date.now(), hasMore: false, nextStartIndex: 0},
	statistics: {
		statistics: {
			SeriesStarted: 0,
			SeriesWatched: 0,
			EpisodesWatched: 0,
			MoviesWatched: 0,
			TopShows: [],
			TopMovies: []
		},
		cachedAt: Date.now()
	},
	...overrides
});

jest.mock('../../services/jellyfinService', () => ({
	getWatchlistSeriesInsights: jest.fn(),
	getWatchlistMovieHistory: jest.fn(),
	getWatchlistStatistics: jest.fn(),
	getLikesWatchlist: jest.fn(),
	markWatched: jest.fn(),
	getImageUrl: jest.fn((id) => `image:${id}`)
}));

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText({children, ...rest}) {
	return <div {...rest}>{children}</div>;
});

jest.mock('@enact/sandstone/VirtualList', () => ({
	VirtualList: function TestVirtualList(props) {
		virtualListProps = props;
		return (
			<div data-testid="watchlist-virtual-list">
				{props.dataSize > 0
					? props.itemRenderer({...props.childProps, index: 0, 'data-index': 0})
					: null}
			</div>
		);
	}
}));

jest.mock('@enact/spotlight/Spottable', () => () => function TestSpottable({children, ...rest}) {
	return <div tabIndex={-1} {...rest}>{children}</div>;
});

jest.mock('@enact/ui/resolution', () => ({
	__esModule: true,
	default: {scale: (value) => value}
}));

jest.mock('../../components/MediaRow', () => function TestMediaRow({title}) {
	return <div>{title}</div>;
});

jest.mock('../../components/PanelActionButton', () => function TestButton(props) {
	const forwardedProps = {...props};
	const children = forwardedProps.children;
	const spotlightId = forwardedProps.spotlightId;
	delete forwardedProps.children;
	delete forwardedProps.minWidth;
	delete forwardedProps.size;
	delete forwardedProps.spotlightId;
	return <button type="button" data-spotlight-id={spotlightId} {...forwardedProps}>{children}</button>;
});

jest.mock('../../components/IntegrationPanelLayout', () => function TestLayout(props) {
	layoutProps = props;
	return <div>{props.children}</div>;
});

jest.mock('../../components/PanelTabNavigation', () => function TestTabs() {
	return <div />;
});

jest.mock('../../components/PanelLandscapeVirtualGrid', () => function TestGrid() {
	return <div />;
});

jest.mock('../../hooks/usePanelScrollState', () => ({
	usePanelScrollState: () => ({
		captureScrollTo: jest.fn(),
		handleScrollStop: jest.fn()
	})
}));

jest.mock('../../hooks/usePanelToolbarActions', () => ({
	usePanelToolbarActions: () => ({})
}));

describe('WatchlistPanel advanced list layout', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		layoutProps = null;
		virtualListProps = null;
		jellyfinService.getWatchlistSeriesInsights.mockResolvedValue({
			available: true,
			result: {
				items: [{
					Id: 'series-1',
					Title: 'Example Series',
					WatchedEpisodeCount: 3,
					TotalEpisodeCount: 10,
					RemainingEpisodeCount: 7
				}],
				nextStartIndex: 1,
				hasMore: false
			}
		});
	});

	it('gives Sandstone VirtualList exclusive scroll ownership and opens its main row', async () => {
		const onItemSelect = jest.fn();
		render(
			<WatchlistPanel
				isActive
				cachedState={{
					activeTab: 'progress',
					insightEntries: freshInsightEntries({
						progress: {
							items: [{
								Id: 'series-1',
								Title: 'Example Series',
								WatchedEpisodeCount: 3,
								TotalEpisodeCount: 10,
								RemainingEpisodeCount: 7
							}],
							cachedAt: Date.now(),
							hasMore: false,
							nextStartIndex: 1
						}
					})
				}}
				onItemSelect={onItemSelect}
			/>
		);

		expect(await screen.findByTestId('watchlist-virtual-list')).toBeTruthy();

		expect(layoutProps.scrollable).toBe(false);
		expect(virtualListProps).toEqual(expect.objectContaining({
			id: 'watchlist-progress-list',
			spotlightId: 'watchlist-progress-list',
			itemSize: 320,
			snapToCenter: false
		}));
		expect(virtualListProps.overscrollEffectOn).toEqual({
			arrowKey: false,
			drag: false,
			pageKey: false,
			track: false,
			wheel: false
		});
		const row = screen.getByRole('button', {name: /Example Series/});
		fireEvent.click(row);
		expect(onItemSelect).toHaveBeenCalledWith(expect.objectContaining({Id: 'series-1'}));

		fireEvent.click(screen.getByRole('button', {name: 'View Unwatched'}));
		expect(onItemSelect).toHaveBeenCalledTimes(1);
	});

	it('keeps Statistics Scroller-owned and renders independent show and movie rankings', () => {
		const cachedAt = Date.now();
		render(
			<WatchlistPanel
				isActive
				cachedState={{
					activeTab: 'statistics',
					insightEntries: freshInsightEntries({
						statistics: {
							cachedAt,
							statistics: {
								SeriesStarted: 3,
								SeriesWatched: 1,
								EpisodesWatched: 24,
								MoviesWatched: 5,
								TopShows: [{Id: 'show-1', Title: 'A Long Show Title', WatchedEpisodeCount: 12}],
								TopMovies: [{Id: 'movie-1', Title: 'A Long Movie Title', PlayCount: 3}]
							}
						}
					})
				}}
				onItemSelect={jest.fn()}
			/>
		);

		expect(layoutProps.scrollable).toBe(true);
		expect(screen.getByText('Top 5 Shows')).toBeTruthy();
		expect(screen.getByText('12 episodes')).toBeTruthy();
		expect(screen.getByText('Top 5 Movies')).toBeTruthy();
		expect(screen.getByText('3 plays')).toBeTruthy();
	});

	it('deduplicates repeated Mark All Watched activation while the mutation is pending', async () => {
		let resolveMutation;
		jellyfinService.markWatched.mockReturnValue(new Promise((resolve) => {
			resolveMutation = resolve;
		}));
		render(
			<WatchlistPanel
				isActive
				cachedState={{
					activeTab: 'progress',
					insightEntries: freshInsightEntries({
						progress: {
							items: [{
								Id: 'series-1',
								Title: 'Example Series',
								WatchedEpisodeCount: 3,
								TotalEpisodeCount: 10,
								RemainingEpisodeCount: 7
							}],
							cachedAt: Date.now(),
							hasMore: false,
							nextStartIndex: 1
						}
					})
				}}
				onItemSelect={jest.fn()}
			/>
		);

		const button = screen.getByRole('button', {name: 'Mark All Watched'});
		fireEvent.click(button);
		fireEvent.click(button);
		expect(jellyfinService.markWatched).toHaveBeenCalledTimes(1);

		await act(async () => {
			resolveMutation();
			await Promise.resolve();
		});
	});
});
