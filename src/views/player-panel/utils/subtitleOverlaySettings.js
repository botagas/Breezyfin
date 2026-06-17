const SUBTITLE_SIZE_VALUES = new Set(['small', 'medium', 'large']);
const SUBTITLE_POSITION_VALUES = new Set(['low', 'standard', 'raised']);
const SUBTITLE_BACKGROUND_VALUES = new Set(['none', 'low', 'medium', 'high']);
const SUBTITLE_WEIGHT_VALUES = new Set(['regular', 'bold', 'black']);
const SUBTITLE_TEXT_COLOR_VALUES = new Set(['white', 'warmWhite', 'yellow', 'black']);
const SUBTITLE_BORDER_STYLE_VALUES = new Set(['none', 'shadow', 'outline', 'box']);
const SUBTITLE_BORDER_COLOR_VALUES = new Set(['black', 'white', 'yellow', 'accent']);
const SUBTITLE_BORDER_STRENGTH_VALUES = new Set(['low', 'medium', 'high']);

export const SUBTITLE_REGION_KEYS = ['top', 'middle', 'bottom'];
export const SUBTITLE_ALIGN_KEYS = ['left', 'center', 'right'];

const normalizeSubtitleSetting = (value, allowedValues, fallback) => {
	return allowedValues.has(value) ? value : fallback;
};

export const getSubtitleOverlayAttributes = (settings = {}, controlsVisible = false) => ({
	'data-size': normalizeSubtitleSetting(settings.subtitleOverlaySize, SUBTITLE_SIZE_VALUES, 'medium'),
	'data-position': normalizeSubtitleSetting(settings.subtitleOverlayPosition, SUBTITLE_POSITION_VALUES, 'standard'),
	'data-background': normalizeSubtitleSetting(settings.subtitleOverlayBackground, SUBTITLE_BACKGROUND_VALUES, 'medium'),
	'data-weight': normalizeSubtitleSetting(settings.subtitleOverlayWeight, SUBTITLE_WEIGHT_VALUES, 'bold'),
	'data-text-color': normalizeSubtitleSetting(settings.subtitleOverlayTextColor, SUBTITLE_TEXT_COLOR_VALUES, 'white'),
	'data-border-style': normalizeSubtitleSetting(settings.subtitleOverlayBorderStyle, SUBTITLE_BORDER_STYLE_VALUES, 'shadow'),
	'data-border-color': normalizeSubtitleSetting(settings.subtitleOverlayBorderColor, SUBTITLE_BORDER_COLOR_VALUES, 'black'),
	'data-border-strength': normalizeSubtitleSetting(settings.subtitleOverlayBorderStrength, SUBTITLE_BORDER_STRENGTH_VALUES, 'medium'),
	'data-controls-visible': controlsVisible ? 'true' : 'false'
});

export const groupSubtitleCuesByPlacement = (cues = []) => cues.reduce((groups, cue) => {
	const region = SUBTITLE_REGION_KEYS.includes(cue?.placement) ? cue.placement : 'bottom';
	const align = SUBTITLE_ALIGN_KEYS.includes(cue?.horizontalAlign) ? cue.horizontalAlign : 'center';
	groups[region][align].push(cue);
	return groups;
}, SUBTITLE_REGION_KEYS.reduce((groups, region) => ({
	...groups,
	[region]: SUBTITLE_ALIGN_KEYS.reduce((alignGroups, align) => ({
		...alignGroups,
		[align]: []
	}), {})
}), {}));
