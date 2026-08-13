import {
	REDACTED_SENSITIVE_VALUE,
	redactSensitiveText,
	redactSensitiveUrl,
	sanitizeConsoleArgs,
	sanitizeSensitiveValue
} from '../sensitiveData';

describe('sensitive data redaction', () => {
	it('redacts mixed-case query credentials', () => {
		const value = redactSensitiveUrl(
			'https://example.test/video.m3u8?ApiKey=secret-one&access_token=secret-two&safe=value',
			{includeOrigin: false}
		);
		expect(value).toContain('ApiKey=[REDACTED]');
		expect(value).toContain('access_token=[REDACTED]');
		expect(value).toContain('safe=value');
		expect(value).not.toContain('secret-one');
		expect(value).not.toContain('secret-two');
	});

	it('redacts headers and serialized key/value content', () => {
		const value = redactSensitiveText(
			'Authorization: Bearer bearer-secret, Authorization: MediaBrowser Token="media-browser-secret", X-Emby-Token=emby-secret, {"apiKey":"json-secret"}'
		);
		expect(value).not.toContain('bearer-secret');
		expect(value).not.toContain('media-browser-secret');
		expect(value).not.toContain('emby-secret');
		expect(value).not.toContain('json-secret');
	});

	it('sanitizes errors, nested objects, and circular references', () => {
		const cyclic = {ApiKey: 'object-secret'};
		cyclic.self = cyclic;
		const sanitized = sanitizeSensitiveValue({
			error: new Error('request failed ?api_key=error-secret'),
			cyclic
		});
		expect(sanitized.cyclic.ApiKey).toBe(REDACTED_SENSITIVE_VALUE);
		expect(sanitized.cyclic.self).toBe('[Circular]');
		expect(sanitized.error.message).not.toContain('error-secret');
	});

	it('sanitizes every native console argument', () => {
		const args = sanitizeConsoleArgs([
			'https://example.test/file?token=console-secret',
			{Authorization: 'Bearer object-secret'}
		]);
		expect(JSON.stringify(args)).not.toContain('console-secret');
		expect(JSON.stringify(args)).not.toContain('object-secret');
	});
});
