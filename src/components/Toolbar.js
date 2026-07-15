import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react';
import { Spottable } from '@enact/spotlight/Spottable';
import Popup from '@enact/sandstone/Popup';
import jellyfinService from '../services/jellyfinService';
import {KeyCodes} from '../utils/keyCodes';
import {scrollElementIntoHorizontalView} from '../utils/horizontalScroll';
import { useBreezyfinSettingsSync } from '../hooks/useBreezyfinSettingsSync';
import { usePanelBackHandler } from '../hooks/usePanelBackHandler';
import { useDismissOnOutsideInteraction } from '../hooks/useDismissOnOutsideInteraction';
import { useDisclosureMap } from '../hooks/useDisclosureMap';
import { useMapById } from '../hooks/useMapById';
import { usePopupInitialFocus } from '../hooks/usePopupInitialFocus';
import {getRuntimePlatformCapabilities} from '../utils/platformCapabilities';
import {applyImageFormatFallbackFromEvent} from '../utils/imageFormat';
import {buildUserPrimaryImageUrl, normalizeImageTag} from '../utils/imageUrls';
import ToolbarLibraryPicker from './toolbar/ToolbarLibraryPicker';
import ToolbarElegantLayout from './toolbar/ToolbarElegantLayout';
import ToolbarClassicLayout from './toolbar/ToolbarClassicLayout';

import css from './Toolbar.module.less';
import {useRuntimeSuspended} from '../hooks/useRuntimeSuspension';
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
	onExit,
	onNavigateDown
}) => {
	const runtimeSuspended = useRuntimeSuspended();
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
	const toolbarRootRef = useRef(null);
	const userMenuScopeRef = useRef(null);
	const libraryMenuScopeRef = useRef(null);
	const librariesPopupContentRef = useRef(null);
	const userMenuCloseTimerRef = useRef(null);
	const suppressUserMenuUntilRef = useRef(0);
	const librariesById = useMapById(libraries);
	const isElegantTheme = toolbarTheme === TOOLBAR_THEME_ELEGANT;
	const isHomeSection = activeSection === 'home';
	const usePillLayout = isElegantTheme;
	const useCompactPillHeader = isElegantTheme;
	const primaryToolbarNavSelector = useMemo(() => ([
		`.${css.iconButton}`,
		`.${css.toolbarButton}`,
		`.${css.tabButton}`,
		`.${css.userButton}`
	].join(', ')), []);
	usePopupInitialFocus(showLibrariesPopup, librariesPopupContentRef);
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
		return buildUserPrimaryImageUrl({
			baseUrl: jellyfinService.serverUrl,
			userId: user?.Id,
			accessToken: jellyfinService.accessToken,
			width: 96,
			tag: normalizeImageTag(user?.PrimaryImageTag)
		});
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
	}, [loadLibraries, loadUserInfo]);

	useEffect(() => {
		if (runtimeSuspended) return undefined;
		setCurrentTime(new Date());

		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 60000);

		return () => clearInterval(timer);
	}, [runtimeSuspended]);

	useEffect(() => {
		if (!usePillLayout && showLibrariesPopup) {
			closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP);
		}
	}, [closeDisclosure, showLibrariesPopup, usePillLayout]);

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
		if (showLibrariesPopup) {
			setTimeout(() => {
				const trigger = toolbarRootRef.current?.querySelector?.('[data-spotlight-id="toolbar-libraries"]');
				trigger?.focus?.();
			}, 0);
		}
	}, [closeDisclosure, setDisclosure, showLibrariesPopup]);

	const handleCloseLibrariesPopup = useCallback(() => {
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP);
	}, [closeDisclosure]);
	const focusLibrariesTrigger = useCallback(() => {
		const trigger = toolbarRootRef.current?.querySelector?.('[data-spotlight-id="toolbar-libraries"]');
		if (!trigger) return false;
		try {
			trigger.focus({preventScroll: true});
		} catch (error) {
			trigger.focus();
		}
		return document.activeElement === trigger || trigger.contains(document.activeElement);
	}, []);
	const closeLibrariesPopupAndRestoreFocus = useCallback(() => {
		closeDisclosure(TOOLBAR_DISCLOSURE_KEYS.LIBRARIES_POPUP);
		setTimeout(focusLibrariesTrigger, 0);
	}, [closeDisclosure, focusLibrariesTrigger]);

	useDismissOnOutsideInteraction({
		enabled: showUserMenu,
		scopeRef: userMenuScopeRef,
		onDismiss: handleUserMenuClose
	});

	useDismissOnOutsideInteraction({
		enabled: usePillLayout && showLibrariesPopup,
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

	const focusFirstLibraryPopupItem = useCallback(() => {
		const scope = libraryMenuScopeRef.current || librariesPopupContentRef.current;
		const firstLibraryButton = scope?.querySelector?.(`.${css.libraryNativeButton}`);
		if (!firstLibraryButton) return false;
		try {
			firstLibraryButton.focus({preventScroll: true});
		} catch (_) {
			firstLibraryButton.focus();
		}
		return document.activeElement === firstLibraryButton || firstLibraryButton.contains(document.activeElement);
	}, []);

	const handleToolbarKeyDownCapture = useCallback((event) => {
		const code = event.keyCode || event.which;
		const currentControl = event.target?.closest?.(primaryToolbarNavSelector);
		const spotlightId = currentControl?.dataset?.spotlightId ||
			event.target?.closest?.('[data-spotlight-id]')?.dataset?.spotlightId ||
			event.target?.dataset?.spotlightId ||
			'';
		const isLibrariesTrigger =
			spotlightId === 'toolbar-libraries' ||
			currentControl?.getAttribute?.('aria-label') === 'Libraries';
		if (showLibrariesPopup && code === KeyCodes.DOWN && isLibrariesTrigger) {
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation?.();
			focusFirstLibraryPopupItem();
			return;
		}
		if (event.target?.closest?.(`.${css.libraryNativeContent}`)) return;
		if (code === KeyCodes.DOWN && currentControl && typeof onNavigateDown === 'function') {
			const moved = onNavigateDown({event, spotlightId, control: currentControl}) === true;
			if (moved) {
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation?.();
			}
			return;
		}
		const isDirectionalLockKey =
			code === KeyCodes.LEFT ||
			code === KeyCodes.RIGHT ||
			code === KeyCodes.UP;
		if (!isDirectionalLockKey) return;

		if (!currentControl) return;

		if (code === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation?.();
			return;
		}

		const root = toolbarRootRef.current || event.currentTarget;
		const controls = Array.from(root.querySelectorAll(primaryToolbarNavSelector))
			.filter((element) => (
				element &&
				element.nodeType === 1 &&
				element.offsetParent !== null &&
				!element.closest?.(`.${css.userMenu}`) &&
				!element.closest?.(`.${css.elegantLibraryPopup}`)
			));
		if (controls.length === 0) return;

		const currentIndex = controls.indexOf(currentControl);
		if (currentIndex < 0) return;

		const nextIndex = code === KeyCodes.LEFT
			? Math.max(0, currentIndex - 1)
			: Math.min(controls.length - 1, currentIndex + 1);
		const nextControl = controls[nextIndex];
		if (!nextControl || nextControl === currentControl) {
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation?.();
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation?.();
		try {
			nextControl.focus({preventScroll: true});
		} catch (_) {
			nextControl.focus();
		}
	}, [focusFirstLibraryPopupItem, onNavigateDown, primaryToolbarNavSelector, showLibrariesPopup]);

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
			closeLibrariesPopupAndRestoreFocus();
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
	}, [closeDisclosure, closeLibrariesPopupAndRestoreFocus, showLibrariesPopup, showUserMenu]);

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
	const toolbarStyle = usePillLayout
		? {'--bf-glass-distortion-filter': shouldRenderElegantDistortion ? `url(#${glassFilterId})` : 'none'}
		: undefined;

	return (
		<div
			ref={toolbarRootRef}
			className={`${css.toolbar} ${usePillLayout ? css.toolbarElegant : ''} ${useCompactPillHeader ? css.toolbarCompactPill : ''}`}
			data-bf-navbar="true"
			data-bf-navbar-theme={toolbarTheme}
			data-bf-header-layout={useCompactPillHeader ? 'compact-pill' : 'classic'}
			data-bf-navbar-legacy={isWebOS6Compat ? 'on' : 'off'}
			style={toolbarStyle}
			onKeyDownCapture={handleToolbarKeyDownCapture}
		>
			{usePillLayout ? (
				<ToolbarElegantLayout
					SpottableDiv={SpottableDiv}
					glassFilterId={glassFilterId}
					glassDistortionScale={14}
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
					librariesPopupContentRef={librariesPopupContentRef}
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

			{!usePillLayout && (
				<Popup open={showLibrariesPopup} onClose={handleCloseLibrariesPopup} style={toolbarStyle} css={popupShellCss}>
					<div>
						<ToolbarLibraryPicker
							useElegantGlass={false}
							libraries={libraries}
							activeSection={activeSection}
							activeLibraryId={activeLibraryId}
							onLibrarySelect={handleLibraryPopupSelect}
							contentRef={librariesPopupContentRef}
						/>
					</div>
				</Popup>
			)}
		</div>
	);
};

export default Toolbar;
