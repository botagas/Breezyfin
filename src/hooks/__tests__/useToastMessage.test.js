import {
	TOAST_SEVERITIES,
	normalizeToastInput
} from '../useToastMessage';

describe('useToastMessage helpers', () => {
	it('keeps string toast calls as informational messages', () => {
		expect(normalizeToastInput(' Loading stream... ')).toEqual({
			message: 'Loading stream...',
			severity: TOAST_SEVERITIES.INFO
		});
	});

	it('normalizes object toast calls with severity', () => {
		expect(normalizeToastInput({
			message: 'Subtitle fallback needed',
			severity: 'warning'
		})).toEqual({
			message: 'Subtitle fallback needed',
			severity: TOAST_SEVERITIES.WARNING
		});
	});

	it('falls back to info for unknown severities', () => {
		expect(normalizeToastInput({
			message: 'Unknown severity',
			severity: 'critical'
		})).toEqual({
			message: 'Unknown severity',
			severity: TOAST_SEVERITIES.INFO
		});
	});
});
