import Button from '../../../components/BreezyButton';
import css from '../../MediaDetailsPanel.module.less';
import MediaOptionPickerPopup from './MediaOptionPickerPopup';

const MediaEpisodePickerPopup = ({
	open,
	onClose,
	isSeriesMode,
	episodes,
	selectedEpisodeId,
	currentItemId,
	onSelect
}) => {
	if (!episodes?.length) return null;

	return (
		<MediaOptionPickerPopup open={open} onClose={onClose} title="Select Episode">
			{episodes.map((episode) => (
				<Button
					key={episode.Id}
					data-episode-id={episode.Id}
					data-series-mode={isSeriesMode ? '1' : '0'}
					size="large"
					selected={isSeriesMode ? selectedEpisodeId === episode.Id : currentItemId === episode.Id}
					onClick={onSelect}
					className={css.popupButton}
				>
					Episode {episode.IndexNumber}: {episode.Name}
				</Button>
			))}
		</MediaOptionPickerPopup>
	);
};

export default MediaEpisodePickerPopup;
