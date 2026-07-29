import {useRef} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Button from '../../../components/BreezyButton';
import {usePopupInitialFocus} from '../../../hooks/usePopupInitialFocus';
import css from '../../PlayerPanel.module.less';
import popupStyles from '../../../styles/popupStyles.module.less';
import {
	SERVER_TRANSCODING_FAILURE_MESSAGE,
	SERVER_TRANSCODING_FAILURE_TITLE
} from '../utils/playerRecoveryPolicy';

const PlayerErrorPopup = ({
	open,
	error,
	onClose,
	onRetry,
	onBack
}) => {
	const contentRef = useRef(null);
	usePopupInitialFocus(open, contentRef);
	const isServerTranscodingFailure = error === SERVER_TRANSCODING_FAILURE_MESSAGE;
	const title = isServerTranscodingFailure
		? SERVER_TRANSCODING_FAILURE_TITLE
		: 'Playback Error';

	return (
		<Popup
			open={open}
			onClose={onClose}
			noAutoDismiss
			css={{popup: popupStyles.popupShell, body: css.errorPopupBody}}
		>
			<div
				ref={contentRef}
				data-popup-focus-scope="true"
				className={`${popupStyles.popupSurface} ${css.errorPopupContent} bf-error-surface`}
			>
				<BodyText className={`${css.popupTitle} bf-error-title`}>{title}</BodyText>
				<BodyText className={`${css.errorMessage} bf-error-message`}>{error}</BodyText>
				<div className={`${css.errorActions} bf-error-actions`}>
					<Button onClick={onRetry} className={`${css.errorActionButton} bf-error-action-button`}>
						Retry
					</Button>
					<Button onClick={onBack} className={`${css.errorActionButton} bf-error-action-button`}>
						Go Back
					</Button>
				</div>
			</div>
		</Popup>
	);
};

export default PlayerErrorPopup;
