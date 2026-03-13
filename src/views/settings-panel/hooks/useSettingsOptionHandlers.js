import {useCallback, useMemo} from 'react';

import {writeBreezyfinSettings} from '../../../utils/settingsStorage';
import {SETTINGS_DISCLOSURE_KEYS, SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS} from '../constants';
import {getSubtitleBurnInTextCodecsLabel} from '../labels';

export const useSettingsOptionHandlers = ({
	settings,
	setSettings,
	handleSettingChange,
	openDisclosure,
	closeBitratePopup,
	closeCapabilityProbeRefreshPopup,
	closeAudioLangPopup,
	closeSubtitleLangPopup,
	closeNavbarThemePopup,
	closePlayNextPromptModePopup,
	normalizeCapabilityProbeRefreshDaysSetting,
	setRuntimeCapabilityProbeRefreshDays,
	setToastMessage,
	bumpCapabilitySnapshotVersion,
	getCapabilityProbeRefreshLabel
}) => {
	const openPlayNextPromptModePopup = useCallback(() => {
		if (settings.showPlayNextPrompt !== false) {
			openDisclosure(SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE);
		}
	}, [openDisclosure, settings.showPlayNextPrompt]);

	const handleNavbarThemeSelect = useCallback((event) => {
		const themeValue = event.currentTarget.dataset.theme;
		if (!themeValue) return;
		handleSettingChange('navbarTheme', themeValue);
		closeNavbarThemePopup();
	}, [closeNavbarThemePopup, handleSettingChange]);

	const handleBitrateSelect = useCallback((event) => {
		const bitrate = event.currentTarget.dataset.bitrate;
		if (!bitrate) return;
		handleSettingChange('maxBitrate', bitrate);
		closeBitratePopup();
	}, [closeBitratePopup, handleSettingChange]);

	const handleCapabilityProbeRefreshSelect = useCallback((event) => {
		const daysValue = normalizeCapabilityProbeRefreshDaysSetting(event.currentTarget.dataset.days);
		handleSettingChange('capabilityProbeRefreshDays', daysValue);
		setRuntimeCapabilityProbeRefreshDays(daysValue);
		closeCapabilityProbeRefreshPopup();
		setToastMessage(`Capability refresh set to ${getCapabilityProbeRefreshLabel(daysValue)}.`);
		bumpCapabilitySnapshotVersion((version) => version + 1);
	}, [
		bumpCapabilitySnapshotVersion,
		closeCapabilityProbeRefreshPopup,
		getCapabilityProbeRefreshLabel,
		handleSettingChange,
		normalizeCapabilityProbeRefreshDaysSetting,
		setRuntimeCapabilityProbeRefreshDays,
		setToastMessage
	]);

	const handleAudioLanguageSelect = useCallback((event) => {
		const language = event.currentTarget.dataset.language;
		if (!language) return;
		handleSettingChange('preferredAudioLanguage', language);
		closeAudioLangPopup();
	}, [closeAudioLangPopup, handleSettingChange]);

	const handleSubtitleLanguageSelect = useCallback((event) => {
		const language = event.currentTarget.dataset.language;
		if (!language) return;
		handleSettingChange('preferredSubtitleLanguage', language);
		closeSubtitleLangPopup();
	}, [closeSubtitleLangPopup, handleSettingChange]);

	const handleSubtitleBurnInTextCodecToggle = useCallback((event) => {
		const codec = String(event.currentTarget.dataset.codec || '').trim().toLowerCase();
		if (!codec) return;
		if (!SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS.some((option) => option.value === codec)) return;
		setSettings((prevSettings) => {
			const previous = Array.isArray(prevSettings.subtitleBurnInTextCodecs)
				? prevSettings.subtitleBurnInTextCodecs
				: [];
			const next = previous.includes(codec)
				? previous.filter((value) => value !== codec)
				: [...previous, codec];
			const ordered = SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS
				.map((option) => option.value)
				.filter((value) => next.includes(value));
			const updated = {
				...prevSettings,
				subtitleBurnInTextCodecs: ordered
			};
			if (!writeBreezyfinSettings(updated)) {
				console.error('Failed to save subtitle burn-in format settings');
			}
			return updated;
		});
	}, [setSettings]);

	const setSegmentsOnlyPromptMode = useCallback(() => {
		handleSettingChange('playNextPromptMode', 'segmentsOnly');
		closePlayNextPromptModePopup();
	}, [closePlayNextPromptModePopup, handleSettingChange]);

	const setSegmentsOrLast60PromptMode = useCallback(() => {
		handleSettingChange('playNextPromptMode', 'segmentsOrLast60');
		closePlayNextPromptModePopup();
	}, [closePlayNextPromptModePopup, handleSettingChange]);

	const subtitleBurnInTextCodecsLabel = useMemo(() => {
		return getSubtitleBurnInTextCodecsLabel(
			settings.subtitleBurnInTextCodecs,
			SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS
		);
	}, [settings.subtitleBurnInTextCodecs]);

	return {
		openPlayNextPromptModePopup,
		handleNavbarThemeSelect,
		handleBitrateSelect,
		handleCapabilityProbeRefreshSelect,
		handleAudioLanguageSelect,
		handleSubtitleLanguageSelect,
		handleSubtitleBurnInTextCodecToggle,
		setSegmentsOnlyPromptMode,
		setSegmentsOrLast60PromptMode,
		subtitleBurnInTextCodecsLabel
	};
};
