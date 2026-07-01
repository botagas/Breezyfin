import { useState, useCallback, useMemo } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Scroller from '../components/AppScroller';
import jellyfinService from '../services/jellyfinService';
import SettingsToolbar from '../components/SettingsToolbar';
import { useMapById } from '../hooks/useMapById';
import { usePanelToolbarActions } from '../hooks/usePanelToolbarActions';
import { usePanelScrollState } from '../hooks/usePanelScrollState';
import { useToastMessage } from '../hooks/useToastMessage';
import { PANEL_TOAST_CONFIG } from '../constants/toast';
import {
	getRuntimePlatformCapabilities,
	setRuntimeCapabilityProbeRefreshDays
} from '../utils/platformCapabilities';
import {isNonStableBuild} from '../utils/featureFlags';
import BreezyToast from '../components/BreezyToast';
import {
	BITRATE_OPTIONS,
	CAPABILITY_PROBE_REFRESH_OPTIONS,
	DEFAULT_SETTINGS,
	LANGUAGE_OPTIONS,
	NAVBAR_THEME_OPTIONS,
	getAssSubtitleRendererOptions,
	SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS,
	SUBTITLE_OVERLAY_BACKGROUND_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS,
	SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS,
	SUBTITLE_OVERLAY_POSITION_OPTIONS,
	SUBTITLE_OVERLAY_SHADOW_ANGLE_OPTIONS,
	SUBTITLE_OVERLAY_SHADOW_DISTANCE_OPTIONS,
	SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS,
	SUBTITLE_OVERLAY_WEIGHT_OPTIONS
} from './settings-panel/constants';
import {
	getCapabilityProbeRefreshLabel,
	getHomeRowLabel,
	getPlayNextPromptModeLabel
} from './settings-panel/labels';
import {
	createCapabilityProbeRefreshNormalizer
} from './settings-panel/capabilityFormatting';
import { useRuntimeCapabilityLabels } from './settings-panel/hooks/useRuntimeCapabilityLabels';
import { useSettingsBootstrap } from './settings-panel/hooks/useSettingsBootstrap';
import { useSettingsDisclosures } from './settings-panel/hooks/useSettingsDisclosures';
import { useSettingsHomeRows } from './settings-panel/hooks/useSettingsHomeRows';
import { useSettingsOptionHandlers } from './settings-panel/hooks/useSettingsOptionHandlers';
import { useSettingsSystemHandlers } from './settings-panel/hooks/useSettingsSystemHandlers';
import { useSettingsToggleHandlers } from './settings-panel/hooks/useSettingsToggleHandlers';
import { useSettingsDisplayHandlers } from './settings-panel/hooks/useSettingsDisplayHandlers';

import css from './SettingsPanel.module.less';
import {popupShellCss} from '../styles/popupStyles';
import SettingsSections from './settings-panel/components/SettingsSections';
import SettingsPopups from './settings-panel/components/SettingsPopups';

const normalizeCapabilityProbeRefreshDaysSetting = createCapabilityProbeRefreshNormalizer(
	CAPABILITY_PROBE_REFRESH_OPTIONS,
	DEFAULT_SETTINGS.capabilityProbeRefreshDays
);
const SHOW_NON_STABLE_DEBUG_OPTIONS = isNonStableBuild();

const SettingsPanel = ({
	onNavigate,
	onSwitchUser,
	onLogout,
	onSignOut,
	onExit,
	registerBackHandler,
	isActive = false,
	cachedState = null,
	onCacheState = null,
	...rest
}) => {
	const [, bumpCapabilitySnapshotVersion] = useState(0);
	const runtimeCapabilities = getRuntimePlatformCapabilities();
	const [settings, setSettings] = useState(DEFAULT_SETTINGS);
	const assSubtitleRendererOptions = useMemo(
		() => getAssSubtitleRendererOptions(),
		[]
	);
	const [switchingServerId, setSwitchingServerId] = useState(null);
	const [appLogs, setAppLogs] = useState([]);
	const [cacheWipeInProgress, setCacheWipeInProgress] = useState(false);
	const [cacheWipeError, setCacheWipeError] = useState('');
	const {
		toastMessage,
		toastVisible,
		setToastMessage
	} = useToastMessage(PANEL_TOAST_CONFIG);
	const {
		disclosures,
		openDisclosure,
		closeDisclosure,
		bitratePopupOpen,
		capabilityProbeRefreshPopupOpen,
		audioLangPopupOpen,
		subtitleLangPopupOpen,
		subtitleBurnInTextCodecsPopupOpen,
		assSubtitleRendererPopupOpen,
		subtitleOverlaySizePopupOpen,
		subtitleOverlayPositionPopupOpen,
		subtitleOverlayBackgroundPopupOpen,
		subtitleOverlayWeightPopupOpen,
		subtitleOverlayTextColorPopupOpen,
		subtitleOverlayBorderStylePopupOpen,
		subtitleOverlayBorderColorPopupOpen,
		subtitleOverlayBorderStrengthPopupOpen,
		subtitleOverlayOutlineSizePopupOpen,
		subtitleOverlayShadowDistancePopupOpen,
		subtitleOverlayShadowAnglePopupOpen,
		navbarThemePopupOpen,
		playNextPromptModePopupOpen,
		logoutConfirmOpen,
		logsPopupOpen,
		wipeCacheConfirmOpen,
		openBitratePopup,
		closeBitratePopup,
		openCapabilityProbeRefreshPopup,
		closeCapabilityProbeRefreshPopup,
		openAudioLangPopup,
		closeAudioLangPopup,
		openSubtitleLangPopup,
		closeSubtitleLangPopup,
		openSubtitleBurnInTextCodecsPopup,
		closeSubtitleBurnInTextCodecsPopup,
		openAssSubtitleRendererPopup,
		closeAssSubtitleRendererPopup,
		openSubtitleOverlaySizePopup,
		closeSubtitleOverlaySizePopup,
		openSubtitleOverlayPositionPopup,
		closeSubtitleOverlayPositionPopup,
		openSubtitleOverlayBackgroundPopup,
		closeSubtitleOverlayBackgroundPopup,
		openSubtitleOverlayWeightPopup,
		closeSubtitleOverlayWeightPopup,
		openSubtitleOverlayTextColorPopup,
		closeSubtitleOverlayTextColorPopup,
		openSubtitleOverlayBorderStylePopup,
		closeSubtitleOverlayBorderStylePopup,
		openSubtitleOverlayBorderColorPopup,
		closeSubtitleOverlayBorderColorPopup,
		openSubtitleOverlayBorderStrengthPopup,
		closeSubtitleOverlayBorderStrengthPopup,
		openSubtitleOverlayOutlineSizePopup,
		closeSubtitleOverlayOutlineSizePopup,
		openSubtitleOverlayShadowDistancePopup,
		closeSubtitleOverlayShadowDistancePopup,
		openSubtitleOverlayShadowAnglePopup,
		closeSubtitleOverlayShadowAnglePopup,
		openNavbarThemePopup,
		closeNavbarThemePopup,
		openLogoutConfirm,
		closeLogoutConfirm,
		closePlayNextPromptModePopup,
		closeLogsPopup
	} = useSettingsDisclosures();
	const {
		appVersion,
		serverInfo,
		userInfo,
		loading,
		savedServers,
		appLogCount,
		setAppLogCount,
		loadServerInfo,
		refreshSavedServers
	} = useSettingsBootstrap({
		setSettings,
		normalizeCapabilityProbeRefreshDaysSetting,
		assSubtitleRendererOptions
	});
	const savedServerKeySelector = useCallback(
		(entry) => `${entry.serverId}:${entry.userId}`,
		[]
	);
	const savedServersByKey = useMapById(savedServers, savedServerKeySelector);
	const {
		webosVersionLabel,
		capabilityProbeLabel,
		dynamicRangeLabel,
		videoCodecsLabel,
		audioCodecsLabel,
		dolbyVisionMkvLabel,
		webpImageDecodeLabel,
		atmosLabel,
		hdAudioLabel,
		maxAudioChannelsLabel,
		maxStreamingBitrateLabel
	} = useRuntimeCapabilityLabels(runtimeCapabilities);
	const {
		captureScrollTo: captureSettingsScrollRestore,
		handleScrollStop: handleSettingsScrollMemoryStop
	} = usePanelScrollState({
		cachedState,
		isActive,
		onCacheState
	});
	const {
		handleSettingChange,
		settingToggleHandlers
	} = useSettingsToggleHandlers({
		settings,
		setSettings
	});

	const {
		homeRowToggleHandlers,
		moveHomeRowUp,
		moveHomeRowDown
	} = useSettingsHomeRows({setSettings});

	const {
		handleSwitchServerClick,
		handleForgetServerClick,
		handleLogoutConfirm,
		openLogsPopup,
		handleClearLogs,
		openWipeCacheConfirm,
		openWipeCacheKeepLoginConfirm,
		closeWipeCacheConfirm,
		wipeCacheKeepLogin,
		handleWipeCacheConfirm
	} = useSettingsSystemHandlers({
		loadServerInfo,
		refreshSavedServers,
		savedServersByKey,
		setSwitchingServerId,
		onSignOut,
		onLogout,
		closeDisclosure,
		openDisclosure,
		setAppLogs,
		setAppLogCount,
		cacheWipeInProgress,
		setCacheWipeInProgress,
		setCacheWipeError
	});

	const {
		openPlayNextPromptModePopup,
		handleNavbarThemeSelect,
		handleBitrateSelect,
		handleCapabilityProbeRefreshSelect,
		handleAudioLanguageSelect,
		handleSubtitleLanguageSelect,
		handleAssSubtitleRendererSelect,
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
		subtitleOverlayShadowAngleLabel
	} = useSettingsOptionHandlers({
		settings,
		setSettings,
		handleSettingChange,
		openDisclosure,
		closeBitratePopup,
		closeCapabilityProbeRefreshPopup,
		closeAudioLangPopup,
		closeSubtitleLangPopup,
		closeAssSubtitleRendererPopup,
		closeSubtitleOverlaySizePopup,
		closeSubtitleOverlayPositionPopup,
		closeSubtitleOverlayBackgroundPopup,
		closeSubtitleOverlayWeightPopup,
		closeSubtitleOverlayTextColorPopup,
		closeSubtitleOverlayBorderStylePopup,
		closeSubtitleOverlayBorderColorPopup,
		closeSubtitleOverlayBorderStrengthPopup,
		closeSubtitleOverlayOutlineSizePopup,
		closeSubtitleOverlayShadowDistancePopup,
		closeSubtitleOverlayShadowAnglePopup,
		closeNavbarThemePopup,
		closePlayNextPromptModePopup,
		normalizeCapabilityProbeRefreshDaysSetting,
		setRuntimeCapabilityProbeRefreshDays,
		setToastMessage,
		bumpCapabilitySnapshotVersion,
		getCapabilityProbeRefreshLabel,
		assSubtitleRendererOptions
	});
	const {
		getBitrateLabel,
		getLanguageLabel,
		getNavbarThemeLabel,
		getCapabilityProbeRefreshPeriodLabel,
		handleRefreshCapabilitiesNow,
		handlePanelBack
	} = useSettingsDisplayHandlers({
		normalizeCapabilityProbeRefreshDaysSetting,
		getCapabilityProbeRefreshLabel,
		setToastMessage,
		bumpCapabilitySnapshotVersion,
		disclosures,
		cacheWipeInProgress,
		closeDisclosure
	});

	const toolbarActions = usePanelToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		isActive,
		onPanelBack: handlePanelBack
	});

		return (
			<Panel {...rest}>
				<Header title="Settings" />
				<SettingsToolbar
					isActive={isActive}
					{...toolbarActions}
				/>
				<BreezyToast message={toastMessage} visible={toastVisible} />
				<Scroller
					className={css.settingsContainer}
					cbScrollTo={captureSettingsScrollRestore}
					onScrollStop={handleSettingsScrollMemoryStop}
				>
					<SettingsSections
						loading={loading}
						serverInfo={serverInfo}
						serverUrl={jellyfinService.serverUrl}
						savedServers={savedServers}
						switchingServerId={switchingServerId}
						handleSwitchServerClick={handleSwitchServerClick}
						handleForgetServerClick={handleForgetServerClick}
						settings={settings}
						homeRowToggleHandlers={homeRowToggleHandlers}
						moveHomeRowUp={moveHomeRowUp}
						moveHomeRowDown={moveHomeRowDown}
						getHomeRowLabel={getHomeRowLabel}
						userInfo={userInfo}
						openLogoutConfirm={openLogoutConfirm}
						settingToggleHandlers={settingToggleHandlers}
						getPlayNextPromptModeLabel={getPlayNextPromptModeLabel}
						openPlayNextPromptModePopup={openPlayNextPromptModePopup}
						getLanguageLabel={getLanguageLabel}
						openAudioLangPopup={openAudioLangPopup}
						openSubtitleLangPopup={openSubtitleLangPopup}
						subtitleBurnInTextCodecsLabel={subtitleBurnInTextCodecsLabel}
						openSubtitleBurnInTextCodecsPopup={openSubtitleBurnInTextCodecsPopup}
						assSubtitleRendererLabel={assSubtitleRendererLabel}
						openAssSubtitleRendererPopup={openAssSubtitleRendererPopup}
						subtitleOverlayFontSizeLabel={subtitleOverlayFontSizeLabel}
						subtitleOverlayPositionLabel={subtitleOverlayPositionLabel}
						subtitleOverlayBackgroundLabel={subtitleOverlayBackgroundLabel}
						subtitleOverlayWeightLabel={subtitleOverlayWeightLabel}
						subtitleOverlayTextColorLabel={subtitleOverlayTextColorLabel}
						subtitleOverlayBorderStyleLabel={subtitleOverlayBorderStyleLabel}
						subtitleOverlayBorderColorLabel={subtitleOverlayBorderColorLabel}
						subtitleOverlayBorderStrengthLabel={subtitleOverlayBorderStrengthLabel}
						subtitleOverlayOutlineSizeLabel={subtitleOverlayOutlineSizeLabel}
						subtitleOverlayShadowDistanceLabel={subtitleOverlayShadowDistanceLabel}
						subtitleOverlayShadowAngleLabel={subtitleOverlayShadowAngleLabel}
						openSubtitleOverlaySizePopup={openSubtitleOverlaySizePopup}
						openSubtitleOverlayPositionPopup={openSubtitleOverlayPositionPopup}
						openSubtitleOverlayBackgroundPopup={openSubtitleOverlayBackgroundPopup}
						openSubtitleOverlayWeightPopup={openSubtitleOverlayWeightPopup}
						openSubtitleOverlayTextColorPopup={openSubtitleOverlayTextColorPopup}
						openSubtitleOverlayBorderStylePopup={openSubtitleOverlayBorderStylePopup}
						openSubtitleOverlayBorderColorPopup={openSubtitleOverlayBorderColorPopup}
						openSubtitleOverlayBorderStrengthPopup={openSubtitleOverlayBorderStrengthPopup}
						openSubtitleOverlayOutlineSizePopup={openSubtitleOverlayOutlineSizePopup}
						openSubtitleOverlayShadowDistancePopup={openSubtitleOverlayShadowDistancePopup}
						openSubtitleOverlayShadowAnglePopup={openSubtitleOverlayShadowAnglePopup}
						getBitrateLabel={getBitrateLabel}
						openBitratePopup={openBitratePopup}
						getNavbarThemeLabel={getNavbarThemeLabel}
						openNavbarThemePopup={openNavbarThemePopup}
						appVersion={appVersion}
						webosVersionLabel={webosVersionLabel}
						capabilityProbeLabel={capabilityProbeLabel}
						getCapabilityProbeRefreshPeriodLabel={getCapabilityProbeRefreshPeriodLabel}
						openCapabilityProbeRefreshPopup={openCapabilityProbeRefreshPopup}
						handleRefreshCapabilitiesNow={handleRefreshCapabilitiesNow}
						dynamicRangeLabel={dynamicRangeLabel}
						dolbyVisionMkvLabel={dolbyVisionMkvLabel}
						webpImageDecodeLabel={webpImageDecodeLabel}
						videoCodecsLabel={videoCodecsLabel}
						audioCodecsLabel={audioCodecsLabel}
						atmosLabel={atmosLabel}
						hdAudioLabel={hdAudioLabel}
						maxAudioChannelsLabel={maxAudioChannelsLabel}
						maxStreamingBitrateLabel={maxStreamingBitrateLabel}
						appLogCount={appLogCount}
						cacheWipeInProgress={cacheWipeInProgress}
						openLogsPopup={openLogsPopup}
						openWipeCacheConfirm={openWipeCacheConfirm}
						openWipeCacheKeepLoginConfirm={openWipeCacheKeepLoginConfirm}
						isNonStableBuild={SHOW_NON_STABLE_DEBUG_OPTIONS}
					/>
				</Scroller>
				<SettingsPopups
					popupShellCss={popupShellCss}
					bitratePopupOpen={bitratePopupOpen}
					closeBitratePopup={closeBitratePopup}
					bitrateOptions={BITRATE_OPTIONS}
					capabilityProbeRefreshPopupOpen={capabilityProbeRefreshPopupOpen}
					closeCapabilityProbeRefreshPopup={closeCapabilityProbeRefreshPopup}
					capabilityProbeRefreshOptions={CAPABILITY_PROBE_REFRESH_OPTIONS}
					settings={settings}
					handleBitrateSelect={handleBitrateSelect}
					handleCapabilityProbeRefreshSelect={handleCapabilityProbeRefreshSelect}
					audioLangPopupOpen={audioLangPopupOpen}
					closeAudioLangPopup={closeAudioLangPopup}
					languageOptions={LANGUAGE_OPTIONS}
					handleAudioLanguageSelect={handleAudioLanguageSelect}
					subtitleLangPopupOpen={subtitleLangPopupOpen}
					closeSubtitleLangPopup={closeSubtitleLangPopup}
					handleSubtitleLanguageSelect={handleSubtitleLanguageSelect}
					subtitleBurnInTextCodecsPopupOpen={subtitleBurnInTextCodecsPopupOpen}
					closeSubtitleBurnInTextCodecsPopup={closeSubtitleBurnInTextCodecsPopup}
					subtitleBurnInTextCodecOptions={SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS}
					handleSubtitleBurnInTextCodecToggle={handleSubtitleBurnInTextCodecToggle}
					assSubtitleRendererPopupOpen={assSubtitleRendererPopupOpen}
					closeAssSubtitleRendererPopup={closeAssSubtitleRendererPopup}
					assSubtitleRendererOptions={assSubtitleRendererOptions}
					handleAssSubtitleRendererSelect={handleAssSubtitleRendererSelect}
					subtitleOverlaySizePopupOpen={subtitleOverlaySizePopupOpen}
					closeSubtitleOverlaySizePopup={closeSubtitleOverlaySizePopup}
					subtitleOverlayFontSizeLabel={subtitleOverlayFontSizeLabel}
					handleSubtitleOverlayFontSizeDecrease={handleSubtitleOverlayFontSizeDecrease}
					handleSubtitleOverlayFontSizeIncrease={handleSubtitleOverlayFontSizeIncrease}
					handleSubtitleOverlayFontSizeReset={handleSubtitleOverlayFontSizeReset}
					subtitleOverlayPositionPopupOpen={subtitleOverlayPositionPopupOpen}
					closeSubtitleOverlayPositionPopup={closeSubtitleOverlayPositionPopup}
					subtitleOverlayPositionOptions={SUBTITLE_OVERLAY_POSITION_OPTIONS}
					handleSubtitleOverlayPositionSelect={handleSubtitleOverlayPositionSelect}
					subtitleOverlayBackgroundPopupOpen={subtitleOverlayBackgroundPopupOpen}
					closeSubtitleOverlayBackgroundPopup={closeSubtitleOverlayBackgroundPopup}
					subtitleOverlayBackgroundOptions={SUBTITLE_OVERLAY_BACKGROUND_OPTIONS}
					handleSubtitleOverlayBackgroundSelect={handleSubtitleOverlayBackgroundSelect}
					subtitleOverlayWeightPopupOpen={subtitleOverlayWeightPopupOpen}
					closeSubtitleOverlayWeightPopup={closeSubtitleOverlayWeightPopup}
					subtitleOverlayWeightOptions={SUBTITLE_OVERLAY_WEIGHT_OPTIONS}
					handleSubtitleOverlayWeightSelect={handleSubtitleOverlayWeightSelect}
					subtitleOverlayTextColorPopupOpen={subtitleOverlayTextColorPopupOpen}
					closeSubtitleOverlayTextColorPopup={closeSubtitleOverlayTextColorPopup}
					subtitleOverlayTextColorOptions={SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS}
					handleSubtitleOverlayTextColorSelect={handleSubtitleOverlayTextColorSelect}
					subtitleOverlayBorderStylePopupOpen={subtitleOverlayBorderStylePopupOpen}
					closeSubtitleOverlayBorderStylePopup={closeSubtitleOverlayBorderStylePopup}
					subtitleOverlayBorderStyleOptions={SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS}
					handleSubtitleOverlayBorderStyleSelect={handleSubtitleOverlayBorderStyleSelect}
					subtitleOverlayBorderColorPopupOpen={subtitleOverlayBorderColorPopupOpen}
					closeSubtitleOverlayBorderColorPopup={closeSubtitleOverlayBorderColorPopup}
					subtitleOverlayBorderColorOptions={SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS}
					handleSubtitleOverlayBorderColorSelect={handleSubtitleOverlayBorderColorSelect}
					subtitleOverlayBorderStrengthPopupOpen={subtitleOverlayBorderStrengthPopupOpen}
					closeSubtitleOverlayBorderStrengthPopup={closeSubtitleOverlayBorderStrengthPopup}
					subtitleOverlayBorderStrengthOptions={SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS}
					handleSubtitleOverlayBorderStrengthSelect={handleSubtitleOverlayBorderStrengthSelect}
					subtitleOverlayOutlineSizePopupOpen={subtitleOverlayOutlineSizePopupOpen}
					closeSubtitleOverlayOutlineSizePopup={closeSubtitleOverlayOutlineSizePopup}
					subtitleOverlayOutlineSizeLabel={subtitleOverlayOutlineSizeLabel}
					handleSubtitleOverlayOutlineSizeDecrease={handleSubtitleOverlayOutlineSizeDecrease}
					handleSubtitleOverlayOutlineSizeIncrease={handleSubtitleOverlayOutlineSizeIncrease}
					handleSubtitleOverlayOutlineSizeReset={handleSubtitleOverlayOutlineSizeReset}
					subtitleOverlayShadowDistancePopupOpen={subtitleOverlayShadowDistancePopupOpen}
					closeSubtitleOverlayShadowDistancePopup={closeSubtitleOverlayShadowDistancePopup}
					subtitleOverlayShadowDistanceOptions={SUBTITLE_OVERLAY_SHADOW_DISTANCE_OPTIONS}
					handleSubtitleOverlayShadowDistanceSelect={handleSubtitleOverlayShadowDistanceSelect}
					subtitleOverlayShadowAnglePopupOpen={subtitleOverlayShadowAnglePopupOpen}
					closeSubtitleOverlayShadowAnglePopup={closeSubtitleOverlayShadowAnglePopup}
					subtitleOverlayShadowAngleOptions={SUBTITLE_OVERLAY_SHADOW_ANGLE_OPTIONS}
					handleSubtitleOverlayShadowAngleSelect={handleSubtitleOverlayShadowAngleSelect}
					navbarThemePopupOpen={navbarThemePopupOpen}
					closeNavbarThemePopup={closeNavbarThemePopup}
					navbarThemeOptions={NAVBAR_THEME_OPTIONS}
					handleNavbarThemeSelect={handleNavbarThemeSelect}
					playNextPromptModePopupOpen={playNextPromptModePopupOpen}
					closePlayNextPromptModePopup={closePlayNextPromptModePopup}
					setSegmentsOnlyPromptMode={setSegmentsOnlyPromptMode}
					setSegmentsOrLast60PromptMode={setSegmentsOrLast60PromptMode}
					logoutConfirmOpen={logoutConfirmOpen}
					closeLogoutConfirm={closeLogoutConfirm}
					serverInfo={serverInfo}
					handleLogoutConfirm={handleLogoutConfirm}
					logsPopupOpen={logsPopupOpen}
					closeLogsPopup={closeLogsPopup}
					handleClearLogs={handleClearLogs}
					appLogs={appLogs}
					wipeCacheConfirmOpen={wipeCacheConfirmOpen}
					closeWipeCacheConfirm={closeWipeCacheConfirm}
					wipeCacheKeepLogin={wipeCacheKeepLogin}
					cacheWipeInProgress={cacheWipeInProgress}
					cacheWipeError={cacheWipeError}
					handleWipeCacheConfirm={handleWipeCacheConfirm}
				/>
			</Panel>
		);
	};

export default SettingsPanel;
