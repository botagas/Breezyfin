import {getRuntimePlatformCapabilities} from '../../utils/platformCapabilities';
import {
	canDynamicRangeSatisfyCap,
	getDynamicRangeInfo,
	normalizeDynamicRangeCap
} from '../../utils/playbackDynamicRange';

export const WEBOS_AUDIO_CODEC_PRIORITY = [
	'eac3',
	'ec3',
	'ac3',
	'dolby',
	'aac',
	'mp3',
	'mp2',
	'flac',
	'opus',
	'vorbis',
	'pcm_s24le',
	'pcm_s16le',
	'lpcm',
	'wav'
];

const WEBOS_SUPPORTED_AUDIO_CODECS = new Set(WEBOS_AUDIO_CODEC_PRIORITY);
const WEBOS_DIRECTPLAY_TEXT_SUBTITLE_CODECS = new Set([
	'srt',
	'subrip',
	'vtt',
	'webvtt',
	'ass',
	'ssa',
	'txt',
	'sub',
	'smi',
	'sami',
	'ttml',
	'dfxp'
]);

const getPlaybackCapabilities = () => {
	return getRuntimePlatformCapabilities()?.playback || {};
};

export const normalizeCodec = (codec) => {
	return (codec || '').toString().trim().toLowerCase();
};

const getContainerParts = (mediaSource) => {
	const container = normalizeCodec(mediaSource?.Container);
	if (!container) return [];
	return container
		.split(',')
		.map((part) => normalizeCodec(part))
		.filter(Boolean);
};

const mediaSourceUsesMkvContainer = (mediaSource) => {
	const containerParts = getContainerParts(mediaSource);
	return containerParts.includes('mkv') || containerParts.includes('matroska');
};

export const toInteger = (value) => {
	if (Number.isInteger(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isInteger(parsed) ? parsed : null;
	}
	return null;
};

export const getAudioStreams = (mediaSource) => {
	return mediaSource?.MediaStreams?.filter((stream) => stream.Type === 'Audio') || [];
};

export const getSubtitleStreams = (mediaSource) => {
	return mediaSource?.MediaStreams?.filter((stream) => stream.Type === 'Subtitle') || [];
};

export const getVideoStream = (mediaSource) => {
	return mediaSource?.MediaStreams?.find((stream) => stream.Type === 'Video') || null;
};

export const getMediaSourceDynamicRangeInfo = (mediaSource) => {
	return getDynamicRangeInfo(mediaSource);
};

export const isSupportedAudioCodec = (codec) => {
	const normalized = normalizeCodec(codec);
	return !normalized || WEBOS_SUPPORTED_AUDIO_CODECS.has(normalized);
};

export const getDefaultAudioStreamIndex = (mediaSource) => {
	const explicitDefault = toInteger(mediaSource?.DefaultAudioStreamIndex);
	if (explicitDefault !== null) return explicitDefault;
	const defaultStream = getAudioStreams(mediaSource).find((stream) => stream.IsDefault);
	return toInteger(defaultStream?.Index);
};

export const getSubtitleStreamByIndex = (mediaSource, streamIndex) => {
	const index = toInteger(streamIndex);
	if (index === null || index < 0) return null;
	return getSubtitleStreams(mediaSource).find((stream) => toInteger(stream.Index) === index) || null;
};

export const normalizeSubtitleCodec = (stream) => {
	const candidates = [
		stream?.Codec,
		stream?.CodecTag,
		stream?.DisplayTitle
	];
	for (const candidate of candidates) {
		const normalized = normalizeCodec(candidate);
		if (normalized) return normalized;
	}
	return '';
};

export const isTextSubtitleCodec = (codec) => {
	const normalized = normalizeCodec(codec);
	return WEBOS_DIRECTPLAY_TEXT_SUBTITLE_CODECS.has(normalized);
};

export const shouldTranscodeForSubtitleSelection = (mediaSource, subtitleStreamIndex) => {
	const subtitleStream = getSubtitleStreamByIndex(mediaSource, subtitleStreamIndex);
	if (!subtitleStream) return false;
	const codec = normalizeSubtitleCodec(subtitleStream);
	if (!codec) {
		const deliveryMethod = normalizeCodec(subtitleStream?.DeliveryMethod);
		if (deliveryMethod === 'external') return false;
	}
	// Fail-safe: keep direct/copy only for known text subtitle codecs.
	return !isTextSubtitleCodec(codec);
};

export const findBestCompatibleAudioStreamIndex = (mediaSource) => {
	const audioStreams = getAudioStreams(mediaSource);
	if (!audioStreams.length) return null;
	let best = null;
	for (const stream of audioStreams) {
		const codec = normalizeCodec(stream.Codec);
		if (codec && !isSupportedAudioCodec(codec)) continue;
		const priority = WEBOS_AUDIO_CODEC_PRIORITY.indexOf(codec);
		const priorityScore = priority >= 0 ? (WEBOS_AUDIO_CODEC_PRIORITY.length - priority) : 1;
		const channels = Number.isFinite(stream.Channels) ? stream.Channels : 0;
		const score = priorityScore * 100 + channels;
		if (!best || score > best.score) {
			best = {index: toInteger(stream.Index), score};
		}
	}
	return best?.index ?? null;
};

export const scoreMediaSource = (mediaSource, {forceTranscoding = false, dynamicRangeCap = 'auto'} = {}) => {
	if (!mediaSource) return Number.NEGATIVE_INFINITY;
	const videoStream = getVideoStream(mediaSource);
	const audioStreams = getAudioStreams(mediaSource);
	const dynamicRangeInfo = getMediaSourceDynamicRangeInfo(mediaSource);
	const playbackCapabilities = getPlaybackCapabilities();
	const normalizedRangeCap = normalizeDynamicRangeCap(dynamicRangeCap);
	const hasCompatibleAudio = !audioStreams.length || audioStreams.some((stream) => isSupportedAudioCodec(stream.Codec));
	let score = 0;

	if (forceTranscoding) {
		if (mediaSource.SupportsTranscoding) score += 1200;
		if (mediaSource.TranscodingUrl) score += 900;
		if (mediaSource.TranscodingContainer) score += 120;
	} else {
		if (mediaSource.SupportsDirectPlay) score += 1400;
		if (mediaSource.SupportsDirectStream) score += 1000;
		if (!mediaSource.TranscodingUrl) score += 150;
		if (mediaSource.SupportsTranscoding) score += 50;
		if (hasCompatibleAudio) score += 180;
		else if (audioStreams.length > 0) score -= 250;
	}

	if (videoStream?.Width >= 3840) score += 60;
	else if (videoStream?.Width >= 1920) score += 40;
	else if (videoStream?.Width >= 1280) score += 20;
	if (videoStream?.BitRate && videoStream.BitRate <= 120000000) score += 20;

	if (!canDynamicRangeSatisfyCap(dynamicRangeInfo, normalizedRangeCap)) {
		score -= 220;
	}

	if (dynamicRangeInfo.id === 'DV') {
		if (playbackCapabilities.supportsDolbyVision) {
			score += 45;
		} else if (dynamicRangeInfo.hasFallbackLayer) {
			score += 10;
		} else {
			score -= 120;
		}
		if (mediaSourceUsesMkvContainer(mediaSource) && !playbackCapabilities.supportsDolbyVisionInMkv && dynamicRangeInfo.isPureDolbyVision) {
			score -= 180;
		}
	}

	return score;
};

export const selectMediaSource = (mediaSources, {preferredMediaSourceId = null, forceTranscoding = false, dynamicRangeCap = 'auto'} = {}) => {
	if (!Array.isArray(mediaSources) || mediaSources.length === 0) {
		return {source: null, index: -1, score: Number.NEGATIVE_INFINITY, reason: 'none'};
	}

	if (preferredMediaSourceId) {
		const preferredIndex = mediaSources.findIndex((source) => source.Id === preferredMediaSourceId);
		if (preferredIndex >= 0) {
			return {
				source: mediaSources[preferredIndex],
				index: preferredIndex,
				score: Number.POSITIVE_INFINITY,
				reason: 'requested'
			};
		}
	}

	let bestIndex = 0;
	let bestScore = Number.NEGATIVE_INFINITY;
	for (let index = 0; index < mediaSources.length; index += 1) {
		const score = scoreMediaSource(mediaSources[index], {forceTranscoding, dynamicRangeCap});
		if (score > bestScore) {
			bestScore = score;
			bestIndex = index;
		}
	}
	return {
		source: mediaSources[bestIndex],
		index: bestIndex,
		score: bestScore,
		reason: 'scored'
	};
};

export const reorderMediaSources = (mediaSources, selectedIndex) => {
	if (!Array.isArray(mediaSources) || selectedIndex <= 0 || selectedIndex >= mediaSources.length) {
		return mediaSources;
	}
	const selected = mediaSources[selectedIndex];
	const reordered = mediaSources.slice();
	reordered.splice(selectedIndex, 1);
	reordered.unshift(selected);
	return reordered;
};

export const determinePlayMethod = (mediaSource, {forceTranscoding = false, dynamicRangeCap = 'auto'} = {}) => {
	if (!mediaSource) return 'DirectStream';
	if (forceTranscoding) return 'Transcode';

	const audioStreams = getAudioStreams(mediaSource);
	const hasCompatibleAudio = !audioStreams.length || audioStreams.some((stream) => isSupportedAudioCodec(stream.Codec));
	const dynamicRangeInfo = getMediaSourceDynamicRangeInfo(mediaSource);
	const playbackCapabilities = getPlaybackCapabilities();
	const normalizedRangeCap = normalizeDynamicRangeCap(dynamicRangeCap);

	if (!canDynamicRangeSatisfyCap(dynamicRangeInfo, normalizedRangeCap) && mediaSource.TranscodingUrl) {
		return 'Transcode';
	}

	if (
		dynamicRangeInfo.isPureDolbyVision &&
		mediaSourceUsesMkvContainer(mediaSource) &&
		!playbackCapabilities.supportsDolbyVisionInMkv &&
		mediaSource.TranscodingUrl
	) {
		return 'Transcode';
	}

	if (!hasCompatibleAudio && mediaSource.TranscodingUrl) return 'Transcode';
	if (mediaSource.SupportsDirectPlay) return 'DirectPlay';
	if (mediaSource.SupportsDirectStream) return 'DirectStream';
	if (mediaSource.TranscodingUrl) return 'Transcode';
	return 'DirectStream';
};
