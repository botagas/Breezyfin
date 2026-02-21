import BodyText from '@enact/sandstone/BodyText';
import css from '../../PlayerPanel.module.less';

const PlayerLoadingOverlay = ({loading}) => {
	if (!loading) return null;

	return (
		<div className={css.loading}>
			<svg className={css.loadingDefs} aria-hidden="true" focusable="false">
				<filter id="glass-distortion-player-loading">
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
			<BodyText className={css.loadingText}>Loading...</BodyText>
		</div>
	);
};

export default PlayerLoadingOverlay;
