import {
	DEFAULT_SETTINGS,
	SCREENSAVER_TIMEOUT_OPTIONS
} from '../constants';
import {normalizeScreensaverTimeoutMinutes} from '../../../utils/screensaver';

describe('screensaver settings', () => {
	it('enables the screensaver after one minute by default', () => {
		expect(DEFAULT_SETTINGS.screensaverTimeoutMinutes).toBe('1');
	});

	it('offers the supported persisted timeout values', () => {
		expect(SCREENSAVER_TIMEOUT_OPTIONS.map((option) => option.value)).toEqual([
		'off',
		'1',
		'3',
		'5',
		'10',
		'15'
	]);
	});

	it('normalizes stale persisted values to the default', () => {
		expect(normalizeScreensaverTimeoutMinutes('30')).toBe('1');
	});
});
