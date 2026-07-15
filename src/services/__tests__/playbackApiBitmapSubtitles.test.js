jest.mock('@jellyfin/sdk/lib/utils/api/playstate-api', () => ({
	getPlaystateApi: jest.fn()
}));
jest.mock('../../utils/platformCapabilities', () => ({
	getRuntimePlatformCapabilities: jest.fn()
}));

import {getRuntimePlatformCapabilities} from '../../utils/platformCapabilities';
import {
	createPlaybackApiTestService,
	resetPlaybackApiTestRuntime,
	withSubtitleStream
} from '../testUtils/playbackApiTestHelpers';
import {createVideoAudioMediaSource} from '../testUtils/playbackFixtures';
import {getItemPlaybackInfo} from '../jellyfin/playbackApi';

describe('playbackApi bitmap subtitles', () => {
	const createService = createPlaybackApiTestService;

	const createPgsSubtitleSource = (overrides = {}) => withSubtitleStream(createVideoAudioMediaSource({
		id: 'source-pgs',
		videoRangeType: 'SDR',
		supportsTranscoding: true,
		...overrides
	}), {Codec: 'pgssub', Index: 4, DeliveryMethod: 'External'});

	beforeEach(() => {
		resetPlaybackApiTestRuntime({
			clearMocks: jest.clearAllMocks,
			createFetchMock: jest.fn,
			getRuntimePlatformCapabilities
		});
	});

	it('pre-detaches known selected PGS subtitles before PlaybackInfo while preserving the client subtitle index', async () => {
		const service = createService();
		const mediaSource = createPgsSubtitleSource();
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [mediaSource]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			mediaSource,
			mediaSourceId: mediaSource.Id,
			subtitleStreamIndex: 4,
			enableDiagnostics: true
		});
		const payload = JSON.parse(global.fetch.mock.calls[0][1].body);

		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(payload.SubtitleStreamIndex).toBe(-1);
		expect(payload.SubtitleMethod).toBeUndefined();
		expect(playbackInfo?.__breezyfin?.subtitlePolicy).toEqual(expect.objectContaining({
			mode: 'smart',
			reason: 'client-render-bitmap-auto',
			renderer: 'client-bitmap-auto',
			clientRender: true,
			clientRenderedStreamIndex: 4
		}));
		expect(playbackInfo?.__breezyfin?.decision).toEqual(expect.objectContaining({
			selectedSubtitleStreamIndex: 4,
			clientRenderedSubtitleStreamIndex: 4,
			payload: expect.objectContaining({
				subtitleStreamIndex: -1
			})
		}));
		expect(playbackInfo?.__breezyfin?.diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({
				scope: 'subtitle-policy',
				stage: 'client-render-pre-detach',
				status: 'applied',
				reason: 'known-bitmap-subtitle'
			})
		]));
	});

	it('pre-detaches selected PGS subtitles when bitmap burn-in is unconfirmed', async () => {
		const service = createService();
		const mediaSource = createPgsSubtitleSource();
		global.fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				PlaySessionId: 'session-1',
				MediaSources: [mediaSource]
			})
		});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			mediaSource,
			mediaSourceId: mediaSource.Id,
			subtitleStreamIndex: 4,
			bitmapSubtitleRenderer: 'burn-in',
			enableDiagnostics: true
		});
		const payload = JSON.parse(global.fetch.mock.calls[0][1].body);

		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(payload.SubtitleStreamIndex).toBe(-1);
		expect(playbackInfo?.__breezyfin?.subtitlePolicy).toEqual(expect.objectContaining({
			reason: 'bitmap-burn-in-fragility-consent-required',
			renderer: 'burn-in',
			clientRender: false,
			requiresBurnIn: false,
			requiresBitmapBurnInConsent: true,
			fallbackPromptType: 'bitmap-burn-in-fragility',
			requiredDecision: expect.objectContaining({
				type: 'bitmap-burn-in-fragility',
				subtitleStreamIndex: 4
			})
		}));
		expect(playbackInfo?.__breezyfin?.decision).toEqual(expect.objectContaining({
			selectedSubtitleStreamIndex: 4,
			clientRenderedSubtitleStreamIndex: 4,
			payload: expect.objectContaining({
				subtitleStreamIndex: -1
			})
		}));
	});

	it('re-negotiates server-selected default PGS subtitles on transcode for client rendering', async () => {
		const service = createService();
		const mediaSource = createPgsSubtitleSource({
			id: 'source-pgs-transcode',
			supportsDirectPlay: false,
			supportsDirectStream: false,
			supportsTranscoding: true
		});
		mediaSource.TranscodingUrl = '/Videos/item-1/master.m3u8';
		mediaSource.TranscodingContainer = 'ts';
		mediaSource.DefaultSubtitleStreamIndex = 4;
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-1',
					MediaSources: [mediaSource]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-2',
					MediaSources: [mediaSource]
				})
			});

		const playbackInfo = await getItemPlaybackInfo(service, 'item-1', {
			enableDiagnostics: true
		});
		const detachedPayload = JSON.parse(global.fetch.mock.calls[1][1].body);

		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(detachedPayload.SubtitleStreamIndex).toBe(-1);
		expect(detachedPayload.SubtitleMethod).toBeUndefined();
		expect(playbackInfo?.__breezyfin?.subtitlePolicy).toEqual(expect.objectContaining({
			reason: 'client-render-bitmap-auto',
			renderer: 'client-bitmap-auto',
			clientRender: true,
			clientRenderedStreamIndex: 4
		}));
		expect(playbackInfo?.__breezyfin?.diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({
				scope: 'subtitle-policy',
				stage: 'default-bitmap-detach',
				status: 'applied'
			})
		]));
	});

	it('reports a typed subtitle fallback when confirmed burn-in returns no source', async () => {
		const service = createService();
		const mediaSource = createPgsSubtitleSource();
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-1',
					MediaSources: [mediaSource]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					PlaySessionId: 'session-2',
					MediaSources: []
				})
			});

		await expect(getItemPlaybackInfo(service, 'item-1', {
			mediaSource,
			mediaSourceId: mediaSource.Id,
			subtitleStreamIndex: 4,
			bitmapSubtitleRenderer: 'burn-in',
			forceSubtitleBurnIn: true,
			confirmedBitmapBurnIn: true
		})).rejects.toEqual(expect.objectContaining({
			code: 'subtitle-burn-in-no-source',
			details: {subtitleStreamIndex: 4}
		}));
	});
});
