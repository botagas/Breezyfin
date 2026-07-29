import {useCallback, useMemo} from 'react';

import {writeBreezyfinSettings} from '../../../utils/settingsStorage';
import {
	ASS_SUBTITLE_RENDERER_OPTIONS,
	BITMAP_SUBTITLE_RENDERER_OPTIONS,
	SCREENSAVER_TIMEOUT_OPTIONS,
	SETTINGS_DISCLOSURE_KEYS,
	SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS,
	SUBTITLE_OVERLAY_BACKGROUND_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS,
	SUBTITLE_OVERLAY_FONT_SIZE_RANGE,
	SUBTITLE_OVERLAY_POSITION_OPTIONS,
	SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE,
	SUBTITLE_OVERLAY_SHADOW_ANGLE_OPTIONS,
	SUBTITLE_OVERLAY_SHADOW_DISTANCE_OPTIONS,
	SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_WEIGHT_OPTIONS
} from '../constants';
import {getOptionLabel, getSubtitleBurnInTextCodecsLabel} from '../labels';
import {
	adjustNumericSetting,
	getNumericSettingLabel,
	normalizeNumericSetting
} from '../../../utils/subtitleAppearance';

export const useSettingsOptionHandlers = ({
	settings,
	setSettings,
	handleSettingChange,
	openDisclosure,
	closeBitratePopup,
	closeCapabilityProbeRefreshPopup,
	closeAudioLangPopup,
	closeSubtitleLangPopup,
	closeAssSubtitleRendererPopup,
	closeBitmapSubtitleRendererPopup,
	closeSubtitleOverlayPositionPopup,
	closeSubtitleOverlayBackgroundPopup,
	closeSubtitleOverlayWeightPopup,
	closeSubtitleOverlayTextColorPopup,
	closeSubtitleOverlayBorderStylePopup,
	closeSubtitleOverlayBorderColorPopup,
	closeSubtitleOverlayBorderStrengthPopup,
	closeSubtitleOverlayShadowDistancePopup,
	closeSubtitleOverlayShadowAnglePopup,
	closeNavbarThemePopup,
	closeScreensaverTimeoutPopup,
	closePlayNextPromptModePopup,
	normalizeCapabilityProbeRefreshDaysSetting,
	setRuntimeCapabilityProbeRefreshDays,
	setToastMessage,
	bumpCapabilitySnapshotVersion,
	getCapabilityProbeRefreshLabel,
	assSubtitleRendererOptions = ASS_SUBTITLE_RENDERER_OPTIONS,
	bitmapSubtitleRendererOptions = BITMAP_SUBTITLE_RENDERER_OPTIONS
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

	const handleScreensaverTimeoutSelect = useCallback((event) => {
		const value = event.currentTarget.dataset.value;
		if (!SCREENSAVER_TIMEOUT_OPTIONS.some((option) => option.value === value)) return;
		handleSettingChange('screensaverTimeoutMinutes', value);
		closeScreensaverTimeoutPopup();
	}, [closeScreensaverTimeoutPopup, handleSettingChange]);

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

	const handleAssSubtitleRendererSelect = useCallback((event) => {
		if (settings.smartSubtitleTranscoding === false) return;
		const value = event.currentTarget.dataset.value;
		if (!assSubtitleRendererOptions.some((option) => option.value === value)) return;
		handleSettingChange('assSubtitleRenderer', value);
		closeAssSubtitleRendererPopup();
	}, [assSubtitleRendererOptions, closeAssSubtitleRendererPopup, handleSettingChange, settings.smartSubtitleTranscoding]);

	const handleBitmapSubtitleRendererSelect = useCallback((event) => {
		if (settings.smartSubtitleTranscoding === false) return;
		const value = event.currentTarget.dataset.value;
		if (!bitmapSubtitleRendererOptions.some((option) => option.value === value)) return;
		handleSettingChange('bitmapSubtitleRenderer', value);
		closeBitmapSubtitleRendererPopup();
	}, [
		bitmapSubtitleRendererOptions,
		closeBitmapSubtitleRendererPopup,
		handleSettingChange,
		settings.smartSubtitleTranscoding
	]);

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

	const handleNumericSettingChange = useCallback((settingKey, range, direction) => {
		if (direction !== 'increase' && direction !== 'decrease') return;
		setSettings((prevSettings) => {
			const nextValue = adjustNumericSetting(prevSettings[settingKey], range, direction);
			if (String(prevSettings[settingKey]) === nextValue) return prevSettings;
			const updated = {
				...prevSettings,
				[settingKey]: nextValue
			};
			if (!writeBreezyfinSettings(updated)) {
				console.error(`Failed to save ${settingKey} setting`);
			}
			return updated;
		});
	}, [setSettings]);

	const handleNumericSettingReset = useCallback((settingKey, range) => {
		const nextValue = normalizeNumericSetting(range.defaultValue, range);
		setSettings((prevSettings) => {
			if (String(prevSettings[settingKey]) === nextValue) return prevSettings;
			const updated = {
				...prevSettings,
				[settingKey]: nextValue
			};
			if (!writeBreezyfinSettings(updated)) {
				console.error(`Failed to reset ${settingKey} setting`);
			}
			return updated;
		});
	}, [setSettings]);

	const handleSubtitleOverlayFontSizeDecrease = useCallback(() => {
		handleNumericSettingChange('subtitleOverlayFontSizePx', SUBTITLE_OVERLAY_FONT_SIZE_RANGE, 'decrease');
	}, [handleNumericSettingChange]);

	const handleSubtitleOverlayFontSizeIncrease = useCallback(() => {
		handleNumericSettingChange('subtitleOverlayFontSizePx', SUBTITLE_OVERLAY_FONT_SIZE_RANGE, 'increase');
	}, [handleNumericSettingChange]);

	const handleSubtitleOverlayFontSizeReset = useCallback(() => {
		handleNumericSettingReset('subtitleOverlayFontSizePx', SUBTITLE_OVERLAY_FONT_SIZE_RANGE);
	}, [handleNumericSettingReset]);

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

	const handleSubtitleOverlayOutlineSizeDecrease = useCallback(() => {
		handleNumericSettingChange('subtitleOverlayOutlineSizePx', SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE, 'decrease');
	}, [handleNumericSettingChange]);

	const handleSubtitleOverlayOutlineSizeIncrease = useCallback(() => {
		handleNumericSettingChange('subtitleOverlayOutlineSizePx', SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE, 'increase');
	}, [handleNumericSettingChange]);

	const handleSubtitleOverlayOutlineSizeReset = useCallback(() => {
		handleNumericSettingReset('subtitleOverlayOutlineSizePx', SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE);
	}, [handleNumericSettingReset]);

	const handleSubtitleOverlayShadowDistanceSelect = useCallback((event) => {
		const value = event.currentTarget.dataset.value;
		if (!SUBTITLE_OVERLAY_SHADOW_DISTANCE_OPTIONS.some((option) => option.value === value)) return;
		handleSettingChange('subtitleOverlayShadowDistance', value);
		closeSubtitleOverlayShadowDistancePopup();
	}, [closeSubtitleOverlayShadowDistancePopup, handleSettingChange]);

	const handleSubtitleOverlayShadowAngleSelect = useCallback((event) => {
		const value = event.currentTarget.dataset.value;
		if (!SUBTITLE_OVERLAY_SHADOW_ANGLE_OPTIONS.some((option) => option.value === value)) return;
		handleSettingChange('subtitleOverlayShadowAngle', value);
		closeSubtitleOverlayShadowAnglePopup();
	}, [closeSubtitleOverlayShadowAnglePopup, handleSettingChange]);

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
	const assSubtitleRendererLabel = useMemo(
		() => getOptionLabel(assSubtitleRendererOptions, settings.assSubtitleRenderer, 'Auto'),
		[assSubtitleRendererOptions, settings.assSubtitleRenderer]
	);
	const bitmapSubtitleRendererLabel = useMemo(
		() => getOptionLabel(bitmapSubtitleRendererOptions, settings.bitmapSubtitleRenderer, 'Auto'),
		[bitmapSubtitleRendererOptions, settings.bitmapSubtitleRenderer]
	);
	const subtitleOverlayFontSizeLabel = useMemo(
		() => getNumericSettingLabel(settings.subtitleOverlayFontSizePx, SUBTITLE_OVERLAY_FONT_SIZE_RANGE),
		[settings.subtitleOverlayFontSizePx]
	);
	const subtitleOverlayPositionLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_POSITION_OPTIONS, settings.subtitleOverlayPosition, 'Standard'),
		[settings.subtitleOverlayPosition]
	);
	const subtitleOverlayBackgroundLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_BACKGROUND_OPTIONS, settings.subtitleOverlayBackground, 'None'),
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
		() => getOptionLabel(SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS, settings.subtitleOverlayBorderStyle, 'Outline'),
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
	const subtitleOverlayOutlineSizeLabel = useMemo(
		() => getNumericSettingLabel(settings.subtitleOverlayOutlineSizePx, SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE),
		[settings.subtitleOverlayOutlineSizePx]
	);
	const subtitleOverlayShadowDistanceLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_SHADOW_DISTANCE_OPTIONS, settings.subtitleOverlayShadowDistance, 'Medium'),
		[settings.subtitleOverlayShadowDistance]
	);
	const subtitleOverlayShadowAngleLabel = useMemo(
		() => getOptionLabel(SUBTITLE_OVERLAY_SHADOW_ANGLE_OPTIONS, settings.subtitleOverlayShadowAngle, 'Down'),
		[settings.subtitleOverlayShadowAngle]
	);
	const screensaverTimeoutLabel = useMemo(
		() => getOptionLabel(
			SCREENSAVER_TIMEOUT_OPTIONS,
			settings.screensaverTimeoutMinutes,
			'1 minute'
		),
		[settings.screensaverTimeoutMinutes]
	);

	return {
		openPlayNextPromptModePopup,
		handleNavbarThemeSelect,
		handleScreensaverTimeoutSelect,
		handleBitrateSelect,
		handleCapabilityProbeRefreshSelect,
		handleAudioLanguageSelect,
		handleSubtitleLanguageSelect,
		handleAssSubtitleRendererSelect,
		handleBitmapSubtitleRendererSelect,
		handleSubtitleBurnInTextCodecToggle,
		handleSubtitleOverlayFontSizeDecrease,
		handleSubtitleOverlayFontSizeIncrease,
		handleSubtitleOverlayFontSizeReset,
		handleSubtitleOverlayPositionSelect,
		handleSubtitleOverlayBackgroundSelect,
		handleSubtitleOverlayWeightSelect,
		handleSubtitleOverlayTextColorSelect,
		handleSubtitleOverlayBorderStyleSelect,
		handleSubtitleOverlayBorderColorSelect,
		handleSubtitleOverlayBorderStrengthSelect,
		handleSubtitleOverlayOutlineSizeDecrease,
		handleSubtitleOverlayOutlineSizeIncrease,
		handleSubtitleOverlayOutlineSizeReset,
		handleSubtitleOverlayShadowDistanceSelect,
		handleSubtitleOverlayShadowAngleSelect,
		setSegmentsOnlyPromptMode,
		setSegmentsOrLast60PromptMode,
		subtitleBurnInTextCodecsLabel,
		assSubtitleRendererLabel,
		bitmapSubtitleRendererLabel,
		subtitleOverlayFontSizeLabel,
		subtitleOverlayPositionLabel,
		subtitleOverlayBackgroundLabel,
		subtitleOverlayWeightLabel,
		subtitleOverlayTextColorLabel,
		subtitleOverlayBorderStyleLabel,
		subtitleOverlayBorderColorLabel,
		subtitleOverlayBorderStrengthLabel,
		subtitleOverlayOutlineSizeLabel,
		subtitleOverlayShadowDistanceLabel,
		subtitleOverlayShadowAngleLabel,
		screensaverTimeoutLabel
	};
};
