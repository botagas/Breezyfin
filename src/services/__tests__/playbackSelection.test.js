jest.mock('../../utils/platformCapabilities', () => ({
	getRuntimePlatformCapabilities: jest.fn()
}));

import {getRuntimePlatformCapabilities} from '../../utils/platformCapabilities';
import {createVideoAudioMediaSource} from '../testUtils/playbackFixtures';
import {
	isTextSubtitleCodec,
	selectMediaSource,
	shouldTranscodeForSubtitleSelection
} from '../jellyfin/playbackSelection';

const createMediaSource = (subtitleStream) => ({
	MediaStreams: [
		{
			Type: 'Video',
			Index: 0,
			VideoRangeType: 'SDR',
			Codec: 'hevc'
		},
		{
			Type: 'Subtitle',
			Index: 3,
			...subtitleStream
		}
	]
});

const createVideoMediaSource = ({
	id,
	videoRangeType,
	container = 'mkv',
	supportsDirectPlay = true,
	supportsDirectStream = true,
	supportsTranscoding = true
}) => createVideoAudioMediaSource({
	id,
	videoRangeType,
	container,
	supportsDirectPlay,
	supportsDirectStream,
	supportsTranscoding
});

describe('playbackSelection subtitle compatibility', () => {
	beforeEach(() => {
		getRuntimePlatformCapabilities.mockReturnValue({
			playback: {
				supportsDolbyVision: true,
				supportsDolbyVisionInMkv: true
			}
		});
	});

	it('keeps direct/direct-stream for common text subtitles', () => {
		const mediaSource = createMediaSource({Codec: 'subrip'});
		expect(shouldTranscodeForSubtitleSelection(mediaSource, 3)).toBe(false);
	});

	it('keeps ASS/SSA direct by default (quality-first policy)', () => {
		const assSource = createMediaSource({Codec: 'ass'});
		const ssaSource = createMediaSource({Codec: 'ssa'});

		expect(shouldTranscodeForSubtitleSelection(assSource, 3)).toBe(false);
		expect(shouldTranscodeForSubtitleSelection(ssaSource, 3)).toBe(false);
	});

	it('forces transcoding for user-selected burn-in formats', () => {
		const mediaSource = createMediaSource({Codec: 'ass'});
		expect(
			shouldTranscodeForSubtitleSelection(mediaSource, 3, {
				subtitleBurnInTextCodecs: ['ass']
			})
		).toBe(true);
	});

	it('avoids subtitle-triggered transcode on HDR/DV by default', () => {
		const hdrSource = createMediaSource({
			Codec: 'ass'
		});
		hdrSource.MediaStreams[0].VideoRangeType = 'DOVIWithHDR10';

		expect(
			shouldTranscodeForSubtitleSelection(hdrSource, 3, {
				subtitleBurnInTextCodecs: ['ass']
			})
		).toBe(false);
	});

	it('allows subtitle-triggered transcode on HDR/DV when forced', () => {
		const hdrSource = createMediaSource({
			Codec: 'ass'
		});
		hdrSource.MediaStreams[0].VideoRangeType = 'DOVIWithHDR10';

		expect(
			shouldTranscodeForSubtitleSelection(hdrSource, 3, {
				subtitleBurnInTextCodecs: ['ass'],
				allowSubtitleBurnInOnHdr: true
			})
		).toBe(true);
	});

	it('skips subtitle-triggered transcode when subtitle burn-in is disabled', () => {
		const mediaSource = createMediaSource({Codec: 'ass'});
		expect(
			shouldTranscodeForSubtitleSelection(mediaSource, 3, {
				enableSubtitleBurnIn: false,
				subtitleBurnInTextCodecs: ['ass']
			})
		).toBe(false);
	});

	it('detects ASS tokenized codec labels from display text when selected for burn-in', () => {
		const mediaSource = createMediaSource({
			Codec: null,
			CodecTag: null,
			DisplayTitle: 'English ASS (Styled)'
		});

		expect(
			shouldTranscodeForSubtitleSelection(mediaSource, 3, {
				subtitleBurnInTextCodecs: ['ass']
			})
		).toBe(true);
	});

	it('keeps external subtitle path when codec metadata is unavailable', () => {
		const mediaSource = createMediaSource({
			Codec: null,
			CodecTag: null,
			DisplayTitle: null,
			DeliveryMethod: 'External'
		});

		expect(shouldTranscodeForSubtitleSelection(mediaSource, 3)).toBe(false);
	});

	it('classifies tokenized subtitle codec names as text codecs', () => {
		expect(isTextSubtitleCodec('english ass styled')).toBe(true);
		expect(isTextSubtitleCodec('subrip')).toBe(true);
		expect(isTextSubtitleCodec('pgs')).toBe(false);
	});
});

describe('playbackSelection dynamic-range source preference', () => {
	beforeEach(() => {
		getRuntimePlatformCapabilities.mockReturnValue({
			playback: {
				supportsDolbyVision: true,
				supportsDolbyVisionInMkv: true
			}
		});
	});

	it('prefers Dolby Vision sources when requested and available', () => {
		const mediaSources = [
			createVideoMediaSource({
				id: 'hdr10-source',
				videoRangeType: 'HDR10'
			}),
			createVideoMediaSource({
				id: 'dv-source',
				videoRangeType: 'DOVIWithHDR10'
			})
		];

		const selection = selectMediaSource(mediaSources, {
			preferDolbyVision: true,
			dynamicRangeCap: 'auto'
		});

		expect(selection.reason).toBe('preferDolbyVision');
		expect(selection.source?.Id).toBe('dv-source');
	});

	it('falls back to non-DV source when avoidDolbyVision is enabled', () => {
		const mediaSources = [
			createVideoMediaSource({
				id: 'dv-source',
				videoRangeType: 'DOVIWithHDR10'
			}),
			createVideoMediaSource({
				id: 'hdr10-source',
				videoRangeType: 'HDR10'
			})
		];

		const selection = selectMediaSource(mediaSources, {
			avoidDolbyVision: true,
			dynamicRangeCap: 'hdr10'
		});

		expect(selection.reason).toBe('avoidDolbyVision');
		expect(selection.source?.Id).toBe('hdr10-source');
	});
});
