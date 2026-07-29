import {getPlayerBackdropCandidates} from '../playerPanelHelpers';

describe('playerPanelHelpers backdrop candidates', () => {
	const imageApi = {
		getBackdropUrl: (id) => `backdrop:${id}`,
		getImageUrl: (id, type) => `${type.toLowerCase()}:${id}`
	};

	it('orders episode artwork from series backdrop through item primary', () => {
		expect(getPlayerBackdropCandidates({
			Id: 'episode',
			SeriesId: 'series',
			Type: 'Episode'
		}, imageApi)).toEqual([
			'backdrop:series',
			'backdrop:episode',
			'primary:series',
			'primary:episode'
		]);
	});

	it('prefers an item backdrop before its primary image', () => {
		expect(getPlayerBackdropCandidates({
			Id: 'movie',
			Type: 'Movie',
			BackdropImageTags: ['tag']
		}, imageApi)).toEqual(['backdrop:movie', 'primary:movie']);
	});
});
