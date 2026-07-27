import { useRef, useCallback } from 'react';

export const usePanelBackHandlerRegistry = () => {
	const playerBackHandlerRef = useRef(null);
	const detailsBackHandlerRef = useRef(null);
	const homeBackHandlerRef = useRef(null);
	const homeSectionBackHandlerRef = useRef(null);
	const libraryBackHandlerRef = useRef(null);
	const searchBackHandlerRef = useRef(null);
	const favoritesBackHandlerRef = useRef(null);
	const settingsBackHandlerRef = useRef(null);
	const watchlistBackHandlerRef = useRef(null);
	const calendarBackHandlerRef = useRef(null);
	const syncPlayBackHandlerRef = useRef(null);
	const watchPartyBackHandlerRef = useRef(null);

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

	const registerHomeSectionBackHandler = useCallback((handler) => {
		homeSectionBackHandlerRef.current = handler;
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

	const registerWatchlistBackHandler = useCallback((handler) => {
		watchlistBackHandlerRef.current = handler;
	}, []);

	const registerCalendarBackHandler = useCallback((handler) => {
		calendarBackHandlerRef.current = handler;
	}, []);

	const registerSyncPlayBackHandler = useCallback((handler) => {
		syncPlayBackHandlerRef.current = handler;
	}, []);

	const registerWatchPartyBackHandler = useCallback((handler) => {
		watchPartyBackHandlerRef.current = handler;
	}, []);

	return {
		refs: {
			playerBackHandlerRef,
			detailsBackHandlerRef,
			homeBackHandlerRef,
			homeSectionBackHandlerRef,
			libraryBackHandlerRef,
			searchBackHandlerRef,
			favoritesBackHandlerRef,
			settingsBackHandlerRef,
			watchlistBackHandlerRef,
			calendarBackHandlerRef,
			syncPlayBackHandlerRef,
			watchPartyBackHandlerRef
		},
		runPanelBackHandler,
		registerDetailsBackHandler,
		registerPlayerBackHandler,
		registerHomeBackHandler,
		registerHomeSectionBackHandler,
		registerLibraryBackHandler,
		registerSearchBackHandler,
		registerFavoritesBackHandler,
		registerSettingsBackHandler,
		registerWatchlistBackHandler,
		registerCalendarBackHandler,
		registerSyncPlayBackHandler,
		registerWatchPartyBackHandler
	};
};

export default usePanelBackHandlerRegistry;
