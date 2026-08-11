import Slider from '@enact/sandstone/Slider';
import BodyText from '@enact/sandstone/BodyText';
import Button from '../../../components/BreezyButton';
import {formatPlaybackTime, getPlayerHeaderTitle} from '../utils/playerPanelHelpers';
import css from '../../PlayerPanel.module.less';

const PlayerControlsOverlay = ({
	state,
	actions,
	refs
}) => {
	const {
		show,
		loading,
		error,
		item,
		currentTime,
		duration,
		hasPreviousEpisode,
		playing,
		hasNextEpisode,
		audioTracks,
		subtitleTracks,
		muted,
		volume,
		debugOverlayEnabled,
		debugOverlayVisible,
		syncPlayGroup,
		watchPartyAvailable,
		watchPartyRoom,
		actionsLocked = false
	} = state;
	const {
		handleBackButton,
		handleSeek,
		handlePlayPreviousEpisode,
		handlePause,
		handlePlay,
		handlePlayNextEpisode,
		openAudioPopup,
		openSubtitlePopup,
		toggleMute,
		handleVolumeChange,
		handleToggleDebugOverlay,
		openSyncPlayPopup,
		openWatchPartyPopup
	} = actions;
	const {controlsRef, playPauseButtonRef} = refs;

	if (!show || (loading && !actionsLocked) || error) return null;

	return (
		<div className={css.controls} ref={controlsRef}>
			<div className={css.topBar}>
				<Button
					onClick={handleBackButton}
					size="large"
					icon="arrowlargeleft"
					className={css.playerBackButton}
				/>
				{debugOverlayEnabled && (
					<Button
						onClick={handleToggleDebugOverlay}
						size="small"
						className={css.playerDebugToggleButton}
						disabled={actionsLocked}
					>
						{debugOverlayVisible ? 'Hide Debug' : 'Show Debug'}
					</Button>
				)}
				<BodyText className={css.title}>{getPlayerHeaderTitle(item)}</BodyText>
			</div>

			<div className={css.bottomBar} data-player-actions-locked={actionsLocked ? 'true' : undefined}>
				<div className={css.progressContainer} data-seekable="true">
					<BodyText className={css.time}>
						{formatPlaybackTime(currentTime)}
					</BodyText>
					<Slider
						className={css.progressSlider}
						min={0}
						max={Math.floor(duration) || 1}
						step={1}
						value={Math.floor(currentTime)}
						onChange={handleSeek}
						disabled={actionsLocked}
						data-seekable="true"
						data-player-progress-slider="true"
					/>
					<BodyText className={css.time}>
						-{formatPlaybackTime(Math.max(0, duration - currentTime))}
					</BodyText>
				</div>

				<div className={css.controlButtons}>
					{item?.Type === 'Episode' && (
						<Button
							onClick={handlePlayPreviousEpisode}
							size="large"
							icon="jumpbackward"
							disabled={actionsLocked || !hasPreviousEpisode}
							className={css.playerControlButton}
						/>
					)}

					{playing ? (
						<Button
							spotlightId="player-primary-playback-action"
							onClick={handlePause}
							disabled={actionsLocked}
							size="large"
							icon="pause"
							componentRef={playPauseButtonRef}
							className={css.playerControlButton}
						/>
					) : (
						<Button
							spotlightId="player-primary-playback-action"
							onClick={handlePlay}
							disabled={actionsLocked}
							size="large"
							icon="play"
							componentRef={playPauseButtonRef}
							className={css.playerControlButton}
						/>
					)}

					{item?.Type === 'Episode' && (
						<Button
							onClick={handlePlayNextEpisode}
							size="large"
							icon="jumpforward"
							disabled={actionsLocked || !hasNextEpisode}
							className={css.playerControlButton}
						/>
					)}

					<div className={css.trackButtons}>
						{watchPartyAvailable ? (
							<Button
								size="small"
								onClick={openWatchPartyPopup}
								disabled={actionsLocked}
								className={css.playerControlButton}
							>
								{watchPartyRoom ? 'Watch Party' : 'Parties'}
							</Button>
						) : null}
						{syncPlayGroup ? (
							<Button
								size="small"
								icon="dlna"
								aria-label="SyncPlay"
								onClick={openSyncPlayPopup}
								disabled={actionsLocked}
								className={css.playerControlButton}
							/>
						) : null}
						{audioTracks.length > 1 && (
							<Button
								size="small"
								icon="speaker"
								onClick={openAudioPopup}
								disabled={actionsLocked}
								className={css.playerControlButton}
							/>
						)}
						{subtitleTracks.length > 0 && (
							<Button
								size="small"
								icon="subtitle"
								onClick={openSubtitlePopup}
								disabled={actionsLocked}
								className={css.playerControlButton}
							/>
						)}
					</div>

					<div className={css.volumeControl}>
						<Button
							size="small"
							icon={muted || volume === 0 ? 'soundmute' : 'sound'}
							onClick={toggleMute}
							disabled={actionsLocked}
							className={css.playerControlButton}
						/>
						<Slider
							className={css.volumeSlider}
							min={0}
							max={100}
							value={muted ? 0 : volume}
							onChange={handleVolumeChange}
							disabled={actionsLocked}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PlayerControlsOverlay;
