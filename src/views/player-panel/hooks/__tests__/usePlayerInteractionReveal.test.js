import {act, fireEvent, renderHook} from '@testing-library/react';
import {usePlayerInteractionReveal} from '../usePlayerInteractionReveal';

describe('usePlayerInteractionReveal', () => {
	let originalRequestAnimationFrame;
	let originalCancelAnimationFrame;
	let frameCallback;

	beforeEach(() => {
		frameCallback = null;
		originalRequestAnimationFrame = window.requestAnimationFrame;
		originalCancelAnimationFrame = window.cancelAnimationFrame;
		window.requestAnimationFrame = jest.fn((callback) => {
			frameCallback = callback;
			return 1;
		});
		window.cancelAnimationFrame = jest.fn();
	});

	afterEach(() => {
		window.requestAnimationFrame = originalRequestAnimationFrame;
		window.cancelAnimationFrame = originalCancelAnimationFrame;
	});

	it('does not reveal controls while the paused-player screensaver owns input', () => {
		const blockedRef = {current: true};
		const setShowControls = jest.fn();
		const lastInteractionRef = {current: 0};

		renderHook(() => usePlayerInteractionReveal({
			enabled: true,
			showControls: false,
			setShowControls,
			lastInteractionRef,
			blockedRef
		}));

		fireEvent.wheel(window);
		expect(window.requestAnimationFrame).not.toHaveBeenCalled();
		expect(setShowControls).not.toHaveBeenCalled();

		blockedRef.current = false;
		fireEvent.wheel(window);
		expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
		act(() => frameCallback());
		expect(setShowControls).toHaveBeenCalledWith(true);
		expect(lastInteractionRef.current).toBeGreaterThan(0);
	});
});
