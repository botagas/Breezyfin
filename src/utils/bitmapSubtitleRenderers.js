export const BITMAP_SUBTITLE_RENDERERS = Object.freeze({
	AUTO: 'auto',
	LIBBITSUB: 'libbitsub',
	LIBPGS: 'libpgs',
	BURN_IN: 'burn-in'
});

export const ALL_BITMAP_SUBTITLE_RENDERER_VALUES = Object.freeze([
	BITMAP_SUBTITLE_RENDERERS.AUTO,
	BITMAP_SUBTITLE_RENDERERS.LIBBITSUB,
	BITMAP_SUBTITLE_RENDERERS.LIBPGS,
	BITMAP_SUBTITLE_RENDERERS.BURN_IN
]);

export const normalizeBitmapSubtitleRenderer = (value) => {
	const normalized = String(value || '').trim().toLowerCase();
	return ALL_BITMAP_SUBTITLE_RENDERER_VALUES.includes(normalized)
		? normalized
		: BITMAP_SUBTITLE_RENDERERS.AUTO;
};
