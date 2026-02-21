import Button from '../BreezyButton';
import css from '../Toolbar.module.less';

const ToolbarUserMenu = ({
	isElegantTheme,
	showUserMenu,
	onLogout,
	onSwitchUser,
	onExit
}) => {
	if (!showUserMenu) return null;

	return (
		<div className={`${css.userMenu} ${isElegantTheme ? css.userMenuElegant : ''}`}>
			{isElegantTheme && (
				<>
					<div className={`${css.liquidLayerFilter} ${css.liquidLayerFilterMuted}`} />
					<div className={css.liquidLayerOverlay} />
					<div className={css.liquidLayerSpecular} />
				</>
			)}
			<div className={css.userMenuInner}>
				<Button size="small" focusEffect="static" backgroundOpacity="transparent" shadowed={false} onClick={onLogout} className={css.menuButton}>Log Out</Button>
				<Button size="small" focusEffect="static" backgroundOpacity="transparent" shadowed={false} onClick={onSwitchUser} className={css.menuButton}>Switch User</Button>
				<Button size="small" focusEffect="static" backgroundOpacity="transparent" shadowed={false} onClick={onExit} className={css.menuButton}>Exit</Button>
			</div>
		</div>
	);
};

export default ToolbarUserMenu;
