import {getDynamicRangeInfo} from '../../../utils/playbackDynamicRange';
import {
	getSubtitleStreamByIndex,
	isBitmapSubtitleCodec,
	normalizeSubtitleCodec
} from '../../../utils/playbackSelection';

const HDR_DYNAMIC_RANGE_IDS = new Set(['DV', 'HDR10', 'HDR10_PLUS', 'HLG']);

export const PLAYER_RECOVERY_ACTIONS = Object.freeze({
	IGNORE: 'ignore',
	RECOVER_HLS_NETWORK: 'recover-hls-network',
	RECOVER_HLS_MEDIA: 'recover-hls-media',
	REBUILD_SESSION: 'rebuild-session',
	RETRY_TRANSCODE: 'retry-transcode',
	REQUEST_DECISION: 'request-decision',
	TERMINAL: 'terminal'
});

export const buildPlayerRecoveryAction = (context = {}, error = {}, ledgerSnapshot = null) => {
	if (context.kind === 'transcode-fallback') {
		if (context.exitInProgress === true || context.failureLocked === true) {
			return {type: PLAYER_RECOVERY_ACTIONS.IGNORE, reason: 'playback-failure-locked'};
		}
		if (context.forceDolbyVision === true) {
			return {type: PLAYER_RECOVERY_ACTIONS.TERMINAL, reason: 'force-dolby-vision'};
		}
		if (context.requiresDynamicRangeDecision === true) {
			return {
				type: PLAYER_RECOVERY_ACTIONS.REQUEST_DECISION,
				claim: 'dynamicRangeFallback',
				decision: context.decision || null,
				reason: context.reason || 'dolby-vision-playback-failed'
			};
		}
		if (context.strictTranscodingMode === true) {
			return {type: PLAYER_RECOVERY_ACTIONS.IGNORE, reason: 'strict-transcoding-mode'};
		}
		if (context.transcodeFallbackAttempted === true || ledgerSnapshot?.claims?.transcodeFallback === true) {
			return {type: PLAYER_RECOVERY_ACTIONS.IGNORE, reason: 'already-attempted'};
		}
		if (context.supportsTranscoding !== true) {
			return {type: PLAYER_RECOVERY_ACTIONS.IGNORE, reason: 'server-transcoding-unsupported'};
		}
		return {
			type: PLAYER_RECOVERY_ACTIONS.RETRY_TRANSCODE,
			claim: 'transcodeFallback',
			override: context.override || null,
			toast: context.toast || null,
			reason: context.reason || 'playback-failure'
		};
	}

	if (error?.fatal !== true || context.exitInProgress === true || context.sourceCurrent === false) {
		return {type: PLAYER_RECOVERY_ACTIONS.IGNORE, reason: 'not-actionable'};
	}
	if (ledgerSnapshot?.failureLocked === true) {
		return {type: PLAYER_RECOVERY_ACTIONS.IGNORE, reason: 'terminal-locked'};
	}

	const statusCode = Number(error?.response?.code ?? error?.response?.status);
	if (error.type === context.networkErrorType) {
		if (error.details === 'fragLoadError' && Number.isFinite(statusCode) && statusCode >= 500) {
			return {
				type: PLAYER_RECOVERY_ACTIONS.REBUILD_SESSION,
				claim: 'playSessionRebuild',
				reason: `fragment-http-${statusCode}`,
				statusCode
			};
		}
		const attempts = Number(ledgerSnapshot?.attempts?.hlsNetwork) || 0;
		return attempts < Math.max(0, Number(context.maxHlsNetworkRecoveryAttempts) || 0)
			? {type: PLAYER_RECOVERY_ACTIONS.RECOVER_HLS_NETWORK, claim: 'hlsNetwork', reason: error.details || 'network-error'}
			: {type: PLAYER_RECOVERY_ACTIONS.TERMINAL, reason: 'hls-network-budget-exhausted'};
	}

	if (error.type === context.mediaErrorType) {
		const attempts = Number(ledgerSnapshot?.attempts?.hlsMedia) || 0;
		return attempts < Math.max(0, Number(context.maxHlsMediaRecoveryAttempts) || 0)
			? {type: PLAYER_RECOVERY_ACTIONS.RECOVER_HLS_MEDIA, claim: 'hlsMedia', reason: error.details || 'media-error'}
			: {type: PLAYER_RECOVERY_ACTIONS.TERMINAL, reason: 'hls-media-budget-exhausted'};
	}

	return {type: PLAYER_RECOVERY_ACTIONS.TERMINAL, reason: error.details || 'unknown-hls-error'};
};

export const SERVER_TRANSCODING_FAILURE_TITLE = 'Server transcoding failed';
export const SERVER_TRANSCODING_FAILURE_MESSAGE =
	'Jellyfin could not start the requested video transcode. This could be an issue with FFmpeg, hardware-acceleration, permissions, service-sandbox configuration, or else. Check the latest Jellyfin FFmpeg log.';
export const SERVER_TRANSCODING_FAILURE_DIAGNOSTIC =
	'If Jellyfin reports FFmpeg exit code 159 on a systemd installation, the service syscall policy may be terminating FFmpeg. Review SystemCallFilter and SystemCallErrorNumber.';

export const isServerTranscodingStartupFailure = ({
	isTranscoding = false,
	playbackStarted = false,
	mediaErrorCode = null,
	errorData = null
} = {}) => {
	if (!isTranscoding || playbackStarted) return false;
	if (Number(mediaErrorCode) === 4) return true;
	const statusCode = Number(errorData?.response?.code ?? errorData?.response?.status);
	return errorData?.details === 'fragLoadError' &&
		Number.isFinite(statusCode) &&
		statusCode >= 500;
};

export const getSubtitleFallbackContext = (mediaSourceData, {burnInRequestedOverride = false} = {}) => {
	const policy = mediaSourceData?.__debugSubtitlePolicy || {};
	const burnInRequested = burnInRequestedOverride ||
		policy.forceBurnIn === true ||
		policy.requiresBurnIn === true;
	if (burnInRequested) {
		return {
			toast: {
				message: 'Subtitle burn-in playback failed. Retrying without subtitles.',
				severity: 'warning'
			},
			reason: 'subtitle-burn-in-playback-failed',
			message: 'Retrying playback without subtitles after a burn-in playback failure.'
		};
	}
	if (policy.reason === 'skip-hdr-dv-preserve-range') {
		return {
			toast: {
				message: 'Subtitle burn-in was skipped to preserve HDR/DV. Retrying without subtitles.',
				severity: 'warning'
			},
			reason: 'subtitle-burn-in-skipped-hdr-dv',
			message: 'Retrying playback without subtitles after subtitle burn-in was skipped for HDR/DV preservation.'
		};
	}
	return {
		toast: {
			message: 'Subtitle playback failed. Retrying without subtitles.',
			severity: 'warning'
		},
		reason: policy.reason || 'subtitle-playback-failed',
		message: 'Retrying playback without subtitles after subtitle playback failed.'
	};
};

export const hasRequestedSubtitleBurnIn = (subtitlePolicy) =>
	subtitlePolicy?.forceBurnIn === true || subtitlePolicy?.requiresBurnIn === true;

export const collectRecoveryStringValues = (value, seen = new WeakSet(), depth = 0) => {
	if (value == null || depth > 4) return [];
	if (typeof value === 'string') return [value];
	if (typeof value !== 'object') return [];
	if (seen.has(value)) return [];
	seen.add(value);
	if (Array.isArray(value)) {
		return value.flatMap((entry) => collectRecoveryStringValues(entry, seen, depth + 1));
	}
	return Object.values(value).flatMap((entry) => collectRecoveryStringValues(entry, seen, depth + 1));
};

export const hasSubtitleCodecUnsupportedReason = (values) =>
	values.some((value) => {
		const normalized = String(value || '').toLowerCase();
		return normalized.includes('subtitlecodecnotsupported');
	});

const hasSubtitleMethodEncode = (values) =>
	values.some((value) => {
		const normalized = String(value || '').toLowerCase();
		return normalized.includes('subtitlemethod=encode') ||
			normalized.includes('subtitlemethod%3dencode');
	});

export const extractSubtitleStreamIndexFromValues = (values = []) => {
	for (const value of values) {
		const text = String(value || '');
		const match = text.match(/[?&]SubtitleStreamIndex=(-?\d+)/i) ||
			text.match(/subtitleStreamIndex["'=: ]+(-?\d+)/i);
		if (!match) continue;
		const index = Number(match[1]);
		if (Number.isInteger(index)) return index;
	}
	return null;
};

export const hasActiveEncodedSubtitle = (values = []) => {
	const subtitleStreamIndex = extractSubtitleStreamIndexFromValues(values);
	return hasSubtitleMethodEncode(values) &&
		Number.isInteger(subtitleStreamIndex) &&
		subtitleStreamIndex >= 0;
};

const hasServerFragmentFailure = (errorData) => {
	const statusCode = Number(errorData?.response?.code);
	return errorData?.details === 'fragLoadError' &&
		Number.isFinite(statusCode) &&
		statusCode >= 500;
};

export const isSubtitleBurnInPlaybackFailure = ({
	errorData,
	subtitlePolicy,
	values = []
} = {}) => {
	if (!hasServerFragmentFailure(errorData)) return false;
	return hasRequestedSubtitleBurnIn(subtitlePolicy) || hasActiveEncodedSubtitle(values);
};

export const isSubtitleBurnInPlaybackPath = ({
	subtitlePolicy,
	values = []
} = {}) => (
	hasRequestedSubtitleBurnIn(subtitlePolicy) || hasActiveEncodedSubtitle(values)
);

export const shouldRetrySubtitleBurnInWithSafeProfile = ({
	burnInPlaybackFailed,
	mediaSourceData,
	playbackOverride,
	knownImageSubtitleHardwareBurnInFailure = false
} = {}) => (
	burnInPlaybackFailed === true &&
	knownImageSubtitleHardwareBurnInFailure !== true &&
	playbackOverride?.confirmedBitmapBurnIn !== true &&
	mediaSourceData?.__safeSubtitleBurnInProfile !== true &&
	mediaSourceData?.__debugDecision?.safeSubtitleBurnInProfile !== true &&
	playbackOverride?.safeSubtitleBurnInProfile !== true
);

export const isKnownImageSubtitleBurnInFailure = ({
	errorData,
	subtitlePolicy,
	values = [],
	mediaSourceData,
	subtitleStreamIndex
} = {}) => {
	const burnInPlaybackFailed = isSubtitleBurnInPlaybackPath({
		subtitlePolicy,
		values
	}) || isSubtitleBurnInPlaybackFailure({
		errorData,
		subtitlePolicy,
		values
	});
	if (!burnInPlaybackFailed) return false;
	const subtitleStream = getSubtitleStreamByIndex(mediaSourceData, subtitleStreamIndex);
	const codec = subtitlePolicy?.codec || normalizeSubtitleCodec(subtitleStream);
	return isBitmapSubtitleCodec(codec) || String(subtitlePolicy?.renderer || '').startsWith('client-bitmap');
};

export const shouldRequireSubtitleBurnInConsent = ({
	mediaSourceData,
	subtitlePolicy,
	playbackSettings
}) => {
	if (subtitlePolicy?.fallbackBurnInAllowed === true) return false;
	if (
		playbackSettings?.forceSubtitleBurnIn === true ||
		playbackSettings?.forceSubtitleBurnInOnHdr === true
	) {
		return false;
	}
	const originalRangeId = subtitlePolicy?.originalDynamicRangeInfo?.id || subtitlePolicy?.originalDynamicRangeId;
	if (originalRangeId) return HDR_DYNAMIC_RANGE_IDS.has(originalRangeId);
	const dynamicRangeInfo = subtitlePolicy?.dynamicRangeInfo || getDynamicRangeInfo(mediaSourceData);
	return HDR_DYNAMIC_RANGE_IDS.has(dynamicRangeInfo?.id);
};
