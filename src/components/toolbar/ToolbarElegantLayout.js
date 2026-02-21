import Icon from '@enact/sandstone/Icon';
import BodyText from '@enact/sandstone/BodyText';
import Button from '../BreezyButton';
import ToolbarUserMenu from './ToolbarUserMenu';
import ToolbarLibraryPicker from './ToolbarLibraryPicker';
import css from '../Toolbar.module.less';

const ToolbarElegantLayout = ({
	SpottableDiv,
	glassFilterId,
	shouldRenderElegantDistortion,
	isHomeSection,
	elegantPanelTitle,
	handleElegantBack,
	handleNavigateHome,
	handleNavigateFavorites,
	handleNavigateSearch,
	handleNavigateSettings,
	activeSection,
	libraryMenuScopeRef,
	handleOpenLibrariesPopup,
	showLibrariesPopup,
	libraries,
	activeLibraryId,
	handleLibraryPopupSelect,
	userMenuScopeRef,
	elegantUserContainerProps,
	handleUserButtonClick,
	userName,
	userAvatarUrl,
	handleUserAvatarError,
	showUserMenu,
	handleLogoutClick,
	handleSwitchUserClick,
	handleExitClick
}) => {
	return (
		<>
			{shouldRenderElegantDistortion && (
				<svg className={css.glassFilterSvg} aria-hidden="true" focusable="false" width="0" height="0">
					<defs>
						<filter id={glassFilterId}>
							<feTurbulence type="turbulence" baseFrequency="0.007" numOctaves="2" result="noise" />
							<feDisplacementMap in="SourceGraphic" in2="noise" scale="77" />
						</filter>
					</defs>
				</svg>
			)}
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
										<ToolbarLibraryPicker
											useElegantGlass
											libraries={libraries}
											activeSection={activeSection}
											activeLibraryId={activeLibraryId}
											onLibrarySelect={handleLibraryPopupSelect}
										/>
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
								<ToolbarUserMenu
									isElegantTheme
									showUserMenu={showUserMenu}
									onLogout={handleLogoutClick}
									onSwitchUser={handleSwitchUserClick}
									onExit={handleExitClick}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default ToolbarElegantLayout;
