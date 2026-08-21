import SelectionOptionButton from '../../../components/SelectionOptionButton';
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
	const trackOptions = tracks.map((track) => {
		const selected = track.key === selectedKey;
		return (
			<SelectionOptionButton
				key={track.key}
				data-track-key={track.key}
				data-track-type={type}
				size="large"
				selected={selected}
				onClick={onTrackSelect}
				className={css.popupButton}
			>
				{track.children}
			</SelectionOptionButton>
		);
	});

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
