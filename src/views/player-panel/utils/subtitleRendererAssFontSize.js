const DEFAULT_ASS_PLAY_RES_Y = 288;
const ASS_FONT_SIZE_OVERRIDE_PATTERN = /^([+-]?)([0-9]+(?:\.\d+)?)$/;

const normalizePlayResY = (value) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : DEFAULT_ASS_PLAY_RES_Y;
};

export const buildAssSourceFontSize = (fontSize, playResY) => {
	const size = Number(fontSize);
	if (!Number.isFinite(size) || size <= 0) return null;
	const resolvedPlayResY = normalizePlayResY(playResY);
	return {
		size,
		playResY: resolvedPlayResY,
		fontSizeVh: (size / resolvedPlayResY) * 100
	};
};

export const buildAssFontSizeOverride = (value, playResY, currentFontSize = null) => {
	const match = String(value ?? '').trim().match(ASS_FONT_SIZE_OVERRIDE_PATTERN);
	if (!match) return null;
	const [, sign, rawSize] = match;
	const size = Number(rawSize);
	if (!Number.isFinite(size) || size <= 0) return null;
	if (!sign) return buildAssSourceFontSize(size, playResY);
	const currentSize = Number(currentFontSize);
	if (!Number.isFinite(currentSize) || currentSize <= 0) return null;
	const resolvedSize = sign === '-' ? currentSize - size : currentSize + size;
	return buildAssSourceFontSize(Math.max(1, resolvedSize), playResY);
};
