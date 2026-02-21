import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Button from '../../../components/BreezyButton';
import css from '../../PlayerPanel.module.less';
import popupStyles from '../../../styles/popupStyles.module.less';

const PlayerErrorPopup = ({
	open,
	error,
	onClose,
	onRetry,
	onBack
}) => {
	return (
		<Popup
			open={open}
			onClose={onClose}
			noAutoDismiss
			css={{popup: popupStyles.popupShell, body: css.errorPopupBody}}
		>
			<div className={`${popupStyles.popupSurface} ${css.errorPopupContent} bf-error-surface`}>
				<BodyText className={`${css.popupTitle} bf-error-title`}>Playback Error</BodyText>
				<BodyText className={`${css.errorMessage} bf-error-message`}>{error}</BodyText>
				<div className={`${css.errorActions} bf-error-actions`}>
					<Button onClick={onRetry} autoFocus className={css.errorActionButton}>
						Retry
					</Button>
					<Button onClick={onBack} className={css.errorActionButton}>
						Go Back
					</Button>
				</div>
			</div>
		</Popup>
	);
};

export default PlayerErrorPopup;
