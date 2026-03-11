const getVideoRangeTypeConditionValue = (deviceProfile, codecName) => {
	const codecProfiles = Array.isArray(deviceProfile?.CodecProfiles)
		? deviceProfile.CodecProfiles
		: [];
	const codecProfile = codecProfiles.find((profile) => String(profile?.Codec || '').toLowerCase() === codecName);
	const conditions = Array.isArray(codecProfile?.Conditions) ? codecProfile.Conditions : [];
	const rangeCondition = conditions.find((condition) => condition?.Property === 'VideoRangeType');
	return rangeCondition?.Value || '';
};

export const buildPlaybackRequestDebug = (payload, data) => {
	const deviceProfile = payload?.DeviceProfile || {};
	const directPlayProfiles = Array.isArray(deviceProfile?.DirectPlayProfiles)
		? deviceProfile.DirectPlayProfiles
		: [];
	const videoDirectPlayContainers = directPlayProfiles
		.filter((profile) => profile?.Type === 'Video')
		.map((profile) => profile?.Container)
		.filter(Boolean)
		.join(',');
	return {
		enableDirectPlay: payload?.EnableDirectPlay !== false,
		enableDirectStream: payload?.EnableDirectStream !== false,
		enableTranscoding: payload?.EnableTranscoding !== false,
		allowVideoStreamCopy: payload?.AllowVideoStreamCopy !== false,
		allowAudioStreamCopy: payload?.AllowAudioStreamCopy !== false,
		hevcVideoRangeTypes: getVideoRangeTypeConditionValue(deviceProfile, 'hevc'),
		h264VideoRangeTypes: getVideoRangeTypeConditionValue(deviceProfile, 'h264'),
		videoDirectPlayContainers,
		maxStreamingBitrate: Number(payload?.MaxStreamingBitrate || deviceProfile?.MaxStreamingBitrate || 0) || null,
		mediaSourceCount: Array.isArray(data?.MediaSources) ? data.MediaSources.length : 0
	};
};
