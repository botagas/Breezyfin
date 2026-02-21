export const buildPlaybackInfoBasePayload = (options = {}, {relaxedPlaybackProfile = false} = {}) => {
	const payload = {};
	if (options.mediaSourceId) {
		payload.MediaSourceId = options.mediaSourceId;
	}
	if (Number.isInteger(options.audioStreamIndex)) {
		payload.AudioStreamIndex = options.audioStreamIndex;
	}
	if (options.subtitleStreamIndex !== undefined && options.subtitleStreamIndex !== null) {
		payload.SubtitleStreamIndex = options.subtitleStreamIndex;
		// In strict/default mode prefer burned-in subtitles for webOS compatibility.
		// Relaxed profile lets Jellyfin choose alternate subtitle handling paths.
		if (!relaxedPlaybackProfile && options.subtitleStreamIndex >= 0) {
			payload.SubtitleMethod = 'Encode';
		}
	}
	if (options.startTimeTicks !== undefined) {
		payload.StartTimeTicks = options.startTimeTicks;
	}
	return payload;
};

export const buildDirectPlayProfiles = (forceTranscoding, relaxedPlaybackProfile) => {
	if (forceTranscoding) return [];
	const directPlayProfiles = [
		// webOS natively supports HLS
		{Container: 'hls', Type: 'Video', VideoCodec: 'h264,hevc', AudioCodec: 'aac,ac3,eac3,mp3'},
		// MP4 container - webOS TVs have excellent MP4 support
		{Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264,hevc,mpeg4,mpeg2video', AudioCodec: 'aac,ac3,eac3,mp3,mp2'},
		// MKV support varies by webOS version, but newer versions support it
		// Drop DTS from the direct-play list so Jellyfin will transcode DTS/DTS-HD
		{Container: 'mkv', Type: 'Video', VideoCodec: 'h264,hevc,mpeg4,mpeg2video', AudioCodec: 'aac,ac3,eac3,mp3,mp2'},
		// Audio direct play
		{Container: 'mp3', Type: 'Audio', AudioCodec: 'mp3'},
		{Container: 'aac', Type: 'Audio', AudioCodec: 'aac'},
		{Container: 'flac', Type: 'Audio', AudioCodec: 'flac'},
		{Container: 'webm', Type: 'Audio', AudioCodec: 'vorbis,opus'}
	];
	if (relaxedPlaybackProfile) {
		directPlayProfiles.push({
			Container: 'mkv',
			Type: 'Video',
			VideoCodec: 'h264,hevc,mpeg4,mpeg2video,vp9,av1',
			AudioCodec: 'aac,ac3,eac3,mp3,mp2,flac,opus,vorbis,pcm,dts,dca,truehd'
		});
	}
	return directPlayProfiles;
};

export const buildTranscodingProfiles = (relaxedPlaybackProfile) => {
	const transcodingProfiles = [
		// HLS transcoding - BEST for webOS (hardware accelerated)
		// Use stereo for maximum compatibility
		{
			Container: 'ts',
			Type: 'Video',
			AudioCodec: 'aac',
			VideoCodec: 'h264',
			Context: 'Streaming',
			Protocol: 'hls',
			MaxAudioChannels: '2',
			MinSegments: '1',
			BreakOnNonKeyFrames: false
		},
		// HLS Audio
		{
			Container: 'ts',
			Type: 'Audio',
			AudioCodec: 'aac',
			Context: 'Streaming',
			Protocol: 'hls',
			MaxAudioChannels: '2',
			BreakOnNonKeyFrames: false
		},
		// HTTP Audio fallback
		{Container: 'mp3', Type: 'Audio', AudioCodec: 'mp3', Context: 'Streaming', Protocol: 'http', MaxAudioChannels: '2'}
	];

	if (relaxedPlaybackProfile) {
		transcodingProfiles.push(
			{
				Container: 'ts',
				Type: 'Video',
				AudioCodec: 'aac,ac3,mp3',
				VideoCodec: 'h264',
				Context: 'Streaming',
				Protocol: 'hls',
				MaxAudioChannels: '6',
				MinSegments: '1',
				BreakOnNonKeyFrames: false
			},
			{
				Container: 'mp4',
				Type: 'Video',
				AudioCodec: 'aac,ac3,mp3',
				VideoCodec: 'h264',
				Context: 'Streaming',
				Protocol: 'http',
				MaxAudioChannels: '6'
			}
		);
	}

	return transcodingProfiles;
};

export const buildSubtitleProfiles = (relaxedPlaybackProfile) => {
	if (relaxedPlaybackProfile) {
		return [
			{Format: 'ass', Method: 'External'},
			{Format: 'ssa', Method: 'External'},
			{Format: 'srt', Method: 'External'},
			{Format: 'subrip', Method: 'External'},
			{Format: 'vtt', Method: 'External'},
			{Format: 'webvtt', Method: 'External'},
			{Format: 'ass', Method: 'Encode'},
			{Format: 'ssa', Method: 'Encode'},
			{Format: 'srt', Method: 'Encode'},
			{Format: 'subrip', Method: 'Encode'},
			{Format: 'vtt', Method: 'Encode'},
			{Format: 'webvtt', Method: 'Encode'},
			{Format: 'pgs', Method: 'Encode'},
			{Format: 'pgssub', Method: 'Encode'},
			{Format: 'dvbsub', Method: 'Encode'},
			{Format: 'dvdsub', Method: 'Encode'}
		];
	}
	// Burn-in all subtitles for webOS compatibility.
	// webOS has limited native subtitle support, so we transcode with burn-in.
	return [
		{Format: 'ass', Method: 'Encode'},
		{Format: 'ssa', Method: 'Encode'},
		{Format: 'srt', Method: 'Encode'},
		{Format: 'subrip', Method: 'Encode'},
		{Format: 'vtt', Method: 'Encode'},
		{Format: 'webvtt', Method: 'Encode'},
		{Format: 'pgs', Method: 'Encode'},
		{Format: 'pgssub', Method: 'Encode'},
		{Format: 'dvbsub', Method: 'Encode'},
		{Format: 'dvdsub', Method: 'Encode'}
	];
};

export const buildPlaybackDeviceProfile = ({
	relaxedPlaybackProfile,
	maxBitrateSetting,
	directPlayProfiles,
	transcodingProfiles,
	subtitleProfiles
}) => {
	return {
		Name: relaxedPlaybackProfile ? 'Breezyfin webOS TV (Relaxed)' : 'Breezyfin webOS TV',
		MaxStreamingBitrate: maxBitrateSetting ? maxBitrateSetting * 1000000 : 120000000,
		MaxStaticBitrate: 100000000,
		MusicStreamingTranscodingBitrate: 384000,
		DirectPlayProfiles: directPlayProfiles,
		TranscodingProfiles: transcodingProfiles,
		SubtitleProfiles: subtitleProfiles,
		ContainerProfiles: [],
		CodecProfiles: [
			{
				Type: 'Video',
				Codec: 'h264',
				Conditions: [
					{Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'high|main|baseline|constrained baseline'},
					{Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '51'},
					{Condition: 'NotEquals', Property: 'IsAnamorphic', Value: 'true', IsRequired: false}
				]
			},
			{
				Type: 'Video',
				Codec: 'hevc',
				Conditions: [
					{Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'main'},
					{Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '120'},
					{Condition: 'NotEquals', Property: 'IsAnamorphic', Value: 'true', IsRequired: false}
				]
			},
			{
				Type: 'VideoAudio',
				Codec: 'aac,mp3',
				Conditions: [
					{Condition: 'LessThanEqual', Property: 'AudioChannels', Value: '6'}
				]
			},
			{
				Type: 'VideoAudio',
				Codec: 'ac3,eac3',
				Conditions: [
					{Condition: 'LessThanEqual', Property: 'AudioChannels', Value: '6'}
				]
			}
		],
		ResponseProfiles: [
			{
				Type: 'Video',
				Container: 'm4v',
				MimeType: 'video/mp4'
			}
		]
	};
};

export const buildPlaybackRequestContext = (options = {}) => {
	const relaxedPlaybackProfile = options.relaxedPlaybackProfile === true;
	const forceTranscoding = options.forceTranscoding === true;
	const enableTranscoding = options.enableTranscoding !== false; // default on
	// Keep stream copy available on transcode sessions unless explicitly disabled.
	// This mirrors Jellyfin client behavior and prevents fragile full re-encode failures.
	const allowStreamCopyOnTranscode = options.allowStreamCopyOnTranscode !== false;
	const allowStreamCopy = enableTranscoding && (!forceTranscoding || allowStreamCopyOnTranscode);
	const maxBitrateSetting = options.maxBitrate ? parseInt(options.maxBitrate, 10) : null;
	const requestedAudioStreamIndex = Number.isInteger(options.audioStreamIndex) ? options.audioStreamIndex : null;
	const payload = buildPlaybackInfoBasePayload(options, {relaxedPlaybackProfile});
	const directPlayProfiles = buildDirectPlayProfiles(forceTranscoding, relaxedPlaybackProfile);
	const transcodingProfiles = buildTranscodingProfiles(relaxedPlaybackProfile);
	const subtitleProfiles = buildSubtitleProfiles(relaxedPlaybackProfile);

	payload.EnableDirectPlay = !forceTranscoding;
	payload.EnableDirectStream = !forceTranscoding;
	payload.EnableTranscoding = enableTranscoding;
	payload.AllowVideoStreamCopy = allowStreamCopy;
	payload.AllowAudioStreamCopy = allowStreamCopy;
	payload.AutoOpenLiveStream = true;
	if (maxBitrateSetting) {
		payload.MaxStreamingBitrate = maxBitrateSetting * 1000000; // convert Mbps to bps
	}
	payload.DeviceProfile = buildPlaybackDeviceProfile({
		relaxedPlaybackProfile,
		maxBitrateSetting,
		directPlayProfiles,
		transcodingProfiles,
		subtitleProfiles
	});

	return {
		payload,
		forceTranscoding,
		enableTranscoding,
		requestedAudioStreamIndex
	};
};

