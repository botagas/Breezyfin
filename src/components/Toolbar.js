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

import css from './Toolbar.module.less';
import popupStyles from '../styles/popupStyles.module.less';
import {popupShellCss} from '../styles/popupStyles';

const SpottableDiv = Spottable('div');
const TOOLBAR_THEME_CLASSIC = 'classic';
const TOOLBAR_THEME_ELEGANT = 'elegant';

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
	const [showUserMenu, setShowUserMenu] = useState(false);
	const [showLibrariesPopup, setShowLibrariesPopup] = useState(false);
	const [toolbarTheme, setToolbarTheme] = useState(TOOLBAR_THEME_CLASSIC);
	const glassFilterId = useId();
	const centerRef = useRef(null);
	const userMenuScopeRef = useRef(null);
	const libraryMenuScopeRef = useRef(null);
	const userMenuCloseTimerRef = useRef(null);
	const suppressUserMenuUntilRef = useRef(0);
	const librariesById = useMemo(() => {
		const map = new Map();
		libraries.forEach((library) => {
			map.set(String(library.Id), library);
		});
		return map;
	}, [libraries]);
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
		setToolbarTheme(nextTheme === TOOLBAR_THEME_ELEGANT ? TOOLBAR_THEME_ELEGANT : TOOLBAR_THEME_CLASSIC);
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
			setShowLibrariesPopup(false);
		}
	}, [isElegantTheme, showLibrariesPopup]);

	useEffect(() => {
		return () => {
			if (userMenuCloseTimerRef.current) {
				clearTimeout(userMenuCloseTimerRef.current);
				userMenuCloseTimerRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (!showUserMenu) return undefined;

		const closeMenuIfOutside = (target) => {
			if (!target || typeof target.nodeType !== 'number') return;
			const scope = userMenuScopeRef.current;
			if (!scope) return;
			if (scope.contains(target)) return;
			setShowUserMenu(false);
		};

		const handleFocusIn = (event) => {
			closeMenuIfOutside(event.target);
		};
		const handlePointerDown = (event) => {
			closeMenuIfOutside(event.target);
		};

		document.addEventListener('focusin', handleFocusIn, true);
		document.addEventListener('pointerdown', handlePointerDown, true);
		document.addEventListener('mousedown', handlePointerDown, true);
		document.addEventListener('touchstart', handlePointerDown, true);
		return () => {
			document.removeEventListener('focusin', handleFocusIn, true);
			document.removeEventListener('pointerdown', handlePointerDown, true);
			document.removeEventListener('mousedown', handlePointerDown, true);
			document.removeEventListener('touchstart', handlePointerDown, true);
		};
	}, [showUserMenu]);

	useEffect(() => {
		if (!showLibrariesPopup || !isElegantTheme) return undefined;
		const closeMenuIfOutside = (target) => {
			if (!target || typeof target.nodeType !== 'number') return;
			const scope = libraryMenuScopeRef.current;
			if (!scope) return;
			if (scope.contains(target)) return;
			setShowLibrariesPopup(false);
		};
		const handleFocusIn = (event) => {
			closeMenuIfOutside(event.target);
		};
		const handlePointerDown = (event) => {
			closeMenuIfOutside(event.target);
		};

		document.addEventListener('focusin', handleFocusIn, true);
		document.addEventListener('pointerdown', handlePointerDown, true);
		document.addEventListener('mousedown', handlePointerDown, true);
		document.addEventListener('touchstart', handlePointerDown, true);
		return () => {
			document.removeEventListener('focusin', handleFocusIn, true);
			document.removeEventListener('pointerdown', handlePointerDown, true);
			document.removeEventListener('mousedown', handlePointerDown, true);
			document.removeEventListener('touchstart', handlePointerDown, true);
		};
	}, [isElegantTheme, showLibrariesPopup]);

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
		setShowUserMenu(true);
	}, []);

	const handleUserMenuClose = useCallback(() => {
		if (userMenuCloseTimerRef.current) {
			clearTimeout(userMenuCloseTimerRef.current);
			userMenuCloseTimerRef.current = null;
		}
		setShowUserMenu(false);
	}, []);

	const handleElegantUserMouseLeave = useCallback(() => {
		if (userMenuCloseTimerRef.current) {
			clearTimeout(userMenuCloseTimerRef.current);
		}
		userMenuCloseTimerRef.current = setTimeout(() => {
			setShowUserMenu(false);
			userMenuCloseTimerRef.current = null;
		}, 140);
	}, []);

	const handleUserContainerFocus = useCallback(() => {
		if (Date.now() < suppressUserMenuUntilRef.current) return;
		setShowUserMenu(true);
	}, []);

	const handleUserContainerBlur = useCallback((event) => {
		const nextFocused = event.relatedTarget;
		if (nextFocused && event.currentTarget.contains(nextFocused)) {
			return;
		}
		setShowUserMenu(false);
	}, []);

	const handleUserButtonClick = useCallback(() => {
		if (userMenuCloseTimerRef.current) {
			clearTimeout(userMenuCloseTimerRef.current);
			userMenuCloseTimerRef.current = null;
		}
		if (Date.now() < suppressUserMenuUntilRef.current) return;
		setShowLibrariesPopup(false);
		setShowUserMenu((prevOpen) => !prevOpen);
	}, []);

	const handleUserAvatarError = useCallback(() => {
		setUserAvatarUrl('');
	}, []);

	const handleNavigateHome = useCallback(() => {
		onNavigate('home');
	}, [onNavigate]);

	const handleNavigateSearch = useCallback(() => {
		onNavigate('search');
	}, [onNavigate]);

	const handleNavigateShuffle = useCallback(() => {
		onNavigate('shuffle');
	}, [onNavigate]);

	const handleNavigateFavorites = useCallback(() => {
		onNavigate('favorites');
	}, [onNavigate]);

	const handleNavigateSettings = useCallback(() => {
		onNavigate('settings');
	}, [onNavigate]);

	const handleElegantBack = useCallback(() => {
		setShowUserMenu(false);
		setShowLibrariesPopup(false);
		onNavigate('home');
	}, [onNavigate]);

	const handleLibraryNavigate = useCallback((event) => {
		const libraryId = event.currentTarget.dataset.libraryId;
		const library = librariesById.get(libraryId);
		if (library) {
			onNavigate('library', library);
		}
	}, [librariesById, onNavigate]);

	const handleOpenLibrariesPopup = useCallback(() => {
		setShowUserMenu(false);
		setShowLibrariesPopup((prevOpen) => !prevOpen);
	}, []);

	const handleCloseLibrariesPopup = useCallback(() => {
		setShowLibrariesPopup(false);
	}, []);

	const handleLibraryPopupSelect = useCallback((event) => {
		const libraryId = event.currentTarget.dataset.libraryId;
		const library = librariesById.get(libraryId);
		if (!library) return;
		setShowLibrariesPopup(false);
		onNavigate('library', library);
	}, [librariesById, onNavigate]);

	const handleLogoutClick = useCallback(() => {
		suppressUserMenuUntilRef.current = Date.now() + 500;
		setShowUserMenu(false);
		setShowLibrariesPopup(false);
		if (document.activeElement && typeof document.activeElement.blur === 'function') {
			document.activeElement.blur();
		}
		if (typeof onLogout === 'function') {
			onLogout();
		}
	}, [onLogout]);

	const handleSwitchUserClick = useCallback(() => {
		suppressUserMenuUntilRef.current = Date.now() + 500;
		setShowUserMenu(false);
		setShowLibrariesPopup(false);
		if (document.activeElement && typeof document.activeElement.blur === 'function') {
			document.activeElement.blur();
		}
		if (typeof onSwitchUser === 'function') {
			onSwitchUser();
			return;
		}
		if (typeof onLogout === 'function') {
			onLogout();
		}
	}, [onLogout, onSwitchUser]);

	const handleExitClick = useCallback(() => {
		suppressUserMenuUntilRef.current = Date.now() + 500;
		setShowUserMenu(false);
		setShowLibrariesPopup(false);
		if (document.activeElement && typeof document.activeElement.blur === 'function') {
			document.activeElement.blur();
		}
		if (typeof onExit === 'function') {
			onExit();
		}
	}, [onExit]);

	const handleInternalBack = useCallback(() => {
		if (showLibrariesPopup) {
			setShowLibrariesPopup(false);
			return true;
		}
		if (showUserMenu) {
			if (userMenuCloseTimerRef.current) {
				clearTimeout(userMenuCloseTimerRef.current);
				userMenuCloseTimerRef.current = null;
			}
			setShowUserMenu(false);
			return true;
		}
		return false;
	}, [showLibrariesPopup, showUserMenu]);

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
	const toolbarStyle = isElegantTheme
		? {'--bf-glass-distortion-filter': `url(#${glassFilterId})`}
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
			style={toolbarStyle}
		>
			{isElegantTheme && (
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
								onClick={handleNavigateShuffle}
								className={css.iconButton}
								aria-label="Shuffle"
								spotlightId="toolbar-shuffle"
							>
								<Icon size="small">arrowhookright</Icon>
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
