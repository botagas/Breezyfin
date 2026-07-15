import {
	buildGridQuerySignature,
	resolveGridFocusRestoreTarget,
	resolveGridScrollRestore,
	updateGridFocusRestoreCycle
} from '../gridScrollRestore';

describe('grid scroll restoration helpers', () => {
	it('builds stable signatures regardless of filter order', () => {
		expect(buildGridQuerySignature('latestMovies', ['favorite', 'unplayed']))
			.toBe(buildGridQuerySignature('latestMovies', ['unplayed', 'favorite']));
	});

	it('waits for additional pages when the target is beyond mounted content', () => {
		expect(resolveGridScrollRestore({
			targetTop: 1800,
			scrollHeight: 1200,
			clientHeight: 600,
			hasMore: true
		})).toEqual({
			targetTop: 1800,
			maxReachableTop: 600,
			needsMoreContent: true,
			shouldLoadMore: true,
			finalTop: 600
		});
	});

	it('restores the exact target once enough content is mounted', () => {
		expect(resolveGridScrollRestore({
			targetTop: 900,
			scrollHeight: 2200,
			clientHeight: 700,
			hasMore: true
		})).toMatchObject({
			needsMoreContent: false,
			shouldLoadMore: false,
			finalTop: 900
		});
	});

	it('clamps an unreachable target when the source is exhausted', () => {
		expect(resolveGridScrollRestore({
			targetTop: 2000,
			scrollHeight: 1400,
			clientHeight: 600,
			hasMore: false
		})).toMatchObject({
			shouldLoadMore: false,
			finalTop: 800
		});
	});

	it('captures focus restoration only when an active query cycle starts', () => {
		const initialCycle = updateGridFocusRestoreCycle(null, {
			isActive: true,
			queryKey: 'movies',
			restoreItemId: null
		});
		const paginationCycle = updateGridFocusRestoreCycle(initialCycle, {
			isActive: true,
			queryKey: 'movies',
			restoreItemId: 'old-first-focus'
		});

		expect(paginationCycle).toBe(initialCycle);
		expect(resolveGridFocusRestoreTarget({
			cycle: paginationCycle,
			items: [{Id: 'old-first-focus'}, {Id: 'new-page-item'}]
		})).toBeNull();
	});

	it('starts a new restore cycle after panel reactivation', () => {
		const activeCycle = updateGridFocusRestoreCycle(null, {
			isActive: true,
			queryKey: 'series'
		});
		const inactiveCycle = updateGridFocusRestoreCycle(activeCycle, {isActive: false});
		const restoredCycle = updateGridFocusRestoreCycle(inactiveCycle, {
			isActive: true,
			queryKey: 'series',
			restoreItemId: 'series-42'
		});

		expect(resolveGridFocusRestoreTarget({
			cycle: restoredCycle,
			items: [{Id: 'series-42'}]
		})).toBe('series-42');
	});
});
