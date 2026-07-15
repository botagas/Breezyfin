import {
	ALL_BITMAP_SUBTITLE_RENDERER_VALUES,
	BITMAP_SUBTITLE_RENDERERS,
	normalizeBitmapSubtitleRenderer
} from '../bitmapSubtitleRenderers';

describe('bitmapSubtitleRenderers', () => {
	it('defines the stable renderer values', () => {
		expect(ALL_BITMAP_SUBTITLE_RENDERER_VALUES).toEqual([
			'auto',
			'libbitsub',
			'libpgs',
			'burn-in'
		]);
	});

	it('normalizes persisted renderer values safely', () => {
		expect(normalizeBitmapSubtitleRenderer(BITMAP_SUBTITLE_RENDERERS.LIBBITSUB)).toBe('libbitsub');
		expect(normalizeBitmapSubtitleRenderer(' LIBPGS ')).toBe('libpgs');
		expect(normalizeBitmapSubtitleRenderer('missing-renderer')).toBe('auto');
		expect(normalizeBitmapSubtitleRenderer(null)).toBe('auto');
	});
});
