import BodyText from '@enact/sandstone/BodyText';
import css from '../../PlayerPanel.module.less';

const PlayerSeekFeedback = ({seekFeedback}) => {
	if (!seekFeedback) return null;

	return (
		<div className={css.seekFeedback}>
			<BodyText className={css.seekFeedbackText}>{seekFeedback}</BodyText>
		</div>
	);
};

export default PlayerSeekFeedback;
