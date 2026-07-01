export const DEFAULT_ASS_PLAY_RES_X = 384;
export const DEFAULT_ASS_PLAY_RES_Y = 288;

export const normalizeAssPlayResValue = (value, fallback = DEFAULT_ASS_PLAY_RES_Y) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
};

export const buildAssScaledValue = (value, playResY = DEFAULT_ASS_PLAY_RES_Y) => {
	const size = Number(value);
	if (!Number.isFinite(size) || size < 0) return null;
	const resolvedPlayResY = normalizeAssPlayResValue(playResY, DEFAULT_ASS_PLAY_RES_Y);
	return {
		size,
		playResY: resolvedPlayResY,
		valueVh: (size / resolvedPlayResY) * 100
	};
};
