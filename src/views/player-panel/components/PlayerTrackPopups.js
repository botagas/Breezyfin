import PlayerTrackPopup from './PlayerTrackPopup';

const PlayerTrackPopups = ({
	audioOpen,
	onAudioClose,
	audioTracks,
	currentAudioTrack,
	onAudioTrackClick,
	subtitleOpen,
	onSubtitleClose,
	subtitleTracks,
	currentSubtitleTrack,
	onSubtitleTrackClick,
	getTrackLabel
}) => (
	<>
		<PlayerTrackPopup
			open={audioOpen}
			onClose={onAudioClose}
			title="Audio Track"
			tracks={audioTracks}
			currentTrack={currentAudioTrack}
			onTrackClick={onAudioTrackClick}
			getTrackLabel={getTrackLabel}
		/>
		<PlayerTrackPopup
			open={subtitleOpen}
			onClose={onSubtitleClose}
			title="Subtitles"
			tracks={subtitleTracks}
			currentTrack={currentSubtitleTrack}
			onTrackClick={onSubtitleTrackClick}
			getTrackLabel={getTrackLabel}
			includeOffOption
			offLabel="Off"
		/>
	</>
);

export default PlayerTrackPopups;
