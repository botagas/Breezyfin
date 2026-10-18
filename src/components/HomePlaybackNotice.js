import {useCallback, useEffect, useRef} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import PanelActionButton from './PanelActionButton';
import {usePopupInitialFocus} from '../hooks/usePopupInitialFocus';
import {popupShellCss} from '../styles/popupStyles';
import popupStyles from '../styles/popupStyles.module.less';

const HomePlaybackNotice = ({notice, onCancel, onChooseAccount, onShown, onHidden}) => {
	const content = useRef(null);
	const afterHide = useRef(null);
	usePopupInitialFocus(Boolean(notice), content);
	const open = Boolean(notice);
	useEffect(() => { if (open) onShown(); }, [open, onShown]);
	const finishAfterHide = useCallback(() => {
		const action = afterHide.current;
		afterHide.current = null;
		onHidden();
		action?.();
	}, [onHidden]);
	const cancel = useCallback(() => { afterHide.current = null; onCancel(); }, [onCancel]);
	const chooseAccount = useCallback(() => {
		afterHide.current = onChooseAccount;
		onChooseAccount({hideOnly: true});
	}, [onChooseAccount]);
	return <Popup open={Boolean(notice)} onClose={cancel} onHide={finishAfterHide} css={popupShellCss}>
		<div ref={content} className={popupStyles.popupSurface}>
			<BodyText>{notice?.message || ''}</BodyText>
			{notice?.account ? <PanelActionButton onClick={chooseAccount}>Choose account</PanelActionButton> : null}
			<PanelActionButton onClick={cancel}>{notice?.account || notice?.loading ? 'Cancel' : 'Close'}</PanelActionButton>
		</div>
	</Popup>;
};

export default HomePlaybackNotice;
