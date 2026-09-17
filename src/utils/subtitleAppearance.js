export const SUBTITLE_OVERLAY_FONT_SIZE_RANGE = {
	min: 20,
	max: 72,
	step: 2,
	defaultValue: 36
};

export const SUBTITLE_OVERLAY_SIZE_LEGACY_PX = {
	small: '29',
	medium: '36',
	large: '45'
};

export const SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE = {
	min: 1,
	max: 12,
	step: 1,
	defaultValue: 2
};

export const SUBTITLE_OVERLAY_OUTLINE_SIZE_LEGACY_PX = {
	thin: '1',
	medium: '2',
	thick: '3',
	extra: '4'
};

export const SUBTITLE_OVERLAY_OFFSET_Y_RANGE = {
	min: -200,
	max: 400,
	step: 10,
	defaultValue: 0
};

export const SUBTITLE_OVERLAY_OFFSET_X_RANGE = {
	min: -300,
	max: 300,
	step: 10,
	defaultValue: 0
};

export const SUBTITLE_OVERLAY_POSITION_LEGACY_OFFSET_Y_PX = {
	low: '-50',
	standard: '0',
	raised: '80'
};

export const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

export const normalizeNumericSetting = (value, range) => {
	const numberValue = Number(value);
	const fallbackValue = Number(range.defaultValue);
	if (!Number.isFinite(numberValue)) return String(fallbackValue);
	const roundedValue = Math.round(numberValue / range.step) * range.step;
	return String(clampNumber(roundedValue, range.min, range.max));
};

export const getNumericSettingLabel = (value, range, unit = 'px') => {
	return `${normalizeNumericSetting(value, range)}${unit}`;
};

export const getSignedNumericSettingLabel = (value, range, unit = 'px') => {
	const normalized = normalizeNumericSetting(value, range);
	return `${Number(normalized) > 0 ? '+' : ''}${normalized}${unit}`;
};

export const resolveSubtitleOffsetYPx = (settings = {}) => normalizeNumericSetting(
	settings.subtitleOverlayOffsetYPx ?? SUBTITLE_OVERLAY_POSITION_LEGACY_OFFSET_Y_PX[settings.subtitleOverlayPosition],
	SUBTITLE_OVERLAY_OFFSET_Y_RANGE
);

export const resolveSubtitleOffsetXPx = (settings = {}) => normalizeNumericSetting(
	settings.subtitleOverlayOffsetXPx,
	SUBTITLE_OVERLAY_OFFSET_X_RANGE
);

export const adjustNumericSetting = (value, range, direction) => {
	const currentValue = Number(normalizeNumericSetting(value, range));
	const step = direction === 'decrease' ? -range.step : range.step;
	return String(clampNumber(currentValue + step, range.min, range.max));
};
