import {buildProviderDiagnosticSummary} from '../providerDiagnostics';

describe('provider diagnostics', () => {
	it('keeps bounded structured fields without retaining arbitrary provider data', () => {
		expect(buildProviderDiagnosticSummary({
			diagnosticReason: 'plugin-upstream-http',
			status: 503,
			retryable: true,
			problemDetails: {
				provider: 'Seerr',
				operation: 'UpcomingMovies',
				reason: 'upstream-http',
				upstreamStatus: 502,
				failedPage: 1,
				api_key: 'must-not-survive'
			}
		})).toEqual({
			diagnosticReason: 'plugin-upstream-http',
			status: 503,
			provider: 'Seerr',
			operation: 'UpcomingMovies',
			reason: 'upstream-http',
			upstreamStatus: 502,
			failedPage: 1,
			retryable: true
		});
	});
});
