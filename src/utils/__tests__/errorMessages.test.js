import {
	getPlaybackErrorMessage,
	getUserErrorMessage,
	getCrashErrorMessage,
	isFatalPlaybackError
} from '../errorMessages';

describe('errorMessages utils', () => {
	it('maps common playback failures to user-friendly labels', () => {
		expect(getPlaybackErrorMessage(new Error('Media decode failed'))).toBe('Decode error');
		expect(getPlaybackErrorMessage(new Error('No supported source was found'))).toBe('Format not supported');
		expect(getPlaybackErrorMessage(new Error('Network timeout'))).toBe('Network error');
		expect(getPlaybackErrorMessage(new Error('Playback aborted by user'))).toBe('Playback aborted');
	});

	it('falls back correctly for unknown or missing errors', () => {
		expect(getPlaybackErrorMessage(new Error('custom issue'))).toBe('custom issue');
		expect(getPlaybackErrorMessage(null, 'fallback')).toBe('fallback');
	});

	it('detects fatal playback errors', () => {
		expect(isFatalPlaybackError({name: 'NotSupportedError'})).toBe(true);
		expect(isFatalPlaybackError(new Error('codec mismatch'))).toBe(true);
		expect(isFatalPlaybackError(new Error('network timeout'))).toBe(false);
	});

	it('returns fallback text for user and crash messages when needed', () => {
		expect(getUserErrorMessage('')).toBe('Something went wrong. Please try again.');
		expect(getCrashErrorMessage('')).toBe('The app hit an unexpected issue. You can safely return to Home.');
		expect(getUserErrorMessage('Server unreachable')).toBe('Server unreachable');
	});
});
