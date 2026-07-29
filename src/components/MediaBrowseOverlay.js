import css from './MediaBrowseControls.module.less';

const MediaBrowseOverlay = ({
	children,
	compact = false,
	expanded = false,
	actionCount = 1
}) => (
	<div className={css.panelOverlay} data-bf-panel-controls="true">
		<div className={[
			css.panelOverlayInner,
			compact ? css.panelOverlayInnerCompact : '',
			compact && actionCount > 1 ? css.panelOverlayInnerCompactTwoActions : '',
			compact && expanded ? css.panelOverlayInnerCompactExpanded : ''
		].filter(Boolean).join(' ')}>
			{children}
		</div>
	</div>
);

export default MediaBrowseOverlay;
