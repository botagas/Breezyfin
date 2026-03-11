import { useState, useCallback } from 'react';
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
import BreezyToast from '../components/BreezyToast';
import {
	BITRATE_OPTIONS,
	CAPABILITY_PROBE_REFRESH_OPTIONS,
	DEFAULT_SETTINGS,
	LANGUAGE_OPTIONS,
	NAVBAR_THEME_OPTIONS,
	SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS
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
		normalizeCapabilityProbeRefreshDaysSetting
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
		handleSubtitleBurnInTextCodecToggle,
		setSegmentsOnlyPromptMode,
		setSegmentsOrLast60PromptMode,
		subtitleBurnInTextCodecsLabel
	} = useSettingsOptionHandlers({
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
