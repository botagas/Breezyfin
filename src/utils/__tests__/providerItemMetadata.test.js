import {getProviderItemMetadata} from '../providerItemMetadata';

describe('provider item metadata', () => {
	it('normalizes summary, genres, and credits from provider-compatible fields', () => {
		expect(getProviderItemMetadata({
			Type: 'Movie',
			ProductionYear: 2026,
			CommunityRating: 8.24,
			Genres: ['Drama', {Name: 'Science Fiction'}],
			Directors: ['Director One'],
			People: [
				{Name: 'Director One', Type: 'Director'},
				{Name: 'Writer One', Type: 'Writer'},
				{Name: 'Writer Two', Role: 'Screenplay Writer'}
			]
		})).toEqual({
			summary: ['Movie', '2026'],
			rating: '8.2/10',
			genres: ['Drama', 'Science Fiction'],
			directors: ['Director One'],
			writers: ['Writer One', 'Writer Two']
		});
	});

	it('returns empty metadata for fields absent from compact discovery feeds', () => {
		expect(getProviderItemMetadata({Title: 'Provider item'})).toEqual({
			summary: [],
			rating: '',
			genres: [],
			directors: [],
			writers: []
		});
	});
});
