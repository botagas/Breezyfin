import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {
	getDynamicRangeDisplayLabel,
	getDynamicRangeInfo
} from '../../../utils/playbackDynamicRange';
import {
	buildMediaSourceDebugData,
	resolveInitialTrackSelection,
	resolveDefaultAudioStreamIndex,
	resolvePlaybackVideoUrl
} from './playerVideoLoaderHelpers';

export const PLAYBACK_PLAN_VERSION = 1;

const HDR_DYNAMIC_RANGE_IDS = new Set(['DV', 'HDR10', 'HDR10_PLUS', 'HLG']);

const isObject = (value) => value !== null && typeof value === 'object';

const cloneImmutable = (value, seen = new WeakMap()) => {
	if (typeof value === 'function') {
		throw new TypeError('PlaybackPlan cannot contain callbacks');
	}
	if (!isObject(value)) return value;
	if (seen.has(value)) return seen.get(value);

	const clone = Array.isArray(value) ? [] : {};
	seen.set(value, clone);
	Object.keys(value).forEach((key) => {
		clone[key] = cloneImmutable(value[key], seen);
	});
	return Object.freeze(clone);
};

const getDefaultAudioIndex = (audioStreams, requestedAudio, defaultAudio) => (
	Number.isInteger(requestedAudio)
		? requestedAudio
		: (Number.isInteger(defaultAudio?.Index)
			? defaultAudio.Index
			: (Number.isInteger(audioStreams[0]?.Index) ? audioStreams[0].Index : null))
);

const getDefaultSubtitleIndex = (subtitleStreams, requestedSubtitle, defaultSubtitle) => {
	if (requestedSubtitle === -1 || Number.isInteger(requestedSubtitle)) return requestedSubtitle;
	return Number.isInteger(defaultSubtitle?.Index)
		? defaultSubtitle.Index
		: (Number.isInteger(subtitleStreams[0]?.Index) ? subtitleStreams[0].Index : -1);
};

const defaultPickPreferredAudio = (audioStreams, requestedAudio, defaultAudio) => (
	getDefaultAudioIndex(audioStreams, requestedAudio, defaultAudio)
);

const defaultPickPreferredSubtitle = (subtitleStreams, requestedSubtitle, defaultSubtitle) => (
	getDefaultSubtitleIndex(subtitleStreams, requestedSubtitle, defaultSubtitle)
);

const getDurationSeconds = (mediaSource, item) => {
	const runtimeTicks = mediaSource?.RunTimeTicks || item?.RunTimeTicks;
	const durationSeconds = Number(runtimeTicks) / JELLYFIN_TICKS_PER_SECOND;
	return Number.isFinite(durationSeconds) ? durationSeconds : null;
};

const getPlaybackMetadata = (playbackInfo) => (
	playbackInfo && isObject(playbackInfo.__breezyfin) ? playbackInfo.__breezyfin : {}
);

const getResumeTicks = (playbackOptions, requiredDecision) => {
	if (Number.isFinite(Number(requiredDecision?.resumeTicks))) {
		return Math.max(0, Number(requiredDecision.resumeTicks));
	}
	if (Number.isFinite(Number(playbackOptions?.startTimeTicks))) {
		return Math.max(0, Number(playbackOptions.startTimeTicks));
	}
	return Math.round(Math.max(0, Number(playbackOptions?.seekSeconds) || 0) * 10000000);
};

const getSourceBurnInState = (subtitlePolicy, videoUrl) => (
	subtitlePolicy?.forceBurnIn === true ||
	subtitlePolicy?.requiresBurnIn === true ||
	/[?&]subtitlemethod=encode(?:&|$)/i.test(videoUrl)
);

export const isPlaybackPlan = (value) => Boolean(
	value &&
	value.version === PLAYBACK_PLAN_VERSION &&
	value.kind === 'PlaybackPlan'
);

export const buildPlaybackPlan = ({
	item = null,
	itemId = item?.Id,
	playbackInfo,
	playbackSettingsSnapshot = {},
	playbackOptions = {},
	playbackOverride = null,
	service,
	pickPreferredAudio = defaultPickPreferredAudio,
	pickPreferredSubtitle = defaultPickPreferredSubtitle
} = {}) => {
	const mediaSource = playbackInfo?.MediaSources?.[0] || null;
	if (!mediaSource) {
		throw new Error('No media source available');
	}
	const settingsSnapshot = playbackSettingsSnapshot || {};
	const options = playbackOptions || {};

	const playbackMetadata = getPlaybackMetadata(playbackInfo);
	const resolvedPlayMethod = playbackMetadata.playMethod || (
		mediaSource.TranscodingUrl
			? 'Transcode'
			: (mediaSource.SupportsDirectPlay ? 'DirectPlay' : 'DirectStream')
	);
	const requestedDynamicRangeCap = playbackMetadata.dynamicRangeCap ||
		settingsSnapshot.dynamicRangeCap || 'auto';
	const dynamicRangeInfo = playbackMetadata.dynamicRange || getDynamicRangeInfo(mediaSource);
	const dynamicRangeLabel = playbackMetadata.dynamicRange?.displayLabel ||
		getDynamicRangeDisplayLabel(dynamicRangeInfo, requestedDynamicRangeCap);
	const videoStream = mediaSource.MediaStreams?.find((stream) => stream.Type === 'Video') || null;
	const audioStreams = mediaSource.MediaStreams?.filter((stream) => stream.Type === 'Audio') || [];
	const subtitleStreams = mediaSource.MediaStreams?.filter((stream) => stream.Type === 'Subtitle') || [];
	const selectedTracks = resolveInitialTrackSelection({
		audioStreams,
		subtitleStreams,
		playbackOptions: options,
		playbackOverride,
		negotiatedAudioStreamIndex: playbackMetadata.selectedAudioStreamIndex,
		negotiatedSubtitleStreamIndex: playbackMetadata.selectedSubtitleStreamIndex,
		clientRenderedSubtitleStreamIndex: playbackMetadata.clientRenderedSubtitleStreamIndex,
		pickPreferredAudio,
		pickPreferredSubtitle
	});
	const sourceUrl = resolvePlaybackVideoUrl({
		service,
		itemId: itemId || item?.Id,
		mediaSource,
		playbackInfo,
		resolvedPlayMethod
	});
	const subtitlePolicy = playbackMetadata.subtitlePolicy || null;
	const requiredDecision = playbackMetadata.requiredDecision || subtitlePolicy?.requiredDecision || null;
	const runtimeMediaSourceData = buildMediaSourceDebugData({
		mediaSource,
		playbackInfo,
		playbackMeta: playbackMetadata,
		resolvedPlayMethod,
		dynamicRangeInfo,
		dynamicRangeLabel,
		requestedDynamicRangeCap,
		playbackRequestDebug: playbackMetadata.requestDebug || null,
		videoStream,
		diagnosticsEnabled: settingsSnapshot.enableDiagnostics === true
	});
	const source = {
		url: sourceUrl.videoUrl,
		transport: sourceUrl.isHls ? 'hls' : 'file',
		isHls: sourceUrl.isHls,
		isHdrLikeStream: HDR_DYNAMIC_RANGE_IDS.has(dynamicRangeInfo?.id),
		serverBurnIn: getSourceBurnInState(subtitlePolicy, sourceUrl.videoUrl),
		useTranscoding: sourceUrl.useTranscoding
	};
	const defaultAudioStreamIndex = resolveDefaultAudioStreamIndex({mediaSource, audioStreams});
	const requiresInitialNativeAudioSelection = (
		resolvedPlayMethod === 'DirectPlay' &&
		Number.isInteger(selectedTracks.selectedAudio) &&
		selectedTracks.selectedAudio !== defaultAudioStreamIndex &&
		!playbackOverride?.audioTransition
	);
	const planItemId = String(itemId || item?.Id || '');

	return cloneImmutable({
		kind: 'PlaybackPlan',
		version: PLAYBACK_PLAN_VERSION,
		itemId: planItemId,
		playMethod: resolvedPlayMethod,
		playbackInfo,
		playbackMetadata,
		mediaSource,
		session: {
			playSessionId: playbackInfo?.PlaySessionId || null,
			mediaSourceId: mediaSource.Id || null,
			playMethod: resolvedPlayMethod
		},
		settingsSnapshot,
		playbackOptions: options,
		playbackOverride,
		tracks: {
			audio: audioStreams,
			subtitle: subtitleStreams,
			selectedAudioStreamIndex: selectedTracks.selectedAudio,
			selectedSubtitleStreamIndex: selectedTracks.selectedSubtitle,
			clientRenderedSubtitleStreamIndex:
				playbackMetadata.clientRenderedSubtitleStreamIndex ?? null
		},
		durationSeconds: getDurationSeconds(mediaSource, item),
		dynamicRange: dynamicRangeInfo,
		dynamicRangeLabel,
		subtitlePolicy,
		decision: {
			required: requiredDecision,
			resumeTicks: getResumeTicks(options, requiredDecision)
		},
		source,
		runtimeInput: {
			mediaSourceData: runtimeMediaSourceData,
			playbackOptions: settingsSnapshot,
			selectedAudioTrack: selectedTracks.selectedAudio,
			selectedSubtitleTrack: selectedTracks.selectedSubtitle,
			audioTransition: playbackOverride?.audioTransition || null,
			requiresInitialNativeAudioSelection
		},
		adjustments: playbackMetadata.adjustments || [],
		diagnostics: playbackMetadata.diagnostics || []
	});
};

export default buildPlaybackPlan;
