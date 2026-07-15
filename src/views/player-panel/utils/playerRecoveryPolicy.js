import {getDynamicRangeInfo} from '../../../utils/playbackDynamicRange';
import {
	getSubtitleStreamByIndex,
	isBitmapSubtitleCodec,
	normalizeSubtitleCodec
} from '../../../utils/playbackSelection';

const HDR_DYNAMIC_RANGE_IDS = new Set(['DV', 'HDR10', 'HDR10_PLUS', 'HLG']);

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
	return hasRequestedSubtitleBurnIn(subtitlePolicy) || hasSubtitleMethodEncode(values);
};

export const isSubtitleBurnInPlaybackPath = ({
	subtitlePolicy,
	values = []
} = {}) => (
	hasRequestedSubtitleBurnIn(subtitlePolicy) || hasSubtitleMethodEncode(values)
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
