import {useCallback} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import Spotlight from '@enact/spotlight';
import Button from '../../../components/BreezyButton';
import {KeyCodes} from '../../../utils/keyCodes';
import css from '../../PlayerPanel.module.less';

const SKIP_ACTION_SPOTLIGHT_ID = 'skip-overlay-action';
const SKIP_DISMISS_SPOTLIGHT_ID = 'skip-overlay-dismiss';

const PlayerSkipOverlay = ({
	visible,
	currentSkipSegment,
	showNextEpisodePrompt,
	skipCountdown,
	onSkip,
	onDismiss,
	skipButtonRef,
	skipOverlayRef,
	getSkipSegmentLabel
}) => {
	const handleOverlayKeyDown = useCallback((event) => {
		const code = event.keyCode || event.which;
		if (code !== KeyCodes.LEFT && code !== KeyCodes.RIGHT) return;
		const spotlightNode = event.target?.closest?.('[data-spotlight-id]');
		const spotlightId = spotlightNode?.dataset?.spotlightId;
		const nextSpotlightId = code === KeyCodes.RIGHT && spotlightId === SKIP_ACTION_SPOTLIGHT_ID
			? SKIP_DISMISS_SPOTLIGHT_ID
			: code === KeyCodes.LEFT && spotlightId === SKIP_DISMISS_SPOTLIGHT_ID
				? SKIP_ACTION_SPOTLIGHT_ID
				: null;
		if (!nextSpotlightId) return;
		event.preventDefault();
		event.stopPropagation();
		event.nativeEvent?.stopImmediatePropagation?.();
		Spotlight.focus(nextSpotlightId);
	}, []);

	if (!visible || (!currentSkipSegment && !showNextEpisodePrompt)) return null;

	return (
		<div className={css.skipOverlay} ref={skipOverlayRef} onKeyDown={handleOverlayKeyDown}>
			<div className={`${css.skipPill} ${css.skipPillCompact}`}>
				<Button
					size="small"
					onClick={onSkip}
					className={css.skipButton}
					componentRef={skipButtonRef}
					spotlightId={SKIP_ACTION_SPOTLIGHT_ID}
					autoFocus
				>
					{showNextEpisodePrompt ? 'Play Next' : getSkipSegmentLabel(currentSkipSegment.Type, false)}
				</Button>
				{skipCountdown !== null && (
					<BodyText className={css.skipCountdownCompact}>{skipCountdown}s</BodyText>
				)}
				<Button
					size="small"
					icon="closex"
					onClick={onDismiss}
					className={css.skipCloseButton}
					spotlightId={SKIP_DISMISS_SPOTLIGHT_ID}
					aria-label="Dismiss skip overlay"
				/>
			</div>
		</div>
	);
};

export default PlayerSkipOverlay;
