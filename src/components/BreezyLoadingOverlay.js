import css from './BreezyLoadingOverlay.module.less';

const joinClasses = (...names) => names.filter(Boolean).join(' ');

const BreezyLoadingOverlay = ({
	visible = true,
	label = 'Loading...',
	className = ''
}) => {
	if (!visible) return null;

	return (
		<div
			className={joinClasses(css.loading, className)}
			role="status"
			aria-live="polite"
			aria-atomic="true"
		>
			<div className={css.loadingGust} aria-hidden="true">
				<span className={css.loadingStroke} />
				<span className={css.loadingStroke} />
				<span className={css.loadingStroke} />
			</div>
			<div className={css.loadingText}>{label}</div>
		</div>
	);
};

export default BreezyLoadingOverlay;
