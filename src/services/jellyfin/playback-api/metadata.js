export const attachPlaybackInfoMetadata = (data, {
	playMethod,
	selectedSource,
	selectedAudioStreamIndex,
	adjustments,
	dynamicRange,
	dynamicRangeCap,
	subtitlePolicy,
	requestDebug,
	diagnostics = [],
	decision = null
}) => {
	data.__breezyfin = {
		playMethod,
		selectedMediaSourceId: selectedSource?.Id || null,
		selectedAudioStreamIndex,
		adjustments,
		dynamicRange,
		dynamicRangeCap,
		subtitlePolicy,
		requestDebug,
		diagnostics,
		decision
	};
	return data;
};
