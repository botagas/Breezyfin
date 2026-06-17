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
		subtitleOverlaySizePopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_SIZE] === true,
		subtitleOverlayPositionPopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_POSITION] === true,
		subtitleOverlayBackgroundPopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BACKGROUND] === true,
		subtitleOverlayWeightPopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_WEIGHT] === true,
		subtitleOverlayTextColorPopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_TEXT_COLOR] === true,
		subtitleOverlayBorderStylePopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STYLE] === true,
		subtitleOverlayBorderColorPopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_COLOR] === true,
		subtitleOverlayBorderStrengthPopupOpen: disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STRENGTH] === true,
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
		openSubtitleOverlaySizePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_SIZE].open,
		closeSubtitleOverlaySizePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_SIZE].close,
		openSubtitleOverlayPositionPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_POSITION].open,
		closeSubtitleOverlayPositionPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_POSITION].close,
		openSubtitleOverlayBackgroundPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BACKGROUND].open,
		closeSubtitleOverlayBackgroundPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BACKGROUND].close,
		openSubtitleOverlayWeightPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_WEIGHT].open,
		closeSubtitleOverlayWeightPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_WEIGHT].close,
		openSubtitleOverlayTextColorPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_TEXT_COLOR].open,
		closeSubtitleOverlayTextColorPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_TEXT_COLOR].close,
		openSubtitleOverlayBorderStylePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STYLE].open,
		closeSubtitleOverlayBorderStylePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STYLE].close,
		openSubtitleOverlayBorderColorPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_COLOR].open,
		closeSubtitleOverlayBorderColorPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_COLOR].close,
		openSubtitleOverlayBorderStrengthPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STRENGTH].open,
		closeSubtitleOverlayBorderStrengthPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STRENGTH].close,
		openNavbarThemePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME].open,
		closeNavbarThemePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME].close,
		openLogoutConfirm: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM].open,
		closeLogoutConfirm: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM].close,
		closePlayNextPromptModePopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE].close,
		closeLogsPopup: disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.LOGS].close
	};
};
