import {isPopupFocusContainer} from '../usePopupInitialFocus';

describe('isPopupFocusContainer', () => {
	it('accepts DOM-like popup containers', () => {
		expect(isPopupFocusContainer({
			querySelectorAll: () => [],
			contains: () => false
		})).toBe(true);
	});

	it('rejects decorated component refs without DOM containment methods', () => {
		expect(isPopupFocusContainer({querySelectorAll: () => []})).toBe(false);
		expect(isPopupFocusContainer({contains: () => false})).toBe(false);
		expect(isPopupFocusContainer(null)).toBe(false);
	});
});
