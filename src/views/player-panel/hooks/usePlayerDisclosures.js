import {useDisclosureHandlers} from '../../../hooks/useDisclosureHandlers';
import {useDisclosureMap} from '../../../hooks/useDisclosureMap';

const PLAYER_DISCLOSURE_KEYS = {
	AUDIO_TRACKS: 'audioTracksPopup',
	SUBTITLE_TRACKS: 'subtitleTracksPopup'
};
const INITIAL_PLAYER_DISCLOSURES = {
	[PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS]: false,
	[PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS]: false
};
const PLAYER_DISCLOSURE_KEY_LIST = [
	PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS,
	PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS
];

export const usePlayerDisclosures = () => {
	const {
		disclosures,
		openDisclosure,
		closeDisclosure
	} = useDisclosureMap(INITIAL_PLAYER_DISCLOSURES);
	const disclosureHandlers = useDisclosureHandlers(
		PLAYER_DISCLOSURE_KEY_LIST,
		openDisclosure,
		closeDisclosure
	);

	return {
		showAudioPopup: disclosures[PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS] === true,
		showSubtitlePopup: disclosures[PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS] === true,
		openAudioPopup: disclosureHandlers[PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS].open,
		closeAudioPopup: disclosureHandlers[PLAYER_DISCLOSURE_KEYS.AUDIO_TRACKS].close,
		openSubtitlePopup: disclosureHandlers[PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS].open,
		closeSubtitlePopup: disclosureHandlers[PLAYER_DISCLOSURE_KEYS.SUBTITLE_TRACKS].close
	};
};

