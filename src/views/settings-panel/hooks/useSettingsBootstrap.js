import {useCallback, useEffect, useState} from 'react';

import {HOME_ROW_ORDER} from '../../../constants/homeRows';
import jellyfinService from '../../../services/jellyfinService';
import {configureAppDiagnostics, getAppLogs, isVerboseLoggingEnabled} from '../../../utils/appLogger';
import {getAppVersion, loadAppVersion} from '../../../utils/appInfo';
import {readBreezyfinSettings} from '../../../utils/settingsStorage';
import {setRuntimeCapabilityProbeRefreshDays} from '../../../utils/platformCapabilities';
import {
	ASS_SUBTITLE_RENDERER_OPTIONS,
	BITMAP_SUBTITLE_RENDERER_OPTIONS,
	DEFAULT_SETTINGS,
	SCREENSAVER_TIMEOUT_OPTIONS,
	SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS,
	SUBTITLE_OVERLAY_BACKGROUND_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS,
	SUBTITLE_OVERLAY_FONT_SIZE_RANGE,
	SUBTITLE_OVERLAY_OUTLINE_SIZE_OPTIONS,
	SUBTITLE_OVERLAY_OUTLINE_SIZE_LEGACY_PX,
	SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE,
	SUBTITLE_OVERLAY_POSITION_OPTIONS,
	SUBTITLE_OVERLAY_SHADOW_ANGLE_OPTIONS,
	SUBTITLE_OVERLAY_SHADOW_DISTANCE_OPTIONS,
	SUBTITLE_OVERLAY_SIZE_LEGACY_PX,
	SUBTITLE_OVERLAY_SIZE_OPTIONS,
	SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_WEIGHT_OPTIONS
} from '../constants';
import {normalizeNumericSetting} from '../../../utils/subtitleAppearance';

const normalizeOptionValue = (value, options, fallback) => {
	return options.some((option) => option.value === value) ? value : fallback;
};

export const useSettingsBootstrap = ({
	setSettings,
	normalizeCapabilityProbeRefreshDaysSetting,
	assSubtitleRendererOptions = ASS_SUBTITLE_RENDERER_OPTIONS,
	bitmapSubtitleRendererOptions = BITMAP_SUBTITLE_RENDERER_OPTIONS
}) => {
	const [appVersion, setAppVersion] = useState(getAppVersion());
	const [serverInfo, setServerInfo] = useState(null);
	const [userInfo, setUserInfo] = useState(null);
	const [loading, setLoading] = useState(true);
	const [savedServers, setSavedServers] = useState([]);
	const [appLogCount, setAppLogCount] = useState(0);

	const loadSettings = useCallback(() => {
		try {
			const parsed = readBreezyfinSettings();
			const parsedWithoutLegacyFmp4Preference = {...parsed};
			delete parsedWithoutLegacyFmp4Preference.preferDolbyVisionMp4;
			const normalizedOrder = Array.isArray(parsed.homeRowOrder)
				? parsed.homeRowOrder.filter((key) => HOME_ROW_ORDER.includes(key))
				: [];
			const resolvedOrder = [
				...normalizedOrder,
				...HOME_ROW_ORDER.filter((key) => !normalizedOrder.includes(key))
			];
			const capabilityProbeRefreshDays = normalizeCapabilityProbeRefreshDaysSetting(parsed.capabilityProbeRefreshDays);
			const subtitleBurnInTextCodecs = Array.isArray(parsed.subtitleBurnInTextCodecs)
				? parsed.subtitleBurnInTextCodecs
					.map((codec) => String(codec || '').trim().toLowerCase())
					.filter((codec) => SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS.some((option) => option.value === codec))
				: DEFAULT_SETTINGS.subtitleBurnInTextCodecs;
			const assSubtitleRenderer = normalizeOptionValue(
				parsed.assSubtitleRenderer,
				assSubtitleRendererOptions,
				DEFAULT_SETTINGS.assSubtitleRenderer
			);
			const bitmapSubtitleRenderer = normalizeOptionValue(
				parsed.bitmapSubtitleRenderer,
				bitmapSubtitleRendererOptions,
				DEFAULT_SETTINGS.bitmapSubtitleRenderer
			);
			const screensaverTimeoutMinutes = normalizeOptionValue(
				String(parsed.screensaverTimeoutMinutes || ''),
				SCREENSAVER_TIMEOUT_OPTIONS,
				DEFAULT_SETTINGS.screensaverTimeoutMinutes
			);
			const hasEnableFmp4Preference = typeof parsed.enableFmp4HlsContainerPreference === 'boolean';
			const hasForceFmp4Preference = typeof parsed.forceFmp4HlsContainerPreference === 'boolean';
			const legacyPreferFmp4Preference = typeof parsed.preferDolbyVisionMp4 === 'boolean'
				? parsed.preferDolbyVisionMp4
				: undefined;
			const enableFmp4HlsContainerPreference = hasEnableFmp4Preference
				? parsed.enableFmp4HlsContainerPreference
				: (legacyPreferFmp4Preference ?? DEFAULT_SETTINGS.enableFmp4HlsContainerPreference);
			const forceFmp4HlsContainerPreferenceRaw = hasForceFmp4Preference
				? parsed.forceFmp4HlsContainerPreference
				: DEFAULT_SETTINGS.forceFmp4HlsContainerPreference;
			const forceFmp4HlsContainerPreference =
				forceFmp4HlsContainerPreferenceRaw === true && enableFmp4HlsContainerPreference === true;
			const subtitleOverlaySize = normalizeOptionValue(
				parsed.subtitleOverlaySize,
				SUBTITLE_OVERLAY_SIZE_OPTIONS,
				DEFAULT_SETTINGS.subtitleOverlaySize
			);
			const subtitleOverlayFontSizePx = normalizeNumericSetting(
				parsed.subtitleOverlayFontSizePx || SUBTITLE_OVERLAY_SIZE_LEGACY_PX[subtitleOverlaySize],
				SUBTITLE_OVERLAY_FONT_SIZE_RANGE
			);
			const subtitleOverlayPosition = normalizeOptionValue(
				parsed.subtitleOverlayPosition,
				SUBTITLE_OVERLAY_POSITION_OPTIONS,
				DEFAULT_SETTINGS.subtitleOverlayPosition
			);
			const subtitleOverlayBackground = normalizeOptionValue(
				parsed.subtitleOverlayBackground,
				SUBTITLE_OVERLAY_BACKGROUND_OPTIONS,
				DEFAULT_SETTINGS.subtitleOverlayBackground
			);
			const subtitleOverlayWeight = normalizeOptionValue(
				parsed.subtitleOverlayWeight,
				SUBTITLE_OVERLAY_WEIGHT_OPTIONS,
				DEFAULT_SETTINGS.subtitleOverlayWeight
			);
			const subtitleOverlayTextColor = normalizeOptionValue(
				parsed.subtitleOverlayTextColor,
				SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS,
				DEFAULT_SETTINGS.subtitleOverlayTextColor
			);
			const subtitleOverlayBorderStyle = normalizeOptionValue(
				parsed.subtitleOverlayBorderStyle,
				SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS,
				DEFAULT_SETTINGS.subtitleOverlayBorderStyle
			);
			const subtitleOverlayBorderColor = normalizeOptionValue(
				parsed.subtitleOverlayBorderColor,
				SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS,
				DEFAULT_SETTINGS.subtitleOverlayBorderColor
			);
			const subtitleOverlayBorderStrength = normalizeOptionValue(
				parsed.subtitleOverlayBorderStrength,
				SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS,
				DEFAULT_SETTINGS.subtitleOverlayBorderStrength
			);
			const subtitleOverlayOutlineSize = normalizeOptionValue(
				parsed.subtitleOverlayOutlineSize,
				SUBTITLE_OVERLAY_OUTLINE_SIZE_OPTIONS,
				DEFAULT_SETTINGS.subtitleOverlayOutlineSize
			);
			const subtitleOverlayOutlineSizePx = normalizeNumericSetting(
				parsed.subtitleOverlayOutlineSizePx || SUBTITLE_OVERLAY_OUTLINE_SIZE_LEGACY_PX[subtitleOverlayOutlineSize],
				SUBTITLE_OVERLAY_OUTLINE_SIZE_RANGE
			);
			const subtitleOverlayShadowDistance = normalizeOptionValue(
				parsed.subtitleOverlayShadowDistance,
				SUBTITLE_OVERLAY_SHADOW_DISTANCE_OPTIONS,
				DEFAULT_SETTINGS.subtitleOverlayShadowDistance
			);
			const subtitleOverlayShadowAngle = normalizeOptionValue(
				parsed.subtitleOverlayShadowAngle,
				SUBTITLE_OVERLAY_SHADOW_ANGLE_OPTIONS,
				DEFAULT_SETTINGS.subtitleOverlayShadowAngle
			);
			const verboseAppLogs = parsed.verboseAppLogs === true || isVerboseLoggingEnabled();
			const enableDiagnostics = parsed.enableDiagnostics === true;
			configureAppDiagnostics({enabled: enableDiagnostics, verbose: verboseAppLogs});
			setRuntimeCapabilityProbeRefreshDays(capabilityProbeRefreshDays);
			setSettings({
				...DEFAULT_SETTINGS,
				...parsedWithoutLegacyFmp4Preference,
				capabilityProbeRefreshDays,
				assSubtitleRenderer,
				bitmapSubtitleRenderer,
				screensaverTimeoutMinutes,
				subtitleBurnInTextCodecs,
				subtitleOverlaySize,
				subtitleOverlayFontSizePx,
				subtitleOverlayPosition,
				subtitleOverlayBackground,
				subtitleOverlayWeight,
				subtitleOverlayTextColor,
				subtitleOverlayBorderStyle,
				subtitleOverlayBorderColor,
				subtitleOverlayBorderStrength,
				subtitleOverlayOutlineSize,
				subtitleOverlayOutlineSizePx,
				subtitleOverlayShadowDistance,
				subtitleOverlayShadowAngle,
				enableFmp4HlsContainerPreference,
				forceFmp4HlsContainerPreference,
					verboseAppLogs,
					enableDiagnostics,
				homeRows: {
					...DEFAULT_SETTINGS.homeRows,
					...(parsed.homeRows || {})
				},
				homeRowOrder: resolvedOrder
			});
		} catch (error) {
			console.error('Failed to load settings:', error);
		}
	}, [assSubtitleRendererOptions, bitmapSubtitleRendererOptions, normalizeCapabilityProbeRefreshDaysSetting, setSettings]);

	const loadServerInfo = useCallback(async () => {
		setLoading(true);
		try {
			const [server, user] = await Promise.all([
				jellyfinService.getPublicServerInfo(),
				jellyfinService.getCurrentUser()
			]);
			setServerInfo(server);
			setUserInfo(user);
		} catch (error) {
			console.error('Failed to load server info:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	const refreshSavedServers = useCallback(() => {
		try {
			setSavedServers(jellyfinService.getSavedServers() || []);
		} catch (error) {
			console.error('Failed to fetch saved servers:', error);
		}
	}, []);

	const refreshAppLogCount = useCallback(() => {
		setAppLogCount(getAppLogs().length);
	}, []);

	useEffect(() => {
		loadSettings();
		loadServerInfo();
		refreshSavedServers();
		refreshAppLogCount();
	}, [loadServerInfo, loadSettings, refreshSavedServers, refreshAppLogCount]);

	useEffect(() => {
		let cancelled = false;
		loadAppVersion().then((resolvedVersion) => {
			if (!cancelled && resolvedVersion) {
				setAppVersion(resolvedVersion);
			}
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return {
		appVersion,
		serverInfo,
		userInfo,
		loading,
		savedServers,
		appLogCount,
		setAppLogCount,
		loadServerInfo,
		refreshSavedServers
	};
};
