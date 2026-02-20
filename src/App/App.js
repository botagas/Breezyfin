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
import PerformanceOverlay from '../components/PerformanceOverlay';
import jellyfinService from '../services/jellyfinService';
import {isBackKey} from '../utils/keyCodes';
import { useBreezyfinSettingsSync } from '../hooks/useBreezyfinSettingsSync';
import {SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE} from '../constants/session';
import {readBreezyfinSettings} from '../utils/settingsStorage';
import {isStyleDebugEnabled} from '../utils/featureFlags';
import AppCrashBoundary from './AppCrashBoundary';

import css from './App.module.less';

const DETAIL_RETURN_VIEWS = new Set(['home', 'library', 'search', 'favorites', 'settings']);
const STYLE_DEBUG_ENABLED = isStyleDebugEnabled();
const KEYED_PANEL_STATE_CACHE_LIMIT = 180;
const normalizePanelStatePayload = (nextState) => nextState || null;
const upsertKeyedPanelState = (previousState, key, nextState) => {
	const normalizedKey = String(key);
	const normalizedState = normalizePanelStatePayload(nextState);
	const nextStateMap = {
		...previousState
	};
	if (Object.prototype.hasOwnProperty.call(nextStateMap, normalizedKey)) {
		delete nextStateMap[normalizedKey];
	}
	nextStateMap[normalizedKey] = normalizedState;
	const keys = Object.keys(nextStateMap);
	if (keys.length <= KEYED_PANEL_STATE_CACHE_LIMIT) {
		return nextStateMap;
	}
	const keysToDrop = keys.slice(0, keys.length - KEYED_PANEL_STATE_CACHE_LIMIT);
	keysToDrop.forEach((oldKey) => {
		delete nextStateMap[oldKey];
	});
	return nextStateMap;
};
const clearKeyedPanelState = (previousState, key) => {
	const normalizedKey = String(key);
	if (!Object.prototype.hasOwnProperty.call(previousState, normalizedKey)) {
		return previousState;
	}
	const nextStateMap = {
		...previousState
	};
	delete nextStateMap[normalizedKey];
	return nextStateMap;
};
let StyleDebugPanel = null;
if (STYLE_DEBUG_ENABLED) {
	// Keep debug-only panel and assets out of stable production bundles.
	StyleDebugPanel = require('../views/StyleDebugPanel').default;
}

const resolveInitialVisualSettings = () => {
	const settings = readBreezyfinSettings();
	return {
		animationsDisabled: settings.disableAnimations !== false,
		allAnimationsDisabled: settings.disableAllAnimations === true,
		navbarTheme: settings.navbarTheme === 'classic' ? 'classic' : 'elegant',
		performanceOverlayEnabled: settings.showPerformanceOverlay === true
	};
};

const App = (props) => {
	const initialVisualSettingsRef = useRef(resolveInitialVisualSettings());
	const [currentView, setCurrentView] = useState('login');
	const [selectedItem, setSelectedItem] = useState(null);
	const [selectedLibrary, setSelectedLibrary] = useState(null);
	const [playbackOptions, setPlaybackOptions] = useState(null);
	const [previousItem, setPreviousItem] = useState(null);
	const [homePanelState, setHomePanelState] = useState(null);
	const [libraryPanelStateById, setLibraryPanelStateById] = useState({});
	const [searchPanelState, setSearchPanelState] = useState(null);
	const [favoritesPanelState, setFavoritesPanelState] = useState(null);
	const [settingsPanelState, setSettingsPanelState] = useState(null);
	const [detailsPanelStateByItemId, setDetailsPanelStateByItemId] = useState({});
	const [detailsReturnView, setDetailsReturnView] = useState('home');
	const [playerControlsVisible, setPlayerControlsVisible] = useState(true);
	const [animationsDisabled, setAnimationsDisabled] = useState(initialVisualSettingsRef.current.animationsDisabled);
	const [allAnimationsDisabled, setAllAnimationsDisabled] = useState(initialVisualSettingsRef.current.allAnimationsDisabled);
	const [navbarTheme, setNavbarTheme] = useState(initialVisualSettingsRef.current.navbarTheme);
	const [performanceOverlayEnabled, setPerformanceOverlayEnabled] = useState(initialVisualSettingsRef.current.performanceOverlayEnabled);
	const [inputMode, setInputMode] = useState(() => (
		Spotlight?.getPointerMode?.() ? 'pointer' : '5way'
	));
	const [loginNotice, setLoginNotice] = useState('');
	const [loginNoticeNonce, setLoginNoticeNonce] = useState(0);
	const playerBackHandlerRef = useRef(null);
	const detailsBackHandlerRef = useRef(null);
	const homeBackHandlerRef = useRef(null);
	const libraryBackHandlerRef = useRef(null);
	const searchBackHandlerRef = useRef(null);
	const favoritesBackHandlerRef = useRef(null);
	const settingsBackHandlerRef = useRef(null);
	const styleDebugBackHandlerRef = useRef(null);
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
		setHomePanelState(null);
		setLibraryPanelStateById({});
		setSearchPanelState(null);
		setFavoritesPanelState(null);
		setSettingsPanelState(null);
		setDetailsPanelStateByItemId({});
		setDetailsReturnView('home');
		setPlayerControlsVisible(true);
		clearPanelHistory();
	}, [clearPanelHistory]);

	const clearPanelSelection = useCallback((options = {}) => {
		const {clearLibrary = true} = options;
		setSelectedItem(null);
		setPlaybackOptions(null);
		if (clearLibrary) {
			setSelectedLibrary(null);
		}
	}, []);

	const runPanelBackHandler = useCallback((handlerRef) => {
		if (typeof handlerRef?.current !== 'function') return false;
		return handlerRef.current() === true;
	}, []);

	const navigateToViewAndClearSelection = useCallback((view, options = {}) => {
		setCurrentView(view);
		clearPanelSelection(options);
	}, [clearPanelSelection]);

	const handleSectionBack = useCallback((handlerRef, fallbackView = 'home', options = {}) => {
		if (runPanelBackHandler(handlerRef)) return true;
		if (navigateBackInHistory()) return true;
		navigateToViewAndClearSelection(fallbackView, options);
		return true;
	}, [navigateBackInHistory, navigateToViewAndClearSelection, runPanelBackHandler]);

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
		navigateToViewAndClearSelection(targetView, {clearLibrary: targetView === 'home'});
		return true;
	}, [navigateBackInHistory, navigateToViewAndClearSelection, resolveDetailsReturnView]);
	const fallbackToDetailsFromPlayer = useCallback(() => {
		let historyFallbackItem = null;
		for (let index = panelHistoryRef.current.length - 1; index >= 0; index -= 1) {
			const snapshotItem = panelHistoryRef.current[index]?.selectedItem;
			if (snapshotItem) {
				historyFallbackItem = snapshotItem;
				break;
			}
		}
		const fallbackItem = selectedItem || previousItem || historyFallbackItem || null;
		if (fallbackItem) {
			setSelectedItem(fallbackItem);
		}
		setPlayerControlsVisible(true);
		setCurrentView('details');
		return true;
	}, [previousItem, selectedItem]);

	const applyVisualSettings = useCallback((settingsPayload) => {
		const settings = settingsPayload || {};
		setAnimationsDisabled(settings.disableAnimations !== false);
		setAllAnimationsDisabled(settings.disableAllAnimations === true);
		setNavbarTheme(settings.navbarTheme === 'classic' ? 'classic' : 'elegant');
		setPerformanceOverlayEnabled(settings.showPerformanceOverlay === true);
	}, []);

	useBreezyfinSettingsSync(applyVisualSettings);

	const handleSessionExpired = useCallback((message = SESSION_EXPIRED_MESSAGE) => {
		jellyfinService.switchUser();
		resetSessionState();
		setCurrentView('login');
		setLoginNotice(message);
		setLoginNoticeNonce((value) => value + 1);
	}, [resetSessionState]);

	useEffect(() => {
		let cancelled = false;
		const restoreSession = async () => {
			const restored = jellyfinService.restoreSession();
			if (!restored) return;
			const user = await jellyfinService.getCurrentUser();
			if (cancelled) return;
			if (user) {
				setCurrentView('home');
				return;
			}
			handleSessionExpired();
		};
		restoreSession();
		return () => {
			cancelled = true;
		};
	}, [handleSessionExpired]);

	useEffect(() => {
		const onSessionExpired = (event) => {
			const message = event?.detail?.message || SESSION_EXPIRED_MESSAGE;
			handleSessionExpired(message);
		};
		window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
		return () => {
			window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
		};
	}, [handleSessionExpired]);

	useEffect(() => {
		if (!STYLE_DEBUG_ENABLED && currentView === 'styleDebug') {
			setCurrentView('settings');
		}
	}, [currentView]);

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

	const handleBack = useCallback(() => {
		switch (currentView) {
			case 'library':
				return handleSectionBack(libraryBackHandlerRef, 'home');
			case 'search':
				return handleSectionBack(searchBackHandlerRef, 'home');
			case 'favorites':
				return handleSectionBack(favoritesBackHandlerRef, 'home');
			case 'settings':
				return handleSectionBack(settingsBackHandlerRef, 'home');
			case 'styleDebug':
				return handleSectionBack(styleDebugBackHandlerRef, 'settings');
			case 'details':
				if (runPanelBackHandler(detailsBackHandlerRef)) return true;
				return navigateBackFromDetails();
			case 'player':
				if (runPanelBackHandler(playerBackHandlerRef)) return true;
				if (playerControlsVisible) {
					setPlayerControlsVisible(false);
					return true;
				}
				if (navigateBackInHistory()) return true;
				return fallbackToDetailsFromPlayer();
			case 'home':
				if (runPanelBackHandler(homeBackHandlerRef)) return true;
				return false;
			case 'login':
			default:
				return false;
		}
	}, [
		currentView,
		fallbackToDetailsFromPlayer,
		handleSectionBack,
		navigateBackFromDetails,
		navigateBackInHistory,
		playerControlsVisible,
		runPanelBackHandler
	]);

	useEffect(() => {
		handleBackRef.current = handleBack;
	}, [handleBack]);

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

	useEffect(() => {
		const handlePopState = (e) => {
			const handled = handleBackRef.current?.();
			if (handled) {
				e.preventDefault?.();
				window.history.pushState({breezyfin: true}, document.title);
			}
		};
		const state = window.history.state || {};
		if (!state.breezyfin) {
			window.history.pushState({breezyfin: true}, document.title);
		}
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	const handleLogin = useCallback(() => {
		clearPanelHistory();
		setLoginNotice('');
		setCurrentView('home');
	}, [clearPanelHistory]);

	const handleLogout = useCallback(() => {
		jellyfinService.logout();
		resetSessionState();
		setLoginNotice('');
		setCurrentView('login');
	}, [resetSessionState]);

	const handleSignOut = useCallback(() => {
		jellyfinService.logout();
		resetSessionState();
		setLoginNotice('');
		setCurrentView('login');
	}, [resetSessionState]);

	const handleSwitchUser = useCallback(() => {
		jellyfinService.switchUser();
		resetSessionState();
		setLoginNotice('');
		setCurrentView('login');
	}, [resetSessionState]);

	const handleItemSelect = useCallback((item, fromItem = null) => {
		if (DETAIL_RETURN_VIEWS.has(currentView) && currentView !== 'details') {
			setDetailsReturnView(currentView);
			pushPanelHistory();
		} else if (currentView === 'details') {
			pushPanelHistory();
		}
		if (fromItem) {
			setPreviousItem(fromItem);
		} else if (selectedItem && selectedItem.Type === 'Series' && item.Type === 'Episode') {
			setPreviousItem(selectedItem);
		} else {
			setPreviousItem(null);
		}
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
			targetView === 'settings' ||
			(STYLE_DEBUG_ENABLED && targetView === 'styleDebug')
				? (targetView !== currentView || nextLibraryId !== currentLibraryId)
				: false;
		if (shouldTrackHistory) {
			pushPanelHistory();
		}
		switch (section) {
			case 'home':
				setHomePanelState(null);
				break;
			case 'library':
				if (nextLibraryId) {
					setLibraryPanelStateById((previousState) => clearKeyedPanelState(previousState, nextLibraryId));
				} else {
					setLibraryPanelStateById({});
				}
				break;
			case 'search':
				setSearchPanelState(null);
				break;
			case 'favorites':
				setFavoritesPanelState(null);
				break;
			case 'settings':
				setSettingsPanelState(null);
				break;
			default:
				break;
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
			case 'styleDebug':
				setCurrentView(section === 'styleDebug' && !STYLE_DEBUG_ENABLED ? 'settings' : section);
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
		fallbackToDetailsFromPlayer();
	}, [fallbackToDetailsFromPlayer, navigateBackInHistory]);

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

	const registerStyleDebugBackHandler = useCallback((handler) => {
		styleDebugBackHandlerRef.current = handler;
	}, []);

	const handleSearchPanelStateChange = useCallback((nextState) => {
		setSearchPanelState(normalizePanelStatePayload(nextState));
	}, []);

	const handleHomePanelStateChange = useCallback((nextState) => {
		setHomePanelState(normalizePanelStatePayload(nextState));
	}, []);

	const handleLibraryPanelStateChange = useCallback((libraryId, nextState) => {
		if (!libraryId) return;
		setLibraryPanelStateById((previousState) => (
			upsertKeyedPanelState(previousState, libraryId, nextState)
		));
	}, []);

	const handleFavoritesPanelStateChange = useCallback((nextState) => {
		setFavoritesPanelState(normalizePanelStatePayload(nextState));
	}, []);

	const handleSettingsPanelStateChange = useCallback((nextState) => {
		setSettingsPanelState(normalizePanelStatePayload(nextState));
	}, []);

	const handleDetailsPanelStateChange = useCallback((itemId, nextState) => {
		if (!itemId) return;
		setDetailsPanelStateByItemId((previousState) => (
			upsertKeyedPanelState(previousState, itemId, nextState)
		));
	}, []);

	const getPanelIndex = () => {
		const detailsPanelIndex = STYLE_DEBUG_ENABLED ? 7 : 6;
		const playerPanelIndex = STYLE_DEBUG_ENABLED ? 8 : 7;
		if (currentView === 'login') return 0;
		if (currentView === 'home') return 1;
		if (currentView === 'library') return 2;
		if (currentView === 'search') return 3;
		if (currentView === 'favorites') return 4;
		if (currentView === 'settings') return 5;
		if (currentView === 'styleDebug' && STYLE_DEBUG_ENABLED) return 6;
		if (currentView === 'details') return detailsPanelIndex;
		if (currentView === 'player') return playerPanelIndex;
		return 0;
	};

	const panelChildren = [
		<LoginPanel
			key="login"
			onLogin={handleLogin}
			isActive={currentView === 'login'}
			sessionNotice={loginNotice}
			sessionNoticeNonce={loginNoticeNonce}
		/>,
		<HomePanel
			key="home"
			isActive={currentView === 'home'}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={homePanelState}
			onCacheState={handleHomePanelStateChange}
			registerBackHandler={registerHomeBackHandler}
			noCloseButton
		/>,
		<LibraryPanel
			key="library"
			isActive={currentView === 'library'}
			library={selectedLibrary}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			onBack={handleBackToHome}
			cachedState={selectedLibrary?.Id ? libraryPanelStateById[String(selectedLibrary.Id)] || null : null}
			onCacheState={handleLibraryPanelStateChange}
			registerBackHandler={registerLibraryBackHandler}
			noCloseButton
		/>,
		<SearchPanel
			key="search"
			isActive={currentView === 'search'}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={searchPanelState}
			onCacheState={handleSearchPanelStateChange}
			registerBackHandler={registerSearchBackHandler}
			noCloseButton
		/>,
		<FavoritesPanel
			key="favorites"
			isActive={currentView === 'favorites'}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={favoritesPanelState}
			onCacheState={handleFavoritesPanelStateChange}
			registerBackHandler={registerFavoritesBackHandler}
			noCloseButton
		/>,
		<SettingsPanel
			key="settings"
			isActive={currentView === 'settings'}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onSignOut={handleSignOut}
			onExit={handleExit}
			cachedState={settingsPanelState}
			onCacheState={handleSettingsPanelStateChange}
			registerBackHandler={registerSettingsBackHandler}
			noCloseButton
		/>
	];

	if (STYLE_DEBUG_ENABLED && StyleDebugPanel) {
		panelChildren.push(
			<StyleDebugPanel
				key="styleDebug"
				isActive={currentView === 'styleDebug'}
				onNavigate={handleNavigate}
				onSwitchUser={handleSwitchUser}
				onLogout={handleLogout}
				onExit={handleExit}
				registerBackHandler={registerStyleDebugBackHandler}
				noCloseButton
			/>
		);
	}

	panelChildren.push(
		<MediaDetailsPanel
			key={`details-${selectedItem?.Id || 'none'}`}
			isActive={currentView === 'details'}
			item={selectedItem}
			onBack={navigateBackFromDetails}
			onPlay={handlePlay}
			onItemSelect={handleItemSelect}
			cachedState={selectedItem?.Id ? detailsPanelStateByItemId[String(selectedItem.Id)] || null : null}
			onCacheState={handleDetailsPanelStateChange}
			registerBackHandler={registerDetailsBackHandler}
			noCloseButton
		/>
	);

	panelChildren.push(
		<PlayerPanel
			key="player"
			isActive={currentView === 'player'}
			item={selectedItem}
			playbackOptions={playbackOptions}
			onBack={handleBackToDetails}
			onPlay={handlePlay}
			requestedControlsVisible={playerControlsVisible}
			onControlsVisibilityChange={setPlayerControlsVisible}
			registerBackHandler={registerPlayerBackHandler}
		/>
	);

	return (
		<div
			className={css.app}
			data-bf-animations={animationsDisabled ? 'off' : 'on'}
			data-bf-all-animations={allAnimationsDisabled ? 'off' : 'on'}
			data-bf-nav-theme={navbarTheme}
			data-bf-performance-overlay={performanceOverlayEnabled ? 'on' : 'off'}
			data-bf-input-mode={inputMode}
			{...props}
			>
				<Panels
					index={getPanelIndex()}
					onBack={handleBack}
				>
					{panelChildren}
				</Panels>
				<PerformanceOverlay enabled={performanceOverlayEnabled} inputMode={inputMode} />
			</div>
		);
	};

const AppWithBoundary = (props) => (
	<AppCrashBoundary>
		<App {...props} />
	</AppCrashBoundary>
);

export default ThemeDecorator(AppWithBoundary);
