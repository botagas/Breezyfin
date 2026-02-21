import Popup from '@enact/sandstone/Popup';
import Heading from '@enact/sandstone/Heading';
import Button from '../../../components/BreezyButton';
import Scroller from '../../../components/AppScroller';
import css from '../../MediaDetailsPanel.module.less';
import popupStyles from '../../../styles/popupStyles.module.less';
import {popupShellCss} from '../../../styles/popupStyles';

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
		<Popup open={open} onClose={onClose} noAutoDismiss css={popupShellCss}>
			<div className={`${popupStyles.popupSurface} ${css.popupSurface}`}>
				<Heading size="medium" spacing="none" className={css.popupHeading}>
					Select Episode
				</Heading>
				<Scroller className={css.popupScroller}>
					<div className={css.popupList}>
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
					</div>
				</Scroller>
			</div>
		</Popup>
	);
};

export default MediaEpisodePickerPopup;
