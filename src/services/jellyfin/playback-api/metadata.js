export const attachPlaybackInfoMetadata = (data, {
	playMethod,
	selectedSource,
	selectedAudioStreamIndex,
	adjustments,
	dynamicRange,
	dynamicRangeCap,
	subtitlePolicy,
	requestDebug
}) => {
	data.__breezyfin = {
		playMethod,
		selectedMediaSourceId: selectedSource?.Id || null,
		selectedAudioStreamIndex,
		adjustments,
		dynamicRange,
		dynamicRangeCap,
		subtitlePolicy,
		requestDebug
	};
	return data;
};
