const normalizeDiagnosticValue = (value, fallback = '-') => {
	const normalized = String(value || '').trim();
	return normalized || fallback;
};

export const createPlaybackDiagnostic = ({
	scope = 'playback',
	stage = 'unknown',
	status = 'info',
	reason = '',
	message = ''
} = {}) => ({
	scope: normalizeDiagnosticValue(scope, 'playback'),
	stage: normalizeDiagnosticValue(stage, 'unknown'),
	status: normalizeDiagnosticValue(status, 'info'),
	reason: normalizeDiagnosticValue(reason, ''),
	message: normalizeDiagnosticValue(message, '')
});

export const appendPlaybackDiagnostic = (diagnostics, entry) => {
	if (!Array.isArray(diagnostics)) return;
	diagnostics.push(createPlaybackDiagnostic(entry));
};
