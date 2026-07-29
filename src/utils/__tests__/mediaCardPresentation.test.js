import {getEpisodeContextBadge, getMediaCardPresentation} from '../mediaCardPresentation';

describe('mediaCardPresentation', () => {
	it('keeps episode title, series context, and season/episode badge separate', () => {
		const item = {
			Type: 'Episode',
			Name: 'A Very Long Episode Title',
			SeriesName: 'Example Series',
			ParentIndexNumber: 2,
			IndexNumber: 7
		};
		expect(getEpisodeContextBadge(item)).toBe('S02E07');
		expect(getMediaCardPresentation(item)).toEqual({
			title: 'A Very Long Episode Title',
			subtitle: 'Example Series',
			contextBadge: 'S02E07',
			ariaLabel: 'Example Series - S02E07 - A Very Long Episode Title'
		});
	});

	it('keeps non-episode presentation free of context badges', () => {
		expect(getMediaCardPresentation({Type: 'Movie', Name: 'Movie', ProductionYear: 2026})).toEqual({
			title: 'Movie',
			subtitle: '2026',
			contextBadge: '',
			ariaLabel: 'Movie - 2026'
		});
	});

	it('uses the parent series as context for season results', () => {
		expect(getMediaCardPresentation({
			Type: 'Season',
			Name: 'Season 1',
			SeriesName: 'Example Series',
			IndexNumber: 1
		})).toEqual({
			title: 'Season 1',
			subtitle: 'Example Series',
			contextBadge: '',
			ariaLabel: 'Example Series - Season 1'
		});
	});
});
