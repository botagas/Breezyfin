import {
	normalizeSearchPage,
	resolveSearchPageProgress,
	shouldLoadMoreSearchResults
} from '../searchPagination';

describe('search pagination helpers', () => {
	it('uses exact total counts to stop after the final partial page', () => {
		expect(resolveSearchPageProgress({
			page: {
				items: [{Id: '31'}],
				startIndex: 30,
				totalRecordCount: 31
			},
			existingItems: Array.from({length: 30}, (_, index) => ({Id: String(index + 1)})),
			pageSize: 30
		})).toMatchObject({
			nextStartIndex: 31,
			hasMore: false,
			madeProgress: true
		});
	});

	it('stops when a full server page adds no unique results', () => {
		const repeated = Array.from({length: 30}, (_, index) => ({Id: String(index + 1)}));
		expect(resolveSearchPageProgress({
			page: {items: repeated, startIndex: 30, totalRecordCount: null},
			existingItems: repeated,
			pageSize: 30
		})).toMatchObject({
			uniqueItems: [],
			hasMore: false,
			madeProgress: false
		});
	});

	it('keeps legacy array responses compatible without inventing a total count', () => {
		expect(normalizeSearchPage([{Id: '1'}], 60)).toEqual({
			items: [{Id: '1'}],
			startIndex: 60,
			totalRecordCount: null
		});
	});

	it('advances legacy array pages from the requested server cursor', () => {
		expect(resolveSearchPageProgress({
			page: [{Id: '31'}, {Id: '32'}],
			fallbackStartIndex: 30,
			pageSize: 2
		})).toMatchObject({
			startIndex: 30,
			nextStartIndex: 32,
			hasMore: true
		});
	});

	it('requests another page when the virtual grid reaches its prefetch range', () => {
		expect(shouldLoadMoreSearchResults({
			lastVisibleIndex: 17,
			resultCount: 30,
			threshold: 12
		})).toBe(true);
		expect(shouldLoadMoreSearchResults({
			lastVisibleIndex: 16,
			resultCount: 30,
			threshold: 12
		})).toBe(false);
	});

	it('does not request another page for invalid or empty virtual-grid ranges', () => {
		expect(shouldLoadMoreSearchResults({lastVisibleIndex: null, resultCount: 30})).toBe(false);
		expect(shouldLoadMoreSearchResults({lastVisibleIndex: 0, resultCount: 0})).toBe(false);
	});
});
