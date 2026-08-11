export const createPlaybackRuntimeContext = ({
	generation,
	itemId,
	mediaSourceData,
	playMethod,
	dynamicRange,
	subtitlePolicy,
	selectedAudioTrack,
	selectedSubtitleTrack,
	playbackOptions,
	audioTransition = null,
	requiresInitialNativeAudioSelection = false
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
	playbackOptions: Object.freeze({...playbackOptions}),
	audioTransition: audioTransition ? Object.freeze({...audioTransition}) : null,
	requiresInitialNativeAudioSelection: requiresInitialNativeAudioSelection === true
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
	engine = 'native',
	sourceGeneration = runtimeContext?.generation,
	serverBurnIn = false,
	attachedAtEpochMs = Date.now(),
	attachedAtEventTime = (
		typeof performance !== 'undefined' &&
		typeof performance.now === 'function'
	) ? performance.now() : 0
}) => Object.freeze({
	generation: runtimeContext?.generation,
	sourceGeneration,
	itemId: runtimeContext?.itemId || '',
	mediaSourceId: runtimeContext?.mediaSourceId || '',
	playMethod: runtimeContext?.playMethod || '',
	runtimeContext,
	video,
	sourceUrl: String(sourceUrl || ''),
	engine,
	serverBurnIn: serverBurnIn === true,
	attachedAtEpochMs,
	attachedAtEventTime
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

const isEventAfterSourceAttachment = (event, sourceToken) => {
	const eventTime = Number(event?.timeStamp);
	if (!(eventTime > 0)) return true;
	const attachedAt = eventTime >= 1e12
		? Number(sourceToken?.attachedAtEpochMs)
		: Number(sourceToken?.attachedAtEventTime);
	return !Number.isFinite(attachedAt) || eventTime >= attachedAt;
};

export const isPlaybackSourceMediaEventCurrent = ({
	event,
	sourceToken,
	activeSourceToken,
	activeRuntimeContext,
	generation,
	exitInProgress = false
}) => (
	isNativePlaybackSourceTokenCurrent({
		sourceToken,
		activeSourceToken,
		activeRuntimeContext,
		generation,
		eventTarget: event?.currentTarget || event?.target || null,
		exitInProgress
	}) &&
	isEventAfterSourceAttachment(event, sourceToken) &&
	!(sourceToken?.engine === 'hls.js' && event?.type === 'error')
);
