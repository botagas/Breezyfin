jest.mock('../platformCapabilities', () => ({
	getRuntimePlatformCapabilities: jest.fn()
}));

import {getRuntimePlatformCapabilities} from '../platformCapabilities';
import {createVideoAudioMediaSource} from '../../services/testUtils/playbackFixtures';
import {
	determinePlayMethod,
	getSubtitleTranscodePolicy,
	isTextSubtitleCodec,
	selectMediaSource,
	shouldTranscodeForSubtitleSelection
} from '../playbackSelection';

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
		expect(policy.renderer).toBe('client-text');
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

	it('uses lightweight client rendering for ASS/SSA subtitles in smart auto mode on SDR', () => {
		const mediaSource = createMediaSource({Codec: 'ass'});
		const policy = getSubtitleTranscodePolicy(mediaSource, 3);

		expect(policy.mode).toBe('smart');
		expect(policy.reason).toBe('client-render-ass-lightweight');
		expect(policy.renderer).toBe('client-ass-lightweight');
		expect(policy.clientRender).toBe(true);
		expect(policy.requiresBurnIn).toBe(false);
	});

	it('uses libass client rendering for ASS/SSA subtitles when explicitly selected', () => {
		const mediaSource = createMediaSource({Codec: 'ass'});
		const policy = getSubtitleTranscodePolicy(mediaSource, 3, {
			assSubtitleRenderer: 'libass'
		});

		expect(policy.mode).toBe('smart');
		expect(policy.reason).toBe('client-render-ass-libass');
		expect(policy.renderer).toBe('client-ass-libass');
		expect(policy.clientRender).toBe(true);
		expect(policy.requiresBurnIn).toBe(false);
	});

	it('uses manual-canvas libass client rendering when explicitly selected', () => {
		const mediaSource = createMediaSource({Codec: 'ass'});
		const policy = getSubtitleTranscodePolicy(mediaSource, 3, {
			assSubtitleRenderer: 'libass-manual'
		});

		expect(policy.mode).toBe('smart');
		expect(policy.reason).toBe('client-render-ass-libass-manual');
		expect(policy.renderer).toBe('client-ass-libass-manual');
		expect(policy.clientRender).toBe(true);
		expect(policy.requiresBurnIn).toBe(false);
	});

	it('uses experimental ASS renderer ids when JASSUB or ASS.js are explicitly selected', () => {
		const mediaSource = createMediaSource({Codec: 'ass'});

		expect(getSubtitleTranscodePolicy(mediaSource, 3, {
			assSubtitleRenderer: 'jassub'
		})).toEqual(expect.objectContaining({
			reason: 'client-render-ass-jassub',
			renderer: 'client-ass-jassub',
			clientRender: true,
			requiresBurnIn: false
		}));
		expect(getSubtitleTranscodePolicy(mediaSource, 3, {
			assSubtitleRenderer: 'jassub-manual'
		})).toEqual(expect.objectContaining({
			reason: 'client-render-ass-jassub-manual',
			renderer: 'client-ass-jassub-manual',
			clientRender: true,
			requiresBurnIn: false
		}));
		expect(getSubtitleTranscodePolicy(mediaSource, 3, {
			assSubtitleRenderer: 'assjs'
		})).toEqual(expect.objectContaining({
			reason: 'client-render-ass-assjs',
			renderer: 'client-ass-assjs',
			clientRender: true,
			requiresBurnIn: false
		}));
	});

	it('honors explicit ASS renderer values without release-channel gating', () => {
		jest.isolateModules(() => {
			jest.doMock('../../utils/platformCapabilities', () => ({
				getRuntimePlatformCapabilities: () => ({playback: {}})
			}));
			const {getSubtitleTranscodePolicy: getStableSubtitleTranscodePolicy} = require('../playbackSelection');
			const mediaSource = createMediaSource({Codec: 'ass'});
			const policy = getStableSubtitleTranscodePolicy(mediaSource, 3, {
				assSubtitleRenderer: 'jassub'
			});

			expect(policy).toEqual(expect.objectContaining({
				reason: 'client-render-ass-jassub',
				renderer: 'client-ass-jassub',
				clientRender: true,
				requiresBurnIn: false
			}));
		});
	});

	it('uses burn-in for ASS/SSA subtitles when smart ASS renderer is burn-in on SDR', () => {
		const mediaSource = createMediaSource({Codec: 'ass'});
		const policy = getSubtitleTranscodePolicy(mediaSource, 3, {
			assSubtitleRenderer: 'burn-in'
		});

		expect(policy.mode).toBe('smart');
		expect(policy.reason).toBe('ass-renderer-burn-in');
		expect(policy.renderer).toBe('burn-in');
		expect(policy.requiresBurnIn).toBe(true);
	});

	it('uses bitmap client rendering for PGS/image subtitles in smart mode on SDR', () => {
		const mediaSource = createMediaSource({Codec: 'pgs'});
		const policy = getSubtitleTranscodePolicy(mediaSource, 3);

		expect(policy.mode).toBe('smart');
		expect(policy.reason).toBe('client-render-bitmap-auto');
		expect(policy.renderer).toBe('client-bitmap-auto');
		expect(policy.requiresBurnIn).toBe(false);
		expect(policy.clientRender).toBe(true);
		expect(policy.fallbackBurnInAllowed).toBe(true);
		expect(shouldTranscodeForSubtitleSelection(mediaSource, 3)).toBe(false);
	});

	it('uses explicit bitmap renderer ids for PGS subtitles in smart mode', () => {
		const mediaSource = createMediaSource({Codec: 'hdmv_pgs_subtitle'});

		expect(getSubtitleTranscodePolicy(mediaSource, 3, {
			bitmapSubtitleRenderer: 'libbitsub'
		})).toEqual(expect.objectContaining({
			reason: 'client-render-bitmap-libbitsub',
			renderer: 'client-bitmap-libbitsub',
			clientRender: true,
			requiresBurnIn: false
		}));
		expect(getSubtitleTranscodePolicy(mediaSource, 3, {
			bitmapSubtitleRenderer: 'libpgs'
		})).toEqual(expect.objectContaining({
			reason: 'client-render-bitmap-libpgs',
			renderer: 'client-bitmap-libpgs',
			clientRender: true,
			requiresBurnIn: false
		}));
	});

	it('requires fragility consent for explicit bitmap burn-in on SDR', () => {
		const mediaSource = createMediaSource({Codec: 'pgs'});
		const policy = getSubtitleTranscodePolicy(mediaSource, 3, {
			bitmapSubtitleRenderer: 'burn-in'
		});

		expect(policy.reason).toBe('bitmap-burn-in-fragility-consent-required');
		expect(policy.renderer).toBe('burn-in');
		expect(policy.clientRender).toBe(false);
		expect(policy.requiresBurnIn).toBe(false);
		expect(policy.requiresBitmapBurnInConsent).toBe(true);
		expect(policy.requiredDecision).toEqual(expect.objectContaining({
			type: 'bitmap-burn-in-fragility',
			subtitleStreamIndex: 3
		}));
		expect(shouldTranscodeForSubtitleSelection(mediaSource, 3, {
			bitmapSubtitleRenderer: 'burn-in'
		})).toBe(false);
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
		expect(policy.renderer).toBe('client-text');
		expect(policy.clientRender).toBe(true);
		expect(policy.requiresBurnIn).toBe(false);
		expect(policy.fallbackBurnInAllowed).toBe(false);
	});

	it('uses bitmap client rendering for PGS/image subtitles on HDR/DV while preserving fallback consent', () => {
		const hdrSource = createMediaSource({Codec: 'pgssub'});
		hdrSource.MediaStreams[0].VideoRangeType = 'DOVIWithHDR10';

		const policy = getSubtitleTranscodePolicy(hdrSource, 3);

		expect(policy.reason).toBe('client-render-bitmap-auto');
		expect(policy.renderer).toBe('client-bitmap-auto');
		expect(policy.clientRender).toBe(true);
		expect(policy.fallbackBurnInAllowed).toBe(false);
		expect(policy.requiresBurnIn).toBe(false);
		expect(shouldTranscodeForSubtitleSelection(hdrSource, 3)).toBe(false);
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
		expect(policy.renderer).toBe('client-text');
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
				assSubtitleRenderer: 'burn-in',
				allowSubtitleBurnInOnHdr: true
			})
		).toBe(true);
	});

	it('requires fragility consent for explicit bitmap burn-in on HDR/DV even when HDR burn-in is forced', () => {
		const hdrSource = createMediaSource({Codec: 'pgs'});
		hdrSource.MediaStreams[0].VideoRangeType = 'DOVIWithHDR10';

		const policy = getSubtitleTranscodePolicy(hdrSource, 3, {
			bitmapSubtitleRenderer: 'burn-in',
			allowSubtitleBurnInOnHdr: true
		});

		expect(policy.reason).toBe('bitmap-burn-in-fragility-consent-required');
		expect(policy.renderer).toBe('burn-in');
		expect(policy.clientRender).toBe(false);
		expect(policy.fallbackBurnInAllowed).toBe(false);
		expect(policy.requiresBitmapBurnInConsent).toBe(true);
		expect(policy.requiredDecision).toEqual(expect.objectContaining({
			type: 'bitmap-burn-in-fragility',
			subtitleStreamIndex: 3
		}));
		expect(policy.fallbackPromptType).toBe('bitmap-burn-in-fragility');
		expect(policy.requiresBurnIn).toBe(false);
		expect(shouldTranscodeForSubtitleSelection(hdrSource, 3, {
			bitmapSubtitleRenderer: 'burn-in',
			allowSubtitleBurnInOnHdr: true
		})).toBe(false);
	});

	it('uses PGS/image subtitle burn-in only after bitmap fragility confirmation', () => {
		const hdrSource = createMediaSource({Codec: 'pgs'});
		hdrSource.MediaStreams[0].VideoRangeType = 'DOVIWithHDR10';

		const policy = getSubtitleTranscodePolicy(hdrSource, 3, {
			bitmapSubtitleRenderer: 'burn-in',
			allowSubtitleBurnInOnHdr: true,
			confirmedBitmapBurnIn: true
		});

		expect(policy.reason).toBe('confirmed-bitmap-renderer-burn-in');
		expect(policy.renderer).toBe('burn-in');
		expect(policy.requiresBurnIn).toBe(true);
		expect(shouldTranscodeForSubtitleSelection(hdrSource, 3, {
			bitmapSubtitleRenderer: 'burn-in',
			allowSubtitleBurnInOnHdr: true,
			confirmedBitmapBurnIn: true
		})).toBe(true);
	});

	it('forces PGS/image subtitle burn-in over bitmap client rendering during fallback reloads', () => {
		const mediaSource = createMediaSource({Codec: 'pgssub'});
		const policy = getSubtitleTranscodePolicy(mediaSource, 3, {
			bitmapSubtitleRenderer: 'libbitsub',
			forceSubtitleBurnIn: true
		});

		expect(policy.reason).toBe('forced-subtitle-burn-in');
		expect(policy.renderer).toBe('burn-in');
		expect(policy.clientRender).toBe(false);
		expect(policy.requiresBurnIn).toBe(true);
		expect(shouldTranscodeForSubtitleSelection(mediaSource, 3, {
			bitmapSubtitleRenderer: 'libpgs',
			forceSubtitleBurnIn: true
		})).toBe(true);
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
				assSubtitleRenderer: 'burn-in',
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

	it('selects DirectStream when DirectPlay is disabled for a compatible source', () => {
		const mediaSource = createVideoMediaSource({
			id: 'source-directstream',
			videoRangeType: 'SDR',
			supportsDirectPlay: true,
			supportsDirectStream: true
		});

		expect(determinePlayMethod(mediaSource, {disableDirectPlay: true})).toBe('DirectStream');
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
