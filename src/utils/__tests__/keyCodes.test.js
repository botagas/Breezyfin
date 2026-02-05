import {KeyCodes, isBackKey, isNavigationKey} from '../keyCodes';

describe('keyCodes utils', () => {
	it('recognizes navigation keys', () => {
		expect(isNavigationKey(KeyCodes.LEFT)).toBe(true);
		expect(isNavigationKey(KeyCodes.RIGHT)).toBe(true);
		expect(isNavigationKey(KeyCodes.ENTER)).toBe(true);
		expect(isNavigationKey(KeyCodes.DELETE)).toBe(false);
	});

	it('recognizes back keys from remote and keyboard', () => {
		expect(isBackKey(KeyCodes.BACK)).toBe(true);
		expect(isBackKey(KeyCodes.BACK_SOFT)).toBe(true);
		expect(isBackKey(KeyCodes.BACKSPACE)).toBe(true);
		expect(isBackKey(KeyCodes.LEFT)).toBe(false);
	});
});
