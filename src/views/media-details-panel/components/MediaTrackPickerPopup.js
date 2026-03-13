import Button from '../../../components/BreezyButton';
import css from '../../MediaDetailsPanel.module.less';
import MediaOptionPickerPopup from './MediaOptionPickerPopup';

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
		<MediaOptionPickerPopup
			open={open}
			onClose={onClose}
			title={`Select ${isAudio ? 'Audio' : 'Subtitle'} Track`}
		>
			{trackOptions}
		</MediaOptionPickerPopup>
	);
};

export default MediaTrackPickerPopup;
