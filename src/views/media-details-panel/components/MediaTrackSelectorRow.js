import MediaTrackSelectorButton from './MediaTrackSelectorButton';

const MediaTrackSelectorRow = ({
	audioTracks,
	subtitleTracks,
	onOpenAudioPicker,
	onOpenSubtitlePicker,
	audioSummary,
	subtitleSummary,
	audioSelectorButtonRef,
	subtitleSelectorButtonRef,
	onAudioSelectorKeyDown,
	onSubtitleSelectorKeyDown
}) => {
	return (
		<>
			{audioTracks.length > 0 && (
				<MediaTrackSelectorButton
					icon="speaker"
					onClick={onOpenAudioPicker}
					label={audioSummary}
					ariaLabel={`Audio track ${audioSummary}`}
					componentRef={audioSelectorButtonRef}
					onKeyDown={onAudioSelectorKeyDown}
				/>
			)}
			{subtitleTracks.length > 1 && (
				<MediaTrackSelectorButton
					icon="subtitle"
					onClick={onOpenSubtitlePicker}
					label={subtitleSummary}
					ariaLabel={`Subtitle track ${subtitleSummary}`}
					componentRef={subtitleSelectorButtonRef}
					onKeyDown={onSubtitleSelectorKeyDown}
				/>
			)}
		</>
	);
};

export default MediaTrackSelectorRow;
