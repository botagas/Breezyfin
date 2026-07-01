import {
	getSubtitleBurnInFallbackStatus,
	normalizeSubtitleRendererFailureReason
} from '../subtitleRendererStatus';

describe('subtitleRendererStatus', () => {
	it('normalizes unsupported payload and fetch failure reasons', () => {
		expect(normalizeSubtitleRendererFailureReason('unsupported-subtitle-event-payload'))
			.toBe('unsupported-payload');
		expect(normalizeSubtitleRendererFailureReason('subtitle-fetch-failed'))
			.toBe('fetch-failed');
		expect(normalizeSubtitleRendererFailureReason('', 'fetch-failed')).toBe('fetch-failed');
	});

	it('maps HDR/DV preserve and burn-in fallback statuses explicitly', () => {
		expect(getSubtitleBurnInFallbackStatus({fallbackAllowed: false}))
			.toBe('skipped-hdr-dv-preserve-range');
		expect(getSubtitleBurnInFallbackStatus({
			fallbackAllowed: true,
			hasFallbackHandler: false
		})).toBe('burn-in-fallback-pending');
		expect(getSubtitleBurnInFallbackStatus({
			fallbackAllowed: true,
			hasFallbackHandler: true
		})).toBe('burn-in-fallback-started');
		expect(getSubtitleBurnInFallbackStatus({
			fallbackAllowed: true,
			fallbackAlreadyStarted: true
		})).toBe('burn-in-fallback-started');
	});
});
