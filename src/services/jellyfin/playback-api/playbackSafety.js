import {
	getAudioStreams,
	getMediaSourceDynamicRangeInfo,
	isSupportedAudioCodec,
	toInteger,
	WEBOS_AUDIO_CODEC_PRIORITY
} from '../../../utils/playbackSelection';
import {CLIENT_MAX_STREAMING_BITRATE_MBPS} from '../../../constants/playback';
import {normalizeDynamicRangeCap} from '../../../utils/playbackDynamicRange';
import {isAudioOnlyTranscodeReason} from './dolbyVision';

export const DEFAULT_DOLBY_VISION_ORIGINAL_QUALITY_BITRATE_MBPS = CLIENT_MAX_STREAMING_BITRATE_MBPS;

const parseTranscodingUrl = (transcodingUrl) => {
	if (!transcodingUrl) return null;
	try {
		return new URL(transcodingUrl, 'https://breezyfin.invalid').searchParams;
	} catch (_) {
		return null;
	}
};

const getSearchParam = (searchParams, ...keys) => {
	for (const key of keys) {
		const value = searchParams?.get(key);
		if (value !== null && value !== undefined && value !== '') return value;
	}
	return '';
};

const parseTranscodeReasons = (searchParams) => {
	const value = getSearchParam(searchParams, 'TranscodeReasons', 'transcodeReasons');
	if (!value) return [];
	return value
		.split(',')
		.map((reason) => String(reason || '').trim())
		.filter(Boolean);
};

const parseVideoRangeTypes = (searchParams) => {
	if (!searchParams) return [];
	const rangeTypes = [];
	searchParams.forEach((value, key) => {
		const normalizedKey = String(key || '').toLowerCase();
		if (!normalizedKey.endsWith('-rangetype') && normalizedKey !== 'videorangetype') return;
		String(value || '')
			.split(',')
			.map((rangeType) => rangeType.trim())
			.filter(Boolean)
			.forEach((rangeType) => rangeTypes.push(rangeType));
	});
	return [...new Set(rangeTypes)];
};

export const classifyDolbyVisionPlaybackPath = ({
	mediaSource,
	playMethod,
	forceSubtitleBurnIn = false
} = {}) => {
	const dynamicRangeInfo = getMediaSourceDynamicRangeInfo(mediaSource);
	if (dynamicRangeInfo?.id !== 'DV') {
		return {
			classification: 'invalid',
			reason: 'not-dolby-vision',
			videoCodec: '',
			transcodeReasons: [],
			subtitleMethod: '',
			videoRangeTypes: []
		};
	}
	if (playMethod === 'DirectPlay' || playMethod === 'DirectStream') {
		return {
			classification: 'direct-safe',
			reason: String(playMethod).toLowerCase(),
			videoCodec: 'copy',
			transcodeReasons: [],
			subtitleMethod: '',
			videoRangeTypes: []
		};
	}

	const searchParams = parseTranscodingUrl(mediaSource?.TranscodingUrl);
	if (!searchParams) {
		return {
			classification: 'invalid',
			reason: 'missing-transcoding-url',
			videoCodec: '',
			transcodeReasons: [],
			subtitleMethod: '',
			videoRangeTypes: []
		};
	}
	const videoCodec = String(getSearchParam(searchParams, 'VideoCodec', 'videoCodec')).trim().toLowerCase();
	const subtitleMethod = String(getSearchParam(searchParams, 'SubtitleMethod', 'subtitleMethod')).trim();
	const transcodeReasons = parseTranscodeReasons(searchParams);
	const videoRangeTypes = parseVideoRangeTypes(searchParams);
	const videoCopy = videoCodec
		.split(',')
		.map((codec) => codec.trim())
		.includes('copy');
	const onlyAudioReasons =
		transcodeReasons.length > 0 &&
		transcodeReasons.every(isAudioOnlyTranscodeReason);
	const subtitleEncode = subtitleMethod.toLowerCase() === 'encode';

	if (videoCopy && onlyAudioReasons && !subtitleEncode && forceSubtitleBurnIn !== true) {
		return {
			classification: 'audio-only-transcode-safe',
			reason: 'video-copy-audio-only',
			videoCodec,
			transcodeReasons,
			subtitleMethod,
			videoRangeTypes
		};
	}
	return {
		classification: 'unsafe-video-transcode',
		reason: subtitleEncode
			? 'subtitle-video-encode'
			: (videoCopy ? 'non-audio-transcode-reason' : 'video-codec-not-copy'),
		videoCodec,
		transcodeReasons,
		subtitleMethod,
		videoRangeTypes
	};
};

export const isConfirmedDynamicRangeFallbackPath = ({
	pathClassification,
	target
} = {}) => {
	const normalizedTarget = normalizeDynamicRangeCap(target);
	const videoCodecs = String(pathClassification?.videoCodec || '')
		.split(',')
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
	const videoCopy = videoCodecs.includes('copy');
	if (normalizedTarget === 'sdr') {
		// H.264 is the deterministic SDR fallback. HEVC Main 10 may preserve a
		// Dolby Vision fallback layer even when the request was capped to SDR.
		return !videoCopy && videoCodecs.some((codec) => (
			codec === 'h264' ||
			codec === 'avc' ||
			codec === 'avc1'
		));
	}
	if (normalizedTarget !== 'hdr10') return false;
	if (
		pathClassification?.classification !== 'direct-safe' &&
		pathClassification?.classification !== 'audio-only-transcode-safe'
	) {
		return false;
	}
	const rangeTypes = Array.isArray(pathClassification?.videoRangeTypes)
		? pathClassification.videoRangeTypes.map((value) => String(value || '').toUpperCase())
		: [];
	if (!rangeTypes.length) return false;
	if (rangeTypes.some((value) => value.includes('DOVI') || value.includes('DOLBYVISION'))) {
		return false;
	}
	return rangeTypes.some((value) => (
		value === 'HDR10' ||
		value === 'HDR10PLUS' ||
		value === 'HDR10_PLUS' ||
		value === 'HLG'
	));
};

export const buildDolbyVisionOriginalQualityDecision = ({
	mediaSource,
	pathClassification,
	maxBitrate,
	maxSupportedBitrateMbps,
	confirmedOriginalQuality = false,
	forceTranscoding = false,
	itemId = null,
	generation = null,
	resumeTicks = 0
} = {}) => {
	const parsedBitrate = Number(maxBitrate);
	const configuredBitrate = Number.isFinite(parsedBitrate) && parsedBitrate > 0
		? parsedBitrate
		: DEFAULT_DOLBY_VISION_ORIGINAL_QUALITY_BITRATE_MBPS;
	const parsedSupportedBitrate = Number(maxSupportedBitrateMbps);
	const supportedBitrate = Number.isFinite(parsedSupportedBitrate) && parsedSupportedBitrate > 0
		? Math.max(1, Math.floor(parsedSupportedBitrate))
		: DEFAULT_DOLBY_VISION_ORIGINAL_QUALITY_BITRATE_MBPS;
	const transcodeReasons = Array.isArray(pathClassification?.transcodeReasons)
		? pathClassification.transcodeReasons
		: [];
	const bitrateOnlyFailure =
		transcodeReasons.length > 0 &&
		transcodeReasons.every((reason) => reason === 'ContainerBitrateExceedsLimit');
	if (
		confirmedOriginalQuality ||
		forceTranscoding ||
		configuredBitrate >= supportedBitrate ||
		pathClassification?.classification !== 'unsafe-video-transcode' ||
		!bitrateOnlyFailure
	) {
		return null;
	}
	return {
		type: 'dolby-vision-original-quality',
		reason: 'dolby-vision-bitrate-limit',
		originalRange: 'DV',
		proposedBitrateMbps: supportedBitrate,
		configuredBitrateMbps: configuredBitrate,
		itemId,
		mediaSourceId: mediaSource?.Id || null,
		generation,
		resumeTicks: Number.isFinite(Number(resumeTicks)) ? Math.max(0, Number(resumeTicks)) : 0,
		pathClassification: pathClassification.classification
	};
};

const normalizeLanguage = (value) => String(value || '').trim().toLowerCase();
const normalizeCodec = (value) => String(value || '').trim().toLowerCase();

export const summarizeAudioStream = (stream) => {
	if (!stream) return null;
	return {
		index: toInteger(stream.Index),
		codec: stream.Codec || null,
		language: stream.Language || null,
		title: stream.Title || null,
		displayTitle: stream.DisplayTitle || null,
		channels: Number.isFinite(Number(stream.Channels)) ? Number(stream.Channels) : null,
		isDefault: stream.IsDefault === true
	};
};

export const findSupportedAudioSwitch = ({
	mediaSource,
	selectedAudioStreamIndex,
	preferredAudioLanguage = ''
} = {}) => {
	const selectedIndex = toInteger(selectedAudioStreamIndex);
	if (selectedIndex === null) return null;
	const audioStreams = getAudioStreams(mediaSource);
	const selectedStream = audioStreams.find((stream) => toInteger(stream?.Index) === selectedIndex);
	if (!selectedStream || isSupportedAudioCodec(selectedStream.Codec)) return null;

	const preferredLanguage = normalizeLanguage(preferredAudioLanguage);
	const selectedLanguage = normalizeLanguage(selectedStream.Language);
	const candidates = audioStreams
		.map((stream, order) => {
			const codec = normalizeCodec(stream?.Codec);
			const codecIndex = WEBOS_AUDIO_CODEC_PRIORITY.indexOf(codec);
			return {
				stream,
				order,
				codecPriority: codecIndex >= 0 ? WEBOS_AUDIO_CODEC_PRIORITY.length - codecIndex : 0,
				language: normalizeLanguage(stream?.Language),
				channels: Number(stream?.Channels) || 0
			};
		})
		.filter(({stream}) => (
			toInteger(stream?.Index) !== selectedIndex &&
			isSupportedAudioCodec(stream?.Codec)
		))
		.sort((left, right) => {
			const leftPreferred = preferredLanguage && left.language === preferredLanguage;
			const rightPreferred = preferredLanguage && right.language === preferredLanguage;
			if (leftPreferred !== rightPreferred) return rightPreferred ? 1 : -1;
			const leftSameLanguage = selectedLanguage && left.language === selectedLanguage;
			const rightSameLanguage = selectedLanguage && right.language === selectedLanguage;
			if (leftSameLanguage !== rightSameLanguage) return rightSameLanguage ? 1 : -1;
			if (left.stream.IsDefault !== right.stream.IsDefault) return left.stream.IsDefault ? -1 : 1;
			if (left.codecPriority !== right.codecPriority) return right.codecPriority - left.codecPriority;
			if (left.channels !== right.channels) return right.channels - left.channels;
			return left.order - right.order;
		});

	if (!candidates.length) return null;
	return {
		selectedTrack: summarizeAudioStream(selectedStream),
		proposedTrack: summarizeAudioStream(candidates[0].stream)
	};
};

export const buildDynamicRangeFallbackDecision = ({
	mediaSource,
	dynamicRangeCap,
	forceVideoTranscoding = false,
	itemId = null,
	generation = null,
	resumeTicks = 0,
	reason = 'unsafe-dolby-vision-video-transcode',
	pathClassification = null
} = {}) => {
	const currentCap = normalizeDynamicRangeCap(dynamicRangeCap);
	if (currentCap === 'sdr') return null;
	return {
		type: 'dynamic-range-fallback',
		reason,
		originalRange: 'DV',
		proposedRange: currentCap === 'hdr10' || forceVideoTranscoding ? 'sdr' : 'hdr10',
		itemId,
		mediaSourceId: mediaSource?.Id || null,
		generation,
		resumeTicks: Number.isFinite(Number(resumeTicks)) ? Math.max(0, Number(resumeTicks)) : 0,
		pathClassification
	};
};
