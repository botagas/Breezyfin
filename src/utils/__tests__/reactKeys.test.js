import {buildMediaListItemKey} from '../reactKeys';

describe('react key utilities', () => {
	it('keeps duplicate Jellyfin item ids unique by including list index', () => {
		const item = {Id: 'same-id'};

		expect(buildMediaListItemKey('home-row-recent', item, 0)).toBe('home-row-recent-same-id-0');
		expect(buildMediaListItemKey('home-row-recent', item, 1)).toBe('home-row-recent-same-id-1');
	});

	it('falls back safely when scope or item id are missing', () => {
		expect(buildMediaListItemKey('', {}, 3)).toBe('media-missing-3');
		expect(buildMediaListItemKey('library', null, 'bad')).toBe('library-missing-0');
	});
});
