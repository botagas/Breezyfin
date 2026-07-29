import {getBrowseControlNavigationTarget, getBrowseSearchEventValue} from '../browseSearch';

describe('getBrowseSearchEventValue', () => {
	it('reads Sandstone and native input event values', () => {
		expect(getBrowseSearchEventValue({value: 'Favorite movie'})).toBe('Favorite movie');
		expect(getBrowseSearchEventValue({target: {value: 'Favorite series'}})).toBe('Favorite series');
	});

	it('normalizes missing values', () => {
		expect(getBrowseSearchEventValue(null)).toBe('');
	});
});

describe('getBrowseControlNavigationTarget', () => {
	it('routes between Search and Filter controls', () => {
		expect(getBrowseControlNavigationTarget({
			keyCode: 37,
			source: 'filter',
			searchVisible: true,
			searchSpotlightId: 'search',
			filterSpotlightId: 'filter'
		})).toBe('search');
		expect(getBrowseControlNavigationTarget({
			keyCode: 39,
			source: 'search',
			searchVisible: true,
			searchSpotlightId: 'search',
			filterSpotlightId: 'filter'
		})).toBe('filter');
	});

	it('does not reroute Filter when Search is unavailable', () => {
		expect(getBrowseControlNavigationTarget({
			keyCode: 37,
			source: 'filter',
			searchVisible: false,
			searchSpotlightId: 'search'
		})).toBe('');
	});
});
