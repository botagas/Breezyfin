import {
	collectFilteredHomeSectionPage,
	normalizeHomeSectionPage
} from '../homeSectionPaging';

describe('homeSectionPaging', () => {
	it('normalizes plugin page envelopes without losing their cursor', () => {
		expect(normalizeHomeSectionPage({
			items: [{Id: 'item-30'}],
			nextStartIndex: 46,
			hasMore: true
		}, {
			startIndex: 30,
			requestedLimit: 30
		})).toEqual({
			items: [{Id: 'item-30'}],
			nextStartIndex: 46,
			hasMore: true,
			madeProgress: true
		});
	});

	it('continues through plugin pages until unplayed My Requests are found', async () => {
		const fetchPage = jest.fn()
			.mockResolvedValueOnce({
				items: [
					{Id: 'played-1', UserData: {Played: true}},
					{Id: 'played-2', UserData: {Played: true}}
				],
				nextStartIndex: 2,
				hasMore: true
			})
			.mockResolvedValueOnce({
				items: [
					{Id: 'unplayed-1', UserData: {Played: false}},
					{Id: 'unplayed-2', UserData: {UnplayedItemCount: 3}}
				],
				nextStartIndex: 4,
				hasMore: false
			});

		const result = await collectFilteredHomeSectionPage({
			fetchPage,
			matchesItem: (item) => item.UserData?.Played !== true,
			startIndex: 0,
			pageSize: 2,
			scanLimit: 6
		});

		expect(fetchPage).toHaveBeenNthCalledWith(1, {startIndex: 0, limit: 2});
		expect(fetchPage).toHaveBeenNthCalledWith(2, {startIndex: 2, limit: 2});
		expect(result).toEqual({
			items: [
				{Id: 'unplayed-1', UserData: {Played: false}},
				{Id: 'unplayed-2', UserData: {UnplayedItemCount: 3}}
			],
			nextStartIndex: 4,
			hasMore: false
		});
	});

	it('preserves continuation after the bounded filtered scan window', async () => {
		const fetchPage = jest.fn(({startIndex}) => Promise.resolve({
			items: [{Id: `played-${startIndex}`, UserData: {Played: true}}],
			nextStartIndex: startIndex + 1,
			hasMore: true
		}));

		const result = await collectFilteredHomeSectionPage({
			fetchPage,
			matchesItem: () => false,
			startIndex: 30,
			pageSize: 2,
			scanLimit: 2
		});

		expect(fetchPage).toHaveBeenCalledTimes(2);
		expect(result).toEqual({
			items: [],
			nextStartIndex: 32,
			hasMore: true
		});
	});

	it('stops stale filtered requests before their results can append', async () => {
		const result = await collectFilteredHomeSectionPage({
			fetchPage: jest.fn().mockResolvedValue({
				items: [{Id: 'stale-item'}],
				nextStartIndex: 1,
				hasMore: true
			}),
			isStale: () => true
		});

		expect(result).toEqual({
			items: [],
			nextStartIndex: 0,
			hasMore: false,
			stale: true
		});
	});
});
