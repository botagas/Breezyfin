import PlayerControlsOverlay from './PlayerControlsOverlay';
import PlayerDebugOverlay from './PlayerDebugOverlay';
import PlayerErrorPopup from './PlayerErrorPopup';
import PlayerMediaSurface from './PlayerMediaSurface';
import PlayerSkipOverlay from './PlayerSkipOverlay';
import PlayerSubtitleBurnInPrompt from './PlayerSubtitleBurnInPrompt';
import PlayerToast from './PlayerToast';
import PlayerTrackPopups from './PlayerTrackPopups';
import ScreensaverOverlay from '../../../components/ScreensaverOverlay';

import css from '../../PlayerPanel.module.less';

const PlayerPanelContent = ({
	controls,
	debugOverlay,
	errorPopup,
	mediaSurface,
	pausedScreensaver,
	skipOverlay,
	startupStatus,
	subtitlePrompt,
	toast,
	trackPopups
}) => (
	<div className={css.playerContainer} data-playback-startup-status={startupStatus}>
		<PlayerMediaSurface {...mediaSurface} />
		<PlayerErrorPopup {...errorPopup} />
		<PlayerSkipOverlay {...skipOverlay} />
		<PlayerSubtitleBurnInPrompt {...subtitlePrompt} />
		<PlayerToast {...toast} />
		<PlayerDebugOverlay {...debugOverlay} />
		<PlayerControlsOverlay {...controls} />
		<PlayerTrackPopups {...trackPopups} />
		<ScreensaverOverlay {...pausedScreensaver} />
	</div>
);

export default PlayerPanelContent;
