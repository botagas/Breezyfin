import {
	getSubtitleStreamByIndex,
	isBitmapSubtitleCodec,
	normalizeSubtitleCodec,
	toInteger
} from '../../../utils/playbackSelection';

const getOptionMediaSources = (options = {}) => {
	if (Array.isArray(options.mediaSources)) return options.mediaSources;
	if (Array.isArray(options.item?.MediaSources)) return options.item.MediaSources;
	if (options.mediaSource) return [options.mediaSource];
	return [];
};

const findSubtitleStreamInOptionSources = (options = {}, streamIndex = null) => {
	const index = toInteger(streamIndex);
	if (index === null || index < 0) return null;
	const preferredMediaSourceId = options.mediaSourceId || options.mediaSource?.Id || null;
	const mediaSources = getOptionMediaSources(options);
	const preferredSource = preferredMediaSourceId
		? mediaSources.find((source) => source?.Id === preferredMediaSourceId)
		: null;
	const sources = preferredSource
		? [preferredSource, ...mediaSources.filter((source) => source !== preferredSource)]
		: mediaSources;
	for (const mediaSource of sources) {
		const stream = getSubtitleStreamByIndex(mediaSource, index);
		if (stream) return {mediaSource, stream};
	}
	const itemStream = (options.item?.MediaStreams || [])
		.find((stream) => stream?.Type === 'Subtitle' && toInteger(stream.Index) === index);
	return itemStream ? {mediaSource: options.mediaSource || null, stream: itemStream} : null;
};

export const shouldDetachKnownBitmapSubtitleBeforeRequest = ({
	options,
	subtitleStreamIndex,
	smartSubtitleTranscoding,
	forceSubtitleBurnIn,
	confirmedBitmapBurnIn
} = {}) => {
	if (
		smartSubtitleTranscoding === false ||
		forceSubtitleBurnIn === true ||
		confirmedBitmapBurnIn === true
	) {
		return null;
	}
	const knownSubtitle = findSubtitleStreamInOptionSources(options, subtitleStreamIndex);
	const codec = normalizeSubtitleCodec(knownSubtitle?.stream);
	if (!isBitmapSubtitleCodec(codec)) return null;
	return knownSubtitle;
};

export const shouldDetachClientRenderedSubtitlePolicy = (subtitlePolicy) => (
	subtitlePolicy?.clientRender === true &&
	String(subtitlePolicy?.renderer || '').startsWith('client')
);
