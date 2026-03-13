import { useDisclosureMap } from '../../../hooks/useDisclosureMap';
import { useDisclosureHandlers } from '../../../hooks/useDisclosureHandlers';
import {
	INITIAL_SETTINGS_DISCLOSURES,
	SETTINGS_DISCLOSURE_KEYS,
	SETTINGS_DISCLOSURE_KEY_LIST
} from '../constants';

export const useSettingsDisclosures = () => {
	const {
		disclosures,
		openDisclosure,
		closeDisclosure
	} = useDisclosureMap(INITIAL_SETTINGS_DISCLOSURES);
	const disclosureHandlers = useDisclosureHandlers(
		SETTINGS_DISCLOSURE_KEY_LIST,
		openDisclosure,
		closeDisclosure
	);

	return {
		disclosures,
		openDisclosure,
		closeDisclosure,
		bitratePopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.BITRATE] === true,
		capabilityProbeRefreshPopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.CAPABILITY_PROBE_REFRESH] === true,
		audioLangPopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE] === true,
		subtitleLangPopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE] === true,
		subtitleBurnInTextCodecsPopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_BURN_IN_TEXT_CODECS] === true,
		navbarThemePopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME] === true,
		playNextPromptModePopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE] === true,
		logoutConfirmOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM] === true,
		logsPopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.LOGS] === true,
		wipeCacheConfirmOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM] === true,
		openBitratePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.BITRATE].open,
		closeBitratePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.BITRATE].close,
		openCapabilityProbeRefreshPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.CAPABILITY_PROBE_REFRESH].open,
		closeCapabilityProbeRefreshPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.CAPABILITY_PROBE_REFRESH].close,
		openAudioLangPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE].open,
		closeAudioLangPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE].close,
		openSubtitleLangPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE].open,
		closeSubtitleLangPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE].close,
		openSubtitleBurnInTextCodecsPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_BURN_IN_TEXT_CODECS].open,
		closeSubtitleBurnInTextCodecsPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_BURN_IN_TEXT_CODECS].close,
		openNavbarThemePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME].open,
		closeNavbarThemePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME].close,
		openLogoutConfirm: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM].open,
		closeLogoutConfirm: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM].close,
		closePlayNextPromptModePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE].close,
		closeLogsPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.LOGS].close
	};
};
