import {useCallback, useRef} from 'react';

export const useToolbarBackHandler = () => {
	const toolbarBackHandlerRef = useRef(null);

	const registerToolbarBackHandler = useCallback((handler) => {
		toolbarBackHandlerRef.current = handler;
	}, []);

	const runToolbarBackHandler = useCallback(() => {
		if (typeof toolbarBackHandlerRef.current !== 'function') return false;
		return toolbarBackHandlerRef.current() === true;
	}, []);

	return {
		registerToolbarBackHandler,
		runToolbarBackHandler
	};
};
