import {resolveScrollerRestoreAttempt} from '../useScrollerScrollMemory';

describe('useScrollerScrollMemory restore decisions', () => {
	it('completes only when the actual scroll position reaches the target', () => {
		expect(resolveScrollerRestoreAttempt({targetTop: 900, actualTop: 899})).toMatchObject({
			reachedTarget: true,
			shouldRetry: false
		});
	});

	it('retries a restore that Sandstone clamped before content was measured', () => {
		expect(resolveScrollerRestoreAttempt({targetTop: 900, actualTop: 0, attempt: 0, maxAttempts: 3})).toMatchObject({
			reachedTarget: false,
			shouldRetry: true
		});
	});

	it('stops bounded retries and reports the actual reachable position', () => {
		expect(resolveScrollerRestoreAttempt({targetTop: 900, actualTop: 640, attempt: 3, maxAttempts: 3})).toEqual({
			targetTop: 900,
			actualTop: 640,
			reachedTarget: false,
			shouldRetry: false
		});
	});
});
