import {getRuntimePlatformCapabilities} from '../../utils/platformCapabilities';
import {normalizeDynamicRangeCap} from '../../utils/playbackDynamicRange';

const VIDEO_RANGE_TYPES = {
	DV_FALLBACKS: [
		'DOVIWithHDR10',
		'DOVIWithHDR10Plus',
		'DOVIWithHLG',
		'DOVIWithSDR',
		'DOVIWithEL',
		'DOVIWithELHDR10Plus',
		'DOVIInvalid'
	],
	DV_HDR_ONLY_FALLBACKS: [
		'DOVIWithHDR10',
		'DOVIWithHDR10Plus',
		'DOVIWithHLG',
		'DOVIWithSDR'
	]
};

const addUnique = (target, values) => {
	values.forEach((value) => {
		if (!target.includes(value)) {
			target.push(value);
		}
	});
};

const getPlaybackCapabilities = () => {
	const runtimeCapabilities = getRuntimePlatformCapabilities();
	return runtimeCapabilities?.playback || {};
};

const getContainerAudioCodecs = (playbackCapabilities, container) => {
	const map = playbackCapabilities.audioCodecsByContainer || {};
	const codecs = map[container] || playbackCapabilities.audioCodecs || ['aac', 'mp3', 'ac3', 'eac3'];
	return Array.from(new Set(codecs.map((codec) => codec.toLowerCase())));
};

export const buildVideoRangeTypeValue = (playbackCapabilities, dynamicRangeCap = 'auto') => {
	const cap = normalizeDynamicRangeCap(dynamicRangeCap);
	const rangeTypes = ['SDR'];
	const supportsHdr10 = playbackCapabilities.supportsHdr10 !== false;
	const supportsHlg = playbackCapabilities.supportsHlg !== false;
	const supportsDolbyVision = playbackCapabilities.supportsDolbyVision === true;

	if (supportsHdr10) {
		addUnique(rangeTypes, ['HDR10', 'HDR10Plus']);
	}
	if (supportsHlg) {
		addUnique(rangeTypes, ['HLG']);
	}

	if (cap === 'auto') {
		if (supportsDolbyVision) {
			addUnique(rangeTypes, ['DOVI']);
		}
		addUnique(rangeTypes, VIDEO_RANGE_TYPES.DV_FALLBACKS);
	} else if (cap === 'hdr10') {
		addUnique(rangeTypes, VIDEO_RANGE_TYPES.DV_HDR_ONLY_FALLBACKS);
	} else if (cap === 'sdr') {
		addUnique(rangeTypes, ['DOVIWithSDR']);
	}

	return rangeTypes.join('|');
};

export const buildPlaybackInfoBasePayload = (
	options = {},
	{relaxedPlaybackProfile = false, forceSubtitleBurnIn = false} = {}
) => {
	const payload = {};
	if (options.mediaSourceId) {
		payload.MediaSourceId = options.mediaSourceId;
	}
	if (Number.isInteger(options.audioStreamIndex)) {
		payload.AudioStreamIndex = options.audioStreamIndex;
	}
	if (options.subtitleStreamIndex !== undefined && options.subtitleStreamIndex !== null) {
		payload.SubtitleStreamIndex = options.subtitleStreamIndex;
		if (!relaxedPlaybackProfile && forceSubtitleBurnIn && options.subtitleStreamIndex >= 0) {
			payload.SubtitleMethod = 'Encode';
		}
	}
	if (options.startTimeTicks !== undefined) {
		payload.StartTimeTicks = options.startTimeTicks;
	}
	return payload;
};

export const buildDirectPlayProfiles = (forceTranscoding, relaxedPlaybackProfile, playbackCapabilities) => {
	if (forceTranscoding) return [];

	const supportsHevc = playbackCapabilities.supportsHevc !== false;
	const supportsAv1 = playbackCapabilities.supportsAv1 === true;
	const supportsVp9 = playbackCapabilities.supportsVp9 === true;
	const webosVersion = Number.isFinite(playbackCapabilities.webosVersion) ? playbackCapabilities.webosVersion : 0;
	const supportsMkv = webosVersion >= 4 || playbackCapabilities.webosVersion == null;
	const supportsWebm = webosVersion >= 5;

	const mp4VideoCodecs = ['h264'];
	if (supportsHevc) mp4VideoCodecs.push('hevc');
	if (supportsAv1) mp4VideoCodecs.push('av1');

	const mkvVideoCodecs = ['h264', 'mpeg4', 'mpeg2video'];
	if (supportsHevc) mkvVideoCodecs.push('hevc');
	if (supportsVp9) mkvVideoCodecs.push('vp9');
	if (supportsAv1) mkvVideoCodecs.push('av1');

	const mp4AudioCodecs = getContainerAudioCodecs(playbackCapabilities, 'mp4');
	const mkvAudioCodecs = getContainerAudioCodecs(playbackCapabilities, 'mkv');
	const tsAudioCodecs = getContainerAudioCodecs(playbackCapabilities, 'ts');
	const hlsAudioCodecs = getContainerAudioCodecs(playbackCapabilities, 'hls');

	const directPlayProfiles = [
		{
			Container: 'hls',
			Type: 'Video',
			VideoCodec: mp4VideoCodecs.join(','),
			AudioCodec: hlsAudioCodecs.join(',')
		},
		{
			Container: 'mp4,m4v,mov',
			Type: 'Video',
			VideoCodec: mp4VideoCodecs.join(','),
			AudioCodec: mp4AudioCodecs.join(',')
		},
		{
			Container: 'ts,mpegts,m2ts',
			Type: 'Video',
			VideoCodec: mp4VideoCodecs.join(','),
			AudioCodec: tsAudioCodecs.join(',')
		},
		{Container: 'mp3', Type: 'Audio', AudioCodec: 'mp3'},
		{Container: 'aac', Type: 'Audio', AudioCodec: 'aac'},
		{Container: 'flac', Type: 'Audio', AudioCodec: 'flac'}
	];

	if (supportsMkv) {
		directPlayProfiles.push({
			Container: 'mkv',
			Type: 'Video',
			VideoCodec: mkvVideoCodecs.join(','),
			AudioCodec: mkvAudioCodecs.join(',')
		});
	}

	if (supportsWebm && relaxedPlaybackProfile) {
		directPlayProfiles.push({
			Container: 'webm',
			Type: 'Video',
			VideoCodec: ['vp8', supportsVp9 ? 'vp9' : null, supportsAv1 ? 'av1' : null].filter(Boolean).join(','),
			AudioCodec: 'vorbis,opus'
		});
		directPlayProfiles.push({Container: 'webm', Type: 'Audio', AudioCodec: 'vorbis,opus'});
	}

	return directPlayProfiles;
};

export const buildTranscodingProfiles = (relaxedPlaybackProfile, playbackCapabilities) => {
	const maxAudioChannels = String(playbackCapabilities.maxAudioChannels || 6);
	const supportsHevc = playbackCapabilities.supportsHevc !== false;
	const hlsContainer = playbackCapabilities.nativeHlsFmp4 ? 'mp4' : 'ts';
	const hlsAudioCodecs = Array.from(
		new Set(
			getContainerAudioCodecs(playbackCapabilities, 'hls').filter((codec) => ['aac', 'ac3', 'eac3', 'mp3'].includes(codec))
		)
	);
	if (!hlsAudioCodecs.length) {
		hlsAudioCodecs.push('aac');
	}

	const transcodingProfiles = [
		...(supportsHevc ? [{
			Container: hlsContainer,
			Type: 'Video',
			AudioCodec: hlsAudioCodecs.join(','),
			VideoCodec: 'hevc',
			Context: 'Streaming',
			Protocol: 'hls',
			MaxAudioChannels: maxAudioChannels,
			MinSegments: '1',
			BreakOnNonKeyFrames: false
		}] : []),
		{
			Container: hlsContainer,
			Type: 'Video',
			AudioCodec: hlsAudioCodecs.join(','),
			VideoCodec: 'h264',
			Context: 'Streaming',
			Protocol: 'hls',
			MaxAudioChannels: maxAudioChannels,
			MinSegments: '1',
			BreakOnNonKeyFrames: false
		},
		{
			Container: 'mp4',
			Type: 'Video',
			AudioCodec: 'aac,ac3,eac3',
			VideoCodec: 'h264',
			Context: 'Static',
			MaxAudioChannels: maxAudioChannels
		},
		{
			Container: 'mp3',
			Type: 'Audio',
			AudioCodec: 'mp3',
			Context: 'Streaming',
			Protocol: 'http'
		},
		{
			Container: 'aac',
			Type: 'Audio',
			AudioCodec: 'aac',
			Context: 'Streaming',
			Protocol: 'http'
		}
	];

	if (relaxedPlaybackProfile && supportsHevc) {
		transcodingProfiles.push({
			Container: 'mp4',
			Type: 'Video',
			AudioCodec: 'aac,ac3,eac3',
			VideoCodec: 'hevc',
			Context: 'Streaming',
			Protocol: 'http',
			MaxAudioChannels: maxAudioChannels
		});
	}

	return transcodingProfiles;
};

export const buildSubtitleProfiles = ({relaxedPlaybackProfile, forceSubtitleBurnIn}) => {
	const textFormats = ['srt', 'subrip', 'vtt', 'webvtt', 'ass', 'ssa', 'smi', 'sami', 'ttml', 'dfxp'];
	const imageFormats = ['pgs', 'pgssub', 'dvbsub', 'dvdsub'];

	if (forceSubtitleBurnIn) {
		return [...textFormats, ...imageFormats].map((format) => ({Format: format, Method: 'Encode'}));
	}

	const profiles = textFormats.map((format) => ({Format: format, Method: 'External'}));
	if (relaxedPlaybackProfile) {
		textFormats.forEach((format) => {
			profiles.push({Format: format, Method: 'Encode'});
		});
	}
	imageFormats.forEach((format) => {
		profiles.push({Format: format, Method: 'Encode'});
	});
	return profiles;
};

export const buildPlaybackDeviceProfile = ({
	relaxedPlaybackProfile,
	maxBitrateSetting,
	directPlayProfiles,
	transcodingProfiles,
	subtitleProfiles,
	playbackCapabilities,
	dynamicRangeCap
}) => {
	const maxStreamingBitrate = maxBitrateSetting
		? maxBitrateSetting * 1000000
		: (playbackCapabilities.maxStreamingBitrate || 120000000);
	const maxAudioChannels = String(playbackCapabilities.maxAudioChannels || 6);
	const videoRangeTypes = buildVideoRangeTypeValue(playbackCapabilities, dynamicRangeCap);

	const codecProfiles = [
		{
			Type: 'Video',
			Codec: 'h264',
			Conditions: [
				{Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'high|main|baseline|constrained baseline', IsRequired: false},
				{Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '51', IsRequired: false},
				{Condition: 'EqualsAny', Property: 'VideoRangeType', Value: 'SDR|HDR10|HDR10Plus|HLG', IsRequired: false},
				{Condition: 'NotEquals', Property: 'IsAnamorphic', Value: 'true', IsRequired: false}
			]
		},
		{
			Type: 'Video',
			Codec: 'hevc',
			Conditions: [
				{Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'main|main 10', IsRequired: false},
				{Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '186', IsRequired: false},
				{Condition: 'EqualsAny', Property: 'VideoRangeType', Value: videoRangeTypes, IsRequired: false},
				{Condition: 'NotEquals', Property: 'IsAnamorphic', Value: 'true', IsRequired: false}
			]
		},
		{
			Type: 'Video',
			Codec: 'vp9',
			Conditions: [
				{Condition: 'EqualsAny', Property: 'VideoRangeType', Value: videoRangeTypes, IsRequired: false}
			]
		},
		{
			Type: 'Video',
			Codec: 'av1',
			Conditions: [
				{Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'main', IsRequired: false},
				{Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '15', IsRequired: false},
				{Condition: 'EqualsAny', Property: 'VideoRangeType', Value: videoRangeTypes, IsRequired: false}
			]
		},
		{
			Type: 'VideoAudio',
			Codec: 'aac,mp3,ac3,eac3',
			Conditions: [
				{Condition: 'LessThanEqual', Property: 'AudioChannels', Value: maxAudioChannels, IsRequired: false}
			]
		}
	];

	const responseProfiles = [
		{
			Type: 'Video',
			Container: 'm4v',
			MimeType: 'video/mp4'
		},
		{
			Type: 'Video',
			Container: 'mkv',
			MimeType: 'video/x-matroska'
		}
	];

	return {
		Name: relaxedPlaybackProfile ? 'Breezyfin webOS TV (Relaxed)' : 'Breezyfin webOS TV',
		MaxStreamingBitrate: maxStreamingBitrate,
		MaxStaticBitrate: maxStreamingBitrate,
		MusicStreamingTranscodingBitrate: 384000,
		DirectPlayProfiles: directPlayProfiles,
		TranscodingProfiles: transcodingProfiles,
		SubtitleProfiles: subtitleProfiles,
		ContainerProfiles: [],
		CodecProfiles: codecProfiles,
		ResponseProfiles: responseProfiles
	};
};

export const buildPlaybackRequestContext = (options = {}) => {
	const playbackCapabilities = getPlaybackCapabilities();
	const relaxedPlaybackProfile = options.relaxedPlaybackProfile === true;
	const forceTranscoding = options.forceTranscoding === true;
	const enableTranscoding = options.enableTranscoding !== false;
	const forceSubtitleBurnIn = options.forceSubtitleBurnIn === true;
	const dynamicRangeCap = normalizeDynamicRangeCap(options.dynamicRangeCap);
	// Keep stream copy available on transcode sessions unless explicitly disabled.
	const allowStreamCopyOnTranscode = options.allowStreamCopyOnTranscode !== false;
	const allowStreamCopy = enableTranscoding && (!forceTranscoding || allowStreamCopyOnTranscode);
	const maxBitrateSetting = options.maxBitrate ? parseInt(options.maxBitrate, 10) : null;
	const requestedAudioStreamIndex = Number.isInteger(options.audioStreamIndex) ? options.audioStreamIndex : null;
	const payload = buildPlaybackInfoBasePayload(options, {
		relaxedPlaybackProfile,
		forceSubtitleBurnIn
	});
	const directPlayProfiles = buildDirectPlayProfiles(forceTranscoding, relaxedPlaybackProfile, playbackCapabilities);
	const transcodingProfiles = buildTranscodingProfiles(relaxedPlaybackProfile, playbackCapabilities);
	const subtitleProfiles = buildSubtitleProfiles({relaxedPlaybackProfile, forceSubtitleBurnIn});

	payload.EnableDirectPlay = !forceTranscoding;
	payload.EnableDirectStream = !forceTranscoding;
	payload.EnableTranscoding = enableTranscoding;
	payload.AllowVideoStreamCopy = allowStreamCopy;
	payload.AllowAudioStreamCopy = allowStreamCopy;
	payload.AutoOpenLiveStream = true;
	if (maxBitrateSetting) {
		payload.MaxStreamingBitrate = maxBitrateSetting * 1000000;
	}
	payload.DeviceProfile = buildPlaybackDeviceProfile({
		relaxedPlaybackProfile,
		maxBitrateSetting,
		directPlayProfiles,
		transcodingProfiles,
		subtitleProfiles,
		playbackCapabilities,
		dynamicRangeCap
	});

	return {
		payload,
		forceTranscoding,
		enableTranscoding,
		requestedAudioStreamIndex,
		forceSubtitleBurnIn,
		dynamicRangeCap
	};
};
