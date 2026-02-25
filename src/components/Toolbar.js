import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react';
import { Spottable } from '@enact/spotlight/Spottable';
import Popup from '@enact/sandstone/Popup';
import jellyfinService from '../services/jellyfinService';
import {scrollElementIntoHorizontalView} from '../utils/horizontalScroll';
import { useBreezyfinSettingsSync } from '../hooks/useBreezyfinSettingsSync';
import { usePanelBackHandler } from '../hooks/usePanelBackHandler';
import { useDismissOnOutsideInteraction } from '../hooks/useDismissOnOutsideInteraction';
import { useDisclosureMap } from '../hooks/useDisclosureMap';
import { useMapById } from '../hooks/useMapById';
import {getRuntimePlatformCapabilities} from '../utils/platformCapabilities';
import {applyImageFormatFallbackFromEvent} from '../utils/imageFormat';
import ToolbarLibraryPicker from './toolbar/ToolbarLibraryPicker';
import ToolbarElegantLayout from './toolbar/ToolbarElegantLayout';
import ToolbarClassicLayout from './toolbar/ToolbarClassicLayout';

import css from './Toolbar.module.less';
import {popupShellCss} from '../styles/popupStyles';

const SpottableDiv = Spottable('div');
const TOOLBAR_THEME_CLASSIC = 'classic';
const TOOLBAR_THEME_ELEGANT = 'elegant';
const TOOLBAR_DISCLOSURE_KEYS = {
	USER_MENU: 'userMenu',
	LIBRARIES_POPUP: 'librariesPopup'
};
const INITIAL_TOOLBAR_DISCLOSURES = {
	[TOOLBAR_DISCLOSURE_KEYS.USER_MENU]: false,
	[TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP]: false
};

const Toolbar = ({
	activeSection = 'home',
	activeLibraryId = null,
	registerBackHandler,
	onNavigate,
	onSwitchUser,
	onLogout,
	onExit
}) => {
	const [libraries, setLibraries] = useState([]);
	const [currentTime, setCurrentTime] = useState(new Date());
	const [userName, setUserName] = useState('User');
	const [userAvatarUrl, setUserAvatarUrl] = useState('');
	const {disclosures, openDisclosure, closeDisclosure, setDisclosure} = useDisclosureMap(INITIAL_TOOLBAR_DISCLOSURES);
	const showUserMenu = disclosures[TOOLBAR_DISCLOSURE_KEYS.USER_MENU] === true;
	const showLibrariesPopup = disclosures[TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP] === true;
	const [toolbarTheme, setToolbarTheme] = useState(TOOLBAR_THEME_ELEGANT);
	const runtimeCapabilities = getRuntimePlatformCapabilities();
	const isWebOS6Compat = runtimeCapabilities.webosV6Compat;
	const glassFilterId = useId();
	const centerRef = useRef(null);
	const userMenuScopeRef = useRef(null);
	const libraryMenuScopeRef = useRef(null);
	const userMenuCloseTimerRef = useRef(null);
	const suppressUserMenuUntilRef = useRef(0);
	const librariesById = useMapById(libraries);
	const isElegantTheme = toolbarTheme === TOOLBAR_THEME_ELEGANT;
	const isHomeSection = activeSection === 'home';
	const elegantPanelTitle = useMemo(() => {
		if (isHomeSection) return '';
		if (activeSection === 'library') {
			return librariesById.get(String(activeLibraryId))?.Name || 'Library';
		}
		if (activeSection === 'favorites') return 'Favorites';
		if (activeSection === 'search') return 'Search';
		if (activeSection === 'settings') return 'Settings';
		return activeSection ? activeSection.charAt(0).toUpperCase() + activeSection.slice(1) : '';
	}, [activeLibraryId, activeSection, isHomeSection, librariesById]);

	const applyToolbarThemeFromSettings = useCallback((settingsPayload) => {
		const nextTheme = settingsPayload?.navbarTheme;
		setToolbarTheme(nextTheme === TOOLBAR_THEME_CLASSIC ? TOOLBAR_THEME_CLASSIC : TOOLBAR_THEME_ELEGANT);
	}, []);
	useBreezyfinSettingsSync(applyToolbarThemeFromSettings);

	const loadLibraries = useCallback(async () => {
		const libs = await jellyfinService.getLibraryViews();
		setLibraries(libs);
	}, []);

	const buildUserAvatarUrl = useCallback((user) => {
		if (!user?.Id || !jellyfinService?.serverUrl || !jellyfinService?.accessToken || !user?.PrimaryImageTag) return '';
		return jellyfinService.getUserImageUrl(user.Id, 96, {tag: user.PrimaryImageTag}) || '';
	}, []);

	const loadUserInfo = useCallback(async () => {
		const user = await jellyfinService.getCurrentUser();
		if (user && user.Name) {
			setUserName(user.Name);
		}
		setUserAvatarUrl(buildUserAvatarUrl(user));
	}, [buildUserAvatarUrl]);

	useEffect(() => {
		loadLibraries();
		loadUserInfo();

		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 60000);

		return () => clearInterval(timer);
	}, [loadLibraries, loadUserInfo]);

	useEffect(() => {
		if (!isElegantTheme && showLibrariesPopup) {
			closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP);
		}
	}, [closeDisclosure, isElegantTheme, showLibrariesPopup]);

	useEffect(() => {
		return () => {
			if (userMenuCloseTimerRef.current) {
				clearTimeout(userMenuCloseTimerRef.current);
				userMenuCloseTimerRef.current = null;
			}
		};
	}, []);

	const formatTime = useCallback(() => {
		return currentTime.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}, [currentTime]);

	const handleCenterFocus = useCallback((event) => {
		if (!centerRef.current || !centerRef.current.contains(event.target)) return;
		const target = event.target.closest(`.${css.iconButton}, .${css.toolbarButton}`);
		if (!target) return;

		const scroller = centerRef.current;
		scrollElementIntoHorizontalView(scroller, target, {minBuffer: 40, edgeRatio: 0.10});
	}, []);

	const handleUserMenuOpen = useCallback(() => {
		if (userMenuCloseTimerRef.current) {
			clearTimeout(userMenuCloseTimerRef.current);
			userMenuCloseTimerRef.current = null;
		}
		if (Date.now() < suppressUserMenuUntilRef.current) return;
		openDisclosure(TOOLBAR_DISCLOSURE_KEYS.USER_MENU);
	}, [openDisclosure]);

	const handleUserMenuClose = useCallback(() => {
		if (userMenuCloseTimerRef.current) {
			clearTimeout(userMenuCloseTimerRef.current);
			userMenuCloseTimerRef.current = null;
		}
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.USER_MENU);
	}, [closeDisclosure]);

	const handleElegantUserMouseLeave = useCallback(() => {
		if (userMenuCloseTimerRef.current) {
			clearTimeout(userMenuCloseTimerRef.current);
		}
		userMenuCloseTimerRef.current = setTimeout(() => {
			closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.USER_MENU);
			userMenuCloseTimerRef.current = null;
		}, 140);
	}, [closeDisclosure]);

	const handleUserContainerFocus = useCallback(() => {
		if (Date.now() < suppressUserMenuUntilRef.current) return;
		openDisclosure(TOOLBAR_DISCLOSURE_KEYS.USER_MENU);
	}, [openDisclosure]);

	const handleUserContainerBlur = useCallback((event) => {
		const nextFocused = event.relatedTarget;
		if (nextFocused && event.currentTarget.contains(nextFocused)) {
			return;
		}
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.USER_MENU);
	}, [closeDisclosure]);

	const handleUserButtonClick = useCallback(() => {
		if (userMenuCloseTimerRef.current) {
			clearTimeout(userMenuCloseTimerRef.current);
			userMenuCloseTimerRef.current = null;
		}
		if (Date.now() < suppressUserMenuUntilRef.current) return;
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP);
		setDisclosure(TOOLBAR_DISCLOSURE_KEYS.USER_MENU, !showUserMenu);
	}, [closeDisclosure, setDisclosure, showUserMenu]);

	const handleUserAvatarError = useCallback((event) => {
		if (applyImageFormatFallbackFromEvent(event)) return;
		setUserAvatarUrl('');
	}, []);

	const handleNavigateHome = useCallback(() => {
		onNavigate('home');
	}, [onNavigate]);

	const handleNavigateSearch = useCallback(() => {
		onNavigate('search');
	}, [onNavigate]);

	const handleClassicBack = useCallback(() => {
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.USER_MENU);
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP);
		// Keep Home safe from accidental exit prompts via toolbar click.
		if (activeSection === 'home') return;
		if (typeof window !== 'undefined' && typeof window.history?.back === 'function') {
			window.history.back();
		}
	}, [activeSection, closeDisclosure]);

	const handleNavigateFavorites = useCallback(() => {
		onNavigate('favorites');
	}, [onNavigate]);

	const handleNavigateSettings = useCallback(() => {
		onNavigate('settings');
	}, [onNavigate]);

	const handleElegantBack = useCallback(() => {
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.USER_MENU);
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP);
		onNavigate('home');
	}, [closeDisclosure, onNavigate]);

	const handleLibraryNavigate = useCallback((event) => {
		const libraryId = event.currentTarget.dataset.libraryId;
		const library = librariesById.get(libraryId);
		if (library) {
			onNavigate('library', library);
		}
	}, [librariesById, onNavigate]);

	const handleOpenLibrariesPopup = useCallback(() => {
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.USER_MENU);
		setDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP, !showLibrariesPopup);
	}, [closeDisclosure, setDisclosure, showLibrariesPopup]);

	const handleCloseLibrariesPopup = useCallback(() => {
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP);
	}, [closeDisclosure]);

	useDismissOnOutsideInteraction({
		enabled: showUserMenu,
		scopeRef: userMenuScopeRef,
		onDismiss: handleUserMenuClose
	});

	useDismissOnOutsideInteraction({
		enabled: isElegantTheme && showLibrariesPopup,
		scopeRef: libraryMenuScopeRef,
		onDismiss: handleCloseLibrariesPopup
	});

	const handleLibraryPopupSelect = useCallback((event) => {
		const libraryId = event.currentTarget.dataset.libraryId;
		const library = librariesById.get(libraryId);
		if (!library) return;
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP);
		onNavigate('library', library);
	}, [closeDisclosure, librariesById, onNavigate]);

	const runUserMenuAction = useCallback((primaryAction, fallbackAction = null) => {
		suppressUserMenuUntilRef.current = Date.now() + 500;
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.USER_MENU);
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP);
		if (document.activeElement && typeof document.activeElement.blur === 'function') {
			document.activeElement.blur();
		}
		if (typeof primaryAction === 'function') {
			primaryAction();
			return;
		}
		if (typeof fallbackAction === 'function') {
			fallbackAction();
		}
	}, [closeDisclosure]);

	const handleLogoutClick = useCallback(() => {
		runUserMenuAction(onLogout);
	}, [onLogout, runUserMenuAction]);

	const handleSwitchUserClick = useCallback(() => {
		runUserMenuAction(onSwitchUser, onLogout);
	}, [onLogout, onSwitchUser, runUserMenuAction]);

	const handleExitClick = useCallback(() => {
		runUserMenuAction(onExit);
	}, [onExit, runUserMenuAction]);

	const handleInternalBack = useCallback(() => {
		if (showLibrariesPopup) {
			closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP);
			return true;
		}
		if (showUserMenu) {
			if (userMenuCloseTimerRef.current) {
				clearTimeout(userMenuCloseTimerRef.current);
				userMenuCloseTimerRef.current = null;
			}
			closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.USER_MENU);
			return true;
		}
		return false;
	}, [closeDisclosure, showLibrariesPopup, showUserMenu]);

	usePanelBackHandler(registerBackHandler, handleInternalBack);

	const classicUserContainerProps = {
		onMouseEnter: handleUserMenuOpen,
		onMouseLeave: handleUserMenuClose,
		onFocus: handleUserContainerFocus,
		onBlur: handleUserContainerBlur
	};
	const elegantUserContainerProps = {
		onMouseEnter: handleUserMenuOpen,
		onMouseLeave: handleElegantUserMouseLeave
	};
	const shouldRenderElegantDistortion =
		!isWebOS6Compat &&
		runtimeCapabilities.supportsBackdropFilter;
	const toolbarStyle = isElegantTheme
		? {'--bf-glass-distortion-filter': shouldRenderElegantDistortion ? `url(#${glassFilterId})` : 'none'}
		: undefined;

	return (
		<div
			className={`${css.toolbar} ${isElegantTheme ? css.toolbarElegant : ''}`}
			data-bf-navbar="true"
			data-bf-navbar-theme={toolbarTheme}
			data-bf-navbar-legacy={isWebOS6Compat ? 'on' : 'off'}
			style={toolbarStyle}
		>
			{isElegantTheme ? (
				<ToolbarElegantLayout
					SpottableDiv={SpottableDiv}
					glassFilterId={glassFilterId}
					shouldRenderElegantDistortion={shouldRenderElegantDistortion}
					isHomeSection={isHomeSection}
					elegantPanelTitle={elegantPanelTitle}
					handleElegantBack={handleElegantBack}
					handleNavigateHome={handleNavigateHome}
					handleNavigateFavorites={handleNavigateFavorites}
					handleNavigateSearch={handleNavigateSearch}
					handleNavigateSettings={handleNavigateSettings}
					activeSection={activeSection}
					libraryMenuScopeRef={libraryMenuScopeRef}
					handleOpenLibrariesPopup={handleOpenLibrariesPopup}
					showLibrariesPopup={showLibrariesPopup}
					libraries={libraries}
					activeLibraryId={activeLibraryId}
					handleLibraryPopupSelect={handleLibraryPopupSelect}
					userMenuScopeRef={userMenuScopeRef}
					elegantUserContainerProps={elegantUserContainerProps}
					handleUserButtonClick={handleUserButtonClick}
					userName={userName}
					userAvatarUrl={userAvatarUrl}
					handleUserAvatarError={handleUserAvatarError}
					showUserMenu={showUserMenu}
					handleLogoutClick={handleLogoutClick}
					handleSwitchUserClick={handleSwitchUserClick}
					handleExitClick={handleExitClick}
				/>
			) : (
				<ToolbarClassicLayout
					SpottableDiv={SpottableDiv}
					userMenuScopeRef={userMenuScopeRef}
					classicUserContainerProps={classicUserContainerProps}
					handleUserButtonClick={handleUserButtonClick}
					userName={userName}
					showUserMenu={showUserMenu}
					handleLogoutClick={handleLogoutClick}
					handleSwitchUserClick={handleSwitchUserClick}
					handleExitClick={handleExitClick}
					handleNavigateHome={handleNavigateHome}
					activeSection={activeSection}
					handleNavigateSearch={handleNavigateSearch}
					handleClassicBack={handleClassicBack}
					handleNavigateFavorites={handleNavigateFavorites}
					centerRef={centerRef}
					handleCenterFocus={handleCenterFocus}
					libraries={libraries}
					activeLibraryId={activeLibraryId}
					handleLibraryNavigate={handleLibraryNavigate}
					handleNavigateSettings={handleNavigateSettings}
					formatTime={formatTime}
				/>
			)}

			{!isElegantTheme && (
				<Popup open={showLibrariesPopup} onClose={handleCloseLibrariesPopup} style={toolbarStyle} css={popupShellCss}>
					<ToolbarLibraryPicker
						useElegantGlass={false}
						libraries={libraries}
						activeSection={activeSection}
						activeLibraryId={activeLibraryId}
						onLibrarySelect={handleLibraryPopupSelect}
					/>
				</Popup>
			)}
		</div>
	);
};

export default Toolbar;
