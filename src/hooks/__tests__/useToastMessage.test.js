import {act, renderHook} from '@testing-library/react';
import {
	appendProtectedStackedToast,
	TOAST_SEVERITIES,
	normalizeToastInput,
	useToastMessage
} from '../useToastMessage';

describe('useToastMessage helpers', () => {
	it('keeps string toast calls as informational messages', () => {
		expect(normalizeToastInput(' Loading stream... ')).toEqual({
			message: 'Loading stream...',
			severity: TOAST_SEVERITIES.INFO,
			key: '',
			persistent: false
		});
	});

	it('normalizes object toast calls with severity', () => {
		expect(normalizeToastInput({
			message: 'Subtitle fallback needed',
			severity: 'warning'
		})).toEqual({
			message: 'Subtitle fallback needed',
			severity: TOAST_SEVERITIES.WARNING,
			key: '',
			persistent: false
		});
	});

	it('falls back to info for unknown severities', () => {
		expect(normalizeToastInput({
			message: 'Unknown severity',
			severity: 'critical'
		})).toEqual({
			message: 'Unknown severity',
			severity: TOAST_SEVERITIES.INFO,
			key: '',
			persistent: false
		});
	});

	it('preserves keyed persistent toast metadata', () => {
		expect(normalizeToastInput({
			key: 'audio-track-switch',
			message: 'Switching audio...',
			severity: 'warning',
			persistent: true
		})).toEqual({
			key: 'audio-track-switch',
			message: 'Switching audio...',
			severity: TOAST_SEVERITIES.WARNING,
			persistent: true
		});
	});

	it('keeps and dismisses a keyed persistent single toast', () => {
		jest.useFakeTimers();
		const {result, unmount} = renderHook(() => useToastMessage());
		act(() => {
			result.current.setToastMessage({
				key: 'audio-switch',
				message: 'Switching audio...',
				persistent: true
			});
			jest.advanceTimersByTime(10000);
		});
		expect(result.current.toastVisible).toBe(true);
		expect(result.current.toastMessage).toBe('Switching audio...');

		act(() => result.current.dismissToast('audio-switch'));
		expect(result.current.toastVisible).toBe(false);
		expect(result.current.toastMessage).toBe('');
		unmount();
		jest.useRealTimers();
	});

	it('restarts lifecycle metadata when the message text is unchanged', () => {
		jest.useFakeTimers();
		const {result, unmount} = renderHook(() => useToastMessage({durationMs: 1000}));
		act(() => {
			result.current.setToastMessage({
				key: 'audio-switch',
				message: 'Switching audio...',
				persistent: true
			});
		});
		expect(result.current.toastVisible).toBe(true);

		act(() => {
			result.current.setToastMessage({
				key: 'audio-switch',
				message: 'Switching audio...',
				persistent: false
			});
		});
		act(() => {
			jest.advanceTimersByTime(1000);
		});
		expect(result.current.toastVisible).toBe(false);
		expect(result.current.toastMessage).toBe('');
		unmount();
		jest.useRealTimers();
	});

	it('evicts the oldest transient entry before a persistent operation status', () => {
		const persistent = {id: 1, key: 'audio-switch', persistent: true};
		const transient = {id: 2, persistent: false};
		const incoming = {id: 3, persistent: false};

		expect(appendProtectedStackedToast(
			[persistent, transient],
			incoming,
			2
		)).toEqual({
			items: [persistent, incoming],
			removed: [transient],
			accepted: true
		});
	});

	it('suppresses transient entries when persistent statuses reserve the stack', () => {
		const persistent = {id: 1, key: 'audio-switch', persistent: true};
		const incoming = {id: 2, persistent: false};

		expect(appendProtectedStackedToast([persistent], incoming, 1)).toEqual({
			items: [persistent],
			removed: [incoming],
			accepted: false
		});
	});

	it('keeps a persistent switching status independently dismissible in a stack', () => {
		jest.useFakeTimers();
		const {result, unmount} = renderHook(() => useToastMessage({
			stack: true,
			maxVisible: 2,
			durationMs: 1000
		}));
		act(() => {
			result.current.setToastMessage({
				key: 'audio-switch',
				message: 'Switching audio...',
				persistent: true
			});
			result.current.setToastMessage('Compatibility warning');
			result.current.setToastMessage('Recovery warning');
		});

		expect(result.current.toastMessages.map((entry) => entry.message)).toEqual([
			'Switching audio...',
			'Recovery warning'
		]);
		act(() => result.current.dismissToast('audio-switch'));
		expect(result.current.toastMessages.map((entry) => entry.message)).toEqual([
			'Recovery warning'
		]);
		unmount();
		jest.useRealTimers();
	});
});
