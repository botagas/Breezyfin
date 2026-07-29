import {useCallback, useRef} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import PanelActionButton from './PanelActionButton';
import {useSyncPlay} from '../contexts/SyncPlayContext';
import {usePopupInitialFocus} from '../hooks/usePopupInitialFocus';
import {popupShellCss} from '../styles/popupStyles';
import popupStyles from '../styles/popupStyles.module.less';

import css from './SyncPlayGlobalOverlays.module.less';

const SyncPlayGlobalOverlays = () => {
	const syncPlay = useSyncPlay();
	const pendingActionRef = useRef(null);
	const decisionContentRef = useRef(null);
	usePopupInitialFocus(Boolean(syncPlay.playDecision), decisionContentRef);
	const closeDecision = useCallback(() => {
		pendingActionRef.current = null;
		syncPlay.cancelPlayDecision();
	}, [syncPlay]);
	const queueReplaceAfterHide = useCallback(() => {
		pendingActionRef.current = syncPlay.confirmReplacePlayback;
		syncPlay.cancelPlayDecision();
	}, [syncPlay]);
	const queueJoinAfterHide = useCallback(() => {
		pendingActionRef.current = syncPlay.joinCurrentPlayback;
		syncPlay.cancelPlayDecision();
	}, [syncPlay]);
	const finishDecisionAfterHide = useCallback(() => {
		const pendingAction = pendingActionRef.current;
		pendingActionRef.current = null;
		pendingAction?.();
	}, []);
	return (
		<>
			<Popup
				open={Boolean(syncPlay.playDecision)}
				onClose={closeDecision}
				onHide={finishDecisionAfterHide}
				css={popupShellCss}
			>
				<div ref={decisionContentRef} className={`${popupStyles.popupSurface} ${css.decision}`}>
					<BodyText>A different item is already queued for this SyncPlay group.</BodyText>
					<div className={css.actions}>
						<PanelActionButton onClick={queueReplaceAfterHide}>Replace group playback</PanelActionButton>
						<PanelActionButton onClick={queueJoinAfterHide}>Join current group playback</PanelActionButton>
						<PanelActionButton onClick={closeDecision}>Cancel</PanelActionButton>
					</div>
				</div>
			</Popup>
			{syncPlay.notification ? (
				<div className={`${popupStyles.popupSurface} ${css.notification}`} role="status">
					<BodyText>{syncPlay.notification.message}</BodyText>
					{syncPlay.notification.type === 'remote-playback' ? (
						<PanelActionButton size="small" onClick={syncPlay.resumeSession}>Watch</PanelActionButton>
					) : null}
					<PanelActionButton size="small" onClick={syncPlay.dismissNotification}>Dismiss</PanelActionButton>
				</div>
			) : null}
		</>
	);
};

export default SyncPlayGlobalOverlays;
