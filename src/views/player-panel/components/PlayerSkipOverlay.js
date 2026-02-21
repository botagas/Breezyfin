import BodyText from '@enact/sandstone/BodyText';
import Button from '../../../components/BreezyButton';
import css from '../../PlayerPanel.module.less';

const PlayerSkipOverlay = ({
	visible,
	currentSkipSegment,
	showNextEpisodePrompt,
	nextEpisodeData,
	skipCountdown,
	onSkip,
	onDismiss,
	skipButtonRef,
	skipOverlayRef,
	getSkipSegmentLabel
}) => {
	if (!visible || (!currentSkipSegment && !showNextEpisodePrompt)) return null;

	return (
		<div className={css.skipOverlay} ref={skipOverlayRef}>
			<div className={`${css.skipPill} ${css.skipPillCompact}`}>
				<Button
					size="small"
					onClick={onSkip}
					className={css.skipButton}
					componentRef={skipButtonRef}
					spotlightId="skip-overlay-action"
					autoFocus
				>
					{showNextEpisodePrompt ? 'Play Next' : getSkipSegmentLabel(currentSkipSegment.Type, Boolean(nextEpisodeData))}
				</Button>
				{skipCountdown !== null && (
					<BodyText className={css.skipCountdownCompact}>{skipCountdown}s</BodyText>
				)}
				<Button
					size="small"
					icon="closex"
					onClick={onDismiss}
					className={css.skipCloseButton}
				/>
			</div>
		</div>
	);
};

export default PlayerSkipOverlay;
