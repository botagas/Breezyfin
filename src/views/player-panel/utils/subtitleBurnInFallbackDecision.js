import {getSubtitleBurnInFallbackStatus} from './subtitleRendererStatus';

export const runSubtitleBurnInFallbackDecision = ({
	reason = '',
	subtitlePolicy = null,
	subtitleKey = '',
	fallbackAttemptedKeys = null,
	currentSubtitleTrack = -1,
	onBurnInFallback = null,
	setToastMessage = null
} = {}) => {
	const fallbackAllowed = subtitlePolicy?.fallbackBurnInAllowed === true;
	const isBitmapClientRenderer = String(subtitlePolicy?.renderer || '').startsWith('client-bitmap');
	const requiresBitmapBurnInConsent =
		subtitlePolicy?.requiresBitmapBurnInConsent === true ||
		subtitlePolicy?.fallbackPromptType === 'bitmap-burn-in-fragility' ||
		(isBitmapClientRenderer && fallbackAllowed);
	const requiresHdrConsent =
		!requiresBitmapBurnInConsent &&
		!fallbackAllowed &&
		isBitmapClientRenderer;
	const requiresNoSubtitleConsent =
		!requiresBitmapBurnInConsent &&
		!requiresHdrConsent &&
		!fallbackAllowed;
	const fallbackAlreadyStarted = !subtitleKey || fallbackAttemptedKeys?.has(subtitleKey) === true;
	const hasFallbackHandler = typeof onBurnInFallback === 'function';

	if (fallbackAlreadyStarted) {
		return getSubtitleBurnInFallbackStatus({
			fallbackAllowed,
			fallbackAlreadyStarted,
			requiresHdrConsent,
			requiresBitmapBurnInConsent,
			requiresNoSubtitleConsent
		});
	}

	if (requiresBitmapBurnInConsent) {
		fallbackAttemptedKeys?.add(subtitleKey);
		setToastMessage?.({
			message: 'Image subtitle burn-in requires confirmation before server transcoding.',
			severity: 'warning'
		});
		if (hasFallbackHandler) {
			onBurnInFallback({
				subtitleStreamIndex: currentSubtitleTrack,
				reason: subtitlePolicy?.bitmapBurnInFragilityReason || reason,
				requiresBitmapBurnInConsent: true,
				fallbackType: 'bitmap-burn-in-fragility'
			});
		}
		return getSubtitleBurnInFallbackStatus({
			fallbackAllowed,
			hasFallbackHandler,
			requiresBitmapBurnInConsent
		});
	}

	if (requiresHdrConsent) {
		fallbackAttemptedKeys?.add(subtitleKey);
		setToastMessage?.({
			message: 'Bitmap subtitle fallback needs HDR/DV burn-in consent.',
			severity: 'warning'
		});
		if (hasFallbackHandler) {
			onBurnInFallback({
				subtitleStreamIndex: currentSubtitleTrack,
				reason,
				requiresHdrConsent: true
			});
		}
		return getSubtitleBurnInFallbackStatus({
			fallbackAllowed,
			hasFallbackHandler,
			requiresHdrConsent
		});
	}

	if (requiresNoSubtitleConsent) {
		setToastMessage?.({
			message: 'Subtitle renderer failed. Playback without subtitles requires confirmation.',
			severity: 'warning'
		});
		if (hasFallbackHandler) {
			fallbackAttemptedKeys?.add(subtitleKey);
			onBurnInFallback({
				subtitleStreamIndex: currentSubtitleTrack,
				reason,
				requiresNoSubtitleConsent: true,
				fallbackType: 'no-subtitles'
			});
		}
		return getSubtitleBurnInFallbackStatus({
			fallbackAllowed,
			hasFallbackHandler,
			requiresNoSubtitleConsent: true
		});
	}

	fallbackAttemptedKeys?.add(subtitleKey);
	setToastMessage?.({
		message: 'Subtitle renderer failed. Retrying with subtitle burn-in...',
		severity: 'warning'
	});
	if (!hasFallbackHandler) {
		return getSubtitleBurnInFallbackStatus({
			fallbackAllowed,
			hasFallbackHandler: false
		});
	}
	onBurnInFallback({
		subtitleStreamIndex: currentSubtitleTrack,
		reason
	});
	return getSubtitleBurnInFallbackStatus({
		fallbackAllowed,
		hasFallbackHandler: true
	});
};
