import {
	getHorizontalScrollAdjustment,
	scrollElementIntoHorizontalView
} from '../horizontalScroll';

describe('horizontalScroll', () => {
	it('does not move an element already inside the buffered viewport', () => {
		expect(getHorizontalScrollAdjustment({
			scrollLeft: 200,
			viewportWidth: 1000,
			scrollWidth: 3000,
			elementLeft: 500,
			elementWidth: 300,
			minBuffer: 60
		})).toBe(0);
	});

	it('calculates bounded left and right corrections', () => {
		expect(getHorizontalScrollAdjustment({
			scrollLeft: 500,
			viewportWidth: 1000,
			scrollWidth: 3000,
			elementLeft: 520,
			elementWidth: 300,
			minBuffer: 100,
			padding: 20
		})).toBe(-100);

		expect(getHorizontalScrollAdjustment({
			scrollLeft: 500,
			viewportWidth: 1000,
			scrollWidth: 3000,
			elementLeft: 1350,
			elementWidth: 300,
			minBuffer: 100,
			padding: 20
		})).toBe(270);
	});

	it('clamps corrections to the available scroll range', () => {
		expect(getHorizontalScrollAdjustment({
			scrollLeft: 30,
			viewportWidth: 1000,
			scrollWidth: 1800,
			elementLeft: 0,
			elementWidth: 300,
			minBuffer: 100
		})).toBe(-30);

		expect(getHorizontalScrollAdjustment({
			scrollLeft: 700,
			viewportWidth: 1000,
			scrollWidth: 1800,
			elementLeft: 1600,
			elementWidth: 300,
			minBuffer: 100
		})).toBe(100);
	});

	it('scrolls with offset geometry and the requested behavior', () => {
		const scrollTo = jest.fn();
		const scroller = {
			clientWidth: 1000,
			scrollWidth: 3000,
			scrollLeft: 500,
			scrollTo
		};
		const element = {
			offsetLeft: 1350,
			offsetWidth: 300,
			offsetParent: scroller
		};

		expect(scrollElementIntoHorizontalView(scroller, element, {
			minBuffer: 100,
			padding: 20,
			behavior: 'auto'
		})).toBe(true);
		expect(scrollTo).toHaveBeenCalledWith({left: 770, behavior: 'auto'});
	});
});
