import {
	getInteractionClientY,
	shouldRevealControlsForPointerY
} from '../playerInteractionReveal';

describe('playerInteractionReveal', () => {
	it('reveals controls for pointer movement near the top edge', () => {
		expect(shouldRevealControlsForPointerY(0, {viewportHeight: 1080})).toBe(true);
		expect(shouldRevealControlsForPointerY(120, {viewportHeight: 1080})).toBe(true);
		expect(shouldRevealControlsForPointerY(121, {viewportHeight: 1080})).toBe(false);
	});

	it('reveals controls for pointer movement near the bottom edge', () => {
		expect(shouldRevealControlsForPointerY(920, {viewportHeight: 1080})).toBe(true);
		expect(shouldRevealControlsForPointerY(919, {viewportHeight: 1080})).toBe(false);
		expect(shouldRevealControlsForPointerY(1080, {viewportHeight: 1080})).toBe(true);
	});

	it('ignores invalid pointer coordinates', () => {
		expect(shouldRevealControlsForPointerY(undefined, {viewportHeight: 1080})).toBe(false);
		expect(shouldRevealControlsForPointerY(100, {viewportHeight: 0})).toBe(false);
		expect(shouldRevealControlsForPointerY('bad', {viewportHeight: 1080})).toBe(false);
	});

	it('normalizes event clientY values', () => {
		expect(getInteractionClientY({clientY: 42})).toBe(42);
		expect(getInteractionClientY({clientY: '42'})).toBe(42);
		expect(getInteractionClientY({})).toBe(null);
	});
});
