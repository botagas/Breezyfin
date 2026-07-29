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

export const createNativePlaybackSourceToken = ({
	runtimeContext,
	video,
	sourceUrl,
	engine = 'native'
}) => Object.freeze({
	generation: runtimeContext?.generation,
	itemId: runtimeContext?.itemId || '',
	mediaSourceId: runtimeContext?.mediaSourceId || '',
	playMethod: runtimeContext?.playMethod || '',
	runtimeContext,
	video,
	sourceUrl: String(sourceUrl || ''),
	engine
});

export const isNativePlaybackSourceTokenCurrent = ({
	sourceToken,
	activeSourceToken,
	activeRuntimeContext,
	generation,
	eventTarget = null,
	exitInProgress = false
}) => Boolean(
	sourceToken &&
	sourceToken === activeSourceToken &&
	sourceToken.runtimeContext === activeRuntimeContext &&
	sourceToken.generation === generation &&
	sourceToken.video &&
	(!eventTarget || eventTarget === sourceToken.video) &&
	exitInProgress !== true
);
