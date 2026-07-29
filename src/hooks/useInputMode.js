import {useEffect, useRef, useState} from 'react';

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
	const inputModeRef = useRef(inputMode);

	useEffect(() => {
		if (typeof window === 'undefined') return undefined;
		const applyMode = (nextMode) => {
			if (inputModeRef.current === nextMode) return;
			inputModeRef.current = nextMode;
			const pointerModeEnabled = nextMode === 'pointer';
			try {
				if (
					spotlightInstance?.setPointerMode &&
					spotlightInstance?.getPointerMode &&
					spotlightInstance.getPointerMode() !== pointerModeEnabled
				) {
					spotlightInstance.setPointerMode(pointerModeEnabled);
				}
			} catch (_) {
				// Ignore Spotlight mode sync failures and keep UI state updates flowing.
			}
			setInputMode(nextMode);
		};
		const handlePointerInput = () => {
			applyMode('pointer');
		};
		const handleFiveWayInput = (event) => {
			if (isFiveWayKeyboardEvent(event)) {
				applyMode('5way');
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
