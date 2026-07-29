export const createPlaybackRuntimeContext = ({
	generation,
	itemId,
	mediaSourceData,
	playMethod,
	dynamicRange,
	subtitlePolicy,
	selectedAudioTrack,
	selectedSubtitleTrack,
	playbackOptions
}) => Object.freeze({
	generation,
	itemId: String(itemId || ''),
	mediaSourceId: String(mediaSourceData?.Id || ''),
	mediaSourceData: Object.freeze({...mediaSourceData}),
	playMethod: String(playMethod || ''),
	dynamicRange: dynamicRange || null,
	subtitlePolicy: subtitlePolicy || null,
	selectedAudioTrack,
	selectedSubtitleTrack,
	playbackOptions: Object.freeze({...playbackOptions})
});

export const isPlaybackRuntimeContextCurrent = ({
	runtimeContext,
	activeRuntimeContext,
	hls,
	activeHls,
	generation,
	exitInProgress
}) => Boolean(
	runtimeContext &&
	runtimeContext === activeRuntimeContext &&
	(!hls || hls === activeHls) &&
	runtimeContext.generation === generation &&
	exitInProgress !== true
);
