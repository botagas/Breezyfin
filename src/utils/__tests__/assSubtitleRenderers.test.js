import {
	ASS_SUBTITLE_RENDERERS,
	ALL_ASS_SUBTITLE_RENDERER_VALUES,
	EXPERIMENTAL_ASS_SUBTITLE_RENDERER_VALUES,
	STABLE_ASS_SUBTITLE_RENDERER_VALUES,
	normalizeAssSubtitleRenderer
} from '../assSubtitleRenderers';

describe('ASS subtitle renderer utilities', () => {
	it('exposes every renderer value in stable builds while preserving experimental grouping metadata', () => {
		const allRendererValues = Object.values(ASS_SUBTITLE_RENDERERS);
		const nonExperimentalRendererValues = new Set([
			ASS_SUBTITLE_RENDERERS.AUTO,
			ASS_SUBTITLE_RENDERERS.LIGHTWEIGHT,
			ASS_SUBTITLE_RENDERERS.BURN_IN
		]);

		expect(STABLE_ASS_SUBTITLE_RENDERER_VALUES).toEqual(allRendererValues);
		expect(EXPERIMENTAL_ASS_SUBTITLE_RENDERER_VALUES).toEqual(
			allRendererValues.filter((value) => !nonExperimentalRendererValues.has(value))
		);
		expect(ALL_ASS_SUBTITLE_RENDERER_VALUES).toEqual(allRendererValues);
	});

	it('normalizes every known renderer value in every release channel', () => {
		expect(normalizeAssSubtitleRenderer('jassub')).toBe(ASS_SUBTITLE_RENDERERS.JASSUB);
		expect(normalizeAssSubtitleRenderer('jassub-manual')).toBe(ASS_SUBTITLE_RENDERERS.JASSUB_MANUAL);
		expect(normalizeAssSubtitleRenderer('libass-manual')).toBe(ASS_SUBTITLE_RENDERERS.LIBASS_MANUAL);
		expect(normalizeAssSubtitleRenderer('assjs')).toBe(ASS_SUBTITLE_RENDERERS.ASSJS);
		expect(normalizeAssSubtitleRenderer('burn-in')).toBe(ASS_SUBTITLE_RENDERERS.BURN_IN);
		expect(normalizeAssSubtitleRenderer('missing')).toBe(ASS_SUBTITLE_RENDERERS.AUTO);
	});
});
