import {getCrashActionFromElement} from '../utils/crashActions';
import {CRASH_RECOVERY_ACTIONS} from '../../utils/crashRecovery';

describe('AppCrashBoundary crash actions', () => {
	it('resolves Spotlight ids returned as strings for 5-way activation', () => {
		expect(getCrashActionFromElement('crash-action-back')).toBe(CRASH_RECOVERY_ACTIONS.BACK);
		expect(getCrashActionFromElement('crash-action-home')).toBe(CRASH_RECOVERY_ACTIONS.HOME);
	});

	it('resolves the focused crash action from a nested button element', () => {
		const button = document.createElement('button');
		button.dataset.crashAction = CRASH_RECOVERY_ACTIONS.BACK;
		const child = document.createElement('span');
		button.appendChild(child);
		expect(getCrashActionFromElement(child)).toBe(CRASH_RECOVERY_ACTIONS.BACK);
	});
});
