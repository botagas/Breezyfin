import {useEffect, useState} from 'react';

import {KeyCodes, isBackKey} from '../utils/keyCodes';

const resolveInitialInputMode = (spotlightInstance) => (
	spotlightInstance?.getPointerMode?.() ? 'pointer' : '5way'
);

const isFiveWayKeyboardEvent = (event) => {
	const code = event.keyCode || event.which;
	const key = event.key;
	return (
		code === KeyCodes.LEFT ||
		code === KeyCodes.UP ||
		code === KeyCodes.RIGHT ||
		code === KeyCodes.DOWN ||
		code === KeyCodes.ENTER ||
		isBackKey(code) ||
		key === 'ArrowLeft' ||
		key === 'ArrowRight' ||
		key === 'ArrowUp' ||
		key === 'ArrowDown' ||
		key === 'Enter' ||
		key === 'Backspace' ||
		key === 'Escape'
	);
};

export const useInputMode = (spotlightInstance) => {
	const [inputMode, setInputMode] = useState(() => resolveInitialInputMode(spotlightInstance));

	useEffect(() => {
		if (typeof window === 'undefined') return undefined;
		const applySpotlightPointerMode = (enabled) => {
			if (!spotlightInstance?.setPointerMode || !spotlightInstance?.getPointerMode) return;
			try {
				if (spotlightInstance.getPointerMode() !== enabled) {
					spotlightInstance.setPointerMode(enabled);
				}
			} catch (_) {
				// Ignore Spotlight mode sync failures and keep UI state updates flowing.
			}
		};
		const setMode = (nextMode) => {
			setInputMode((currentMode) => (currentMode === nextMode ? currentMode : nextMode));
		};
		const handlePointerInput = () => {
			applySpotlightPointerMode(true);
			setMode('pointer');
		};
		const handleFiveWayInput = (event) => {
			if (isFiveWayKeyboardEvent(event)) {
				applySpotlightPointerMode(false);
				setMode('5way');
			}
		};

		// Listen at window capture phase so pointer-mode flips happen before downstream key handlers.
		window.addEventListener('mousemove', handlePointerInput, true);
		window.addEventListener('mousedown', handlePointerInput, true);
		window.addEventListener('pointermove', handlePointerInput, true);
		window.addEventListener('pointerdown', handlePointerInput, true);
		window.addEventListener('touchstart', handlePointerInput, true);
		window.addEventListener('keydown', handleFiveWayInput, true);

		return () => {
			window.removeEventListener('mousemove', handlePointerInput, true);
			window.removeEventListener('mousedown', handlePointerInput, true);
			window.removeEventListener('pointermove', handlePointerInput, true);
			window.removeEventListener('pointerdown', handlePointerInput, true);
			window.removeEventListener('touchstart', handlePointerInput, true);
			window.removeEventListener('keydown', handleFiveWayInput, true);
		};
	}, [spotlightInstance]);

	return inputMode;
};
