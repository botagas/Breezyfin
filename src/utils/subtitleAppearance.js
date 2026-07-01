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

export const adjustNumericSetting = (value, range, direction) => {
	const currentValue = Number(normalizeNumericSetting(value, range));
	const step = direction === 'decrease' ? -range.step : range.step;
	return String(clampNumber(currentValue + step, range.min, range.max));
};
