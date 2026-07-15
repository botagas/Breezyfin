export const POSTER_MEDIA_CARD_VARIANTS = Object.freeze({
	POSTER_GRID: 'poster-grid',
	LANDSCAPE_GRID: 'landscape-grid'
});

export const normalizePosterMediaCardVariant = (variant) => (
	variant === POSTER_MEDIA_CARD_VARIANTS.LANDSCAPE_GRID
		? POSTER_MEDIA_CARD_VARIANTS.LANDSCAPE_GRID
		: POSTER_MEDIA_CARD_VARIANTS.POSTER_GRID
);
