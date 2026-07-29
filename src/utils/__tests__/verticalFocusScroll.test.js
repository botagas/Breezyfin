import {getVerticalVisibilityDelta} from '../verticalFocusScroll';

describe('vertical focus visibility', () => {
	it('scrolls upward when a row is hidden under top chrome', () => {
		expect(getVerticalVisibilityDelta({
			targetRect: {top: 80, bottom: 260},
			scrollerRect: {top: 0, bottom: 1080},
			topBoundary: 120,
			topPadding: 12,
			bottomPadding: 16
		})).toBe(-52);
	});

	it('scrolls downward when a row crosses the lower safe edge', () => {
		expect(getVerticalVisibilityDelta({
			targetRect: {top: 900, bottom: 1100},
			scrollerRect: {top: 0, bottom: 1080},
			topBoundary: 120,
			topPadding: 12,
			bottomPadding: 16
		})).toBe(36);
	});

	it('does not adjust rows already inside the safe viewport', () => {
		expect(getVerticalVisibilityDelta({
			targetRect: {top: 180, bottom: 820},
			scrollerRect: {top: 0, bottom: 1080},
			topBoundary: 120
		})).toBe(0);
	});
});
