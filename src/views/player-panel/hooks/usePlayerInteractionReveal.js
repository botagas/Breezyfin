import {useEffect, useRef} from 'react';
import {
	getInteractionClientY,
	shouldRevealControlsForPointerY
} from '../utils/playerInteractionReveal';

export const usePlayerInteractionReveal = ({
	enabled = false,
	disabled = false,
	showControls,
	setShowControls,
	lastInteractionRef
}) => {
	const showControlsRef = useRef(showControls);

	useEffect(() => {
		showControlsRef.current = showControls;
	}, [showControls]);

	useEffect(() => {
		if (!enabled || disabled || typeof window === 'undefined') return undefined;
		let pendingFrame = null;

		const revealControls = () => {
			lastInteractionRef.current = Date.now();
			if (!showControlsRef.current) {
				setShowControls(true);
			}
		};

		const scheduleReveal = () => {
			if (pendingFrame !== null) return;
			pendingFrame = window.requestAnimationFrame(() => {
				pendingFrame = null;
				revealControls();
			});
		};

		const handleWheel = () => {
			scheduleReveal();
		};

		const handlePointerMove = (event) => {
			const clientY = getInteractionClientY(event);
			if (clientY === null) return;
			if (!shouldRevealControlsForPointerY(clientY, {viewportHeight: window.innerHeight})) return;
			scheduleReveal();
		};

		const listenerOptions = {passive: true};
		window.addEventListener('wheel', handleWheel, listenerOptions);
		window.addEventListener('mousemove', handlePointerMove, listenerOptions);
		window.addEventListener('pointermove', handlePointerMove, listenerOptions);

		return () => {
			if (pendingFrame !== null) {
				window.cancelAnimationFrame(pendingFrame);
			}
			window.removeEventListener('wheel', handleWheel, listenerOptions);
			window.removeEventListener('mousemove', handlePointerMove, listenerOptions);
			window.removeEventListener('pointermove', handlePointerMove, listenerOptions);
		};
	}, [disabled, enabled, lastInteractionRef, setShowControls]);
};
