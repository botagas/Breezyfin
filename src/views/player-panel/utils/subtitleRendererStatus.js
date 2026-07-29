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
	hasFallbackHandler = false,
	requiresHdrConsent = false,
	requiresBitmapBurnInConsent = false,
	requiresNoSubtitleConsent = false
} = {}) => {
	if (requiresNoSubtitleConsent) return hasFallbackHandler ? 'no-subtitle-consent-pending' : 'failed';
	if (requiresBitmapBurnInConsent) return hasFallbackHandler ? 'burn-in-consent-pending' : 'failed';
	if (requiresHdrConsent) return hasFallbackHandler ? 'burn-in-consent-pending' : 'skipped-hdr-dv-preserve-range';
	if (!fallbackAllowed) return 'skipped-hdr-dv-preserve-range';
	if (fallbackAlreadyStarted) return 'burn-in-fallback-started';
	return hasFallbackHandler ? 'burn-in-fallback-started' : 'burn-in-fallback-pending';
};
