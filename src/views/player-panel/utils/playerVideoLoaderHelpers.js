import {normalizeDynamicRangeCap} from '../../../utils/playbackDynamicRange';
import {toInteger} from '../../../utils/numberParsing';
import {normalizeAssSubtitleRenderer} from '../../../utils/assSubtitleRenderers';
import {normalizeBitmapSubtitleRenderer} from '../../../utils/bitmapSubtitleRenderers';
import {resolveAudioTrackIndex, resolveSubtitleTrackIndex} from '../../../utils/trackMatching';

const DEBUG_SOURCE_SUMMARY_LIMIT = 8;

export const cancelVideoMountAdmission = (pendingRef, result = {
	status: 'stale',
	reason: 'video-surface-wait-cancelled'
}) => {
	const admission = pendingRef?.current;
	if (!admission) return false;
	if (typeof admission.cancel === 'function') {
		admission.cancel(result);
	} else {
		clearTimeout(admission);
		pendingRef.current = null;
	}
	return true;
};

export const waitForVideoMount = ({
	videoRef,
	pendingRef,
	isStale,
	maxAttempts = 20,
	intervalMs = 100
} = {}) => {
	if (videoRef?.current) {
		return Promise.resolve({status: 'ready', video: videoRef.current});
	}

	return new Promise((resolve) => {
		let attempts = 0;
		const admission = {
			timerId: null,
			settled: false,
			cancel: null
		};
		const settle = (result) => {
			if (admission.settled) return;
			admission.settled = true;
			if (admission.timerId !== null) clearTimeout(admission.timerId);
			admission.timerId = null;
			if (pendingRef?.current === admission) pendingRef.current = null;
			resolve(result);
		};
		admission.cancel = settle;
		const check = () => {
			admission.timerId = null;
			if (isStale?.()) {
				settle({status: 'stale', reason: 'video-surface-wait-stale'});
				return;
			}
			if (videoRef?.current) {
				settle({status: 'ready', video: videoRef.current});
				return;
			}
			if (attempts >= maxAttempts) {
				settle({status: 'failed', reason: 'video-surface-unavailable'});
				return;
			}
			attempts += 1;
			admission.timerId = setTimeout(check, intervalMs);
		};

		if (pendingRef) pendingRef.current = admission;
		check();
	});
};

export const buildSourceDebugSummary = (mediaSources = []) => {
	if (!Array.isArray(mediaSources) || mediaSources.length === 0) return [];
	return mediaSources.slice(0, DEBUG_SOURCE_SUMMARY_LIMIT).map((source) => {
		const videoStream = source?.MediaStreams?.find((stream) => stream?.Type === 'Video') || null;
		return {
			id: source?.Id || '',
			container: source?.Container || '',
			videoCodec: videoStream?.Codec || '',
			videoRangeType: videoStream?.VideoRangeType || '',
			videoRange: videoStream?.VideoRange || '',
			supportsDirectPlay: source?.SupportsDirectPlay === true,
			supportsDirectStream: source?.SupportsDirectStream === true,
			supportsTranscoding: source?.SupportsTranscoding === true,
			defaultAudioStreamIndex: toInteger(source?.DefaultAudioStreamIndex)
		};
	});
};

export const buildMediaSourceDebugData = ({
	mediaSource,
	playbackInfo,
	playbackMeta = {},
	resolvedPlayMethod,
	dynamicRangeInfo,
	dynamicRangeLabel,
	requestedDynamicRangeCap,
	playbackRequestDebug,
	videoStream,
	diagnosticsEnabled = false
} = {}) => ({
	__selectedPlayMethod: resolvedPlayMethod,
	__dynamicRangeInfo: dynamicRangeInfo,
	__dynamicRangeLabel: dynamicRangeLabel,
	__requestedDynamicRangeCap: playbackMeta.dynamicRangeCap || requestedDynamicRangeCap,
	__debugVideoRangeType: diagnosticsEnabled ? (videoStream?.VideoRangeType || '') : '',
	__debugVideoRange: diagnosticsEnabled ? (videoStream?.VideoRange || '') : '',
	__debugVideoCodec: diagnosticsEnabled ? (videoStream?.Codec || '') : '',
	__debugRequest: diagnosticsEnabled ? playbackRequestDebug : null,
	__debugDecision: diagnosticsEnabled ? (playbackMeta.decision || null) : null,
	__safeSubtitleBurnInProfile: playbackMeta.safeSubtitleBurnInProfile === true,
	__safeSdrFallbackProfile: playbackMeta.safeSdrFallbackProfile === true,
	__requiredDecision: playbackMeta.requiredDecision || playbackMeta.subtitlePolicy?.requiredDecision || null,
	__debugSubtitlePolicy: playbackMeta.subtitlePolicy || null,
	__debugDiagnostics: diagnosticsEnabled && Array.isArray(playbackMeta.diagnostics) ? playbackMeta.diagnostics : [],
	__debugAvailableSources: diagnosticsEnabled ? buildSourceDebugSummary(playbackInfo?.MediaSources) : [],
	__debugSelectedSourceId: mediaSource?.Id || ''
});

export const buildPlayerPlaybackSettingsSnapshot = ({
	settings = {},
	playbackOptions = {},
	playbackOverride = null,
	forceTranscodeOverride = false
} = {}) => {
	const forceDolbyVision = settings.forceDolbyVision === true;
	const legacyPreferFmp4Preference = typeof settings.preferDolbyVisionMp4 === 'boolean'
		? settings.preferDolbyVisionMp4
		: undefined;
	const enableFmp4HlsContainerPreference = typeof settings.enableFmp4HlsContainerPreference === 'boolean'
		? settings.enableFmp4HlsContainerPreference
		: (legacyPreferFmp4Preference ?? false);
	const forceFmp4HlsContainerPreference =
		settings.forceFmp4HlsContainerPreference === true &&
		enableFmp4HlsContainerPreference === true;
	const subtitleBurnInTextCodecs = Array.isArray(settings.subtitleBurnInTextCodecs)
		? settings.subtitleBurnInTextCodecs
			.map((codec) => String(codec || '').trim().toLowerCase())
			.filter(Boolean)
		: [];
	return {
		forceTranscoding: forceTranscodeOverride || settings.forceTranscoding || false,
		disableDirectPlay: playbackOverride?.disableDirectPlay === true,
		strictTranscodingMode: settings.forceTranscoding === true,
		enableTranscoding: settings.enableTranscoding !== false,
		maxBitrate: settings.maxBitrate,
		enableDiagnostics: settings.enableDiagnostics === true,
		autoPlayNext: settings.autoPlayNext !== false,
		relaxedPlaybackProfile: settings.relaxedPlaybackProfile === true,
		forceDolbyVision,
		enableFmp4HlsContainerPreference,
		forceFmp4HlsContainerPreference,
		preferredAudioLanguage: String(settings.preferredAudioLanguage || '').trim().toLowerCase(),
		smartSubtitleTranscoding: settings.smartSubtitleTranscoding !== false,
		assSubtitleRenderer: normalizeAssSubtitleRenderer(settings.assSubtitleRenderer),
		bitmapSubtitleRenderer: normalizeBitmapSubtitleRenderer(settings.bitmapSubtitleRenderer),
		enableSubtitleBurnIn: settings.enableSubtitleBurnIn !== false,
		forceSubtitleBurnInOnHdr:
			settings.forceTranscodingWithSubtitles === true ||
			playbackOverride?.forceSubtitleBurnInOnHdr === true,
		forceSubtitleBurnIn: playbackOverride?.forceSubtitleBurnIn === true,
		subtitleBurnInTextCodecs,
		dynamicRangeCap: forceDolbyVision
			? 'auto'
			: normalizeDynamicRangeCap(
				playbackOverride?.dynamicRangeCap ??
				playbackOptions?.dynamicRangeCap ??
				'auto'
			)
	};
};

export const resolveInitialTrackSelection = ({
	audioStreams = [],
	subtitleStreams = [],
	playbackOptions = {},
	playbackOverride = null,
	negotiatedAudioStreamIndex = null,
	negotiatedSubtitleStreamIndex = null,
	clientRenderedSubtitleStreamIndex = null,
	pickPreferredAudio,
	pickPreferredSubtitle
} = {}) => {
	const defaultAudio = audioStreams.find((stream) => stream?.IsDefault) || audioStreams[0];
	const defaultSubtitle = subtitleStreams.find((stream) => stream?.IsDefault);
	const providedAudio = Number.isInteger(playbackOptions?.audioStreamIndex)
		? playbackOptions.audioStreamIndex
		: null;
	const audioIntentMatch = resolveAudioTrackIndex({
		audioStreams,
		intent: playbackOptions?.audioTrackIntent,
		fallbackIndex: providedAudio ?? defaultAudio?.Index ?? null
	});
	const effectiveProvidedAudio = audioIntentMatch.method !== 'no-intent'
		? audioIntentMatch.index
		: providedAudio;
	const providedSubtitle = Number.isInteger(playbackOptions?.subtitleStreamIndex)
		? playbackOptions.subtitleStreamIndex
		: null;
	const subtitleIntentMatch = resolveSubtitleTrackIndex({
		subtitleStreams,
		intent: playbackOptions?.subtitleTrackIntent,
		fallbackIndex: providedSubtitle
	});
	const effectiveProvidedSubtitle =
		subtitleIntentMatch.method !== 'no-intent'
			? subtitleIntentMatch.index
			: providedSubtitle;
	const initialAudio = pickPreferredAudio(audioStreams, effectiveProvidedAudio, defaultAudio);
	const initialSubtitle = pickPreferredSubtitle(subtitleStreams, effectiveProvidedSubtitle, defaultSubtitle);
	const overrideAudio = Number.isInteger(playbackOverride?.audioStreamIndex)
		? playbackOverride.audioStreamIndex
		: null;
	const overrideSubtitle =
		(playbackOverride?.subtitleStreamIndex === -1 || Number.isInteger(playbackOverride?.subtitleStreamIndex))
			? playbackOverride.subtitleStreamIndex
			: null;
	return {
		selectedAudio: Number.isInteger(negotiatedAudioStreamIndex)
			? negotiatedAudioStreamIndex
			: (Number.isInteger(overrideAudio) ? overrideAudio : initialAudio),
		selectedSubtitle:
			(clientRenderedSubtitleStreamIndex === -1 || Number.isInteger(clientRenderedSubtitleStreamIndex))
				? clientRenderedSubtitleStreamIndex
				: (negotiatedSubtitleStreamIndex === -1 || Number.isInteger(negotiatedSubtitleStreamIndex))
					? negotiatedSubtitleStreamIndex
					: (overrideSubtitle === -1 || Number.isInteger(overrideSubtitle))
						? overrideSubtitle
						: initialSubtitle
	};
};

export const resolveDefaultAudioStreamIndex = ({mediaSource, audioStreams = []} = {}) => {
	if (Number.isInteger(mediaSource?.DefaultAudioStreamIndex)) {
		return mediaSource.DefaultAudioStreamIndex;
	}
	const defaultStream = audioStreams.find((stream) => stream?.IsDefault) || audioStreams[0];
	return Number.isInteger(defaultStream?.Index) ? defaultStream.Index : null;
};

export const resolvePlaybackVideoUrl = ({
	service,
	itemId,
	mediaSource,
	playbackInfo,
	resolvedPlayMethod
} = {}) => {
	const useTranscoding = resolvedPlayMethod === 'Transcode';
	if (useTranscoding) {
		if (!mediaSource?.TranscodingUrl) {
			throw new Error('Transcoding selected, but no transcoding URL was returned.');
		}
		return {
			videoUrl: `${service.serverUrl}${mediaSource.TranscodingUrl}`,
			isHls: mediaSource.TranscodingUrl.includes('.m3u8') ||
				mediaSource.TranscodingUrl.includes('/hls/') ||
				mediaSource.TranscodingContainer?.toLowerCase() === 'ts',
			useTranscoding
		};
	}
	if (resolvedPlayMethod === 'DirectStream' && mediaSource?.SupportsDirectStream) {
		if (mediaSource?.TranscodingUrl) {
			return {
				videoUrl: `${service.serverUrl}${mediaSource.TranscodingUrl}`,
				isHls: mediaSource.TranscodingUrl.includes('.m3u8') ||
					mediaSource.TranscodingUrl.includes('/hls/') ||
					mediaSource.TranscodingContainer?.toLowerCase() === 'ts',
				useTranscoding
			};
		}
		return {
			videoUrl: service.getPlaybackUrl(
				itemId,
				mediaSource.Id,
				playbackInfo?.PlaySessionId,
				mediaSource.ETag,
				mediaSource.Container,
				mediaSource.LiveStreamId
			),
			isHls: false,
			useTranscoding
		};
	}
	if (resolvedPlayMethod === 'DirectPlay' && mediaSource?.SupportsDirectPlay) {
		return {
			videoUrl: service.getPlaybackUrl(
				itemId,
				mediaSource.Id,
				playbackInfo?.PlaySessionId,
				mediaSource.ETag,
				mediaSource.Container,
				mediaSource.LiveStreamId
			),
			isHls: false,
			useTranscoding
		};
	}
	throw new Error('No supported playback method available');
};

export const selectHlsEnginePreference = ({
	isHls = false,
	isHdrLikeStream = false,
	nativeHlsSupported = false,
	hlsJsSupported = false
} = {}) => {
	if (!isHls) return {engine: null, allowNativeFallback: false, reason: 'not-hls'};
	if (nativeHlsSupported) {
		return {
			engine: 'native',
			allowNativeFallback: !isHdrLikeStream && hlsJsSupported,
			reason: isHdrLikeStream ? 'native-hdr' : 'native-available'
		};
	}
	if (hlsJsSupported) {
		return {engine: 'hls.js', allowNativeFallback: false, reason: 'hlsjs-available'};
	}
	return {engine: null, allowNativeFallback: false, reason: 'hls-unavailable'};
};
