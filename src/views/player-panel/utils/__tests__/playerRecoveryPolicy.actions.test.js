import {
	buildPlayerRecoveryAction,
	PLAYER_RECOVERY_ACTIONS
} from '../playerRecoveryPolicy';

const context = {
	networkErrorType: 'networkError',
	mediaErrorType: 'mediaError',
	maxHlsNetworkRecoveryAttempts: 2,
	maxHlsMediaRecoveryAttempts: 1,
	sourceCurrent: true,
	exitInProgress: false
};

describe('buildPlayerRecoveryAction', () => {
	it('maps recoverable HLS failures to bounded pure actions', () => {
		expect(buildPlayerRecoveryAction(context, {
			fatal: true,
			type: 'networkError',
			details: 'manifestLoadError'
		}, {attempts: {hlsNetwork: 0}})).toEqual(expect.objectContaining({
			type: PLAYER_RECOVERY_ACTIONS.RECOVER_HLS_NETWORK,
			claim: 'hlsNetwork'
		}));
		expect(buildPlayerRecoveryAction(context, {
			fatal: true,
			type: 'mediaError',
			details: 'bufferAppendError'
		}, {attempts: {hlsMedia: 1}})).toEqual(expect.objectContaining({
			type: PLAYER_RECOVERY_ACTIONS.TERMINAL,
			reason: 'hls-media-budget-exhausted'
		}));
	});

	it('routes server fragment failures to a session rebuild action', () => {
		expect(buildPlayerRecoveryAction(context, {
			fatal: true,
			type: 'networkError',
			details: 'fragLoadError',
			response: {code: 503}
		}, {attempts: {hlsNetwork: 0}})).toEqual(expect.objectContaining({
			type: PLAYER_RECOVERY_ACTIONS.REBUILD_SESSION,
			statusCode: 503
		}));
	});

	it('ignores stale, exiting, and terminal-locked failures', () => {
		expect(buildPlayerRecoveryAction({...context, sourceCurrent: false}, {
			fatal: true,
			type: 'networkError'
		}).type).toBe(PLAYER_RECOVERY_ACTIONS.IGNORE);
		expect(buildPlayerRecoveryAction(context, {
			fatal: true,
			type: 'networkError'
		}, {failureLocked: true}).type).toBe(PLAYER_RECOVERY_ACTIONS.IGNORE);
	});

	it('describes range consent and transcode retry inputs without side effects', () => {
		expect(buildPlayerRecoveryAction({
			kind: 'transcode-fallback',
			requiresDynamicRangeDecision: true,
			decision: {type: 'dynamic-range-fallback', proposedRange: 'hdr10'},
			reason: 'dolby-vision-playback-failed'
		})).toEqual(expect.objectContaining({
			type: PLAYER_RECOVERY_ACTIONS.REQUEST_DECISION,
			claim: 'dynamicRangeFallback',
			decision: {type: 'dynamic-range-fallback', proposedRange: 'hdr10'}
		}));

		expect(buildPlayerRecoveryAction({
			kind: 'transcode-fallback',
			supportsTranscoding: true,
			reason: 'startup-no-progress',
			override: {forceTranscoding: true},
			toast: 'Retrying'
		})).toEqual(expect.objectContaining({
			type: PLAYER_RECOVERY_ACTIONS.RETRY_TRANSCODE,
			claim: 'transcodeFallback',
			override: {forceTranscoding: true},
			toast: 'Retrying'
		}));
	});
});
