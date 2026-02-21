import Button from '../../../components/BreezyButton';
import css from '../../MediaDetailsPanel.module.less';

const MediaTrackSelectorButton = ({
	icon,
	onClick,
	label,
	ariaLabel,
	componentRef,
	onKeyDown
}) => {
	return (
		<Button
			size="small"
			icon={icon}
			onClick={onClick}
			className={`${css.compactSelectorButton} ${css.trackSelectorPrimary}`}
			componentRef={componentRef}
			onKeyDown={onKeyDown}
			aria-label={ariaLabel}
		>
			{label}
		</Button>
	);
};

export default MediaTrackSelectorButton;
