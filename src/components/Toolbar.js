import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react';
import { Spottable } from '@enact/spotlight/Spottable';
import Popup from '@enact/sandstone/Popup';
import Button from './BreezyButton';
import Icon from '@enact/sandstone/Icon';
import BodyText from '@enact/sandstone/BodyText';
import jellyfinService from '../services/jellyfinService';
import {scrollElementIntoHorizontalView} from '../utils/horizontalScroll';
import { useBreezyfinSettingsSync } from '../hooks/useBreezyfinSettingsSync';
import { usePanelBackHandler } from '../hooks/usePanelBackHandler';
import { useDismissOnOutsideInteraction } from '../hooks/useDismissOnOutsideInteraction';
import { useDisclosureMap } from '../hooks/useDisclosureMap';
import { useMapById } from '../hooks/useMapById';
import {getRuntimePlatformCapabilities} from '../utils/platformCapabilities';

import css from './Toolbar.module.less';
import popupStyles from '../styles/popupStyles.module.less';
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
		const params = new URLSearchParams({
			width: '96',
			api_key: jellyfinService.accessToken
		});
		params.set('tag', user.PrimaryImageTag);
		return `${jellyfinService.serverUrl}/Users/${user.Id}/Images/Primary?${params.toString()}`;
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

	const formatTime = () => {
		return currentTime.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	};

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

	const handleUserAvatarError = useCallback(() => {
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

	const renderUserMenu = () => (
		showUserMenu && (
			<div className={`${css.userMenu} ${isElegantTheme ? css.userMenuElegant : ''}`}>
				<div className={css.userMenuInner}>
					<Button size="small" focusEffect="static" backgroundOpacity="transparent" shadowed={false} onClick={handleLogoutClick} className={css.menuButton}>Log Out</Button>
					<Button size="small" focusEffect="static" backgroundOpacity="transparent" shadowed={false} onClick={handleSwitchUserClick} className={css.menuButton}>Switch User</Button>
					<Button size="small" focusEffect="static" backgroundOpacity="transparent" shadowed={false} onClick={handleExitClick} className={css.menuButton}>Exit</Button>
				</div>
			</div>
		)
	);

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
	const isWebOS6Compat = runtimeCapabilities.webosV6Compat;
	const shouldRenderElegantDistortion =
		!isWebOS6Compat &&
		runtimeCapabilities.supportsBackdropFilter;
	const toolbarStyle = isElegantTheme
		? {'--bf-glass-distortion-filter': shouldRenderElegantDistortion ? `url(#${glassFilterId})` : 'none'}
		: undefined;
	const renderLibraryPicker = (useElegantGlass = false) => (
		<div className={`${popupStyles.popupSurface} ${css.libraryNativeContent} ${useElegantGlass ? css.libraryNativeContentGlass : ''}`}>
			{useElegantGlass && (
				<>
					<div className={`${css.liquidLayerFilter} ${css.liquidLayerFilterMuted}`} />
					<div className={css.liquidLayerOverlay} />
					<div className={css.liquidLayerSpecular} />
				</>
			)}
			<div className={css.libraryNativeInner}>
				<BodyText className={css.libraryNativeTitle}>Libraries</BodyText>
				<div className={css.libraryNativeGrid}>
					{libraries.length === 0 && (
						<BodyText className={css.libraryNativeEmpty}>No libraries available</BodyText>
					)}
					{libraries.map((library) => (
						<Button
							key={library.Id}
							size="small"
							minWidth={false}
							data-library-id={library.Id}
							selected={activeSection === 'library' && activeLibraryId === library.Id}
							onClick={handleLibraryPopupSelect}
							className={css.libraryNativeButton}
						>
							{library.Name}
						</Button>
					))}
				</div>
			</div>
		</div>
	);

	return (
		<div
			className={`${css.toolbar} ${isElegantTheme ? css.toolbarElegant : ''}`}
			data-bf-navbar="true"
			data-bf-navbar-theme={toolbarTheme}
			data-bf-navbar-legacy={isWebOS6Compat ? 'on' : 'off'}
			style={toolbarStyle}
		>
			{isElegantTheme && shouldRenderElegantDistortion && (
				<svg className={css.glassFilterSvg} aria-hidden="true" focusable="false" width="0" height="0">
					<defs>
						<filter id={glassFilterId}>
							<feTurbulence type="turbulence" baseFrequency="0.007" numOctaves="2" result="noise" />
							<feDisplacementMap in="SourceGraphic" in2="noise" scale="77" />
						</filter>
					</defs>
				</svg>
			)}
			{isElegantTheme ? (
				<div className={css.glassNav}>
					<div className={css.glassFilter} data-bf-glass-layer="filter" />
					<div className={css.glassOverlay} data-bf-glass-layer="overlay" />
					<div className={css.glassSpecular} data-bf-glass-layer="specular" />
					<div className={css.glassContent}>
						<div className={css.elegantContainer}>
							{isHomeSection ? (
								<div className={css.elegantLeftSpacer} aria-hidden="true" />
							) : (
								<div className={css.elegantBackArea}>
									<SpottableDiv
										onClick={handleElegantBack}
									className={`${css.iconButton} ${css.elegantBackButton}`}
									aria-label={`Back to Home from ${elegantPanelTitle}`}
									spotlightId="toolbar-back"
								>
										<Icon style={{'--icon-size': '1rem'}}>arrowsmallleft</Icon>
									</SpottableDiv>
									<BodyText className={css.elegantPanelTitle}>{elegantPanelTitle}</BodyText>
								</div>
							)}
							<div className={css.elegantTabs}>
								<Button
									size="small"
									onClick={handleNavigateHome}
									className={`${css.tabButton} ${activeSection === 'home' ? css.tabSelected : ''}`}
									spotlightId="toolbar-home"
								>
									Home
								</Button>
								<Button
									size="small"
									onClick={handleNavigateFavorites}
									className={`${css.tabButton} ${activeSection === 'favorites' ? css.tabSelected : ''}`}
									spotlightId="toolbar-favorites"
								>
									Favorites
								</Button>
								<Button
									size="small"
									onClick={handleNavigateSearch}
									className={`${css.tabButton} ${activeSection === 'search' ? css.tabSelected : ''}`}
									spotlightId="toolbar-search"
								>
									Search
								</Button>
							</div>

							<div className={css.elegantActions}>
								<SpottableDiv
									onClick={handleNavigateSearch}
									className={`${css.iconButton} ${activeSection === 'search' ? css.selected : ''}`}
									aria-label="Search"
									spotlightId="toolbar-search-icon"
								>
									<Icon size="small">search</Icon>
								</SpottableDiv>
								<SpottableDiv
									onClick={handleNavigateSettings}
									className={`${css.iconButton} ${activeSection === 'settings' ? css.selected : ''}`}
									aria-label="Appearance"
									spotlightId="toolbar-appearance"
								>
									<Icon size="small">gear</Icon>
								</SpottableDiv>
								<div ref={libraryMenuScopeRef} className={css.elegantLibraryMenuScope}>
									<SpottableDiv
										onClick={handleOpenLibrariesPopup}
										className={`${css.iconButton} ${activeSection === 'library' ? css.selected : ''}`}
										aria-label="Libraries"
										spotlightId="toolbar-libraries"
									>
										<Icon size="small">list</Icon>
									</SpottableDiv>
									{showLibrariesPopup && (
										<div className={css.elegantLibraryPopup}>
											{renderLibraryPicker(true)}
										</div>
									)}
								</div>
								<div ref={userMenuScopeRef} className={css.userContainer} {...elegantUserContainerProps}>
									<SpottableDiv
										onClick={handleUserButtonClick}
										className={`${css.iconButton} ${css.userIconButton} ${showUserMenu ? css.selected : ''}`}
										aria-label={`User menu, ${userName}`}
										spotlightId="toolbar-user"
									>
										{userAvatarUrl ? (
											<img
												src={userAvatarUrl}
												alt={`${userName} avatar`}
												className={css.userAvatar}
												onError={handleUserAvatarError}
											/>
										) : (
											<Icon size="small">profile</Icon>
										)}
									</SpottableDiv>
									{renderUserMenu()}
								</div>
							</div>
						</div>
					</div>
				</div>
			) : (
				<>
					<div className={css.start}>
						<div ref={userMenuScopeRef} className={css.userContainer} {...classicUserContainerProps}>
							<Button
								size="small"
								className={css.userButton}
								aria-label="User Profile"
								spotlightId="toolbar-user"
								onClick={handleUserButtonClick}
							>
								{userName}
							</Button>
							{renderUserMenu()}
						</div>
					</div>
					<div className={css.center}>
						<div className={css.centerPinned}>
							<SpottableDiv
								onClick={handleNavigateHome}
								className={`${css.iconButton} ${activeSection === 'home' ? css.selected : ''}`}
								aria-label="Home"
								spotlightId="toolbar-home"
							>
								<Icon size="small">home</Icon>
							</SpottableDiv>

							<SpottableDiv
								onClick={handleNavigateSearch}
								className={`${css.iconButton} ${activeSection === 'search' ? css.selected : ''}`}
								aria-label="Search"
								spotlightId="toolbar-search"
							>
								<Icon size="small">search</Icon>
							</SpottableDiv>

							<SpottableDiv
								onClick={handleClassicBack}
								className={css.iconButton}
								aria-label="Back"
								spotlightId="toolbar-back"
							>
								<Icon size="small">arrowsmallleft</Icon>
							</SpottableDiv>

							<SpottableDiv
								onClick={handleNavigateFavorites}
								className={`${css.iconButton} ${activeSection === 'favorites' ? css.selected : ''}`}
								aria-label="Favorites"
								spotlightId="toolbar-favorites"
							>
								<Icon size="small">star</Icon>
							</SpottableDiv>
						</div>
						<div className={css.centerScroller} ref={centerRef} onFocus={handleCenterFocus}>
							{libraries.map((library) => (
								<Button
									key={library.Id}
									size="small"
									backgroundOpacity="transparent"
									shadowed={false}
									data-library-id={library.Id}
									onClick={handleLibraryNavigate}
									selected={activeSection === 'library' && activeLibraryId === library.Id}
									className={css.toolbarButton}
									spotlightId={`toolbar-library-${library.Id}`}
								>
									{library.Name}
								</Button>
							))}
						</div>
					</div>

					<div className={css.end}>
						<SpottableDiv
							onClick={handleNavigateSettings}
							className={css.iconButton}
							aria-label="Settings"
							spotlightId="toolbar-settings"
						>
							<Icon size="small">gear</Icon>
						</SpottableDiv>
						<BodyText className={css.clock}>{formatTime()}</BodyText>
					</div>
				</>
			)}

			{!isElegantTheme && (
				<Popup open={showLibrariesPopup} onClose={handleCloseLibrariesPopup} style={toolbarStyle} css={popupShellCss}>
					{renderLibraryPicker(false)}
				</Popup>
			)}
		</div>
	);
};

export default Toolbar;
