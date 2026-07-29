const REFRESH_60_INTERVAL_MS = 1000 / 60;
const REFRESH_30_INTERVAL_MS = 1000 / 30;

export const getFrameCadence = (frameDeltas = []) => {
	const samples = frameDeltas
		.filter((value) => Number.isFinite(value) && value > 0 && value < 100)
		.sort((left, right) => left - right);
	if (samples.length === 0) return {hz: 60, intervalMs: REFRESH_60_INTERVAL_MS};
	const median = samples[Math.floor(samples.length / 2)];
	return median < 25
		? {hz: 60, intervalMs: REFRESH_60_INTERVAL_MS}
		: {hz: 30, intervalMs: REFRESH_30_INTERVAL_MS};
};

export const getDroppedFrameEstimate = (deltaMs, intervalMs) => {
	if (!Number.isFinite(deltaMs) || !Number.isFinite(intervalMs) || intervalMs <= 0) return 0;
	return Math.max(0, Math.round(deltaMs / intervalMs) - 1);
};
