import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Button from '../../../components/BreezyButton';
import {popupShellCss} from '../../../styles/popupStyles';

const PlayerSyncPlayPopup = ({open, group, onClose, onLeave}) => (
	<Popup open={open} onClose={onClose} css={popupShellCss}>
		<div>
			<BodyText>{group?.GroupName || 'SyncPlay'}</BodyText>
			<BodyText>Status: {group?.State || 'Unknown'}</BodyText>
			<BodyText>Participants: {(group?.Participants || []).length}</BodyText>
			{(group?.Participants || []).map((participant) => (
				<BodyText key={participant}>{participant}</BodyText>
			))}
			<Button onClick={onLeave}>Leave SyncPlay</Button>
		</div>
	</Popup>
);

export default PlayerSyncPlayPopup;
