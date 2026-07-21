const MAX_FIELD_LENGTH = 120;

const boundedText = (value) => typeof value === 'string'
	? value.replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD_LENGTH)
	: '';

const validInteger = (value, minimum, maximum) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
};

export const buildProviderDiagnosticSummary = (value) => {
	const problem = value?.problemDetails || value || {};
	const summary = {
		diagnosticReason: boundedText(value?.diagnosticReason),
		status: validInteger(value?.status ?? problem.status, 100, 599),
		provider: boundedText(problem.provider),
		operation: boundedText(problem.operation),
		reason: boundedText(problem.reason),
		upstreamStatus: validInteger(problem.upstreamStatus, 100, 599),
		failedPage: validInteger(problem.failedPage, 1, 10000),
		retryable: typeof (value?.retryable ?? problem.retryable) === 'boolean'
			? (value?.retryable ?? problem.retryable)
			: null
	};
	return Object.fromEntries(Object.entries(summary).filter(([, field]) => (
		field !== '' && field !== null && field !== undefined
	)));
};
