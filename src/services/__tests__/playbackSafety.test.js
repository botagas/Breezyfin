import {
	buildDolbyVisionOriginalQualityDecision,
	buildDynamicRangeFallbackDecision,
	classifyDolbyVisionPlaybackPath,
	findSupportedAudioSwitch,
	isConfirmedDynamicRangeFallbackPath
} from '../jellyfin/playback-api/playbackSafety';

const createDolbyVisionSource = ({
	transcodingUrl,
	audioStreams = []
} = {}) => ({
	Id: 'dv-source',
	TranscodingUrl: transcodingUrl,
	MediaStreams: [
		{
			Type: 'Video',
			Codec: 'hevc',
			VideoRangeType: 'DOVIWithHDR10'
		},
		...audioStreams.map((stream) => ({Type: 'Audio', ...stream}))
	]
});

describe('Dolby Vision playback safety', () => {
	it('blocks a bitrate-driven DV video transcode', () => {
		const result = classifyDolbyVisionPlaybackPath({
			mediaSource: createDolbyVisionSource({
				transcodingUrl: '/Videos/item/master.m3u8?VideoCodec=hevc&TranscodeReasons=ContainerBitrateExceedsLimit'
			}),
			playMethod: 'Transcode'
		});

		expect(result).toEqual(expect.objectContaining({
			classification: 'unsafe-video-transcode',
			reason: 'video-codec-not-copy',
			videoCodec: 'hevc',
			transcodeReasons: ['ContainerBitrateExceedsLimit']
		}));
	});

	it('allows a DV audio-only transcode when video is copied', () => {
		const result = classifyDolbyVisionPlaybackPath({
			mediaSource: createDolbyVisionSource({
				transcodingUrl: '/Videos/item/master.m3u8?VideoCodec=copy&TranscodeReasons=AudioCodecNotSupported'
			}),
			playMethod: 'Transcode'
		});

		expect(result.classification).toBe('audio-only-transcode-safe');
	});

	it('blocks subtitle encoding even when the DV video codec says copy', () => {
		const result = classifyDolbyVisionPlaybackPath({
			mediaSource: createDolbyVisionSource({
				transcodingUrl: '/Videos/item/master.m3u8?VideoCodec=copy&SubtitleMethod=Encode&TranscodeReasons=AudioCodecNotSupported'
			}),
			playMethod: 'Transcode'
		});

		expect(result).toEqual(expect.objectContaining({
			classification: 'unsafe-video-transcode',
			reason: 'subtitle-video-encode'
		}));
	});

	it('does not treat a full video encode as preserved HDR output', () => {
		const hdrEncodePath = classifyDolbyVisionPlaybackPath({
			mediaSource: createDolbyVisionSource({
				transcodingUrl: '/Videos/item/master.m3u8?VideoCodec=hevc&hevc-rangetype=SDR,HDR10,HLG&TranscodeReasons=VideoRangeTypeNotSupported'
			}),
			playMethod: 'Transcode'
		});

		expect(isConfirmedDynamicRangeFallbackPath({
			pathClassification: hdrEncodePath,
			target: 'hdr10'
		})).toBe(false);
	});

	it('accepts a confirmed SDR video encode even when URL range parameters describe source capabilities', () => {
		const sdrPath = classifyDolbyVisionPlaybackPath({
			mediaSource: createDolbyVisionSource({
				transcodingUrl: '/Videos/item/master.m3u8?VideoCodec=h264&h264-rangetype=SDR,DOVIWithSDR&TranscodeReasons=VideoRangeTypeNotSupported'
			}),
			playMethod: 'Transcode'
		});

		expect(isConfirmedDynamicRangeFallbackPath({
			pathClassification: sdrPath,
			target: 'sdr'
		})).toBe(true);
	});

	it('rejects an HEVC Main 10 path after SDR fallback consent', () => {
		const sdrPath = classifyDolbyVisionPlaybackPath({
			mediaSource: createDolbyVisionSource({
				transcodingUrl: '/Videos/item/master.m3u8?VideoCodec=hevc&hevc-rangetype=SDR,DOVIWithSDR&TranscodeReasons=ContainerBitrateExceedsLimit'
			}),
			playMethod: 'Transcode'
		});

		expect(isConfirmedDynamicRangeFallbackPath({
			pathClassification: sdrPath,
			target: 'sdr'
		})).toBe(false);
	});

	it('offers a one-shot original-quality retry for a bitrate-only DV encode', () => {
		const mediaSource = createDolbyVisionSource({
			transcodingUrl: '/Videos/item/master.m3u8?VideoCodec=hevc&TranscodeReasons=ContainerBitrateExceedsLimit'
		});
		mediaSource.Id = 'source-1';
		const pathClassification = classifyDolbyVisionPlaybackPath({
			mediaSource,
			playMethod: 'Transcode'
		});

		expect(buildDolbyVisionOriginalQualityDecision({
			mediaSource,
			pathClassification,
			maxBitrate: 40,
			itemId: 'item-1'
		})).toEqual(expect.objectContaining({
			type: 'dolby-vision-original-quality',
			proposedBitrateMbps: 100,
			configuredBitrateMbps: 40,
			mediaSourceId: 'source-1'
		}));
		expect(buildDolbyVisionOriginalQualityDecision({
			mediaSource,
			pathClassification,
			maxBitrate: 100
		})).toBeNull();
		expect(buildDolbyVisionOriginalQualityDecision({
			mediaSource,
			pathClassification,
			maxBitrate: 40,
			confirmedOriginalQuality: true
		})).toBeNull();
	});

	it('skips the nonviable HDR prompt when video transcoding is forced', () => {
		const mediaSource = createDolbyVisionSource({
			transcodingUrl: '/Videos/item/master.m3u8?VideoCodec=hevc&TranscodeReasons=ContainerBitrateExceedsLimit'
		});

		expect(buildDynamicRangeFallbackDecision({
			mediaSource,
			dynamicRangeCap: 'auto',
			forceVideoTranscoding: true
		})).toEqual(expect.objectContaining({
			type: 'dynamic-range-fallback',
			proposedRange: 'sdr'
		}));
	});
});

describe('explicit audio compatibility decisions', () => {
	it('proposes a supported same-language alternative for DTS-HD', () => {
		const result = findSupportedAudioSwitch({
			mediaSource: createDolbyVisionSource({
				audioStreams: [
					{Index: 1, Codec: 'dts-hd', Language: 'eng', Channels: 8, Title: 'DTS-HD MA'},
					{Index: 2, Codec: 'eac3', Language: 'eng', Channels: 6, Title: 'Dolby Digital Plus'},
					{Index: 3, Codec: 'aac', Language: 'jpn', Channels: 2}
				]
			}),
			selectedAudioStreamIndex: 1,
			preferredAudioLanguage: 'eng'
		});

		expect(result).toEqual({
			selectedTrack: expect.objectContaining({index: 1, codec: 'dts-hd'}),
			proposedTrack: expect.objectContaining({index: 2, codec: 'eac3'})
		});
	});

	it('returns no decision when no supported alternative exists', () => {
		const result = findSupportedAudioSwitch({
			mediaSource: createDolbyVisionSource({
				audioStreams: [{Index: 1, Codec: 'dts', Language: 'eng'}]
			}),
			selectedAudioStreamIndex: 1
		});

		expect(result).toBeNull();
	});
});
