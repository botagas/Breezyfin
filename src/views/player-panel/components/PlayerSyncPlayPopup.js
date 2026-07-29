import {useRef} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import {Header} from '../../../components/BreezyPanels';
import PanelActionButton from '../../../components/PanelActionButton';
import {usePopupInitialFocus} from '../../../hooks/usePopupInitialFocus';
import {popupShellCss} from '../../../styles/popupStyles';
import popupStyles from '../../../styles/popupStyles.module.less';

import css from './PlayerSyncPlayPopup.module.less';

const getParticipantName = (participant) => (
	typeof participant === 'string'
		? participant
		: participant?.DisplayName || participant?.Name || participant?.Username || 'Participant'
);

const getParticipantKey = (participant, index) => (
	typeof participant === 'string'
		? participant
		: participant?.ParticipantId || participant?.SessionId || `${getParticipantName(participant)}-${index}`
);

const PlayerSyncPlayPopup = ({open, group, groupState, onClose, onLeave, onStart}) => {
	const contentRef = useRef(null);
	usePopupInitialFocus(open, contentRef);
	const participants = Array.isArray(group?.Participants) ? group.Participants : [];
	const state = groupState?.state || group?.State || 'Unknown';
	const reason = groupState?.reason || group?.StateReason || '';
	const waiting = String(state).toLowerCase() === 'waiting';

	return (
		<Popup open={open} onClose={onClose} css={popupShellCss}>
			<div ref={contentRef} className={`${popupStyles.popupSurface} ${css.content}`}>
				<Header title={group?.GroupName || 'SyncPlay'} />
				<div className={css.statusGrid}>
					<BodyText>Status</BodyText>
					<BodyText>{state}</BodyText>
					{reason ? <BodyText>Reason</BodyText> : null}
					{reason ? <BodyText>{reason}</BodyText> : null}
					<BodyText>Participants</BodyText>
					<BodyText>{participants.length}</BodyText>
				</div>
				{participants.length > 0 ? (
					<div className={css.participants}>
						{participants.map((participant, index) => (
							<BodyText key={getParticipantKey(participant, index)}>
								{getParticipantName(participant)}
							</BodyText>
						))}
					</div>
				) : null}
				<div className={css.actions}>
					{waiting ? (
						<PanelActionButton onClick={onStart}>Start Group Playback</PanelActionButton>
					) : null}
					<PanelActionButton onClick={onLeave}>Leave SyncPlay</PanelActionButton>
					<PanelActionButton onClick={onClose}>Close</PanelActionButton>
				</div>
			</div>
		</Popup>
	);
};

export default PlayerSyncPlayPopup;
