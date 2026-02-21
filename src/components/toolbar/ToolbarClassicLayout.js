import Icon from '@enact/sandstone/Icon';
import BodyText from '@enact/sandstone/BodyText';
import Button from '../BreezyButton';
import ToolbarUserMenu from './ToolbarUserMenu';
import css from '../Toolbar.module.less';

const ToolbarClassicLayout = ({
	SpottableDiv,
	userMenuScopeRef,
	classicUserContainerProps,
	handleUserButtonClick,
	userName,
	showUserMenu,
	handleLogoutClick,
	handleSwitchUserClick,
	handleExitClick,
	handleNavigateHome,
	activeSection,
	handleNavigateSearch,
	handleClassicBack,
	handleNavigateFavorites,
	centerRef,
	handleCenterFocus,
	libraries,
	activeLibraryId,
	handleLibraryNavigate,
	handleNavigateSettings,
	formatTime
}) => {
	return (
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
					<ToolbarUserMenu
						isElegantTheme={false}
						showUserMenu={showUserMenu}
						onLogout={handleLogoutClick}
						onSwitchUser={handleSwitchUserClick}
						onExit={handleExitClick}
					/>
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
	);
};

export default ToolbarClassicLayout;
