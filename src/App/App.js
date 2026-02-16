import { useState, useEffect, useCallback, useRef } from 'react';
import ThemeDecorator from '@enact/sandstone/ThemeDecorator';
import Spotlight from '@enact/spotlight';
import { Panels } from '../components/BreezyPanels';

import LoginPanel from '../views/LoginPanel';
import HomePanel from '../views/HomePanel';
import LibraryPanel from '../views/LibraryPanel';
import SearchPanel from '../views/SearchPanel';
import FavoritesPanel from '../views/FavoritesPanel';
import SettingsPanel from '../views/SettingsPanel';
import PlayerPanel from '../views/PlayerPanel';
import MediaDetailsPanel from '../views/MediaDetailsPanel';
import jellyfinService from '../services/jellyfinService';
import {isBackKey} from '../utils/keyCodes';
import AppCrashBoundary from './AppCrashBoundary';

import css from './App.module.less';

const DETAIL_RETURN_VIEWS = new Set(['home', 'library', 'search', 'favorites', 'settings']);

const App = (props) => {
	const [currentView, setCurrentView] = useState('login'); // 'login', 'home', 'library', 'search', 'favorites', 'settings', 'details', 'player'
	const [selectedItem, setSelectedItem] = useState(null);
	const [selectedLibrary, setSelectedLibrary] = useState(null);
	const [playbackOptions, setPlaybackOptions] = useState(null);
	const [previousItem, setPreviousItem] = useState(null); // For back navigation from episode to series
	const [detailsReturnView, setDetailsReturnView] = useState('home');
	const [playerControlsVisible, setPlayerControlsVisible] = useState(true);
	const [animationsDisabled, setAnimationsDisabled] = useState(false);
	const [allAnimationsDisabled, setAllAnimationsDisabled] = useState(false);
	const [navbarTheme, setNavbarTheme] = useState('classic');
	const [inputMode, setInputMode] = useState(() => (
		Spotlight?.getPointerMode?.() ? 'pointer' : '5way'
	));
	const playerBackHandlerRef = useRef(null);
	const detailsBackHandlerRef = useRef(null);
	const homeBackHandlerRef = useRef(null);
	const libraryBackHandlerRef = useRef(null);
	const searchBackHandlerRef = useRef(null);
	const favoritesBackHandlerRef = useRef(null);
	const settingsBackHandlerRef = useRef(null);
	const handleBackRef = useRef(null);
	const panelHistoryRef = useRef([]);

	const createPanelSnapshot = useCallback(() => ({
		view: currentView,
		selectedItem,
		selectedLibrary,
		playbackOptions,
		previousItem,
		detailsReturnView,
		playerControlsVisible
	}), [
		currentView,
		detailsReturnView,
		playbackOptions,
		playerControlsVisible,
		previousItem,
		selectedItem,
		selectedLibrary
	]);

	const pushPanelHistory = useCallback(() => {
		panelHistoryRef.current = [...panelHistoryRef.current, createPanelSnapshot()];
	}, [createPanelSnapshot]);

	const clearPanelHistory = useCallback(() => {
		panelHistoryRef.current = [];
	}, []);

	const restorePanelSnapshot = useCallback((snapshot) => {
		if (!snapshot) return false;
		setCurrentView(snapshot.view || 'home');
		setSelectedItem(snapshot.selectedItem || null);
		setSelectedLibrary(snapshot.selectedLibrary || null);
		setPlaybackOptions(snapshot.playbackOptions || null);
		setPreviousItem(snapshot.previousItem || null);
		setDetailsReturnView(snapshot.detailsReturnView || 'home');
		setPlayerControlsVisible(snapshot.playerControlsVisible !== false);
		return true;
	}, []);

	const navigateBackInHistory = useCallback(() => {
		const history = panelHistoryRef.current;
		if (!history.length) return false;
		const previousSnapshot = history[history.length - 1];
		panelHistoryRef.current = history.slice(0, -1);
		return restorePanelSnapshot(previousSnapshot);
	}, [restorePanelSnapshot]);

	const resetSessionState = useCallback(() => {
		setSelectedItem(null);
		setSelectedLibrary(null);
		setPlaybackOptions(null);
		setPreviousItem(null);
		setDetailsReturnView('home');
		setPlayerControlsVisible(true);
		clearPanelHistory();
	}, [clearPanelHistory]);

	const resolveDetailsReturnView = useCallback(() => {
		if (detailsReturnView === 'library') {
			return selectedLibrary ? 'library' : 'home';
		}
		return DETAIL_RETURN_VIEWS.has(detailsReturnView) ? detailsReturnView : 'home';
	}, [detailsReturnView, selectedLibrary]);

	const navigateBackFromDetails = useCallback(() => {
		if (navigateBackInHistory()) {
			return true;
		}

		const targetView = resolveDetailsReturnView();
		setCurrentView(targetView);
		if (targetView === 'home') {
			setSelectedLibrary(null);
		}
		setSelectedItem(null);
		setPlaybackOptions(null);
		return true;
	}, [navigateBackInHistory, resolveDetailsReturnView]);

	const applyVisualSettings = useCallback((settingsPayload) => {
		const settings = settingsPayload || {};
		setAnimationsDisabled(settings.disableAnimations === true);
		setAllAnimationsDisabled(settings.disableAllAnimations === true);
		setNavbarTheme(settings.navbarTheme === 'elegant' ? 'elegant' : 'classic');
	}, []);

	const readVisualSettingsFromStorage = useCallback(() => {
		try {
			const raw = localStorage.getItem('breezyfinSettings');
			if (!raw) {
				applyVisualSettings({});
				return;
			}
			const parsed = JSON.parse(raw);
			applyVisualSettings(parsed);
		} catch (error) {
			console.error('Failed to read animation setting:', error);
			applyVisualSettings({});
		}
	}, [applyVisualSettings]);

	useEffect(() => {
		// Try to restore session on load
		const restored = jellyfinService.restoreSession();
		if (restored) {
			setCurrentView('home');
		}
		readVisualSettingsFromStorage();
	}, [readVisualSettingsFromStorage]);

	useEffect(() => {
		const handleSettingsChanged = (event) => {
			applyVisualSettings(event?.detail);
		};
		const handleStorage = (event) => {
			if (event?.key !== 'breezyfinSettings') return;
			readVisualSettingsFromStorage();
		};
		window.addEventListener('breezyfin-settings-changed', handleSettingsChanged);
		window.addEventListener('storage', handleStorage);
		return () => {
			window.removeEventListener('breezyfin-settings-changed', handleSettingsChanged);
			window.removeEventListener('storage', handleStorage);
		};
	}, [applyVisualSettings, readVisualSettingsFromStorage]);

	useEffect(() => {
		const setMode = (nextMode) => {
			setInputMode((currentMode) => (currentMode === nextMode ? currentMode : nextMode));
		};
		const handlePointerInput = () => setMode('pointer');
		const handleFiveWayInput = (event) => {
			const code = event.keyCode || event.which;
			const key = event.key;
			const isFiveWayKey =
				code === 37 ||
				code === 38 ||
				code === 39 ||
				code === 40 ||
				code === 13 ||
				code === 8 ||
				code === 27 ||
				code === 461 ||
				key === 'ArrowLeft' ||
				key === 'ArrowRight' ||
				key === 'ArrowUp' ||
				key === 'ArrowDown' ||
				key === 'Enter' ||
				key === 'Backspace' ||
				key === 'Escape';
			if (isFiveWayKey) {
				setMode('5way');
			}
		};

		document.addEventListener('mousemove', handlePointerInput, true);
		document.addEventListener('mousedown', handlePointerInput, true);
		document.addEventListener('touchstart', handlePointerInput, true);
		document.addEventListener('keydown', handleFiveWayInput, true);
		return () => {
			document.removeEventListener('mousemove', handlePointerInput, true);
			document.removeEventListener('mousedown', handlePointerInput, true);
			document.removeEventListener('touchstart', handlePointerInput, true);
			document.removeEventListener('keydown', handleFiveWayInput, true);
		};
	}, []);

	// Keep theme/performance attributes on document roots so floating-layer UI (Popup, etc.)
	// receives the same styling tokens as in-panel content.
	useEffect(() => {
		if (typeof document === 'undefined') return undefined;
		const roots = [document.documentElement, document.body].filter(Boolean);
		roots.forEach((root) => {
			root.setAttribute('data-bf-nav-theme', navbarTheme);
			root.setAttribute('data-bf-animations', animationsDisabled ? 'off' : 'on');
			root.setAttribute('data-bf-all-animations', allAnimationsDisabled ? 'off' : 'on');
			root.setAttribute('data-bf-input-mode', inputMode);
		});
		return () => {
			roots.forEach((root) => {
				root.removeAttribute('data-bf-nav-theme');
				root.removeAttribute('data-bf-animations');
				root.removeAttribute('data-bf-all-animations');
				root.removeAttribute('data-bf-input-mode');
			});
		};
	}, [allAnimationsDisabled, animationsDisabled, inputMode, navbarTheme]);

	// Handle back button globally
	const handleBack = useCallback(() => {
		const runBackHandler = (handlerRef) => {
			if (typeof handlerRef?.current !== 'function') return false;
			return handlerRef.current() === true;
		};
		switch (currentView) {
			case 'library':
				if (runBackHandler(libraryBackHandlerRef)) return true;
				if (navigateBackInHistory()) return true;
				setCurrentView('home');
				setSelectedItem(null);
				setSelectedLibrary(null);
				setPlaybackOptions(null);
				return true;
			case 'search':
				if (runBackHandler(searchBackHandlerRef)) return true;
				if (navigateBackInHistory()) return true;
				setCurrentView('home');
				setSelectedItem(null);
				setSelectedLibrary(null);
				setPlaybackOptions(null);
				return true;
			case 'favorites':
				if (runBackHandler(favoritesBackHandlerRef)) return true;
				if (navigateBackInHistory()) return true;
				setCurrentView('home');
				setSelectedItem(null);
				setSelectedLibrary(null);
				setPlaybackOptions(null);
				return true;
			case 'settings':
				if (runBackHandler(settingsBackHandlerRef)) return true;
				if (navigateBackInHistory()) return true;
				setCurrentView('home');
				setSelectedItem(null);
				setSelectedLibrary(null);
				setPlaybackOptions(null);
				return true;
			case 'details':
				if (typeof detailsBackHandlerRef.current === 'function') {
					const handledInDetails = detailsBackHandlerRef.current();
					if (handledInDetails) {
						return true;
					}
				}
				return navigateBackFromDetails();
			case 'player':
				if (typeof playerBackHandlerRef.current === 'function') {
					const handledInPlayer = playerBackHandlerRef.current();
					if (handledInPlayer) {
						return true;
					}
				}
				if (playerControlsVisible) {
					setPlayerControlsVisible(false);
					return true;
				}
				if (navigateBackInHistory()) return true;
				setCurrentView('details');
				return true;
			case 'home':
				if (runBackHandler(homeBackHandlerRef)) return true;
				return false; // Allow default behavior (exit prompt)
			case 'login':
			default:
				return false; // Allow default behavior (exit prompt)
		}
	}, [currentView, navigateBackFromDetails, navigateBackInHistory, playerControlsVisible]);

	useEffect(() => {
		handleBackRef.current = handleBack;
	}, [handleBack]);

	// Global back-key listener to keep navigation consistent outside the player
	useEffect(() => {
		const handleGlobalKeyDown = (e) => {
			const code = e.keyCode || e.which;
			if (isBackKey(code)) {
				const handled = handleBack();
				if (handled) {
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation?.();
				}
			}
		};
		document.addEventListener('keydown', handleGlobalKeyDown, true);
		return () => document.removeEventListener('keydown', handleGlobalKeyDown, true);
	}, [handleBack]);

	// Intercept browser history back (webOS back triggers popstate)
	useEffect(() => {
		const handlePopState = (e) => {
			const handled = handleBackRef.current?.();
			if (handled) {
				e.preventDefault?.();
				// Re-push a dummy state so the next back event stays in-app
				window.history.pushState({breezyfin: true}, document.title);
			}
		};
		// Push only once to avoid history flooding when component re-renders.
		const state = window.history.state || {};
		if (!state.breezyfin) {
			window.history.pushState({breezyfin: true}, document.title);
		}
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	const handleLogin = useCallback(() => {
		clearPanelHistory();
		setCurrentView('home');
	}, [clearPanelHistory]);

	const handleLogout = useCallback(() => {
		jellyfinService.logout();
		resetSessionState();
		setCurrentView('login');
	}, [resetSessionState]);

	const handleSignOut = useCallback(() => {
		jellyfinService.logout();
		resetSessionState();
		setCurrentView('login');
	}, [resetSessionState]);

	const handleSwitchUser = useCallback(() => {
		jellyfinService.switchUser();
		resetSessionState();
		setCurrentView('login');
	}, [resetSessionState]);

	const handleItemSelect = useCallback((item, fromItem = null) => {
		if (DETAIL_RETURN_VIEWS.has(currentView) && currentView !== 'details') {
			setDetailsReturnView(currentView);
			pushPanelHistory();
		}
		// Track the previous item for back navigation (e.g., series -> episode)
		if (fromItem) {
			setPreviousItem(fromItem);
		} else if (selectedItem && selectedItem.Type === 'Series' && item.Type === 'Episode') {
			// If navigating from series to episode, remember the series
			setPreviousItem(selectedItem);
		} else {
			setPreviousItem(null);
		}
		// Always show details first, not immediate play
		setSelectedItem(item);
		setPlaybackOptions(null);
		setCurrentView('details');
	}, [currentView, pushPanelHistory, selectedItem]);

	const handleNavigate = useCallback((section, data) => {
		const targetView = section;
		const nextLibraryId = targetView === 'library' ? data?.Id : null;
		const currentLibraryId = selectedLibrary?.Id || null;
		const shouldTrackHistory =
			targetView === 'home' ||
			targetView === 'library' ||
			targetView === 'search' ||
			targetView === 'favorites' ||
			targetView === 'settings'
				? (targetView !== currentView || nextLibraryId !== currentLibraryId)
				: false;
		if (shouldTrackHistory) {
			pushPanelHistory();
		}
		switch (section) {
			case 'home':
				setCurrentView('home');
				setSelectedLibrary(null);
				setSelectedItem(null);
				setPlaybackOptions(null);
				break;
			case 'library':
				setSelectedLibrary(data);
				setSelectedItem(null);
				setPlaybackOptions(null);
				setCurrentView('library');
				break;
			case 'search':
			case 'favorites':
			case 'settings':
				setCurrentView(section);
				setSelectedItem(null);
				setSelectedLibrary(null);
				setPlaybackOptions(null);
				break;
			default:
				break;
		}
	}, [currentView, pushPanelHistory, selectedLibrary?.Id]);

	const handlePlay = useCallback((item, options = null) => {
		if (currentView !== 'player') {
			pushPanelHistory();
		}
		setSelectedItem(item);
		setPlaybackOptions(options);
		setPlayerControlsVisible(true);
		setCurrentView('player');
	}, [currentView, pushPanelHistory]);

	const handleBackToHome = useCallback(() => {
		if (navigateBackInHistory()) return;
		setCurrentView('home');
		setSelectedItem(null);
		setSelectedLibrary(null);
		setPlaybackOptions(null);
	}, [navigateBackInHistory]);

	const handleBackToDetails = useCallback(() => {
		if (navigateBackInHistory()) return;
		setPlayerControlsVisible(true);
		setCurrentView('details');
	}, [navigateBackInHistory]);

	const handleExit = useCallback(() => {
		if (typeof window !== 'undefined' && window.close) {
			window.close();
		}
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

	const getPanelIndex = () => {
		if (currentView === 'login') return 0;
		if (currentView === 'home') return 1;
		if (currentView === 'library') return 2;
		if (currentView === 'search') return 3;
		if (currentView === 'favorites') return 4;
		if (currentView === 'settings') return 5;
		if (currentView === 'details') return 6;
		if (currentView === 'player') return 7;
		return 0;
	};

	return (
		<div
			className={css.app}
			data-bf-animations={animationsDisabled ? 'off' : 'on'}
			data-bf-all-animations={allAnimationsDisabled ? 'off' : 'on'}
			data-bf-nav-theme={navbarTheme}
			data-bf-input-mode={inputMode}
			{...props}
		>
			<Panels
				index={getPanelIndex()}
				onBack={handleBack}
			>
					<LoginPanel onLogin={handleLogin} isActive={currentView === 'login'} />
					<HomePanel
						onItemSelect={handleItemSelect}
						onNavigate={handleNavigate}
						onSwitchUser={handleSwitchUser}
						onLogout={handleLogout}
						onExit={handleExit}
						registerBackHandler={registerHomeBackHandler}
						noCloseButton
					/>
					<LibraryPanel
						library={selectedLibrary}
						onItemSelect={handleItemSelect}
						onNavigate={handleNavigate}
						onSwitchUser={handleSwitchUser}
						onLogout={handleLogout}
						onExit={handleExit}
						onBack={handleBackToHome}
						registerBackHandler={registerLibraryBackHandler}
						noCloseButton
					/>
					<SearchPanel
						onItemSelect={handleItemSelect}
						onNavigate={handleNavigate}
						onSwitchUser={handleSwitchUser}
						onLogout={handleLogout}
						onExit={handleExit}
						registerBackHandler={registerSearchBackHandler}
						noCloseButton
					/>
					<FavoritesPanel
						onItemSelect={handleItemSelect}
						onNavigate={handleNavigate}
						onSwitchUser={handleSwitchUser}
						onLogout={handleLogout}
						onExit={handleExit}
						registerBackHandler={registerFavoritesBackHandler}
						noCloseButton
					/>
						<SettingsPanel
							onNavigate={handleNavigate}
							onSwitchUser={handleSwitchUser}
							onLogout={handleLogout}
							onSignOut={handleSignOut}
							onExit={handleExit}
							registerBackHandler={registerSettingsBackHandler}
							noCloseButton
						/>
					<MediaDetailsPanel
						isActive={currentView === 'details'}
						item={selectedItem}
						onBack={navigateBackFromDetails}
						onPlay={handlePlay}
						onItemSelect={handleItemSelect}
						registerBackHandler={registerDetailsBackHandler}
						noCloseButton
					/>
				<PlayerPanel
					isActive={currentView === 'player'}
					item={selectedItem}
					playbackOptions={playbackOptions}
						onBack={handleBackToDetails}
						onPlay={handlePlay}
						requestedControlsVisible={playerControlsVisible}
						onControlsVisibilityChange={setPlayerControlsVisible}
						registerBackHandler={registerPlayerBackHandler}
					/>
			</Panels>
		</div>
	);
};

const AppWithBoundary = (props) => (
	<AppCrashBoundary>
		<App {...props} />
	</AppCrashBoundary>
);

export default ThemeDecorator(AppWithBoundary);
