import {useRef} from 'react';
import Popup from '@enact/sandstone/Popup';
import Heading from '@enact/sandstone/Heading';
import Scroller from '../../../components/AppScroller';
import {usePopupInitialFocus} from '../../../hooks/usePopupInitialFocus';
import css from '../../MediaDetailsPanel.module.less';
import popupStyles from '../../../styles/popupStyles.module.less';
import {popupShellCss} from '../../../styles/popupStyles';

const MediaOptionPickerPopup = ({
	open,
	onClose,
	title,
	children
}) => {
	const popupContentRef = useRef(null);
	usePopupInitialFocus(open, popupContentRef);

	return (
		<Popup
			open={open}
			onClose={onClose}
			noAutoDismiss
			css={popupShellCss}
		>
			<div
				ref={popupContentRef}
				className={`${popupStyles.popupSurface} ${css.popupSurface}`}
				data-popup-focus-scope="true"
			>
				<Heading size="medium" spacing="none" className={css.popupHeading}>
					{title}
				</Heading>
				<Scroller className={css.popupScroller}>
					<div className={css.popupList}>{children}</div>
				</Scroller>
			</div>
		</Popup>
	);
};

export default MediaOptionPickerPopup;
