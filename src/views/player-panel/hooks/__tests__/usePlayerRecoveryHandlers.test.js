import {
	extractSubtitleStreamIndexFromValues,
	hasRequestedSubtitleBurnIn,
	isKnownImageSubtitleBurnInFailure,
	isServerTranscodingStartupFailure,
	isSubtitleBurnInPlaybackFailure,
	isSubtitleBurnInPlaybackPath,
	SERVER_TRANSCODING_FAILURE_DIAGNOSTIC,
	SERVER_TRANSCODING_FAILURE_MESSAGE,
	SERVER_TRANSCODING_FAILURE_TITLE,
	shouldRetrySubtitleBurnInWithSafeProfile
} from '../../utils/playerRecoveryPolicy';
import {classifyHlsError} from '../../utils/hlsErrorClassification';

describe('player recovery subtitle burn-in failure helpers', () => {
	it('detects requested subtitle burn-in from playback policy metadata', () => {
		expect(hasRequestedSubtitleBurnIn({forceBurnIn: true})).toBe(true);
		expect(hasRequestedSubtitleBurnIn({requiresBurnIn: true})).toBe(true);
		expect(hasRequestedSubtitleBurnIn({requiresBurnIn: false})).toBe(false);
	});

	it('classifies HLS fragment HTTP 500 during subtitle burn-in as subtitle fallback eligible', () => {
		expect(isSubtitleBurnInPlaybackFailure({
			errorData: {
				details: 'fragLoadError',
				response: {code: 500}
			},
			subtitlePolicy: {forceBurnIn: true}
		})).toBe(true);
	});

	it('detects subtitle burn-in failures from the HLS fragment URL when metadata is unavailable', () => {
		expect(isSubtitleBurnInPlaybackFailure({
			errorData: {
				details: 'fragLoadError',
				response: {code: 500}
			},
			values: [
				'/videos/item/hls1/main/0.ts?SubtitleMethod=Encode&SubtitleStreamIndex=4'
			]
		})).toBe(true);
	});

	it('does not treat non-server or non-burn-in fragment errors as subtitle burn-in failures', () => {
		expect(isSubtitleBurnInPlaybackFailure({
			errorData: {
				details: 'fragLoadError',
				response: {code: 404}
			},
			values: ['/videos/item/hls1/main/0.ts?SubtitleMethod=Encode']
		})).toBe(false);
		expect(isSubtitleBurnInPlaybackFailure({
			errorData: {
				details: 'fragLoadError',
				response: {code: 500}
			},
			values: ['/videos/item/hls1/main/0.ts?SubtitleStreamIndex=-1']
		})).toBe(false);
	});

	it('detects encoded subtitle playback paths without requiring an HLS fragment error object', () => {
		expect(isSubtitleBurnInPlaybackPath({
			values: ['/Videos/item/master.m3u8?SubtitleMethod=Encode&SubtitleStreamIndex=4']
		})).toBe(true);
		expect(isSubtitleBurnInPlaybackPath({
			subtitlePolicy: {forceBurnIn: true},
			values: ['Format not supported']
		})).toBe(true);
		expect(isSubtitleBurnInPlaybackPath({
			values: ['Format not supported']
		})).toBe(false);
	});

	it('does not mistake a generic transcode encode capability for active subtitle burn-in', () => {
		expect(isSubtitleBurnInPlaybackPath({
			values: ['/Videos/item/master.m3u8?SubtitleMethod=Encode&TranscodeReasons=VideoRangeTypeNotSupported']
		})).toBe(false);
		expect(isSubtitleBurnInPlaybackFailure({
			errorData: {
				details: 'fragLoadError',
				response: {code: 500}
			},
			values: ['/videos/item/hls1/main/0.ts?SubtitleMethod=Encode&TranscodeReasons=VideoRangeTypeNotSupported']
		})).toBe(false);
	});

	it('extracts subtitle index from encoded HLS fragment URLs for early failures', () => {
		expect(extractSubtitleStreamIndexFromValues([
			'/videos/item/hls1/main/0.ts?SubtitleMethod=Encode&SubtitleStreamIndex=4'
		])).toBe(4);
		expect(extractSubtitleStreamIndexFromValues([
			'/videos/item/hls1/main/0.ts?SubtitleStreamIndex=-1'
		])).toBe(-1);
		expect(extractSubtitleStreamIndexFromValues(['no subtitle index'])).toBe(null);
	});

	it('allows one safe-profile retry after subtitle burn-in playback fails', () => {
		expect(shouldRetrySubtitleBurnInWithSafeProfile({
			burnInPlaybackFailed: true,
			mediaSourceData: {__debugDecision: {safeSubtitleBurnInProfile: false}},
			playbackOverride: {}
		})).toBe(true);
		expect(shouldRetrySubtitleBurnInWithSafeProfile({
			burnInPlaybackFailed: true,
			mediaSourceData: {__debugDecision: {safeSubtitleBurnInProfile: true}},
			playbackOverride: {}
		})).toBe(false);
		expect(shouldRetrySubtitleBurnInWithSafeProfile({
			burnInPlaybackFailed: true,
			mediaSourceData: {},
			playbackOverride: {safeSubtitleBurnInProfile: true}
		})).toBe(false);
		expect(shouldRetrySubtitleBurnInWithSafeProfile({
			burnInPlaybackFailed: true,
			mediaSourceData: {},
			playbackOverride: {confirmedBitmapBurnIn: true}
		})).toBe(false);
		expect(shouldRetrySubtitleBurnInWithSafeProfile({
			burnInPlaybackFailed: true,
			mediaSourceData: {},
			playbackOverride: {},
			knownImageSubtitleHardwareBurnInFailure: true
		})).toBe(false);
		expect(shouldRetrySubtitleBurnInWithSafeProfile({
			burnInPlaybackFailed: false,
			mediaSourceData: {},
			playbackOverride: {}
		})).toBe(false);
	});

	it('classifies encoded PGS burn-in failures as known image subtitle hardware failures', () => {
		const mediaSourceData = {
			MediaStreams: [
				{Type: 'Subtitle', Index: 4, Codec: 'pgssub'}
			]
		};

		expect(isKnownImageSubtitleBurnInFailure({
			errorData: {
				details: 'fragLoadError',
				response: {code: 500}
			},
			subtitlePolicy: {forceBurnIn: true},
			values: ['/Videos/item/master.m3u8?SubtitleMethod=Encode&SubtitleStreamIndex=4'],
			mediaSourceData,
			subtitleStreamIndex: 4
		})).toBe(true);
		expect(isKnownImageSubtitleBurnInFailure({
			errorData: {
				details: 'fragLoadError',
				response: {code: 500}
			},
			subtitlePolicy: {forceBurnIn: true},
			values: ['/Videos/item/master.m3u8?SubtitleMethod=Encode&SubtitleStreamIndex=2'],
			mediaSourceData: {
				MediaStreams: [
					{Type: 'Subtitle', Index: 2, Codec: 'ass'}
				]
			},
			subtitleStreamIndex: 2
		})).toBe(false);
	});
});

describe('HLS error classification', () => {
	it('classifies fragment HTTP failures as subtitle candidates without treating nonfatal errors as rebuildable', () => {
		expect(classifyHlsError({
			details: 'fragLoadError',
			fatal: false,
			response: {code: 500}
		})).toEqual(expect.objectContaining({
			category: 'fragment-load',
			reason: 'http-500',
			statusCode: 500,
			subtitleCandidate: true,
			recoverableBySessionRebuild: false
		}));
	});

	it('classifies buffer pressure separately from subtitle fallback', () => {
		expect(classifyHlsError({
			details: 'bufferFullError',
			fatal: false
		})).toEqual(expect.objectContaining({
			category: 'buffer-pressure',
			reason: 'buffer-full',
			subtitleCandidate: false
		}));
	});

	it('classifies nonfatal buffer hole skips as recovered runtime events', () => {
		expect(classifyHlsError({
			details: 'bufferSeekOverHole',
			fatal: false
		})).toEqual(expect.objectContaining({
			category: 'buffer-hole-recovery',
			severity: 'recovered',
			subtitleCandidate: false,
			recoverableBySessionRebuild: false
		}));
	});
});

describe('server transcoder startup failure classification', () => {
	it('classifies an initial transcoded HLS fragment 500', () => {
		expect(isServerTranscodingStartupFailure({
			isTranscoding: true,
			playbackStarted: false,
			errorData: {
				details: 'fragLoadError',
				response: {code: 500}
			}
		})).toBe(true);
	});

	it('classifies an initial native format error on a transcoding path', () => {
		expect(isServerTranscodingStartupFailure({
			isTranscoding: true,
			playbackStarted: false,
			mediaErrorCode: 4
		})).toBe(true);
	});

	it('does not relabel direct, later, or non-server failures', () => {
		expect(isServerTranscodingStartupFailure({
			isTranscoding: false,
			playbackStarted: false,
			mediaErrorCode: 4
		})).toBe(false);
		expect(isServerTranscodingStartupFailure({
			isTranscoding: true,
			playbackStarted: true,
			mediaErrorCode: 4
		})).toBe(false);
		expect(isServerTranscodingStartupFailure({
			isTranscoding: true,
			playbackStarted: false,
			errorData: {
				details: 'fragLoadError',
				response: {code: 404}
			}
		})).toBe(false);
	});

	it('keeps the user and diagnostic copy stable', () => {
		expect(SERVER_TRANSCODING_FAILURE_TITLE).toBe('Server transcoding failed');
		expect(SERVER_TRANSCODING_FAILURE_MESSAGE).toContain(
			'Check the latest Jellyfin FFmpeg log.'
		);
		expect(SERVER_TRANSCODING_FAILURE_DIAGNOSTIC).toContain(
			'FFmpeg exit code 159'
		);
	});
});
