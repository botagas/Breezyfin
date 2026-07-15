import {redactSensitiveUrl} from '../../../utils/sensitiveData';

export const getHlsErrorHttpStatus = (errorData = {}) => {
	const statusCode = Number(errorData?.response?.code ?? errorData?.response?.status);
	return Number.isFinite(statusCode) ? statusCode : null;
};

export const redactHlsUrl = (value) => redactSensitiveUrl(value, {
	includeOrigin: /^https?:\/\//i.test(String(value || ''))
});

export const buildHlsErrorSummary = (errorData = {}) => ({
	type: String(errorData?.type || 'unknown'),
	details: String(errorData?.details || 'unknown'),
	fatal: errorData?.fatal === true,
	statusCode: getHlsErrorHttpStatus(errorData),
	url: redactHlsUrl(errorData?.frag?.url || errorData?.url || errorData?.response?.url || '')
});

export const classifyHlsError = (errorData = {}) => {
	const details = String(errorData?.details || '');
	const type = String(errorData?.type || '');
	const statusCode = getHlsErrorHttpStatus(errorData);
	const fatal = errorData?.fatal === true;
	const normalizedDetails = details.toLowerCase();

	if (normalizedDetails === 'bufferseekoverhole' || normalizedDetails === 'buffer-nudge-on-stall') {
		return {
			category: 'buffer-hole-recovery',
			reason: normalizedDetails,
			statusCode,
			fatal,
			severity: fatal ? 'error' : 'recovered',
			subtitleCandidate: false,
			recoverableBySessionRebuild: false
		};
	}

	if (details === 'fragLoadError') {
		return {
			category: 'fragment-load',
			reason: statusCode ? `http-${statusCode}` : 'frag-load-error',
			statusCode,
			fatal,
			severity: fatal ? 'error' : 'warning',
			subtitleCandidate: statusCode === null || statusCode >= 400,
			recoverableBySessionRebuild: fatal && statusCode !== null && statusCode >= 500
		};
	}

	if (details === 'bufferFullError') {
		return {
			category: 'buffer-pressure',
			reason: 'buffer-full',
			statusCode,
			fatal,
			severity: fatal ? 'error' : 'warning',
			subtitleCandidate: false,
			recoverableBySessionRebuild: false
		};
	}

	if (
		normalizedDetails.includes('bufferappend') ||
		normalizedDetails.includes('append') ||
		normalizedDetails.includes('remuxallocerror')
	) {
		return {
			category: 'append-buffer',
			reason: details || 'append-buffer-error',
			statusCode,
			fatal,
			severity: fatal ? 'error' : 'warning',
			subtitleCandidate: false,
			recoverableBySessionRebuild: false
		};
	}

	if (normalizedDetails.includes('gap') || normalizedDetails.includes('stall')) {
		return {
			category: 'gap-or-stall',
			reason: details || 'gap-or-stall',
			statusCode,
			fatal,
			severity: fatal ? 'error' : 'warning',
			subtitleCandidate: false,
			recoverableBySessionRebuild: false
		};
	}

	return {
		category: type || 'unknown',
		reason: details || 'unknown',
		statusCode,
		fatal,
		severity: fatal ? 'error' : 'warning',
		subtitleCandidate: false,
		recoverableBySessionRebuild: false
	};
};
