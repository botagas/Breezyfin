import {
	DEFAULT_SETTINGS,
	SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS,
	SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_WEIGHT_OPTIONS
} from '../constants';

describe('subtitle appearance settings', () => {
	it('uses readable defaults for the lightweight subtitle renderer', () => {
		expect(DEFAULT_SETTINGS.subtitleOverlayWeight).toBe('bold');
		expect(DEFAULT_SETTINGS.subtitleOverlayTextColor).toBe('white');
		expect(DEFAULT_SETTINGS.subtitleOverlayBorderStyle).toBe('shadow');
		expect(DEFAULT_SETTINGS.subtitleOverlayBorderColor).toBe('black');
		expect(DEFAULT_SETTINGS.subtitleOverlayBorderStrength).toBe('medium');
	});

	it('exposes stable option labels for subtitle appearance controls', () => {
		expect(SUBTITLE_OVERLAY_WEIGHT_OPTIONS).toEqual([
			{value: 'regular', label: 'Regular'},
			{value: 'bold', label: 'Bold (Default)'},
			{value: 'black', label: 'Black'}
		]);
		expect(SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS.map((option) => option.value))
			.toEqual(['white', 'warmWhite', 'yellow', 'black']);
		expect(SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS.map((option) => option.value))
			.toEqual(['none', 'shadow', 'outline', 'box']);
		expect(SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS.map((option) => option.value))
			.toEqual(['black', 'white', 'yellow', 'accent']);
		expect(SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS.map((option) => option.value))
			.toEqual(['low', 'medium', 'high']);
	});
});
