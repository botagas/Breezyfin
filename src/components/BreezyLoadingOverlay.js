import css from './BreezyLoadingOverlay.module.less';

const joinClasses = (...names) => names.filter(Boolean).join(' ');

const BreezyLoadingOverlay = ({
	visible = true,
	label = 'Loading...',
	className = ''
}) => {
	if (!visible) return null;

	return (
		<div className={joinClasses(css.loading, className)}>
			<div className={css.loadingSpinner} aria-hidden="true">
				<div className={css.loadingSpinnerRing} />
				<div className={css.loadingSpinnerCore} />
			</div>
			<div className={css.loadingText}>{label}</div>
		</div>
	);
};

export default BreezyLoadingOverlay;
