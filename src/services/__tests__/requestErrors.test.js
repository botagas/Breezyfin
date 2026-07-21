import {createJellyfinRequestError, parseProblemDetails} from '../jellyfin/requestErrors';

describe('Jellyfin request errors', () => {
	it('keeps bounded structured provider details without retaining raw response fields', () => {
		const problem = parseProblemDetails(JSON.stringify({
			status: 503,
			title: 'discovery_unavailable',
			detail: 'Seerr did not answer.',
			code: 'discovery_unavailable',
			provider: 'Seerr',
			operation: 'PopularMovies',
			reason: 'timeout',
			retryable: true,
			upstreamStatus: 504,
			failedPage: 2,
			api_key: 'must-not-survive'
		}));

		expect(problem).toEqual({
			status: 503,
			code: 'discovery_unavailable',
			title: 'discovery_unavailable',
			detail: 'Seerr did not answer.',
			provider: 'Seerr',
			operation: 'PopularMovies',
			reason: 'timeout',
			upstreamStatus: 504,
			failedPage: 2,
			retryable: true
		});
		expect(JSON.stringify(problem)).not.toContain('must-not-survive');
	});

	it('creates a safe error without embedding a raw non-JSON body', () => {
		const error = createJellyfinRequestError({
			status: 500,
			context: 'Discovery request',
			bodyText: 'proxy failure api_key=secret'
		});

		expect(error.status).toBe(500);
		expect(error.context).toBe('Discovery request');
		expect(error.problemDetails).toBeNull();
		expect(error.message).not.toContain('secret');
	});
});

