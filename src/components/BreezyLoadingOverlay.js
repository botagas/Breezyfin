import BodyText from '@enact/sandstone/BodyText';
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
			<svg className={css.loadingDefs} aria-hidden="true" focusable="false">
				<filter id="glass-distortion-breezy-loading">
					<feTurbulence type="turbulence" baseFrequency="0.008" numOctaves="2" result="noise" />
					<feDisplacementMap in="SourceGraphic" in2="noise" scale="77" />
				</filter>
			</svg>
			<div className={css.loadingGlassSpinner}>
				<div className={css.loadingGlassFilter} />
				<div className={css.loadingGlassOverlay} />
				<div className={css.loadingGlassSpecular} />
				<div className={css.loadingGlassContent}>
					<div className={css.loadingSpinnerRing} />
					<div className={css.loadingSpinnerCore} />
				</div>
			</div>
			<BodyText className={css.loadingText}>{label}</BodyText>
		</div>
	);
};

export default BreezyLoadingOverlay;
