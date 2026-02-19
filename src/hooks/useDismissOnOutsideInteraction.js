import { useEffect } from 'react';

const isEventTargetNode = (target) => {
	return target && typeof target.nodeType === 'number';
};

export const useDismissOnOutsideInteraction = (options = {}) => {
	const {
		enabled = true,
		scopeRef,
		onDismiss
	} = options;

	useEffect(() => {
		if (!enabled || typeof onDismiss !== 'function') return undefined;

		const handleOutsideInteraction = (event) => {
			const target = event?.target;
			if (!isEventTargetNode(target)) return;
			const scope = scopeRef?.current;
			if (!scope || scope.contains(target)) return;
			onDismiss(event);
		};

		document.addEventListener('focusin', handleOutsideInteraction, true);
		document.addEventListener('pointerdown', handleOutsideInteraction, true);
		document.addEventListener('mousedown', handleOutsideInteraction, true);
		document.addEventListener('touchstart', handleOutsideInteraction, true);

		return () => {
			document.removeEventListener('focusin', handleOutsideInteraction, true);
			document.removeEventListener('pointerdown', handleOutsideInteraction, true);
			document.removeEventListener('mousedown', handleOutsideInteraction, true);
			document.removeEventListener('touchstart', handleOutsideInteraction, true);
		};
	}, [enabled, onDismiss, scopeRef]);
};

