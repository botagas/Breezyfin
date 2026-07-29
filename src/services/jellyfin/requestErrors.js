const MAX_PROBLEM_TEXT_LENGTH = 280;

const trimProblemText = (value) => {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, MAX_PROBLEM_TEXT_LENGTH);
};

const normalizeInteger = (value, minimum, maximum) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
};

const normalizeProblemDetails = (value) => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const status = normalizeInteger(value.status ?? value.Status, 400, 599);
	const code = trimProblemText(value.code ?? value.Code ?? value.title ?? value.Title);
	if (!status && !code) return null;
	const problem = {
		status,
		code,
		title: trimProblemText(value.title ?? value.Title),
		detail: trimProblemText(value.detail ?? value.Detail)
	};
	const provider = trimProblemText(value.provider ?? value.Provider);
	const operation = trimProblemText(value.operation ?? value.Operation);
	const reason = trimProblemText(value.reason ?? value.Reason);
	const upstreamStatus = normalizeInteger(value.upstreamStatus ?? value.UpstreamStatus, 100, 599);
	const failedPage = normalizeInteger(value.failedPage ?? value.FailedPage, 1, 10000);
	const retryableValue = value.retryable ?? value.Retryable;
	if (provider) problem.provider = provider;
	if (operation) problem.operation = operation;
	if (reason) problem.reason = reason;
	if (upstreamStatus) problem.upstreamStatus = upstreamStatus;
	if (failedPage) problem.failedPage = failedPage;
	if (typeof retryableValue === 'boolean') problem.retryable = retryableValue;
	return Object.freeze(problem);
};

export const parseProblemDetails = (bodyText) => {
	if (typeof bodyText !== 'string' || !bodyText.trim()) return null;
	try {
		return normalizeProblemDetails(JSON.parse(bodyText));
	} catch (_) {
		return null;
	}
};

export class JellyfinRequestError extends Error {
	constructor({status, context, problemDetails = null}) {
		const safeContext = trimProblemText(context) || 'request';
		const safeStatus = normalizeInteger(status, 100, 599);
		const safeDetail = problemDetails?.detail || problemDetails?.title || '';
		super(`${safeContext} failed${safeStatus ? ` with status ${safeStatus}` : ''}${safeDetail ? ` - ${safeDetail}` : ''}`);
		this.name = 'JellyfinRequestError';
		this.status = safeStatus;
		this.context = safeContext;
		this.problemDetails = problemDetails;
	}
}

export const createJellyfinRequestError = ({status, context, bodyText = ''}) => new JellyfinRequestError({
	status,
	context,
	problemDetails: parseProblemDetails(bodyText)
});

