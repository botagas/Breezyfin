import {useCallback, useMemo} from 'react';

import {writeBreezyfinSettings} from '../../../utils/settingsStorage';
import {
	SETTINGS_DISCLOSURE_KEYS,
	SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS,
	SUBTITLE_OVERLAY_BACKGROUND_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS,
	SUBTITLE_OVERLAY_POSITION_OPTIONS,
	SUBTITLE_OVERLAY_SIZE_OPTIONS,
	SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_WEIGHT_OPTIONS
} from '../constants';
import {getOptionLabel, getSubtitleBurnInTextCodecsLabel} from '../labels';

export const useSettingsOptionHandlers = ({
	settings,
	setSettings,
	handleSettingChange,
	openDisclosure,
	closeBitratePopup,
	closeCapabilityProbeRefreshPopup,
	closeAudioLangPopup,
	closeSubtitleLangPopup,
	closeSubtitleOverlaySizePopup,
	closeSubtitleOverlayPositionPopup,
	closeSubtitleOverlayBackgroundPopup,
	closeSubtitleOverlayWeightPopup,
	closeSubtitleOverlayTextColorPopup,
	closeSubtitleOverlayBorderStylePopup,
	closeSubtitleOverlayBorderColorPopup,
	closeSubtitleOverlayBorderStrengthPopup,
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
		if (settings.smartSubtitleTranscoding !== false) return;
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
	}, [setSettings, settings.smartSubtitleTranscoding]);

	const handleSubtitleOverlaySizeSelect = useCallback((event) => {
		const value = event.currentTarget.dataset.value;
		if (!SUBTITLE_OVERLAY_SIZE_OPTIONS.some((option) => option.value === value)) return;
		handleSettingChange('subtitleOverlaySize', value);
		closeSubtitleOverlaySizePopup();
	}, [closeSubtitleOverlaySizePopup, handleSettingChange]);

	const handleSubtitleOverlayPositionSelect = useCallback((event) => {
		const value = event.currentTarget.dataset.value;
		if (!SUBTITLE_OVERLAY_POSITION_OPTIONS.some((option) => option.value === value)) return;
		handleSettingChange('subtitleOverlayPosition', value);
		closeSubtitleOverlayPositionPopup();
	}, [closeSubtitleOverlayPositionPopup, handleSettingChange]);

	const handleSubtitleOverlayBackgroundSelect = useCallback((event) => {
		const value = event.currentTarget.dataset.value;
		if (!SUBTITLE_OVERLAY_BACKGROUND_OPTIONS.some((option) => option.value === value)) return;
		handleSettingChange('subtitleOverlayBackground', value);
		closeSubtitleOverlayBackgroundPopup();
	}, [closeSubtitleOverlayBackgroundPopup, handleSettingChange]);

	const handleSubtitleOverlayWeightSelect = useCallback((event) => {
		const value = event.currentTarget.dataset.value;
		if (!SUBTITLE_OVERLAY_WEIGHT_OPTIONS.some((option) => option.value === value)) return;
		handleSettingChange('subtitleOverlayWeight', value);
		closeSubtitleOverlayWeightPopup();
	}, [closeSubtitleOverlayWeightPopup, handleSettingChange]);

	const handleSubtitleOverlayTextColorSelect = useCallback((event) => {
		const value = event.currentTarget.dataset.value;
		if (!SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS.some((option) => option.value === value)) return;
		handleSettingChange('subtitleOverlayTextColor', value);
		closeSubtitleOverlayTextColorPopup();
	}, [closeSubtitleOverlayTextColorPopup, handleSettingChange]);

	const handleSubtitleOverlayBorderStyleSelect = useCallback((event) => {
		const value = event.currentTarget.dataset.value;
		if (!SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS.some((option) => option.value === value)) return;
		handleSettingChange('subtitleOverlayBorderStyle', value);
		closeSubtitleOverlayBorderStylePopup();
	}, [closeSubtitleOverlayBorderStylePopup, handleSettingChange]);

	const handleSubtitleOverlayBorderColorSelect = useCallback((event) => {
		const value = event.currentTarget.dataset.value;
		if (!SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS.some((option) => option.value === value)) return;
		handleSettingChange('subtitleOverlayBorderColor', value);
		closeSubtitleOverlayBorderColorPopup();
	}, [closeSubtitleOverlayBorderColorPopup, handleSettingChange]);

	const handleSubtitleOverlayBorderStrengthSelect = useCallback((event) => {
		const value = event.currentTarget.dataset.value;
		if (!SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS.some((option) => option.value === value)) return;
		handleSettingChange('subtitleOverlayBorderStrength', value);
		closeSubtitleOverlayBorderStrengthPopup();
	}, [closeSubtitleOverlayBorderStrengthPopup, handleSettingChange]);

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
	const subtitleOverlaySizeLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_SIZE_OPTIONS, settings.subtitleOverlaySize, 'Medium'),
		[settings.subtitleOverlaySize]
	);
	const subtitleOverlayPositionLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_POSITION_OPTIONS, settings.subtitleOverlayPosition, 'Standard'),
		[settings.subtitleOverlayPosition]
	);
	const subtitleOverlayBackgroundLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_BACKGROUND_OPTIONS, settings.subtitleOverlayBackground, 'Medium'),
		[settings.subtitleOverlayBackground]
	);
	const subtitleOverlayWeightLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_WEIGHT_OPTIONS, settings.subtitleOverlayWeight, 'Bold'),
		[settings.subtitleOverlayWeight]
	);
	const subtitleOverlayTextColorLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS, settings.subtitleOverlayTextColor, 'White'),
		[settings.subtitleOverlayTextColor]
	);
	const subtitleOverlayBorderStyleLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS, settings.subtitleOverlayBorderStyle, 'Shadow'),
		[settings.subtitleOverlayBorderStyle]
	);
	const subtitleOverlayBorderColorLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS, settings.subtitleOverlayBorderColor, 'Black'),
		[settings.subtitleOverlayBorderColor]
	);
	const subtitleOverlayBorderStrengthLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS, settings.subtitleOverlayBorderStrength, 'Medium'),
		[settings.subtitleOverlayBorderStrength]
	);

	return {
		openPlayNextPromptModePopup,
		handleNavbarThemeSelect,
		handleBitrateSelect,
		handleCapabilityProbeRefreshSelect,
		handleAudioLanguageSelect,
		handleSubtitleLanguageSelect,
		handleSubtitleBurnInTextCodecToggle,
		handleSubtitleOverlaySizeSelect,
		handleSubtitleOverlayPositionSelect,
		handleSubtitleOverlayBackgroundSelect,
		handleSubtitleOverlayWeightSelect,
		handleSubtitleOverlayTextColorSelect,
		handleSubtitleOverlayBorderStyleSelect,
		handleSubtitleOverlayBorderColorSelect,
		handleSubtitleOverlayBorderStrengthSelect,
		setSegmentsOnlyPromptMode,
		setSegmentsOrLast60PromptMode,
		subtitleBurnInTextCodecsLabel,
		subtitleOverlaySizeLabel,
		subtitleOverlayPositionLabel,
		subtitleOverlayBackgroundLabel,
		subtitleOverlayWeightLabel,
		subtitleOverlayTextColorLabel,
		subtitleOverlayBorderStyleLabel,
		subtitleOverlayBorderColorLabel,
		subtitleOverlayBorderStrengthLabel
	};
};
