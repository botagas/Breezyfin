import {toInteger} from '../../../utils/playbackSelection';

export const buildPlaybackDecisionSnapshot = ({
	activePayload,
	selectedSource,
	playMethod,
	initialRequestedAudioStreamIndex,
	requestedAudioStreamIndex,
	selectedSubtitleStreamIndex,
	clientRenderedSubtitleStreamIndex,
	dynamicRange,
	originalDynamicRange,
	dynamicRangeCap,
	forceTranscoding,
	disableDirectPlay,
	forceDolbyVision,
	avoidDolbyVision,
	enableFmp4HlsContainerPreference,
	forceFmp4HlsContainerPreference,
	forceSubtitleBurnIn,
	confirmedBitmapBurnIn,
	subtitleFallbackConsent,
	safeSubtitleBurnInProfile,
	safeSdrFallbackProfile,
	subtitlePolicy
} = {}) => ({
	playMethod: playMethod || null,
	selectedMediaSourceId: selectedSource?.Id || null,
	container: selectedSource?.Container || selectedSource?.TranscodingContainer || null,
	dynamicRangeId: dynamicRange?.id || null,
	dynamicRangeLabel: dynamicRange?.displayLabel || dynamicRange?.label || null,
	dynamicRangeCap: dynamicRangeCap || 'auto',
	requestedAudioStreamIndex: initialRequestedAudioStreamIndex,
	selectedAudioStreamIndex: requestedAudioStreamIndex,
	selectedSubtitleStreamIndex,
	clientRenderedSubtitleStreamIndex,
	forceTranscoding: forceTranscoding === true,
	disableDirectPlay: disableDirectPlay === true,
	forceDolbyVision: forceDolbyVision === true,
	avoidDolbyVision: avoidDolbyVision === true,
	forceSubtitleBurnIn: forceSubtitleBurnIn === true,
	confirmedBitmapBurnIn: confirmedBitmapBurnIn === true,
	subtitleFallbackConsent: subtitleFallbackConsent || null,
	safeSubtitleBurnInProfile: safeSubtitleBurnInProfile === true,
	safeSdrFallbackProfile: safeSdrFallbackProfile === true,
	subtitleDecision: subtitlePolicy?.reason || null,
	originalDynamicRangeId: originalDynamicRange?.id || dynamicRange?.id || null,
	fmp4HlsPreference: {
		enabled: enableFmp4HlsContainerPreference === true,
		forced: forceFmp4HlsContainerPreference === true
	},
	payload: {
		enableDirectPlay: activePayload?.EnableDirectPlay === true,
		enableDirectStream: activePayload?.EnableDirectStream === true,
		enableTranscoding: activePayload?.EnableTranscoding === true,
		allowVideoStreamCopy: activePayload?.AllowVideoStreamCopy === true,
		allowAudioStreamCopy: activePayload?.AllowAudioStreamCopy === true,
		audioStreamIndex: toInteger(activePayload?.AudioStreamIndex),
		subtitleStreamIndex: toInteger(activePayload?.SubtitleStreamIndex),
		alwaysBurnInSubtitleWhenTranscoding: activePayload?.AlwaysBurnInSubtitleWhenTranscoding === true,
		mediaSourceId: activePayload?.MediaSourceId || null
	}
});

export const attachPlaybackInfoMetadata = (data, {
	playMethod,
	selectedSource,
	selectedAudioStreamIndex,
	selectedSubtitleStreamIndex,
	clientRenderedSubtitleStreamIndex,
	adjustments,
	dynamicRange,
	dynamicRangeCap,
	subtitlePolicy,
	requestDebug,
	diagnostics = [],
	decision = null,
	safeSubtitleBurnInProfile = false,
	safeSdrFallbackProfile = false,
	requiredDecision = null
}) => {
	data.__breezyfin = {
		playMethod,
		selectedMediaSourceId: selectedSource?.Id || null,
		selectedAudioStreamIndex,
		selectedSubtitleStreamIndex,
		clientRenderedSubtitleStreamIndex,
		adjustments,
		dynamicRange,
		dynamicRangeCap,
		subtitlePolicy,
		requestDebug,
		diagnostics,
		decision,
		safeSubtitleBurnInProfile: safeSubtitleBurnInProfile === true,
		safeSdrFallbackProfile: safeSdrFallbackProfile === true,
		requiredDecision: requiredDecision || subtitlePolicy?.requiredDecision || null
	};
	return data;
};
