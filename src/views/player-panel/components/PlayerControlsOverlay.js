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
		volume
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
		handleVolumeChange
	} = actions;
	const {controlsRef, playPauseButtonRef} = refs;

	if (!show || loading || error) return null;

	return (
		<div className={css.controls} ref={controlsRef}>
			<div className={css.topBar}>
				<Button
					onClick={handleBackButton}
					size="large"
					icon="arrowlargeleft"
					className={css.playerBackButton}
				/>
				<BodyText className={css.title}>{getPlayerHeaderTitle(item)}</BodyText>
			</div>

			<div className={css.bottomBar}>
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
							disabled={!hasPreviousEpisode}
							className={css.playerControlButton}
						/>
					)}

					{playing ? (
						<Button
							onClick={handlePause}
							size="large"
							icon="pause"
							componentRef={playPauseButtonRef}
							className={css.playerControlButton}
						/>
					) : (
						<Button
							onClick={handlePlay}
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
							disabled={!hasNextEpisode}
							className={css.playerControlButton}
						/>
					)}

					<div className={css.trackButtons}>
						{audioTracks.length > 1 && (
							<Button
								size="small"
								icon="speaker"
								onClick={openAudioPopup}
								className={css.playerControlButton}
							/>
						)}
						{subtitleTracks.length > 0 && (
							<Button
								size="small"
								icon="subtitle"
								onClick={openSubtitlePopup}
								className={css.playerControlButton}
							/>
						)}
					</div>

					<div className={css.volumeControl}>
						<Button
							size="small"
							icon={muted || volume === 0 ? 'soundmute' : 'sound'}
							onClick={toggleMute}
							className={css.playerControlButton}
						/>
						<Slider
							className={css.volumeSlider}
							min={0}
							max={100}
							value={muted ? 0 : volume}
							onChange={handleVolumeChange}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PlayerControlsOverlay;
