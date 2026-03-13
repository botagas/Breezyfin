import {getMediaSourceDynamicRangeInfo} from '../playbackSelection';

const normalizeContainerParts = (container) => (
	String(container || '')
		.split(',')
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean)
);

export const usesMkvContainer = (mediaSource) => {
	const containerParts = normalizeContainerParts(mediaSource?.Container);
	return containerParts.includes('mkv') || containerParts.includes('matroska');
};

const stripMkvFromContainerList = (containerValue) => {
	const cleaned = normalizeContainerParts(containerValue)
		.filter((container) => container !== 'mkv' && container !== 'matroska');
	return cleaned.join(',');
};

export const buildPayloadWithoutMkvDirectPlay = (payload, selectedSourceId = null) => {
	if (!payload?.DeviceProfile) return null;
	const clonedPayload = JSON.parse(JSON.stringify(payload));
	const deviceProfile = clonedPayload.DeviceProfile;
	if (Array.isArray(deviceProfile.DirectPlayProfiles)) {
		deviceProfile.DirectPlayProfiles = deviceProfile.DirectPlayProfiles
			.map((profile) => {
				if (!profile || profile.Type !== 'Video') return profile;
				const nextContainer = stripMkvFromContainerList(profile.Container);
				if (!nextContainer) return null;
				return {
					...profile,
					Container: nextContainer
				};
			})
			.filter(Boolean);
	}
	if (Array.isArray(deviceProfile.ResponseProfiles)) {
		deviceProfile.ResponseProfiles = deviceProfile.ResponseProfiles
			.map((profile) => {
				if (!profile || profile.Type !== 'Video') return profile;
				const nextContainer = stripMkvFromContainerList(profile.Container);
				if (!nextContainer) return null;
				return {
					...profile,
					Container: nextContainer
				};
			})
			.filter(Boolean);
	}
	if (selectedSourceId) {
		clonedPayload.MediaSourceId = selectedSourceId;
	}
	return clonedPayload;
};

const DOLBY_VISION_VIDEO_RANGE_TYPES = [
	'DOVI',
	'DOVIWithHDR10',
	'DOVIWithHDR10Plus',
	'DOVIWithHLG',
	'DOVIWithSDR',
	'DOVIWithEL',
	'DOVIWithELHDR10Plus',
	'DOVIInvalid'
];
const DOLBY_VISION_VIDEO_RANGE_TYPE_VALUE = DOLBY_VISION_VIDEO_RANGE_TYPES.join('|');
const DOLBY_VISION_CODEC_SET = new Set(['hevc', 'vp9', 'av1']);

const forceDolbyVisionRangeConditions = (deviceProfile) => {
	if (!deviceProfile || !Array.isArray(deviceProfile.CodecProfiles)) return;
	deviceProfile.CodecProfiles.forEach((profile) => {
		const codecName = String(profile?.Codec || '').toLowerCase();
		if (!DOLBY_VISION_CODEC_SET.has(codecName)) return;
		if (!Array.isArray(profile.Conditions)) {
			profile.Conditions = [];
		}
		let rangeCondition = profile.Conditions.find((condition) => condition?.Property === 'VideoRangeType');
		if (!rangeCondition) {
			rangeCondition = {
				Condition: 'EqualsAny',
				Property: 'VideoRangeType',
				Value: DOLBY_VISION_VIDEO_RANGE_TYPE_VALUE,
				IsRequired: false
			};
			profile.Conditions.push(rangeCondition);
			return;
		}
		rangeCondition.Value = DOLBY_VISION_VIDEO_RANGE_TYPE_VALUE;
	});
};

export const buildForceDolbyVisionPayload = (payload) => {
	if (!payload?.DeviceProfile) return null;
	const clonedPayload = JSON.parse(JSON.stringify(payload));
	forceDolbyVisionRangeConditions(clonedPayload.DeviceProfile);
	clonedPayload.EnableDirectPlay = true;
	clonedPayload.EnableDirectStream = true;
	clonedPayload.EnableTranscoding = false;
	clonedPayload.AllowVideoStreamCopy = true;
	clonedPayload.AllowAudioStreamCopy = true;
	return clonedPayload;
};

export const hasDolbyVisionMediaSource = (mediaSources = []) => {
	if (!Array.isArray(mediaSources)) return false;
	return mediaSources.some((mediaSource) => getMediaSourceDynamicRangeInfo(mediaSource)?.id === 'DV');
};

export const summarizeMediaSourceRanges = (mediaSources = []) => {
	if (!Array.isArray(mediaSources) || mediaSources.length === 0) return 'none';
	return mediaSources
		.map((source) => {
			const rangeInfo = getMediaSourceDynamicRangeInfo(source);
			return `${rangeInfo?.id || 'SDR'}/${source?.Container || '-'}`;
		})
		.join(', ');
};

export const hasNonTranscodingDirectPath = (mediaSource) => {
	if (!mediaSource) return false;
	return !mediaSource.TranscodingUrl && (mediaSource.SupportsDirectPlay || mediaSource.SupportsDirectStream);
};

const AUDIO_ONLY_TRANSCODE_REASONS = new Set([
	'AudioCodecNotSupported',
	'AudioIsExternal',
	'SecondaryAudioNotSupported',
	'AudioChannelsNotSupported',
	'AudioProfileNotSupported',
	'AudioSampleRateNotSupported',
	'AudioBitDepthNotSupported',
	'AudioBitrateNotSupported',
	'UnknownAudioStreamInfo'
]);

const parseTranscodingUrlSearchParams = (transcodingUrl) => {
	if (!transcodingUrl) return null;
	try {
		return new URL(transcodingUrl, 'https://breezyfin.invalid').searchParams;
	} catch (_) {
		return null;
	}
};

const parseTranscodeReasonsFromMediaSource = (mediaSource) => {
	const searchParams = parseTranscodingUrlSearchParams(mediaSource?.TranscodingUrl);
	if (!searchParams) return [];
	const reasonsValue = searchParams.get('TranscodeReasons') || searchParams.get('transcodeReasons') || '';
	if (!reasonsValue) return [];
	return reasonsValue
		.split(',')
		.map((reason) => String(reason || '').trim())
		.filter(Boolean);
};

export const isForceDolbyVisionAudioOnlyTranscode = (mediaSource) => {
	if (!mediaSource?.TranscodingUrl) return false;
	const reasons = parseTranscodeReasonsFromMediaSource(mediaSource);
	if (reasons.length === 0) return false;
	if (reasons.some((reason) => !AUDIO_ONLY_TRANSCODE_REASONS.has(reason))) {
		return false;
	}
	const searchParams = parseTranscodingUrlSearchParams(mediaSource.TranscodingUrl);
	const requestedVideoCodec = String(
		searchParams?.get('VideoCodec') ||
		searchParams?.get('videoCodec') ||
		''
	).trim().toLowerCase();
	// Force DV should only permit transcode paths that explicitly preserve the original video bitstream.
	if (!requestedVideoCodec.includes('copy')) {
		return false;
	}
	return true;
};
