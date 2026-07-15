import {KeyCodes} from '../../../../utils/keyCodes';
import {isPausedScreensaverResumeEvent} from '../usePlayerPausedScreensaver';

describe('paused player screensaver wake semantics', () => {
	it('resumes only from explicit player confirmation keys', () => {
		expect(isPausedScreensaverResumeEvent({type: 'keydown', keyCode: KeyCodes.ENTER})).toBe(true);
		expect(isPausedScreensaverResumeEvent({type: 'keydown', keyCode: KeyCodes.OK})).toBe(true);
		expect(isPausedScreensaverResumeEvent({type: 'keydown', keyCode: KeyCodes.SPACE})).toBe(true);
		expect(isPausedScreensaverResumeEvent({type: 'keydown', keyCode: KeyCodes.RIGHT})).toBe(false);
		expect(isPausedScreensaverResumeEvent({type: 'pointerdown'})).toBe(false);
	});
});
