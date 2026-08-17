import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ThemeDecorator from '@enact/sandstone/ThemeDecorator';
import Spotlight from '@enact/spotlight';
import { Panels } from '../components/BreezyPanels';

import PerformanceOverlay from '../components/PerformanceOverlay';
import FocusDebugOverlay from '../components/FocusDebugOverlay';
import DebugErrorMenu from '../components/DebugErrorMenu';
import ScreensaverOverlay from '../components/ScreensaverOverlay';
import jellyfinService from '../services/jellyfinService';
import {isBackKey} from '../utils/keyCodes';
import { useBreezyfinSettingsSync } from '../hooks/useBreezyfinSettingsSync';
import { useInputMode } from '../hooks/useInputMode';
import {RuntimeDiagnosticsProvider} from '../hooks/useRuntimeDiagnostics';
import {SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE} from '../constants/session';
import {readBreezyfinSettings} from '../utils/settingsStorage';
import {configureAppDiagnostics} from '../utils/appLogger';
import {getRuntimePlatformCapabilities} from '../utils/platformCapabilities';
import {normalizeScreensaverTimeoutMinutes} from '../utils/screensaver';
import {isNonStableBuild} from '../utils/featureFlags';
import {
	CRASH_RECOVERY_ACTIONS,
	consumeCrashRecoveryAction,
	peekCrashRecoveryAction,
	readCrashNavigationSnapshot,
	saveCrashNavigationSnapshot,
	clearCrashPlaybackContext
} from '../utils/crashRecovery';
import AppCrashBoundary from './AppCrashBoundary';
import {normalizePanelStatePayload, upsertKeyedPanelState, clearKeyedPanelState} from './utils/panelStateCache';
import {getPanelIndexForView} from './utils/panelIndex';
import {createPanelChildren} from './utils/createPanelChildren';
import {buildRuntimeDataAttributes} from './utils/runtimeDataAttributes';
import {usePanelHistory} from './hooks/usePanelHistory';
import {usePanelBackHandlerRegistry} from './hooks/usePanelBackHandlerRegistry';
import {useAppScreensaver} from './hooks/useAppScreensaver';
import {useIntegrationPanelCache} from './hooks/useIntegrationPanelCache';
import {useAppSyncPlayNavigation} from './hooks/useAppSyncPlayNavigation';
import {SyncPlayProvider} from '../contexts/SyncPlayContext';
import SyncPlayGlobalOverlays from '../components/SyncPlayGlobalOverlays';
import {emitAppDebugEvent, isEditableTarget} from './utils/appInput';
import {
	captureRuntimeSessionIdentity,
	isRuntimeSessionIdentityCurrent,
	resolveExpiredSavedSessionKey
} from '../utils/savedSessionIdentity';

import css from './App.module.less';

const DETAIL_RETURN_VIEWS = new Set([
	'home', 'homeSection', 'library', 'search', 'favorites', 'settings', 'watchlist', 'calendar', 'syncPlay', 'watchParty'
]);
const SHOW_NON_STABLE_DEBUG_OPTIONS = isNonStableBuild();

const resolveInitialVisualSettings = () => {
	const settings = readBreezyfinSettings();
	return {
		animationsDisabled: settings.disableAnimations !== false,
		allAnimationsDisabled: settings.disableAllAnimations === true,
		navbarTheme: settings.navbarTheme === 'classic' ? 'classic' : 'elegant',
		performanceOverlayEnabled: settings.showPerformanceOverlay === true,
		focusDebugOverlayEnabled: settings.showFocusDebugOverlay === true,
		debugErrorMenuEnabled: SHOW_NON_STABLE_DEBUG_OPTIONS && settings.showDebugErrorMenu === true,
		diagnosticsEnabled: settings.enableDiagnostics === true,
		screensaverTimeoutMinutes: normalizeScreensaverTimeoutMinutes(settings.screensaverTimeoutMinutes)
	};
};

const App = (props) => {
	const initialVisualSettingsRef = useRef(resolveInitialVisualSettings());
	const runtimeCapabilities = getRuntimePlatformCapabilities();
	const [currentView, setCurrentView] = useState('login');
	const [sessionActive, setSessionActive] = useState(false);
	const [sessionRestorePending, setSessionRestorePending] = useState(true);
	const [selectedItem, setSelectedItem] = useState(null);
	const [selectedLibrary, setSelectedLibrary] = useState(null);
	const [selectedHomeSection, setSelectedHomeSection] = useState(null);
	const [playbackOptions, setPlaybackOptions] = useState(null);
	const [previousItem, setPreviousItem] = useState(null);
	const [homePanelState, setHomePanelState] = useState(null);
	const [homeSectionPanelStateById, setHomeSectionPanelStateById] = useState({});
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
	const [focusDebugOverlayEnabled, setFocusDebugOverlayEnabled] = useState(initialVisualSettingsRef.current.focusDebugOverlayEnabled);
	const [debugErrorMenuEnabled, setDebugErrorMenuEnabled] = useState(initialVisualSettingsRef.current.debugErrorMenuEnabled);
	const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(initialVisualSettingsRef.current.diagnosticsEnabled);
	const [screensaverTimeoutMinutes, setScreensaverTimeoutMinutes] = useState(
		initialVisualSettingsRef.current.screensaverTimeoutMinutes
	);
	const [debugErrorMenuOpen, setDebugErrorMenuOpen] = useState(false);
	const [lastNavigateDebug, setLastNavigateDebug] = useState(null);
	const inputMode = useInputMode(Spotlight);
	const [loginNotice, setLoginNotice] = useState('');
	const [loginNoticeNonce, setLoginNoticeNonce] = useState(0);
	const [loginReauthenticationKey, setLoginReauthenticationKey] = useState(null);
	const handleUserDataInvalidated = useCallback(() => {
		setHomePanelState(null);
		setHomeSectionPanelStateById({});
		setLibraryPanelStateById({});
		setFavoritesPanelState(null);
		setDetailsPanelStateByItemId({});
	}, []);
	const {
		cacheState: integrationPanelState,
		cacheActions: integrationPanelActions,
		reset: resetIntegrationPanelState,
		clear: clearIntegrationPanelState
	} = useIntegrationPanelCache({onUserDataInvalidated: handleUserDataInvalidated});
	const {
		active: screensaverActive,
		dismiss: dismissScreensaver
	} = useAppScreensaver({
		authenticated: sessionActive,
		currentView,
		timeoutMinutes: screensaverTimeoutMinutes,
		spotlight: Spotlight
	});
	const handleBackRef = useRef(null);
	const crashRecoveryPendingRef = useRef(Boolean(peekCrashRecoveryAction()));
	const {
		refs: {
			playerBackHandlerRef,
			loginBackHandlerRef,
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
		registerLoginBackHandler,
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
		selectedHomeSection,
		playbackOptions,
		previousItem,
		detailsReturnView,
		playerControlsVisible,
		setCurrentView,
		setSelectedItem,
		setSelectedLibrary,
		setSelectedHomeSection,
		setPlaybackOptions,
		setPreviousItem,
		setDetailsReturnView,
		setPlayerControlsVisible
	});
	const resetSessionState = useCallback(() => {
		setSessionActive(false);
		setSelectedItem(null);
		setSelectedLibrary(null);
		setSelectedHomeSection(null);
		setPlaybackOptions(null);
		setPreviousItem(null);
		setHomePanelState(null);
		setHomeSectionPanelStateById({});
		setLibraryPanelStateById({});
		setSearchPanelState(null);
		setFavoritesPanelState(null);
		setSettingsPanelState(null);
		resetIntegrationPanelState();
		setDetailsPanelStateByItemId({});
		setDetailsReturnView('home');
		setPlayerControlsVisible(true);
		clearPanelHistory();
		clearCrashPlaybackContext();
	}, [clearPanelHistory, resetIntegrationPanelState]);

	const clearPanelSelection = useCallback((options = {}) => {
		const {clearLibrary = true, clearHomeSection = true} = options;
		setSelectedItem(null);
		setPlaybackOptions(null);
		if (clearLibrary) {
			setSelectedLibrary(null);
		}
		if (clearHomeSection) {
			setSelectedHomeSection(null);
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
		if (detailsReturnView === 'homeSection') {
			return selectedHomeSection ? 'homeSection' : 'home';
		}
		return DETAIL_RETURN_VIEWS.has(detailsReturnView) ? detailsReturnView : 'home';
	}, [detailsReturnView, selectedHomeSection, selectedLibrary]);

	const navigateBackFromDetails = useCallback(() => {
		if (navigateBackInHistory()) {
			return true;
		}

		const targetView = resolveDetailsReturnView();
		navigateToViewAndClearSelection(targetView, {
			clearLibrary: targetView === 'home',
			clearHomeSection: targetView !== 'homeSection'
		});
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
	const {
		coordinator: syncPlayCoordinator,
		handlePlay,
		handleBackToDetails
	} = useAppSyncPlayNavigation({
		authenticated: sessionActive,
		currentView,
		selectedItem,
		pushPanelHistory,
		navigateBackInHistory,
		syncPlayerBackTargetDetailsItem,
		fallbackToDetailsFromPlayer,
		setSelectedItem,
		setPlaybackOptions,
		setPlayerControlsVisible,
		setCurrentView
	});

	const applyVisualSettings = useCallback((settingsPayload) => {
		const settings = settingsPayload || {};
		setAnimationsDisabled(settings.disableAnimations !== false);
		setAllAnimationsDisabled(settings.disableAllAnimations === true);
		setNavbarTheme(settings.navbarTheme === 'classic' ? 'classic' : 'elegant');
		setPerformanceOverlayEnabled(settings.showPerformanceOverlay === true);
		setFocusDebugOverlayEnabled(settings.showFocusDebugOverlay === true);
		setDebugErrorMenuEnabled(SHOW_NON_STABLE_DEBUG_OPTIONS && settings.showDebugErrorMenu === true);
		setDiagnosticsEnabled(settings.enableDiagnostics === true);
		configureAppDiagnostics({
			enabled: settings.enableDiagnostics === true,
			verbose: settings.verboseAppLogs === true
		});
		setScreensaverTimeoutMinutes(normalizeScreensaverTimeoutMinutes(settings.screensaverTimeoutMinutes));
	}, []);

	useBreezyfinSettingsSync(applyVisualSettings);

	useEffect(() => {
		if ((!diagnosticsEnabled || !debugErrorMenuEnabled) && debugErrorMenuOpen) {
			setDebugErrorMenuOpen(false);
		}
	}, [debugErrorMenuEnabled, debugErrorMenuOpen, diagnosticsEnabled]);

	useEffect(() => {
		if (crashRecoveryPendingRef.current) return;
		saveCrashNavigationSnapshot({
			currentView,
			selectedItem,
			selectedLibrary,
			selectedHomeSection,
			playbackOptions,
			previousItem,
			detailsReturnView,
			playerControlsVisible
		});
	}, [
		currentView,
		selectedItem,
		selectedLibrary,
		selectedHomeSection,
		playbackOptions,
		previousItem,
		detailsReturnView,
		playerControlsVisible
	]);

	const handleSessionExpired = useCallback((message = SESSION_EXPIRED_MESSAGE) => {
		const expiredSessionKey = resolveExpiredSavedSessionKey(
			jellyfinService.getSavedServers(),
			{
				serverUrl: jellyfinService.serverUrl,
				userId: jellyfinService.userId
			}
		);
		if (expiredSessionKey) {
			setLoginReauthenticationKey(expiredSessionKey);
		}
		jellyfinService.switchUser();
		resetSessionState();
		setCurrentView('login');
		setLoginNotice(message);
		setLoginNoticeNonce((value) => value + 1);
	}, [resetSessionState]);

	const applyPendingCrashRecovery = useCallback(() => {
		const pendingRecoveryAction = consumeCrashRecoveryAction();
		crashRecoveryPendingRef.current = false;
		if (!pendingRecoveryAction) return;

		if (pendingRecoveryAction === CRASH_RECOVERY_ACTIONS.HOME) {
			setSelectedItem(null);
			setSelectedLibrary(null);
			setSelectedHomeSection(null);
			setPlaybackOptions(null);
			setPreviousItem(null);
			setDetailsReturnView('home');
			setPlayerControlsVisible(true);
			setCurrentView('home');
			return;
		}

		if (
			pendingRecoveryAction === CRASH_RECOVERY_ACTIONS.BACK ||
			pendingRecoveryAction === CRASH_RECOVERY_ACTIONS.DETAILS
		) {
			const crashSnapshot = readCrashNavigationSnapshot();
			if (!crashSnapshot) {
				setCurrentView('home');
				return;
			}
			const recoverView = crashSnapshot.currentView === 'player' ? 'details' : crashSnapshot.currentView;
			const recoverSelectedItem = crashSnapshot.selectedItem || null;
			const recoverHomeSection = crashSnapshot.selectedHomeSection || null;
			setSelectedItem(crashSnapshot.selectedItem || null);
			setSelectedLibrary(crashSnapshot.selectedLibrary || null);
			setSelectedHomeSection(recoverHomeSection);
			setPlaybackOptions(crashSnapshot.playbackOptions || null);
			setPreviousItem(crashSnapshot.previousItem || null);
			setDetailsReturnView(
				DETAIL_RETURN_VIEWS.has(crashSnapshot.detailsReturnView)
					? crashSnapshot.detailsReturnView
					: 'home'
			);
			setPlayerControlsVisible(crashSnapshot.playerControlsVisible !== false);
			if (recoverView === 'details' && !recoverSelectedItem?.Id) {
				setCurrentView('home');
				return;
			}
			if (recoverView === 'homeSection' && !recoverHomeSection?.id) {
				setCurrentView('home');
				return;
			}
			setCurrentView(recoverView || 'home');
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		const restoreSession = async () => {
			try {
				if (peekCrashRecoveryAction() === CRASH_RECOVERY_ACTIONS.HOME) {
					consumeCrashRecoveryAction();
					crashRecoveryPendingRef.current = false;
					resetSessionState();
					setCurrentView('login');
					setLoginNotice('Crash recovery paused automatic sign-in. Choose an account or open diagnostics.');
					setLoginNoticeNonce((value) => value + 1);
					return;
				}
				const restored = jellyfinService.restoreSession();
				if (!restored) return;
				const restoredSessionIdentity = captureRuntimeSessionIdentity(jellyfinService);
				if (!restoredSessionIdentity) return;
				const user = await jellyfinService.getCurrentUser();
				if (cancelled || !isRuntimeSessionIdentityCurrent(restoredSessionIdentity, jellyfinService)) return;
				if (user) {
					setSessionActive(true);
					setCurrentView('home');
					applyPendingCrashRecovery();
					return;
				}
				handleSessionExpired();
			} finally {
				if (!cancelled) setSessionRestorePending(false);
			}
		};
		restoreSession();
		return () => {
			cancelled = true;
		};
	}, [applyPendingCrashRecovery, handleSessionExpired, resetSessionState]);

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

	const runtimeDataAttributes = useMemo(() => (
		buildRuntimeDataAttributes({
			navbarTheme,
			animationsDisabled,
			allAnimationsDisabled,
			inputMode,
			performanceOverlayEnabled: diagnosticsEnabled && performanceOverlayEnabled,
			diagnosticsEnabled,
			runtimeCapabilities
		})
	), [
		allAnimationsDisabled,
		animationsDisabled,
		inputMode,
		navbarTheme,
		diagnosticsEnabled,
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
		if (screensaverActive) {
			dismissScreensaver();
			return true;
		}
		if (debugErrorMenuOpen) {
			setDebugErrorMenuOpen(false);
			return true;
		}
		switch (currentView) {
			case 'homeSection':
				return handleSectionBack(homeSectionBackHandlerRef, 'home');
			case 'library':
				return handleSectionBack(libraryBackHandlerRef, 'home');
			case 'search':
				return handleSectionBack(searchBackHandlerRef, 'home');
			case 'favorites':
				return handleSectionBack(favoritesBackHandlerRef, 'home');
			case 'settings':
				return handleSectionBack(settingsBackHandlerRef, 'home');
			case 'watchlist':
				return handleSectionBack(watchlistBackHandlerRef, 'home');
			case 'calendar':
				return handleSectionBack(calendarBackHandlerRef, 'home');
			case 'syncPlay':
				return handleSectionBack(syncPlayBackHandlerRef, 'home');
			case 'watchParty':
				return handleSectionBack(watchPartyBackHandlerRef, 'home');
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
				return runPanelBackHandler(loginBackHandlerRef);
			default:
				return false;
		}
		}, [
			currentView,
			debugErrorMenuOpen,
			dismissScreensaver,
			detailsBackHandlerRef,
			fallbackToDetailsFromPlayer,
			favoritesBackHandlerRef,
			handleSectionBack,
			homeBackHandlerRef,
			homeSectionBackHandlerRef,
			libraryBackHandlerRef,
			loginBackHandlerRef,
			navigateBackFromDetails,
			navigateBackInHistory,
			playerBackHandlerRef,
			playerControlsVisible,
			searchBackHandlerRef,
			screensaverActive,
			syncPlayerBackTargetDetailsItem,
			runPanelBackHandler,
			settingsBackHandlerRef,
			watchlistBackHandlerRef,
			calendarBackHandlerRef,
			syncPlayBackHandlerRef,
			watchPartyBackHandlerRef
		]);

	useEffect(() => {
		handleBackRef.current = handleBack;
	}, [handleBack]);

	useEffect(() => {
		const handleGlobalKeyDown = (e) => {
			const code = e.keyCode || e.which;
			const isBackspaceDelete = code === 8 || e.key === 'Backspace';
			if (isBackspaceDelete && isEditableTarget(e.target)) {
				return;
			}
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
		setLoginReauthenticationKey(null);
		setSessionActive(true);
		setCurrentView('home');
	}, [clearPanelHistory]);

	const handleLogout = useCallback(() => {
		jellyfinService.logout();
		resetSessionState();
		setLoginNotice('');
		setLoginReauthenticationKey(null);
		setCurrentView('login');
	}, [resetSessionState]);

	const handleSignOut = useCallback(() => {
		jellyfinService.logout();
		resetSessionState();
		setLoginNotice('');
		setLoginReauthenticationKey(null);
		setCurrentView('login');
	}, [resetSessionState]);

	const handleSwitchUser = useCallback(() => {
		jellyfinService.switchUser();
		resetSessionState();
		setLoginNotice('');
		setLoginReauthenticationKey(null);
		setCurrentView('login');
	}, [resetSessionState]);

	const handleItemSelect = useCallback((item, fromItem = null) => {
		if (diagnosticsEnabled) {
			emitAppDebugEvent('breezyfin:item-select-debug', {
				at: Date.now(),
				itemId: item?.Id ? String(item.Id) : '-',
				itemType: item?.Type || '-',
				fromView: currentView || '-',
				fromItemId: fromItem?.Id ? String(fromItem.Id) : '-'
			});
		}
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
	}, [currentView, diagnosticsEnabled, pushPanelHistory, selectedItem]);

	const handleNavigate = useCallback((section, data) => {
		const targetView = section;
		const nextHomeSectionId = targetView === 'homeSection' ? data?.id : null;
		const nextLibraryId = targetView === 'library' ? data?.Id : null;
		const currentHomeSectionId = selectedHomeSection?.id || null;
		const currentLibraryId = selectedLibrary?.Id || null;
		const navigateDebugBase = {
			at: Date.now(),
			fromView: currentView || '-',
			targetView: targetView || '-',
			nextHomeSectionId: nextHomeSectionId ? String(nextHomeSectionId) : '-',
			currentHomeSectionId: currentHomeSectionId ? String(currentHomeSectionId) : '-',
			nextLibraryId: nextLibraryId ? String(nextLibraryId) : '-',
			currentLibraryId: currentLibraryId ? String(currentLibraryId) : '-'
		};
		const isSameHomeSectionNavigation =
			targetView === 'homeSection' &&
			currentView === 'homeSection' &&
			nextHomeSectionId !== null &&
			currentHomeSectionId !== null &&
			String(nextHomeSectionId) === String(currentHomeSectionId);
		if (isSameHomeSectionNavigation) {
			setLastNavigateDebug({
				...navigateDebugBase,
				ignored: true,
				reason: 'same-home-section'
			});
			return;
		}
		const isSameLibraryNavigation =
			targetView === 'library' &&
			currentView === 'library' &&
			nextLibraryId !== null &&
			currentLibraryId !== null &&
			String(nextLibraryId) === String(currentLibraryId);
		if (isSameLibraryNavigation) {
			setLastNavigateDebug({
				...navigateDebugBase,
				ignored: true,
				reason: 'same-library'
			});
			return;
		}
		setLastNavigateDebug({
			...navigateDebugBase,
			ignored: false,
			reason: 'dispatch'
		});
		const shouldTrackHistory =
			targetView === 'home' ||
			targetView === 'homeSection' ||
			targetView === 'library' ||
			targetView === 'search' ||
			targetView === 'favorites' ||
			targetView === 'settings' ||
			targetView === 'watchlist' ||
			targetView === 'calendar' ||
			targetView === 'syncPlay' ||
			targetView === 'watchParty'
				? (targetView !== currentView || nextLibraryId !== currentLibraryId || nextHomeSectionId !== currentHomeSectionId)
				: false;
		if (shouldTrackHistory) {
			pushPanelHistory();
		}
		clearIntegrationPanelState(section);
		switch (section) {
			case 'home':
				setHomePanelState(null);
				break;
			case 'homeSection':
				if (nextHomeSectionId) {
					setHomeSectionPanelStateById((previousState) => clearKeyedPanelState(previousState, nextHomeSectionId));
				} else {
					setHomeSectionPanelStateById({});
				}
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
				setSelectedHomeSection(null);
				setSelectedLibrary(null);
				setSelectedItem(null);
				setPlaybackOptions(null);
				break;
			case 'homeSection':
				setSelectedHomeSection(data);
				setSelectedLibrary(null);
				setSelectedItem(null);
				setPlaybackOptions(null);
				setCurrentView('homeSection');
				break;
			case 'library':
				setSelectedHomeSection(null);
				setSelectedLibrary(data);
				setSelectedItem(null);
				setPlaybackOptions(null);
				setCurrentView('library');
				break;
			case 'search':
			case 'favorites':
			case 'settings':
			case 'watchlist':
			case 'calendar':
			case 'syncPlay':
			case 'watchParty':
				setCurrentView(section);
				setSelectedItem(null);
				setSelectedHomeSection(null);
				setSelectedLibrary(null);
				setPlaybackOptions(null);
				break;
			default:
				break;
		}
	}, [clearIntegrationPanelState, currentView, pushPanelHistory, selectedHomeSection?.id, selectedLibrary?.Id]);

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

	const handleHomeSectionPanelStateChange = useCallback((sectionId, nextState) => {
		if (!sectionId) return;
		setHomeSectionPanelStateById((previousState) => (
			upsertKeyedPanelState(previousState, sectionId, nextState)
		));
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

	const debugErrorActions = useMemo(() => {
		const actions = [
			{id: 'runtime-crash', label: 'App Crash Boundary'},
			{id: 'unhandled-rejection', label: 'Unhandled Rejection'}
		];
		if (currentView === 'player') {
			actions.unshift(
				{id: 'player-transcode-fallback', label: 'Player: Transcode Fallback'},
				{id: 'player-session-rebuild', label: 'Player: Restart Stream'},
				{id: 'player-playback-error', label: 'Player: Playback Error'}
			);
		}
		return actions;
	}, [currentView]);

	const handleDebugErrorMenuOpenChange = useCallback((open) => {
		if (!diagnosticsEnabled || !debugErrorMenuEnabled) return;
		setDebugErrorMenuOpen(Boolean(open));
	}, [debugErrorMenuEnabled, diagnosticsEnabled]);

	const dispatchPlayerDebugAction = useCallback((action) => {
		emitAppDebugEvent('breezyfin:debug-error-action', {
			action,
			at: Date.now(),
			source: 'app-debug-menu'
		});
	}, []);

	const handleDebugErrorMenuAction = useCallback((actionId) => {
		if (!diagnosticsEnabled || !debugErrorMenuEnabled) return;
		switch (actionId) {
			case 'runtime-crash':
				window.setTimeout(() => {
					throw new Error('Debug: simulated app runtime crash');
				}, 0);
				break;
			case 'unhandled-rejection':
				window.setTimeout(() => {
					Promise.reject(new Error('Debug: simulated unhandled rejection'));
				}, 0);
				break;
			case 'player-playback-error':
			case 'player-session-rebuild':
			case 'player-transcode-fallback':
				dispatchPlayerDebugAction(actionId);
				break;
			default:
				break;
		}
		setDebugErrorMenuOpen(false);
	}, [debugErrorMenuEnabled, diagnosticsEnabled, dispatchPlayerDebugAction]);

	const panelChildren = createPanelChildren({
		currentView,
		sessionRestorePending,
		inputMode,
		screensaverActive,
		diagnosticsEnabled,
		selection: {
			item: selectedItem,
			library: selectedLibrary,
			homeSection: selectedHomeSection,
			playbackOptions
		},
		notices: {
			login: loginNotice,
			loginNonce: loginNoticeNonce,
			loginReauthenticationKey
		},
		cacheState: {
			home: homePanelState,
			homeSectionsById: homeSectionPanelStateById,
			librariesById: libraryPanelStateById,
			search: searchPanelState,
			favorites: favoritesPanelState,
			settings: settingsPanelState,
			...integrationPanelState,
			detailsByItemId: detailsPanelStateByItemId
		},
		actions: {
			login: handleLogin,
			itemSelect: handleItemSelect,
			navigate: handleNavigate,
			switchUser: handleSwitchUser,
			logout: handleLogout,
			signOut: handleSignOut,
			exit: handleExit,
			play: handlePlay,
			backFromDetails: navigateBackFromDetails,
			backToDetails: handleBackToDetails
		},
		cacheActions: {
			home: handleHomePanelStateChange,
			homeSection: handleHomeSectionPanelStateChange,
			library: handleLibraryPanelStateChange,
			search: handleSearchPanelStateChange,
			favorites: handleFavoritesPanelStateChange,
			settings: handleSettingsPanelStateChange,
			...integrationPanelActions,
			details: handleDetailsPanelStateChange
		},
		backHandlers: {
			login: registerLoginBackHandler,
			home: registerHomeBackHandler,
			homeSection: registerHomeSectionBackHandler,
			library: registerLibraryBackHandler,
			search: registerSearchBackHandler,
			favorites: registerFavoritesBackHandler,
			settings: registerSettingsBackHandler,
			watchlist: registerWatchlistBackHandler,
			calendar: registerCalendarBackHandler,
			syncPlay: registerSyncPlayBackHandler,
			watchParty: registerWatchPartyBackHandler,
			details: registerDetailsBackHandler,
			player: registerPlayerBackHandler
		},
		playerControls: {
			visible: playerControlsVisible,
			setVisible: setPlayerControlsVisible
		}
	});

	return (
		<RuntimeDiagnosticsProvider enabled={diagnosticsEnabled}>
			<SyncPlayProvider value={syncPlayCoordinator}>
			<div
				className={css.app}
				{...runtimeDataAttributes}
				{...props}
			>
				<Panels
					index={getPanelIndexForView(currentView)}
					onBack={handleBack}
					noAnimation
				>
					{panelChildren}
				</Panels>
				<DebugErrorMenu
					enabled={diagnosticsEnabled && debugErrorMenuEnabled}
					actions={debugErrorActions}
					open={debugErrorMenuOpen}
					onOpenChange={handleDebugErrorMenuOpenChange}
					onAction={handleDebugErrorMenuAction}
					ariaLabel="Debug error actions"
				/>
				<FocusDebugOverlay
					enabled={diagnosticsEnabled && focusDebugOverlayEnabled && !screensaverActive}
					currentView={currentView}
					inputMode={inputMode}
					lastNavigateDebug={lastNavigateDebug}
				/>
				<PerformanceOverlay
					enabled={diagnosticsEnabled && performanceOverlayEnabled}
					inputMode={inputMode}
					suspended={screensaverActive}
				/>
				<SyncPlayGlobalOverlays />
				<ScreensaverOverlay active={screensaverActive} />
			</div>
			</SyncPlayProvider>
		</RuntimeDiagnosticsProvider>
	);
};

const AppWithBoundary = (props) => (
	<AppCrashBoundary>
		<App {...props} />
	</AppCrashBoundary>
);

export default ThemeDecorator(AppWithBoundary);
