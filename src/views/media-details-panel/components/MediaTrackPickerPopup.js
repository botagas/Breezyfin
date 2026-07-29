import Button from '../../../components/BreezyButton';
import SelectionOptionContent, {selectionOptionSelectedClass} from '../../../components/SelectionOptionContent';
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
			<Button
				key={track.key}
				data-track-key={track.key}
				data-track-type={type}
				size="large"
				selected={selected}
				aria-current={selected ? 'true' : undefined}
				onClick={onTrackSelect}
				className={`${css.popupButton} ${selected ? selectionOptionSelectedClass : ''}`}
			>
				<SelectionOptionContent selected={selected}>
					{track.children}
				</SelectionOptionContent>
			</Button>
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
