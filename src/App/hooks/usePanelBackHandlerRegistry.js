import { useRef, useCallback } from 'react';

export const usePanelBackHandlerRegistry = () => {
	const playerBackHandlerRef = useRef(null);
	const detailsBackHandlerRef = useRef(null);
	const homeBackHandlerRef = useRef(null);
	const libraryBackHandlerRef = useRef(null);
	const searchBackHandlerRef = useRef(null);
	const favoritesBackHandlerRef = useRef(null);
	const settingsBackHandlerRef = useRef(null);

	const runPanelBackHandler = useCallback((handlerRef) => {
		if (typeof handlerRef?.current !== 'function') return false;
		return handlerRef.current() === true;
	}, []);

	const registerDetailsBackHandler = useCallback((handler) => {
		detailsBackHandlerRef.current = handler;
	}, []);

	const registerPlayerBackHandler = useCallback((handler) => {
		playerBackHandlerRef.current = handler;
	}, []);

	const registerHomeBackHandler = useCallback((handler) => {
		homeBackHandlerRef.current = handler;
	}, []);

	const registerLibraryBackHandler = useCallback((handler) => {
		libraryBackHandlerRef.current = handler;
	}, []);

	const registerSearchBackHandler = useCallback((handler) => {
		searchBackHandlerRef.current = handler;
	}, []);

	const registerFavoritesBackHandler = useCallback((handler) => {
		favoritesBackHandlerRef.current = handler;
	}, []);

	const registerSettingsBackHandler = useCallback((handler) => {
		settingsBackHandlerRef.current = handler;
	}, []);

	return {
		refs: {
			playerBackHandlerRef,
			detailsBackHandlerRef,
			homeBackHandlerRef,
			libraryBackHandlerRef,
			searchBackHandlerRef,
			favoritesBackHandlerRef,
			settingsBackHandlerRef
		},
		runPanelBackHandler,
		registerDetailsBackHandler,
		registerPlayerBackHandler,
		registerHomeBackHandler,
		registerLibraryBackHandler,
		registerSearchBackHandler,
		registerFavoritesBackHandler,
		registerSettingsBackHandler
	};
};

export default usePanelBackHandlerRegistry;
