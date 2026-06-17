import {normalizeDynamicRangeCap} from '../../../utils/playbackDynamicRange';

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
		strictTranscodingMode: settings.forceTranscoding === true,
		enableTranscoding: settings.enableTranscoding !== false,
		maxBitrate: settings.maxBitrate,
		autoPlayNext: settings.autoPlayNext !== false,
		relaxedPlaybackProfile: settings.relaxedPlaybackProfile === true,
		forceDolbyVision,
		enableFmp4HlsContainerPreference,
		forceFmp4HlsContainerPreference,
		preferredAudioLanguage: String(settings.preferredAudioLanguage || '').trim().toLowerCase(),
		smartSubtitleTranscoding: settings.smartSubtitleTranscoding !== false,
		enableSubtitleBurnIn: settings.enableSubtitleBurnIn !== false,
		forceSubtitleBurnInOnHdr: settings.forceTranscodingWithSubtitles === true,
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
	pickPreferredAudio,
	pickPreferredSubtitle
} = {}) => {
	const defaultAudio = audioStreams.find((stream) => stream?.IsDefault) || audioStreams[0];
	const defaultSubtitle = subtitleStreams.find((stream) => stream?.IsDefault);
	const providedAudio = Number.isInteger(playbackOptions?.audioStreamIndex)
		? playbackOptions.audioStreamIndex
		: null;
	const providedSubtitle = Number.isInteger(playbackOptions?.subtitleStreamIndex)
		? playbackOptions.subtitleStreamIndex
		: null;
	const initialAudio = pickPreferredAudio(audioStreams, providedAudio, defaultAudio);
	const initialSubtitle = pickPreferredSubtitle(subtitleStreams, providedSubtitle, defaultSubtitle);
	const overrideAudio = Number.isInteger(playbackOverride?.audioStreamIndex)
		? playbackOverride.audioStreamIndex
		: null;
	const overrideSubtitle =
		(playbackOverride?.subtitleStreamIndex === -1 || Number.isInteger(playbackOverride?.subtitleStreamIndex))
			? playbackOverride.subtitleStreamIndex
			: null;
	return {
		selectedAudio: Number.isInteger(overrideAudio) ? overrideAudio : initialAudio,
		selectedSubtitle:
			(overrideSubtitle === -1 || Number.isInteger(overrideSubtitle))
				? overrideSubtitle
				: initialSubtitle
	};
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
