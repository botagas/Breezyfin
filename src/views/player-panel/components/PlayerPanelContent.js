import PlayerControlsOverlay from './PlayerControlsOverlay';
import PlayerDebugOverlay from './PlayerDebugOverlay';
import PlayerErrorPopup from './PlayerErrorPopup';
import PlayerMediaSurface from './PlayerMediaSurface';
import PlayerSkipOverlay from './PlayerSkipOverlay';
import PlayerPlaybackDecisionPrompt from './PlayerPlaybackDecisionPrompt';
import PlayerToast from './PlayerToast';
import PlayerTrackPopups from './PlayerTrackPopups';
import ScreensaverOverlay from '../../../components/ScreensaverOverlay';
import PlayerSyncPlayPopup from './PlayerSyncPlayPopup';
import PlayerWatchPartyPopup from './PlayerWatchPartyPopup';

import css from '../../PlayerPanel.module.less';

const PlayerPanelContent = ({
	controls,
	debugOverlay,
	errorPopup,
	mediaSurface,
	pausedScreensaver,
	skipOverlay,
	startupStatus,
	playbackDecision,
	toast,
	trackPopups,
	syncPlay,
	watchParty
}) => (
	<div className={css.playerContainer} data-playback-startup-status={startupStatus}>
		<PlayerMediaSurface {...mediaSurface} />
		<PlayerErrorPopup {...errorPopup} />
		<PlayerSkipOverlay {...skipOverlay} />
			<PlayerPlaybackDecisionPrompt {...playbackDecision} />
		<PlayerToast {...toast} />
		<PlayerDebugOverlay {...debugOverlay} />
		<PlayerControlsOverlay {...controls} />
		<PlayerTrackPopups {...trackPopups} />
		<PlayerSyncPlayPopup {...syncPlay} />
		<PlayerWatchPartyPopup {...watchParty} />
		<ScreensaverOverlay {...pausedScreensaver} />
	</div>
);

export default PlayerPanelContent;
