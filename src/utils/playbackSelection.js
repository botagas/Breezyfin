import {getRuntimePlatformCapabilities} from './platformCapabilities';
import {toInteger as parseInteger} from './numberParsing';
import {
	canDynamicRangeSatisfyCap,
	getDynamicRangeInfo,
	normalizeDynamicRangeCap
} from './playbackDynamicRange';
import {
	ASS_SUBTITLE_RENDERERS,
	normalizeAssSubtitleRenderer as normalizeAssSubtitleRendererValue
} from './assSubtitleRenderers';
import {
	BITMAP_SUBTITLE_RENDERERS,
	normalizeBitmapSubtitleRenderer as normalizeBitmapSubtitleRendererValue
} from './bitmapSubtitleRenderers';

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
const HDR_DYNAMIC_RANGE_IDS = new Set(['DV', 'HDR10', 'HDR10_PLUS', 'HLG']);
const WEBOS_TEXT_SUBTITLE_CODECS = new Set([
	'srt',
	'subrip',
	'vtt',
	'webvtt',
	'ass',
	'ssa',
	'advancedsubstationalpha',
	'substationalpha',
	'txt',
	'sub',
	'smi',
	'sami',
	'ttml',
	'dfxp'
]);
const CLIENT_RENDER_TEXT_SUBTITLE_CODECS = new Set([
	'srt',
	'subrip',
	'vtt',
	'webvtt'
]);
const ASS_SUBTITLE_CODECS = new Set([
	'ass',
	'ssa',
	'advancedsubstationalpha',
	'substationalpha'
]);
const BITMAP_SUBTITLE_CODECS = new Set([
	'pgs',
	'pgssub',
	'pgssubs',
	'hdmv',
	'hdmvpgs',
	'hdmvpgssubtitle',
	'hdmv_pgs_subtitle',
	'presentationgraphicstream'
]);

const getPlaybackCapabilities = () => {
	return getRuntimePlatformCapabilities()?.playback || {};
};

export const normalizeCodec = (codec) => {
	return (codec || '').toString().trim().toLowerCase();
};

const tokenizedCodecMatches = (codec, codecSet) => {
	const normalized = normalizeCodec(codec);
	if (!normalized) return false;
	if (codecSet.has(normalized)) return true;
	const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
	return tokens.some((token) => codecSet.has(token));
};

const normalizeSubtitleBurnInCodecSet = (subtitleBurnInTextCodecs = []) => {
	const codecSet = new Set();
	if (!Array.isArray(subtitleBurnInTextCodecs)) return codecSet;
	subtitleBurnInTextCodecs
		.map((codec) => normalizeCodec(codec))
		.filter(Boolean)
		.forEach((codec) => codecSet.add(codec));
	if (codecSet.has('ass')) {
		codecSet.add('advancedsubstationalpha');
	}
	if (codecSet.has('ssa')) {
		codecSet.add('substationalpha');
	}
	if (codecSet.has('srt')) codecSet.add('subrip');
	if (codecSet.has('subrip')) codecSet.add('srt');
	if (codecSet.has('vtt')) codecSet.add('webvtt');
	if (codecSet.has('webvtt')) codecSet.add('vtt');
	if (codecSet.has('smi')) codecSet.add('sami');
	if (codecSet.has('sami')) codecSet.add('smi');
	if (codecSet.has('dfxp')) codecSet.add('ttml');
	if (codecSet.has('ttml')) codecSet.add('dfxp');
	return codecSet;
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

export const toInteger = parseInteger;

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
	return tokenizedCodecMatches(codec, WEBOS_TEXT_SUBTITLE_CODECS);
};

export const isClientRenderableSubtitleCodec = (codec) => {
	return tokenizedCodecMatches(codec, CLIENT_RENDER_TEXT_SUBTITLE_CODECS);
};

export const isAssSubtitleCodec = (codec) => {
	return tokenizedCodecMatches(codec, ASS_SUBTITLE_CODECS);
};

const normalizeAssSubtitleRenderer = (value) => normalizeAssSubtitleRendererValue(value);
const normalizeBitmapSubtitleRenderer = (value) => normalizeBitmapSubtitleRendererValue(value);

export const isBitmapSubtitleCodec = (codec) => {
	const normalized = normalizeCodec(codec);
	if (!normalized) return false;
	if (BITMAP_SUBTITLE_CODECS.has(normalized)) return true;
	const compact = normalized.replace(/[^a-z0-9]/g, '');
	if (BITMAP_SUBTITLE_CODECS.has(compact)) return true;
	return tokenizedCodecMatches(normalized, BITMAP_SUBTITLE_CODECS);
};

const buildSubtitleTranscodePolicy = ({
	mode = 'manual',
	streamIndex = null,
	subtitleStream = null,
	codec = '',
	requiresBurnIn = false,
	reason = 'external-supported',
	dynamicRangeInfo = null,
	originalDynamicRangeInfo = null,
	renderer = 'native',
	clientRender = false,
	fallbackBurnInAllowed = false,
	requiredDecision = null
} = {}) => ({
	mode,
	streamIndex,
	codec: codec || subtitleStream?.Codec || null,
	requiresBurnIn,
	forceBurnIn: requiresBurnIn,
	reason,
	renderer,
	clientRender,
	fallbackBurnInAllowed,
	requiresBitmapBurnInConsent: false,
	bitmapBurnInFragilityReason: null,
	knownImageSubtitleHardwareBurnInFailure: false,
	fallbackPromptType: null,
	requiredDecision,
	dynamicRangeId: dynamicRangeInfo?.id || 'SDR',
	dynamicRangeInfo: dynamicRangeInfo || null,
	originalDynamicRangeId: originalDynamicRangeInfo?.id || dynamicRangeInfo?.id || 'SDR',
	originalDynamicRangeInfo: originalDynamicRangeInfo || dynamicRangeInfo || null,
	deliveryMethod: subtitleStream?.DeliveryMethod || null
});

export const getSubtitleTranscodePolicy = (mediaSource, subtitleStreamIndex, options = {}) => {
	const selectedSubtitleStreamIndex = toInteger(subtitleStreamIndex);
	if (selectedSubtitleStreamIndex === null || selectedSubtitleStreamIndex < 0) {
		return buildSubtitleTranscodePolicy({
			mode: options.smartSubtitleTranscoding === false ? 'manual' : 'smart',
			streamIndex: selectedSubtitleStreamIndex,
			reason: 'subtitle-off',
			renderer: 'off'
		});
	}
	const subtitleStream = getSubtitleStreamByIndex(mediaSource, selectedSubtitleStreamIndex);
	if (!subtitleStream) {
		return buildSubtitleTranscodePolicy({
			mode: options.smartSubtitleTranscoding === false ? 'manual' : 'smart',
			streamIndex: selectedSubtitleStreamIndex,
			reason: 'subtitle-stream-missing'
		});
	}
	const subtitleBurnInEnabled = options.enableSubtitleBurnIn !== false;
	const smartSubtitleTranscoding = options.smartSubtitleTranscoding !== false;
	const mode = smartSubtitleTranscoding ? 'smart' : 'manual';
	if (!smartSubtitleTranscoding && !subtitleBurnInEnabled) {
		return buildSubtitleTranscodePolicy({
			mode,
			streamIndex: selectedSubtitleStreamIndex,
			subtitleStream,
			codec: normalizeSubtitleCodec(subtitleStream),
			reason: 'manual-burn-in-disabled'
		});
	}
	const allowSubtitleBurnInOnHdr = options.allowSubtitleBurnInOnHdr === true;
	const forceSubtitleBurnIn = options.forceSubtitleBurnIn === true;
	const confirmedBitmapBurnIn = options.confirmedBitmapBurnIn === true;
	const dynamicRangeInfo = getMediaSourceDynamicRangeInfo(mediaSource);
	const originalDynamicRangeInfo = options.originalDynamicRangeInfo || dynamicRangeInfo;
	const codec = normalizeSubtitleCodec(subtitleStream);
	const isHdrDynamicRange = HDR_DYNAMIC_RANGE_IDS.has(originalDynamicRangeInfo?.id);
	if (forceSubtitleBurnIn) {
		return buildSubtitleTranscodePolicy({
			mode,
			streamIndex: selectedSubtitleStreamIndex,
			subtitleStream,
			codec,
			requiresBurnIn: true,
			reason: 'forced-subtitle-burn-in',
			dynamicRangeInfo,
			originalDynamicRangeInfo,
			renderer: 'burn-in'
		});
	}
	if (smartSubtitleTranscoding && isClientRenderableSubtitleCodec(codec)) {
		return buildSubtitleTranscodePolicy({
			mode,
			streamIndex: selectedSubtitleStreamIndex,
			subtitleStream,
			codec,
			reason: 'client-render-text',
			dynamicRangeInfo,
			originalDynamicRangeInfo,
			renderer: 'client-text',
			clientRender: true,
			fallbackBurnInAllowed: !isHdrDynamicRange || allowSubtitleBurnInOnHdr
		});
	}
	if (smartSubtitleTranscoding && isAssSubtitleCodec(codec)) {
		const assSubtitleRenderer = normalizeAssSubtitleRenderer(options.assSubtitleRenderer);
		if (assSubtitleRenderer === ASS_SUBTITLE_RENDERERS.BURN_IN) {
			if (!allowSubtitleBurnInOnHdr && isHdrDynamicRange) {
				return buildSubtitleTranscodePolicy({
					mode,
					streamIndex: selectedSubtitleStreamIndex,
					subtitleStream,
					codec,
					reason: 'skip-hdr-dv-preserve-range',
					dynamicRangeInfo,
					originalDynamicRangeInfo,
					renderer: 'native'
				});
			}
			return buildSubtitleTranscodePolicy({
				mode,
				streamIndex: selectedSubtitleStreamIndex,
				subtitleStream,
				codec,
				requiresBurnIn: true,
				reason: 'ass-renderer-burn-in',
				dynamicRangeInfo,
				originalDynamicRangeInfo,
				renderer: 'burn-in'
			});
		}
		const renderer = {
			[ASS_SUBTITLE_RENDERERS.LIBASS]: 'client-ass-libass',
			[ASS_SUBTITLE_RENDERERS.LIBASS_MANUAL]: 'client-ass-libass-manual',
			[ASS_SUBTITLE_RENDERERS.JASSUB]: 'client-ass-jassub',
			[ASS_SUBTITLE_RENDERERS.JASSUB_MANUAL]: 'client-ass-jassub-manual',
			[ASS_SUBTITLE_RENDERERS.ASSJS]: 'client-ass-assjs',
			[ASS_SUBTITLE_RENDERERS.LIGHTWEIGHT]: 'client-ass-lightweight',
			[ASS_SUBTITLE_RENDERERS.AUTO]: 'client-ass-lightweight'
		}[assSubtitleRenderer] || 'client-ass-lightweight';
		return buildSubtitleTranscodePolicy({
			mode,
			streamIndex: selectedSubtitleStreamIndex,
			subtitleStream,
			codec,
			reason: `client-render-ass-${renderer.replace('client-ass-', '')}`,
			dynamicRangeInfo,
			originalDynamicRangeInfo,
			renderer,
			clientRender: true,
			fallbackBurnInAllowed: !isHdrDynamicRange || allowSubtitleBurnInOnHdr
		});
	}
	if (smartSubtitleTranscoding && isBitmapSubtitleCodec(codec)) {
		const bitmapSubtitleRenderer = normalizeBitmapSubtitleRenderer(options.bitmapSubtitleRenderer);
		if (bitmapSubtitleRenderer === BITMAP_SUBTITLE_RENDERERS.BURN_IN) {
			if (!confirmedBitmapBurnIn) {
				const bitmapBurnInFragilityReason = isHdrDynamicRange && !allowSubtitleBurnInOnHdr
					? 'image-subtitle-hardware-burn-in-fragile-and-hdr-dv-quality-risk'
					: 'image-subtitle-hardware-burn-in-fragile';
				return {
					...buildSubtitleTranscodePolicy({
						mode,
						streamIndex: selectedSubtitleStreamIndex,
						subtitleStream,
						codec,
						reason: 'bitmap-burn-in-fragility-consent-required',
						dynamicRangeInfo,
						originalDynamicRangeInfo,
						renderer: 'burn-in',
						clientRender: false,
						fallbackBurnInAllowed: false,
						requiredDecision: {
							type: 'bitmap-burn-in-fragility',
							subtitleStreamIndex: selectedSubtitleStreamIndex,
							reason: bitmapBurnInFragilityReason,
							originalDynamicRangeInfo: originalDynamicRangeInfo || dynamicRangeInfo || null,
							renderer: 'burn-in'
						}
					}),
					requiresBitmapBurnInConsent: true,
					bitmapBurnInFragilityReason,
					fallbackPromptType: 'bitmap-burn-in-fragility'
				};
			}
			return buildSubtitleTranscodePolicy({
				mode,
				streamIndex: selectedSubtitleStreamIndex,
				subtitleStream,
				codec,
				requiresBurnIn: true,
				reason: 'confirmed-bitmap-renderer-burn-in',
				dynamicRangeInfo,
				originalDynamicRangeInfo,
				renderer: 'burn-in'
			});
		}
		const renderer = {
			[BITMAP_SUBTITLE_RENDERERS.LIBBITSUB]: 'client-bitmap-libbitsub',
			[BITMAP_SUBTITLE_RENDERERS.LIBPGS]: 'client-bitmap-libpgs',
			[BITMAP_SUBTITLE_RENDERERS.AUTO]: 'client-bitmap-auto'
		}[bitmapSubtitleRenderer] || 'client-bitmap-auto';
		return buildSubtitleTranscodePolicy({
			mode,
			streamIndex: selectedSubtitleStreamIndex,
			subtitleStream,
			codec,
			reason: `client-render-bitmap-${renderer.replace('client-bitmap-', '')}`,
			dynamicRangeInfo,
			originalDynamicRangeInfo,
			renderer,
			clientRender: true,
			fallbackBurnInAllowed: !isHdrDynamicRange || allowSubtitleBurnInOnHdr
		});
	}
	if (!allowSubtitleBurnInOnHdr && isHdrDynamicRange) {
		return buildSubtitleTranscodePolicy({
			mode,
			streamIndex: selectedSubtitleStreamIndex,
			subtitleStream,
			codec,
			reason: 'skip-hdr-dv-preserve-range',
			dynamicRangeInfo,
			originalDynamicRangeInfo,
			renderer: 'native'
		});
	}
	if (smartSubtitleTranscoding) {
		return buildSubtitleTranscodePolicy({
			mode,
			streamIndex: selectedSubtitleStreamIndex,
			subtitleStream,
			codec,
			requiresBurnIn: true,
			reason: HDR_DYNAMIC_RANGE_IDS.has(originalDynamicRangeInfo?.id)
				? 'smart-forced-hdr-dv'
				: 'smart-sdr-reliability',
			dynamicRangeInfo,
			originalDynamicRangeInfo,
			renderer: 'burn-in'
		});
	}
	if (!codec) {
		const deliveryMethod = normalizeCodec(subtitleStream?.DeliveryMethod);
		if (deliveryMethod === 'external') {
			return buildSubtitleTranscodePolicy({
				mode,
				streamIndex: selectedSubtitleStreamIndex,
				subtitleStream,
				codec,
				reason: 'manual-external-unknown-codec',
				dynamicRangeInfo,
				originalDynamicRangeInfo,
				renderer: 'native'
			});
		}
	}
	const burnInCodecSet = normalizeSubtitleBurnInCodecSet(options.subtitleBurnInTextCodecs);
	if (tokenizedCodecMatches(codec, burnInCodecSet)) {
		return buildSubtitleTranscodePolicy({
			mode,
			streamIndex: selectedSubtitleStreamIndex,
			subtitleStream,
			codec,
			requiresBurnIn: true,
			reason: 'manual-selected-format',
			dynamicRangeInfo,
			originalDynamicRangeInfo,
			renderer: 'burn-in'
		});
	}
	const requiresBurnIn = !isTextSubtitleCodec(codec);
	return buildSubtitleTranscodePolicy({
		mode,
		streamIndex: selectedSubtitleStreamIndex,
		subtitleStream,
		codec,
		requiresBurnIn,
		reason: requiresBurnIn ? 'manual-non-text-format' : 'manual-text-external',
		dynamicRangeInfo,
		originalDynamicRangeInfo,
		renderer: requiresBurnIn ? 'burn-in' : 'native'
	});
};

export const shouldTranscodeForSubtitleSelection = (mediaSource, subtitleStreamIndex, options = {}) => {
	return getSubtitleTranscodePolicy(mediaSource, subtitleStreamIndex, options).requiresBurnIn === true;
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

const selectBestScoredMediaSourceIndex = (mediaSources, candidateIndexes, selectionOptions) => {
	if (!Array.isArray(candidateIndexes) || candidateIndexes.length === 0) return -1;
	let bestIndex = candidateIndexes[0];
	let bestScore = Number.NEGATIVE_INFINITY;
	for (const index of candidateIndexes) {
		const score = scoreMediaSource(mediaSources[index], selectionOptions);
		if (score > bestScore) {
			bestScore = score;
			bestIndex = index;
		}
	}
	return bestIndex;
};

export const selectMediaSource = (mediaSources, {
	preferredMediaSourceId = null,
	forceTranscoding = false,
	dynamicRangeCap = 'auto',
	preferDolbyVision = false,
	avoidDolbyVision = false
} = {}) => {
	if (!Array.isArray(mediaSources) || mediaSources.length === 0) {
		return {source: null, index: -1, score: Number.NEGATIVE_INFINITY, reason: 'none'};
	}

	const normalizedRangeCap = normalizeDynamicRangeCap(dynamicRangeCap);
	const playbackCapabilities = getPlaybackCapabilities();
	const selectionOptions = {forceTranscoding, dynamicRangeCap: normalizedRangeCap};

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

	if (avoidDolbyVision) {
		const nonDolbyVisionIndexes = mediaSources
			.map((source, index) => ({source, index}))
			.filter(({source}) => getMediaSourceDynamicRangeInfo(source).id !== 'DV')
			.map(({index}) => index);
		const fallbackIndex = selectBestScoredMediaSourceIndex(mediaSources, nonDolbyVisionIndexes, selectionOptions);
		if (fallbackIndex >= 0) {
			return {
				source: mediaSources[fallbackIndex],
				index: fallbackIndex,
				score: scoreMediaSource(mediaSources[fallbackIndex], selectionOptions),
				reason: 'avoidDolbyVision'
			};
		}
	}

	const shouldPreferDolbyVision =
		preferDolbyVision &&
		normalizedRangeCap === 'auto' &&
		playbackCapabilities.supportsDolbyVision === true;
	if (shouldPreferDolbyVision) {
		const dolbyVisionIndexes = mediaSources
			.map((source, index) => ({source, index}))
			.filter(({source}) => {
				const rangeInfo = getMediaSourceDynamicRangeInfo(source);
				if (rangeInfo.id !== 'DV') return false;
				if (
					rangeInfo.isPureDolbyVision &&
					mediaSourceUsesMkvContainer(source) &&
					playbackCapabilities.supportsDolbyVisionInMkv === false
				) {
					return false;
				}
				return true;
			})
			.map(({index}) => index);
		const preferredIndex = selectBestScoredMediaSourceIndex(mediaSources, dolbyVisionIndexes, selectionOptions);
		if (preferredIndex >= 0) {
			return {
				source: mediaSources[preferredIndex],
				index: preferredIndex,
				score: scoreMediaSource(mediaSources[preferredIndex], selectionOptions),
				reason: 'preferDolbyVision'
			};
		}
	}

	const allIndexes = mediaSources.map((_, index) => index);
	const bestIndex = selectBestScoredMediaSourceIndex(mediaSources, allIndexes, selectionOptions);
	const bestScore = bestIndex >= 0
		? scoreMediaSource(mediaSources[bestIndex], selectionOptions)
		: Number.NEGATIVE_INFINITY;
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

export const determinePlayMethod = (mediaSource, {
	forceTranscoding = false,
	disableDirectPlay = false,
	dynamicRangeCap = 'auto',
	selectedAudioStreamIndex = null
} = {}) => {
	if (!mediaSource) return 'DirectStream';
	if (forceTranscoding) return 'Transcode';

	const audioStreams = getAudioStreams(mediaSource);
	const selectedAudioIndex = toInteger(selectedAudioStreamIndex);
	const selectedAudioStream = selectedAudioIndex === null
		? null
		: audioStreams.find((stream) => toInteger(stream?.Index) === selectedAudioIndex);
	const hasCompatibleAudio = selectedAudioStream
		? isSupportedAudioCodec(selectedAudioStream.Codec)
		: (!audioStreams.length || audioStreams.some((stream) => isSupportedAudioCodec(stream.Codec)));
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
	if (!disableDirectPlay && mediaSource.SupportsDirectPlay) return 'DirectPlay';
	if (mediaSource.SupportsDirectStream) return 'DirectStream';
	if (mediaSource.TranscodingUrl) return 'Transcode';
	return 'DirectStream';
};
