jest.mock('../../utils/platformCapabilities', () => ({
	getRuntimePlatformCapabilities: jest.fn()
}));

import {getRuntimePlatformCapabilities} from '../../utils/platformCapabilities';
import {createVideoAudioMediaSource} from '../testUtils/playbackFixtures';
import {
	getSubtitleTranscodePolicy,
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

	it('uses client rendering for supported text subtitles in smart mode on SDR', () => {
		const mediaSource = createMediaSource({Codec: 'subrip'});
		const policy = getSubtitleTranscodePolicy(mediaSource, 3);

		expect(policy.mode).toBe('smart');
		expect(policy.reason).toBe('client-render-text');
		expect(policy.renderer).toBe('client');
		expect(policy.clientRender).toBe(true);
		expect(policy.fallbackBurnInAllowed).toBe(true);
		expect(shouldTranscodeForSubtitleSelection(mediaSource, 3)).toBe(false);
	});

	it('keeps ASS/SSA direct in manual mode unless selected for burn-in', () => {
		const assSource = createMediaSource({Codec: 'ass'});
		const ssaSource = createMediaSource({Codec: 'ssa'});

		expect(shouldTranscodeForSubtitleSelection(assSource, 3, {smartSubtitleTranscoding: false})).toBe(false);
		expect(shouldTranscodeForSubtitleSelection(ssaSource, 3, {smartSubtitleTranscoding: false})).toBe(false);
	});

	it('forces transcoding for user-selected burn-in formats in manual mode', () => {
		const mediaSource = createMediaSource({Codec: 'ass'});
		expect(
			shouldTranscodeForSubtitleSelection(mediaSource, 3, {
				smartSubtitleTranscoding: false,
				subtitleBurnInTextCodecs: ['ass']
			})
		).toBe(true);
	});

	it('ignores manual burn-in formats for client-renderable text in smart mode', () => {
		const mediaSource = createMediaSource({Codec: 'srt'});
		const policy = getSubtitleTranscodePolicy(mediaSource, 3, {
			subtitleBurnInTextCodecs: []
		});

		expect(policy.mode).toBe('smart');
		expect(policy.reason).toBe('client-render-text');
		expect(policy.requiresBurnIn).toBe(false);
		expect(policy.clientRender).toBe(true);
	});

	it('uses burn-in for non-client-renderable text subtitles in smart mode on SDR', () => {
		const mediaSource = createMediaSource({Codec: 'ass'});
		const policy = getSubtitleTranscodePolicy(mediaSource, 3);

		expect(policy.mode).toBe('smart');
		expect(policy.reason).toBe('smart-sdr-reliability');
		expect(policy.renderer).toBe('burn-in');
		expect(policy.requiresBurnIn).toBe(true);
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

	it('uses client rendering for supported text subtitles on HDR/DV', () => {
		const hdrSource = createMediaSource({
			Codec: 'srt'
		});
		hdrSource.MediaStreams[0].VideoRangeType = 'DOVIWithHDR10';

		const policy = getSubtitleTranscodePolicy(hdrSource, 3);

		expect(policy.reason).toBe('client-render-text');
		expect(policy.renderer).toBe('client');
		expect(policy.clientRender).toBe(true);
		expect(policy.requiresBurnIn).toBe(false);
		expect(policy.fallbackBurnInAllowed).toBe(false);
	});

	it('allows burn-in fallback for supported text subtitles on HDR/DV when forced', () => {
		const hdrSource = createMediaSource({
			Codec: 'srt'
		});
		hdrSource.MediaStreams[0].VideoRangeType = 'DOVIWithHDR10';

		const policy = getSubtitleTranscodePolicy(hdrSource, 3, {
			allowSubtitleBurnInOnHdr: true
		});

		expect(policy.reason).toBe('client-render-text');
		expect(policy.renderer).toBe('client');
		expect(policy.requiresBurnIn).toBe(false);
		expect(policy.fallbackBurnInAllowed).toBe(true);
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

	it('skips subtitle-triggered transcode when manual burn-in is disabled in manual mode', () => {
		const mediaSource = createMediaSource({Codec: 'ass'});
		expect(
			shouldTranscodeForSubtitleSelection(mediaSource, 3, {
				smartSubtitleTranscoding: false,
				enableSubtitleBurnIn: false,
				subtitleBurnInTextCodecs: ['ass']
			})
		).toBe(false);
	});

	it('ignores manual burn-in disabled flag in smart mode', () => {
		const mediaSource = createMediaSource({Codec: 'ass'});
		expect(
			shouldTranscodeForSubtitleSelection(mediaSource, 3, {
				enableSubtitleBurnIn: false,
				subtitleBurnInTextCodecs: []
			})
		).toBe(true);
	});

	it('detects ASS tokenized codec labels from display text when selected for burn-in in manual mode', () => {
		const mediaSource = createMediaSource({
			Codec: null,
			CodecTag: null,
			DisplayTitle: 'English ASS (Styled)'
		});

		expect(
			shouldTranscodeForSubtitleSelection(mediaSource, 3, {
				smartSubtitleTranscoding: false,
				subtitleBurnInTextCodecs: ['ass']
			})
		).toBe(true);
	});

	it('keeps external subtitle path when codec metadata is unavailable in manual mode', () => {
		const mediaSource = createMediaSource({
			Codec: null,
			CodecTag: null,
			DisplayTitle: null,
			DeliveryMethod: 'External'
		});

		expect(shouldTranscodeForSubtitleSelection(mediaSource, 3, {smartSubtitleTranscoding: false})).toBe(false);
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
