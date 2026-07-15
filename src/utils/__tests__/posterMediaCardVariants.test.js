import {
	POSTER_MEDIA_CARD_VARIANTS,
	normalizePosterMediaCardVariant
} from '../posterMediaCardVariants';

describe('PosterMediaCard variants', () => {
	it('defaults unknown values to the poster grid skin', () => {
		expect(normalizePosterMediaCardVariant()).toBe(POSTER_MEDIA_CARD_VARIANTS.POSTER_GRID);
		expect(normalizePosterMediaCardVariant('unknown')).toBe(POSTER_MEDIA_CARD_VARIANTS.POSTER_GRID);
	});

	it('keeps the explicit landscape grid skin', () => {
		expect(normalizePosterMediaCardVariant('landscape-grid')).toBe(
			POSTER_MEDIA_CARD_VARIANTS.LANDSCAPE_GRID
		);
	});
});
