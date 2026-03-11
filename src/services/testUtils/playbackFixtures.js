export const createVideoAudioMediaSource = ({
	id = 'source-1',
	videoRangeType = 'HDR10',
	container = 'mkv',
	supportsDirectPlay = true,
	supportsDirectStream = true,
	supportsTranscoding = true,
	defaultAudioStreamIndex = 0,
	videoCodec = 'hevc',
	videoWidth = 3840,
	audioStreams = [{Codec: 'eac3', Index: 0, IsDefault: true}]
} = {}) => ({
	Id: id,
	Container: container,
	SupportsDirectPlay: supportsDirectPlay,
	SupportsDirectStream: supportsDirectStream,
	SupportsTranscoding: supportsTranscoding,
	DefaultAudioStreamIndex: defaultAudioStreamIndex,
	MediaStreams: [
		{
			Type: 'Video',
			Codec: videoCodec,
			VideoRangeType: videoRangeType,
			Width: videoWidth
		},
		...audioStreams.map((stream) => ({
			Type: 'Audio',
			Codec: stream?.Codec || '',
			Index: Number.isInteger(stream?.Index) ? stream.Index : 0,
			IsDefault: stream?.IsDefault === true
		}))
	]
});

