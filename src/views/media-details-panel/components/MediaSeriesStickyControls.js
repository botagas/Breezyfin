import Button from '../../../components/BreezyButton';
import css from '../../MediaDetailsPanel.module.less';
import MediaTrackSelectorRow from './MediaTrackSelectorRow';

const MediaSeriesStickyControls = ({
	showControls,
	isSidewaysEpisodeLayout,
	selectedEpisode,
	onOpenEpisodePicker,
	episodeSelectorButtonRef,
	onEpisodeSelectorKeyDown,
	audioTracks,
	subtitleTracks,
	onOpenAudioPicker,
	onOpenSubtitlePicker,
	audioSummary,
	subtitleSummary,
	onPlay,
	seriesPlayLabel
}) => {
	if (!showControls || !selectedEpisode) return null;

	return (
		<div className={`${css.stickyControls} ${isSidewaysEpisodeLayout ? css.stickyControlsInline : ''}`}>
			<div className={css.controlsMain}>
				<Button
					size="large"
					onClick={onOpenEpisodePicker}
					className={`${css.dropdown} ${css.episodeSelectorButton}`}
					componentRef={episodeSelectorButtonRef}
					spotlightId="episode-selector-button"
					onKeyDown={onEpisodeSelectorKeyDown}
				>
					Episode {selectedEpisode.IndexNumber}: {selectedEpisode.Name}
				</Button>
			</div>

			<div className={css.controlsActions}>
				<MediaTrackSelectorRow
					audioTracks={audioTracks}
					subtitleTracks={subtitleTracks}
					onOpenAudioPicker={onOpenAudioPicker}
					onOpenSubtitlePicker={onOpenSubtitlePicker}
					audioSummary={audioSummary}
					subtitleSummary={subtitleSummary}
				/>
			</div>

			<Button
				size="small"
				icon="play"
				className={css.primaryButton}
				onClick={onPlay}
			>
				{seriesPlayLabel}
			</Button>
		</div>
	);
};

export default MediaSeriesStickyControls;
