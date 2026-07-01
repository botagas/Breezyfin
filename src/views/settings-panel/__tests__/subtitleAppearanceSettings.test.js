import {
	ASS_SUBTITLE_RENDERER_OPTIONS,
	ASS_SUBTITLE_RENDERER_STABLE_OPTIONS,
	DEFAULT_SETTINGS,
	SUBTITLE_OVERLAY_BACKGROUND_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS,
	SUBTITLE_OVERLAY_FONT_SIZE_RANGE,
	SUBTITLE_OVERLAY_OUTLINE_SIZE_OPTIONS,
	SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE,
	SUBTITLE_OVERLAY_SHADOW_ANGLE_OPTIONS,
	SUBTITLE_OVERLAY_SHADOW_DISTANCE_OPTIONS,
	SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_WEIGHT_OPTIONS,
	getAssSubtitleRendererOptions
} from '../constants';

describe('subtitle appearance settings', () => {
	it('uses readable defaults for the lightweight subtitle renderer', () => {
		expect(DEFAULT_SETTINGS.smartSubtitleTranscoding).toBe(true);
		expect(DEFAULT_SETTINGS.assSubtitleRenderer).toBe('auto');
		expect(DEFAULT_SETTINGS.subtitleOverlayFontSizePx).toBe('36');
		expect(DEFAULT_SETTINGS.subtitleOverlayWeight).toBe('bold');
		expect(DEFAULT_SETTINGS.subtitleOverlayTextColor).toBe('white');
		expect(DEFAULT_SETTINGS.subtitleOverlayBackground).toBe('none');
		expect(DEFAULT_SETTINGS.subtitleOverlayBorderStyle).toBe('outline');
		expect(DEFAULT_SETTINGS.subtitleOverlayBorderColor).toBe('black');
		expect(DEFAULT_SETTINGS.subtitleOverlayBorderStrength).toBe('medium');
		expect(DEFAULT_SETTINGS.subtitleOverlayOutlineSize).toBe('medium');
		expect(DEFAULT_SETTINGS.subtitleOverlayOutlineSizePx).toBe('2');
		expect(DEFAULT_SETTINGS.subtitleOverlayShadowDistance).toBe('medium');
		expect(DEFAULT_SETTINGS.subtitleOverlayShadowAngle).toBe('down');
	});

	it('exposes stable option labels for subtitle appearance controls', () => {
		expect(ASS_SUBTITLE_RENDERER_OPTIONS.map((option) => option.value))
			.toEqual(['auto', 'lightweight', 'libass', 'libass-manual', 'jassub', 'jassub-manual', 'assjs', 'burn-in']);
		expect(ASS_SUBTITLE_RENDERER_STABLE_OPTIONS.map((option) => option.value))
			.toEqual(['auto', 'lightweight', 'libass', 'libass-manual', 'jassub', 'jassub-manual', 'assjs', 'burn-in']);
		expect(getAssSubtitleRendererOptions(false).map((option) => option.value))
			.toEqual(['auto', 'lightweight', 'libass', 'libass-manual', 'jassub', 'jassub-manual', 'assjs', 'burn-in']);
		expect(getAssSubtitleRendererOptions(true).map((option) => option.value))
			.toEqual(['auto', 'lightweight', 'libass', 'libass-manual', 'jassub', 'jassub-manual', 'assjs', 'burn-in']);
		expect(SUBTITLE_OVERLAY_WEIGHT_OPTIONS).toEqual([
			{value: 'regular', label: 'Regular'},
			{value: 'bold', label: 'Bold (Default)'},
			{value: 'black', label: 'Black'}
		]);
		expect(SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS.map((option) => option.value))
			.toEqual(['white', 'warmWhite', 'yellow', 'black']);
		expect(SUBTITLE_OVERLAY_BACKGROUND_OPTIONS.map((option) => option.value))
			.toEqual(['none', 'low', 'medium', 'high']);
		expect(SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS.map((option) => option.value))
			.toEqual(['none', 'shadow', 'outline', 'box']);
		expect(SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS.map((option) => option.value))
			.toEqual(['black', 'white', 'yellow', 'accent']);
		expect(SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS.map((option) => option.value))
			.toEqual(['low', 'medium', 'high']);
		expect(SUBTITLE_OVERLAY_OUTLINE_SIZE_OPTIONS.map((option) => option.value))
			.toEqual(['thin', 'medium', 'thick', 'extra']);
		expect(SUBTITLE_OVERLAY_SHADOW_DISTANCE_OPTIONS.map((option) => option.value))
			.toEqual(['low', 'medium', 'high', 'extra']);
		expect(SUBTITLE_OVERLAY_SHADOW_ANGLE_OPTIONS.map((option) => option.value))
			.toEqual(['down', 'downRight', 'downLeft', 'upRight', 'upLeft']);
		expect(SUBTITLE_OVERLAY_FONT_SIZE_RANGE).toEqual({
			min: 20,
			max: 72,
			step: 2,
			defaultValue: 36
		});
		expect(SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE).toEqual({
			min: 1,
			max: 12,
			step: 1,
			defaultValue: 2
		});
	});
});
