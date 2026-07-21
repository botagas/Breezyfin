import {useRef} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import Popup from '@enact/sandstone/Popup';
import {Header} from './BreezyPanels';
import Button from './BreezyButton';
import {usePopupInitialFocus} from '../hooks/usePopupInitialFocus';
import {popupShellCss} from '../styles/popupStyles';

const ProviderItemPopup = ({
	open,
	title,
	detail,
	onClose,
	onHide,
	spotlightId = 'provider-item-close'
}) => {
	const contentRef = useRef(null);
	usePopupInitialFocus(open, contentRef);
	return (
		<Popup open={open} onClose={onClose} onHide={onHide} css={popupShellCss}>
			<div ref={contentRef}>
				<Header title={title} />
				<BodyText>{detail}</BodyText>
				<Button spotlightId={spotlightId} onClick={onClose}>Close</Button>
			</div>
		</Popup>
	);
};

export default ProviderItemPopup;

