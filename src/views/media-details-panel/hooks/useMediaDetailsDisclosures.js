import {useDisclosureHandlers} from '../../../hooks/useDisclosureHandlers';
import {useDisclosureMap} from '../../../hooks/useDisclosureMap';

const MEDIA_DETAILS_DISCLOSURE_KEYS = {
	AUDIO_PICKER: 'audioPickerPopup',
	SUBTITLE_PICKER: 'subtitlePickerPopup',
	EPISODE_PICKER: 'episodePickerPopup'
};
const INITIAL_MEDIA_DETAILS_DISCLOSURES = {
	[MEDIA_DETAILS_DISCLOSURE_KEYS.AUDIO_PICKER]: false,
	[MEDIA_DETAILS_DISCLOSURE_KEYS.SUBTITLE_PICKER]: false,
	[MEDIA_DETAILS_DISCLOSURE_KEYS.EPISODE_PICKER]: false
};
const MEDIA_DETAILS_DISCLOSURE_KEY_LIST = [
	MEDIA_DETAILS_DISCLOSURE_KEYS.AUDIO_PICKER,
	MEDIA_DETAILS_DISCLOSURE_KEYS.SUBTITLE_PICKER,
	MEDIA_DETAILS_DISCLOSURE_KEYS.EPISODE_PICKER
];

export const useMediaDetailsDisclosures = () => {
	const {
		disclosures,
		openDisclosure,
		closeDisclosure
	} = useDisclosureMap(INITIAL_MEDIA_DETAILS_DISCLOSURES);
	const disclosureHandlers = useDisclosureHandlers(
		MEDIA_DETAILS_DISCLOSURE_KEY_LIST,
		openDisclosure,
		closeDisclosure
	);

	return {
		showAudioPicker: disclosures[MEDIA_DETAILS_DISCLOSURE_KEYS.AUDIO_PICKER] === true,
		showSubtitlePicker: disclosures[MEDIA_DETAILS_DISCLOSURE_KEYS.SUBTITLE_PICKER] === true,
		showEpisodePicker: disclosures[MEDIA_DETAILS_DISCLOSURE_KEYS.EPISODE_PICKER] === true,
		openAudioPicker: disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.AUDIO_PICKER].open,
		closeAudioPicker: disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.AUDIO_PICKER].close,
		openSubtitlePicker: disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.SUBTITLE_PICKER].open,
		closeSubtitlePicker: disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.SUBTITLE_PICKER].close,
		openEpisodePicker: disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.EPISODE_PICKER].open,
		closeEpisodePicker: disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.EPISODE_PICKER].close
	};
};

