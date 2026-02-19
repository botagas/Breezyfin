import { useEffect } from 'react';

export const usePanelBackHandler = (registerBackHandler, handler, options = {}) => {
	const {enabled = true} = options;

	useEffect(() => {
		if (!enabled) return undefined;
		if (typeof registerBackHandler !== 'function') return undefined;
		registerBackHandler(handler);
		return () => registerBackHandler(null);
	}, [enabled, handler, registerBackHandler]);
};
