import Popup from '@enact/sandstone/Popup';
import Heading from '@enact/sandstone/Heading';
import Button from '../../../components/BreezyButton';
import Scroller from '../../../components/AppScroller';
import css from '../../MediaDetailsPanel.module.less';
import popupStyles from '../../../styles/popupStyles.module.less';
import {popupShellCss} from '../../../styles/popupStyles';

const MediaTrackPickerPopup = ({
	open,
	onClose,
	type,
	tracks,
	selectedKey,
	onTrackSelect
}) => {
	const isAudio = type === 'audio';
	const trackOptions = tracks.map((track) => (
		<Button
			key={track.key}
			data-track-key={track.key}
			data-track-type={type}
			size="large"
			selected={track.key === selectedKey}
			onClick={onTrackSelect}
			className={css.popupButton}
		>
			{track.children}
		</Button>
	));

	return (
		<Popup
			open={open}
			onClose={onClose}
			noAutoDismiss
			css={popupShellCss}
		>
			<div className={`${popupStyles.popupSurface} ${css.popupSurface}`}>
				<Heading size="medium" spacing="none" className={css.popupHeading}>
					Select {isAudio ? 'Audio' : 'Subtitle'} Track
				</Heading>
				<Scroller className={css.popupScroller}>
					<div className={css.popupList}>{trackOptions}</div>
				</Scroller>
			</div>
		</Popup>
	);
};

export default MediaTrackPickerPopup;
