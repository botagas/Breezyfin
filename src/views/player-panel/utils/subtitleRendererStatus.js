export const normalizeSubtitleRendererFailureReason = (reason, fallback = 'unsupported-payload') => {
	const normalizedReason = String(reason || '').trim();
	if (!normalizedReason) return fallback;
	if (normalizedReason === 'unsupported-subtitle-event-payload') return 'unsupported-payload';
	if (normalizedReason === 'subtitle-fetch-failed') return 'fetch-failed';
	return normalizedReason;
};

export const getSubtitleBurnInFallbackStatus = ({
	fallbackAllowed = false,
	fallbackAlreadyStarted = false,
	hasFallbackHandler = false
} = {}) => {
	if (!fallbackAllowed) return 'skipped-hdr-dv-preserve-range';
	if (fallbackAlreadyStarted) return 'burn-in-fallback-started';
	return hasFallbackHandler ? 'burn-in-fallback-started' : 'burn-in-fallback-pending';
};
