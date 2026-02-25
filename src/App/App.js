import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ThemeDecorator from '@enact/sandstone/ThemeDecorator';
import Spotlight from '@enact/spotlight';
import { Panels } from '../components/BreezyPanels';

import PerformanceOverlay from '../components/PerformanceOverlay';
import jellyfinService from '../services/jellyfinService';
import {isBackKey} from '../utils/keyCodes';
import { useBreezyfinSettingsSync } from '../hooks/useBreezyfinSettingsSync';
import { useInputMode } from '../hooks/useInputMode';
import {SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE} from '../constants/session';
import {readBreezyfinSettings} from '../utils/settingsStorage';
import {isStyleDebugEnabled} from '../utils/featureFlags';
import {getRuntimePlatformCapabilities} from '../utils/platformCapabilities';
import AppCrashBoundary from './AppCrashBoundary';
import {normalizePanelStatePayload, upsertKeyedPanelState, clearKeyedPanelState} from './utils/panelStateCache';
import {getPanelIndexForView} from './utils/panelIndex';
import {createPanelChildren} from './utils/createPanelChildren';
import {buildRuntimeDataAttributes} from './utils/runtimeDataAttributes';
import {usePanelHistory} from './hooks/usePanelHistory';
import {usePanelBackHandlerRegistry} from './hooks/usePanelBackHandlerRegistry';

import css from './App.module.less';

const DETAIL_RETURN_VIEWS = new Set(['home', 'library', 'search', 'favorites', 'settings']);
const STYLE_DEBUG_ENABLED = isStyleDebugEnabled();
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
	const runtimeCapabilities = getRuntimePlatformCapabilities();
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
	const inputMode = useInputMode(Spotlight);
	const [loginNotice, setLoginNotice] = useState('');
	const [loginNoticeNonce, setLoginNoticeNonce] = useState(0);
	const handleBackRef = useRef(null);
	const {
		refs: {
			playerBackHandlerRef,
			detailsBackHandlerRef,
			homeBackHandlerRef,
			libraryBackHandlerRef,
			searchBackHandlerRef,
			favoritesBackHandlerRef,
			settingsBackHandlerRef,
			styleDebugBackHandlerRef
		},
		runPanelBackHandler,
		registerDetailsBackHandler,
		registerPlayerBackHandler,
		registerHomeBackHandler,
		registerLibraryBackHandler,
		registerSearchBackHandler,
		registerFavoritesBackHandler,
		registerSettingsBackHandler,
		registerStyleDebugBackHandler
	} = usePanelBackHandlerRegistry();
	const {
		pushPanelHistory,
		clearPanelHistory,
		navigateBackInHistory,
		getHistoryFallbackItem,
		updateLatestHistorySnapshot
	} = usePanelHistory({
		currentView,
		selectedItem,
		selectedLibrary,
		playbackOptions,
		previousItem,
		detailsReturnView,
		playerControlsVisible,
		setCurrentView,
		setSelectedItem,
		setSelectedLibrary,
		setPlaybackOptions,
		setPreviousItem,
		setDetailsReturnView,
		setPlayerControlsVisible
	});

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
		const historyFallbackItem = getHistoryFallbackItem();
		const fallbackItem = selectedItem || previousItem || historyFallbackItem || null;
		if (fallbackItem) {
			setSelectedItem(fallbackItem);
		}
		setPlayerControlsVisible(true);
		setCurrentView('details');
		return true;
	}, [getHistoryFallbackItem, previousItem, selectedItem]);

	const syncPlayerBackTargetDetailsItem = useCallback(() => {
		const currentPlayerItem = selectedItem;
		if (!currentPlayerItem?.Id) return;
		updateLatestHistorySnapshot((snapshot) => {
			if (!snapshot || snapshot.view !== 'details') return snapshot;
			if (snapshot.selectedItem?.Id === currentPlayerItem.Id) return snapshot;
			return {
				...snapshot,
				selectedItem: currentPlayerItem
			};
		});
	}, [selectedItem, updateLatestHistorySnapshot]);

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

	const runtimeDataAttributes = useMemo(() => (
		buildRuntimeDataAttributes({
			navbarTheme,
			animationsDisabled,
			allAnimationsDisabled,
			inputMode,
			performanceOverlayEnabled,
			runtimeCapabilities
		})
	), [
		allAnimationsDisabled,
		animationsDisabled,
		inputMode,
		navbarTheme,
		performanceOverlayEnabled,
		runtimeCapabilities
	]);

	useEffect(() => {
		if (typeof document === 'undefined') return undefined;
		const roots = [document.documentElement, document.body].filter(Boolean);
		roots.forEach((root) => {
			Object.entries(runtimeDataAttributes).forEach(([attribute, value]) => {
				root.setAttribute(attribute, String(value));
			});
		});
		return () => {
			roots.forEach((root) => {
				Object.keys(runtimeDataAttributes).forEach((attribute) => {
					root.removeAttribute(attribute);
				});
			});
		};
	}, [runtimeDataAttributes]);

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
				syncPlayerBackTargetDetailsItem();
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
			detailsBackHandlerRef,
			fallbackToDetailsFromPlayer,
			favoritesBackHandlerRef,
			handleSectionBack,
			homeBackHandlerRef,
			libraryBackHandlerRef,
			navigateBackFromDetails,
			navigateBackInHistory,
			playerBackHandlerRef,
			playerControlsVisible,
			searchBackHandlerRef,
			syncPlayerBackTargetDetailsItem,
			runPanelBackHandler,
			settingsBackHandlerRef,
			styleDebugBackHandlerRef
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

	const handleBackToDetails = useCallback(() => {
		syncPlayerBackTargetDetailsItem();
		if (navigateBackInHistory()) return;
		fallbackToDetailsFromPlayer();
	}, [fallbackToDetailsFromPlayer, navigateBackInHistory, syncPlayerBackTargetDetailsItem]);

	const handleExit = useCallback(() => {
		if (typeof window !== 'undefined' && window.close) {
			window.close();
		}
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

	const panelChildren = createPanelChildren({
		currentView,
		selectedItem,
		selectedLibrary,
		playbackOptions,
		loginNotice,
		loginNoticeNonce,
		homePanelState,
		libraryPanelStateById,
		searchPanelState,
		favoritesPanelState,
		settingsPanelState,
		detailsPanelStateByItemId,
		styleDebugEnabled: STYLE_DEBUG_ENABLED,
		StyleDebugPanel,
		handleLogin,
		handleItemSelect,
		handleNavigate,
		handleSwitchUser,
		handleLogout,
		handleSignOut,
		handleExit,
		handlePlay,
		navigateBackFromDetails,
		handleBackToDetails,
		setPlayerControlsVisible,
		playerControlsVisible,
		handleSearchPanelStateChange,
		handleHomePanelStateChange,
		handleLibraryPanelStateChange,
		handleFavoritesPanelStateChange,
		handleSettingsPanelStateChange,
		handleDetailsPanelStateChange,
		registerHomeBackHandler,
		registerLibraryBackHandler,
		registerSearchBackHandler,
		registerFavoritesBackHandler,
		registerSettingsBackHandler,
		registerStyleDebugBackHandler,
		registerDetailsBackHandler,
		registerPlayerBackHandler
	});

	return (
			<div
				className={css.app}
				{...runtimeDataAttributes}
				{...props}
				>
					<Panels
						index={getPanelIndexForView(currentView, STYLE_DEBUG_ENABLED)}
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
