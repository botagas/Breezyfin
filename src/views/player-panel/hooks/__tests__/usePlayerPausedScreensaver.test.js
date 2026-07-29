import {KeyCodes} from '../../../../utils/keyCodes';
import {
	isPausedScreensaverResumeEvent,
	shouldRestorePlayerFocusAfterScreensaverWake
} from '../usePlayerPausedScreensaver';

describe('paused player screensaver wake semantics', () => {
	it('resumes only from explicit player confirmation keys', () => {
		expect(isPausedScreensaverResumeEvent({type: 'keydown', keyCode: KeyCodes.ENTER})).toBe(true);
		expect(isPausedScreensaverResumeEvent({type: 'keydown', keyCode: KeyCodes.OK})).toBe(true);
		expect(isPausedScreensaverResumeEvent({type: 'keydown', keyCode: KeyCodes.SPACE})).toBe(true);
		expect(isPausedScreensaverResumeEvent({type: 'keydown', keyCode: KeyCodes.RIGHT})).toBe(false);
		expect(isPausedScreensaverResumeEvent({type: 'pointerdown'})).toBe(false);
	});

	it('restores a 5-way focus target without forcing pointer focus', () => {
		expect(shouldRestorePlayerFocusAfterScreensaverWake()).toBe(true);
		expect(shouldRestorePlayerFocusAfterScreensaverWake({type: 'keydown'})).toBe(true);
		expect(shouldRestorePlayerFocusAfterScreensaverWake({type: 'pointerdown'})).toBe(false);
		expect(shouldRestorePlayerFocusAfterScreensaverWake({type: 'wheel'})).toBe(false);
	});
});
