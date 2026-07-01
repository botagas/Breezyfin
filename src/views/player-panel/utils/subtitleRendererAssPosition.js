const DEFAULT_ASS_PLAY_RES_X = 384;
const DEFAULT_ASS_PLAY_RES_Y = 288;

const normalizeAssPlayResValue = (value, fallback) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
};

export const buildAssPositionFromCoordinates = (x, y, playResX, playResY) => {
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	const resolvedPlayResX = normalizeAssPlayResValue(playResX, DEFAULT_ASS_PLAY_RES_X);
	const resolvedPlayResY = normalizeAssPlayResValue(playResY, DEFAULT_ASS_PLAY_RES_Y);
	return {
		x,
		y,
		playResX: resolvedPlayResX,
		playResY: resolvedPlayResY,
		xPercent: (x / resolvedPlayResX) * 100,
		yPercent: (y / resolvedPlayResY) * 100
	};
};
