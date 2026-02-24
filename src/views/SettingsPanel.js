import { useState, useEffect, useCallback, useMemo } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Scroller from '../components/AppScroller';
import jellyfinService from '../services/jellyfinService';
import SettingsToolbar from '../components/SettingsToolbar';
import {HOME_ROW_ORDER} from '../constants/homeRows';
import {getAppLogs, clearAppLogs} from '../utils/appLogger';
import {getAppVersion, loadAppVersion} from '../utils/appInfo';
import {isStyleDebugEnabled} from '../utils/featureFlags';
import { useDisclosureMap } from '../hooks/useDisclosureMap';
import { useDisclosureHandlers } from '../hooks/useDisclosureHandlers';
import { useMapById } from '../hooks/useMapById';
import { usePanelToolbarActions } from '../hooks/usePanelToolbarActions';
import { usePanelScrollState } from '../hooks/usePanelScrollState';
import { useToastMessage } from '../hooks/useToastMessage';
import { readBreezyfinSettings, writeBreezyfinSettings } from '../utils/settingsStorage';
import { wipeAllAppCache } from '../utils/cacheMaintenance';
import {
	getRuntimePlatformCapabilities,
	refreshRuntimePlatformCapabilities,
	setRuntimeCapabilityProbeRefreshDays
} from '../utils/platformCapabilities';
import BreezyToast from '../components/BreezyToast';
import {
	BITRATE_OPTIONS,
	CAPABILITY_PROBE_REFRESH_OPTIONS,
	DISCLOSURE_BACK_PRIORITY,
	DEFAULT_SETTINGS,
	INITIAL_SETTINGS_DISCLOSURES,
	LANGUAGE_OPTIONS,
	NAVBAR_THEME_OPTIONS,
	SETTINGS_DISCLOSURE_KEYS,
	SETTINGS_DISCLOSURE_KEY_LIST
} from './settings-panel/constants';
import {
	getCapabilityProbeRefreshLabel,
	getHomeRowLabel,
	getOptionLabel,
	getPlayNextPromptModeLabel
} from './settings-panel/labels';

import css from './SettingsPanel.module.less';
import {popupShellCss} from '../styles/popupStyles';
import SettingsSections from './settings-panel/components/SettingsSections';
import SettingsPopups from './settings-panel/components/SettingsPopups';

const STYLE_DEBUG_ENABLED = isStyleDebugEnabled();
const formatYesNoUnknown = (value) => {
	if (value === true) return 'Yes';
	if (value === false) return 'No';
	return 'Unknown';
};

const formatCapabilityTimestamp = (timestamp) => {
	if (!Number.isFinite(timestamp)) return 'Unknown';
	try {
		return new Date(timestamp).toLocaleString();
	} catch (_) {
		return 'Unknown';
	}
};

const formatAudioCodecName = (codec) => {
	const normalized = String(codec || '').trim().toLowerCase();
	if (!normalized) return '';
	if (normalized === 'pcm_s16le') return 'PCM 16-bit';
	if (normalized === 'pcm_s24le') return 'PCM 24-bit';
	if (normalized === 'eac3') return 'EAC3';
	if (normalized === 'ac3') return 'AC3';
	if (normalized === 'mp3') return 'MP3';
	if (normalized === 'mp2') return 'MP2';
	if (normalized === 'aac') return 'AAC';
	if (normalized === 'opus') return 'Opus';
	if (normalized === 'flac') return 'FLAC';
	return normalized.toUpperCase();
};

const formatAudioCodecList = (audioCodecs) => {
	if (!Array.isArray(audioCodecs) || audioCodecs.length === 0) return 'Unknown';
	return Array.from(new Set(audioCodecs.map(formatAudioCodecName).filter(Boolean))).join(', ');
};

const formatBitrateMbps = (value) => {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric <= 0) return 'Unknown';
	return `${Math.round(numeric / 1000000)} Mbps`;
};

const CAPABILITY_PROBE_REFRESH_VALUE_SET = new Set(
	CAPABILITY_PROBE_REFRESH_OPTIONS.map((option) => String(option.value))
);

const normalizeCapabilityProbeRefreshDaysSetting = (value) => {
	const normalized = String(value ?? '');
	if (CAPABILITY_PROBE_REFRESH_VALUE_SET.has(normalized)) return normalized;
	return DEFAULT_SETTINGS.capabilityProbeRefreshDays;
};

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
	const [appVersion, setAppVersion] = useState(getAppVersion());
	const [, bumpCapabilitySnapshotVersion] = useState(0);
	const runtimeCapabilities = getRuntimePlatformCapabilities();
	const [settings, setSettings] = useState(DEFAULT_SETTINGS);
	const [serverInfo, setServerInfo] = useState(null);
	const [userInfo, setUserInfo] = useState(null);
	const [loading, setLoading] = useState(true);
	const [savedServers, setSavedServers] = useState([]);
	const [switchingServerId, setSwitchingServerId] = useState(null);
	const [appLogs, setAppLogs] = useState([]);
	const [appLogCount, setAppLogCount] = useState(0);
	const [cacheWipeInProgress, setCacheWipeInProgress] = useState(false);
	const [cacheWipeError, setCacheWipeError] = useState('');
	const {
		toastMessage,
		toastVisible,
		setToastMessage
	} = useToastMessage({durationMs: 2050, fadeOutMs: 350});
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
	const savedServerKeySelector = useCallback(
		(entry) => `${entry.serverId}:${entry.userId}`,
		[]
	);
	const savedServersByKey = useMapById(savedServers, savedServerKeySelector);
	const bitratePopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.BITRATE] === true;
	const capabilityProbeRefreshPopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.CAPABILITY_PROBE_REFRESH] === true;
	const audioLangPopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE] === true;
	const subtitleLangPopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE] === true;
	const navbarThemePopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME] === true;
	const playNextPromptModePopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE] === true;
	const logoutConfirmOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM] === true;
	const logsPopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.LOGS] === true;
	const wipeCacheConfirmOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM] === true;
	const openBitratePopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.BITRATE].open;
	const closeBitratePopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.BITRATE].close;
	const openCapabilityProbeRefreshPopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.CAPABILITY_PROBE_REFRESH].open;
	const closeCapabilityProbeRefreshPopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.CAPABILITY_PROBE_REFRESH].close;
	const openAudioLangPopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE].open;
	const closeAudioLangPopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE].close;
	const openSubtitleLangPopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE].open;
	const closeSubtitleLangPopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE].close;
	const openNavbarThemePopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME].open;
	const closeNavbarThemePopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME].close;
	const openLogoutConfirm = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM].open;
	const closeLogoutConfirm = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM].close;
	const closePlayNextPromptModePopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE].close;
	const closeLogsPopup = disclosureHandlers[SETTINGS_DISCLOSURE_KEYS.LOGS].close;
	const hasRuntimeVersionInfo = runtimeCapabilities.version != null || runtimeCapabilities.chrome != null;
	const webosVersionLabel = hasRuntimeVersionInfo
		? `${runtimeCapabilities.version ?? 'Unknown'}${runtimeCapabilities.chrome ? ` (Chrome ${runtimeCapabilities.chrome})` : ''}`
		: 'Unknown';
	const runtimePlaybackCapabilities = runtimeCapabilities?.playback || {};
	const capabilityProbe = runtimeCapabilities?.capabilityProbe || null;
	const dynamicRangeLabel = useMemo(() => {
		const ranges = [];
		if (runtimePlaybackCapabilities.supportsDolbyVision === true) ranges.push('Dolby Vision');
		if (runtimePlaybackCapabilities.supportsHdr10 !== false) ranges.push('HDR10');
		if (runtimePlaybackCapabilities.supportsHlg !== false) ranges.push('HLG');
		if (ranges.length === 0) return 'SDR only';
		return ranges.join(', ');
	}, [
		runtimePlaybackCapabilities.supportsDolbyVision,
		runtimePlaybackCapabilities.supportsHdr10,
		runtimePlaybackCapabilities.supportsHlg
	]);
	const videoCodecsLabel = useMemo(() => {
		const codecs = ['H.264'];
		if (runtimePlaybackCapabilities.supportsHevc !== false) codecs.push('HEVC');
		if (runtimePlaybackCapabilities.supportsAv1 === true) codecs.push('AV1');
		if (runtimePlaybackCapabilities.supportsVp9 === true) codecs.push('VP9');
		return codecs.join(', ');
	}, [
		runtimePlaybackCapabilities.supportsAv1,
		runtimePlaybackCapabilities.supportsHevc,
		runtimePlaybackCapabilities.supportsVp9
	]);
	const audioCodecsLabel = useMemo(
		() => formatAudioCodecList(runtimePlaybackCapabilities.audioCodecs),
		[runtimePlaybackCapabilities.audioCodecs]
	);
	const dolbyVisionMkvLabel = formatYesNoUnknown(runtimePlaybackCapabilities.supportsDolbyVisionInMkv);
	const atmosLabel = formatYesNoUnknown(runtimePlaybackCapabilities.supportsAtmos);
	const hdAudioLabel = `${formatYesNoUnknown(runtimePlaybackCapabilities.supportsDts)} / ${formatYesNoUnknown(runtimePlaybackCapabilities.supportsTrueHd)}`;
	const maxAudioChannelsLabel = Number.isFinite(Number(runtimePlaybackCapabilities.maxAudioChannels))
		? `${runtimePlaybackCapabilities.maxAudioChannels} ch`
		: 'Unknown';
	const maxStreamingBitrateLabel = formatBitrateMbps(runtimePlaybackCapabilities.maxStreamingBitrate);
	const capabilityProbeLabel = useMemo(() => {
		const sourceLabel = capabilityProbe?.source === 'cache' ? 'Cached probe' : 'Live probe';
		const checkedAtLabel = formatCapabilityTimestamp(capabilityProbe?.checkedAt);
		const ttlMs = Number(capabilityProbe?.ttlMs);
		if (!Number.isFinite(ttlMs) || ttlMs <= 0) return `${sourceLabel} | ${checkedAtLabel}`;
		const ttlDays = Math.max(1, Math.round(ttlMs / (24 * 60 * 60 * 1000)));
		return `${sourceLabel} | ${checkedAtLabel} | refresh ${ttlDays}d`;
	}, [capabilityProbe?.checkedAt, capabilityProbe?.source, capabilityProbe?.ttlMs]);
	const {
		captureScrollTo: captureSettingsScrollRestore,
		handleScrollStop: handleSettingsScrollMemoryStop
	} = usePanelScrollState({
		cachedState,
		isActive,
		onCacheState
	});

	const loadSettings = useCallback(() => {
		try {
			const parsed = readBreezyfinSettings();
			const normalizedOrder = Array.isArray(parsed.homeRowOrder)
				? parsed.homeRowOrder.filter((key) => HOME_ROW_ORDER.includes(key))
				: [];
			const resolvedOrder = [
				...normalizedOrder,
				...HOME_ROW_ORDER.filter((key) => !normalizedOrder.includes(key))
			];
			const capabilityProbeRefreshDays = normalizeCapabilityProbeRefreshDaysSetting(parsed.capabilityProbeRefreshDays);
			setRuntimeCapabilityProbeRefreshDays(capabilityProbeRefreshDays);
			setSettings({
				...DEFAULT_SETTINGS,
				...parsed,
				capabilityProbeRefreshDays,
				homeRows: {
					...DEFAULT_SETTINGS.homeRows,
					...(parsed.homeRows || {})
				},
				homeRowOrder: resolvedOrder
			});
		} catch (error) {
			console.error('Failed to load settings:', error);
		}
	}, []);

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
		} catch (err) {
			console.error('Failed to fetch saved servers:', err);
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

	const handleSettingChange = useCallback((key, value) => {
		setSettings((prevSettings) => {
			const newSettings = { ...prevSettings, [key]: value };
			if (!writeBreezyfinSettings(newSettings)) {
				console.error('Failed to save settings');
			}
			return newSettings;
		});
	}, []);

	const handleHomeRowToggle = useCallback((rowKey) => {
		setSettings((prevSettings) => {
			const updated = {
				...prevSettings,
				homeRows: {
					...prevSettings.homeRows,
					[rowKey]: !prevSettings.homeRows?.[rowKey]
				}
			};
			if (!writeBreezyfinSettings(updated)) {
				console.error('Failed to save home row settings');
			}
			return updated;
		});
	}, []);

	const handleHomeRowReorder = useCallback((rowKey, direction) => {
		setSettings((prevSettings) => {
			const order = Array.isArray(prevSettings.homeRowOrder) ? [...prevSettings.homeRowOrder] : [...HOME_ROW_ORDER];
			const index = order.indexOf(rowKey);
			if (index === -1) return prevSettings;
			const swapIndex = direction === 'up' ? index - 1 : index + 1;
			if (swapIndex < 0 || swapIndex >= order.length) return prevSettings;
			[order[index], order[swapIndex]] = [order[swapIndex], order[index]];
			const updated = { ...prevSettings, homeRowOrder: order };
			if (!writeBreezyfinSettings(updated)) {
				console.error('Failed to save home row order');
			}
			return updated;
		});
	}, []);

	const handleSwitchServer = useCallback(async (entry) => {
		if (!entry) return;
		setSwitchingServerId(entry.serverId + ':' + entry.userId);
		try {
			jellyfinService.setActiveServer(entry.serverId, entry.userId);
			await loadServerInfo();
		} catch (err) {
			console.error('Failed to switch server:', err);
		} finally {
			setSwitchingServerId(null);
			refreshSavedServers();
		}
	}, [loadServerInfo, refreshSavedServers]);

	const handleForgetServer = useCallback((entry) => {
		if (!entry) return;
		jellyfinService.forgetServer(entry.serverId, entry.userId);
		const hasActiveSession = Boolean(jellyfinService.userId && jellyfinService.serverUrl && jellyfinService.accessToken);
		if (!hasActiveSession) {
			if (typeof onSignOut === 'function') {
				onSignOut();
			} else {
				onLogout();
			}
			return;
		}
		refreshSavedServers();
	}, [onLogout, onSignOut, refreshSavedServers]);

	const handleLogoutConfirm = useCallback(() => {
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM);
		if (typeof onSignOut === 'function') {
			onSignOut();
			return;
		}
		onLogout();
	}, [closeDisclosure, onLogout, onSignOut]);

	const openLogsPopup = useCallback(() => {
		const logs = getAppLogs();
		setAppLogs(logs.slice().reverse());
		setAppLogCount(logs.length);
		openDisclosure(SETTINGS_DISCLOSURE_KEYS.LOGS);
	}, [openDisclosure]);

	const handleClearLogs = useCallback(() => {
		clearAppLogs();
		setAppLogs([]);
		setAppLogCount(0);
	}, []);

	const homeRowToggleHandlers = useMemo(() => ({
		recentlyAdded: () => handleHomeRowToggle('recentlyAdded'),
		continueWatching: () => handleHomeRowToggle('continueWatching'),
		nextUp: () => handleHomeRowToggle('nextUp'),
		latestMovies: () => handleHomeRowToggle('latestMovies'),
		latestShows: () => handleHomeRowToggle('latestShows'),
		myRequests: () => handleHomeRowToggle('myRequests')
	}), [handleHomeRowToggle]);

	const moveHomeRowUp = useCallback((event) => {
		const rowKey = event.currentTarget.dataset.rowKey;
		if (!rowKey) return;
		handleHomeRowReorder(rowKey, 'up');
	}, [handleHomeRowReorder]);

	const moveHomeRowDown = useCallback((event) => {
		const rowKey = event.currentTarget.dataset.rowKey;
		if (!rowKey) return;
		handleHomeRowReorder(rowKey, 'down');
	}, [handleHomeRowReorder]);

	const handleSwitchServerClick = useCallback((event) => {
		const serverKey = event.currentTarget.dataset.serverKey;
		const entry = savedServersByKey.get(serverKey);
		if (!entry) return;
		handleSwitchServer(entry);
	}, [handleSwitchServer, savedServersByKey]);

	const handleForgetServerClick = useCallback((event) => {
		const serverKey = event.currentTarget.dataset.serverKey;
		const entry = savedServersByKey.get(serverKey);
		if (!entry) return;
		handleForgetServer(entry);
	}, [handleForgetServer, savedServersByKey]);

	const openWipeCacheConfirm = useCallback(() => {
		setCacheWipeError('');
		openDisclosure(SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM);
	}, [openDisclosure]);

	const closeWipeCacheConfirm = useCallback(() => {
		if (cacheWipeInProgress) return;
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM);
	}, [cacheWipeInProgress, closeDisclosure]);

	const handleWipeCacheConfirm = useCallback(async () => {
		if (cacheWipeInProgress) return;
		setCacheWipeInProgress(true);
		setCacheWipeError('');

		try {
			const summary = await wipeAllAppCache();
			console.info('[Settings] Cache wipe summary:', summary);
			if (typeof window !== 'undefined') {
				window.setTimeout(() => {
					window.location.reload();
				}, 160);
			}
		} catch (error) {
			console.error('Failed to wipe application cache:', error);
			setCacheWipeError('Failed to wipe app cache. Please restart the TV and try again.');
			setCacheWipeInProgress(false);
		}
	}, [cacheWipeInProgress]);

	const openStylingDebugPanel = useCallback(() => {
		if (!STYLE_DEBUG_ENABLED) return;
		if (typeof onNavigate === 'function') {
			onNavigate('styleDebug');
		}
	}, [onNavigate]);

	const toggleBooleanSetting = useCallback((key) => {
		handleSettingChange(key, !settings[key]);
	}, [handleSettingChange, settings]);

	const settingToggleHandlers = useMemo(() => ({
		enableTranscoding: () => toggleBooleanSetting('enableTranscoding'),
		autoPlayNext: () => toggleBooleanSetting('autoPlayNext'),
		showPlayNextPrompt: () => toggleBooleanSetting('showPlayNextPrompt'),
		skipIntro: () => toggleBooleanSetting('skipIntro'),
		forceTranscoding: () => toggleBooleanSetting('forceTranscoding'),
		forceTranscodingWithSubtitles: () => toggleBooleanSetting('forceTranscodingWithSubtitles'),
		relaxedPlaybackProfile: () => toggleBooleanSetting('relaxedPlaybackProfile'),
		showBackdrops: () => toggleBooleanSetting('showBackdrops'),
		showSeasonImages: () => toggleBooleanSetting('showSeasonImages'),
		useSidewaysEpisodeList: () => toggleBooleanSetting('useSidewaysEpisodeList'),
		disableAnimations: () => toggleBooleanSetting('disableAnimations'),
		disableAllAnimations: () => toggleBooleanSetting('disableAllAnimations'),
		showMediaBar: () => toggleBooleanSetting('showMediaBar'),
		showPerformanceOverlay: () => toggleBooleanSetting('showPerformanceOverlay')
	}), [toggleBooleanSetting]);

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
	}, [closeCapabilityProbeRefreshPopup, handleSettingChange, setToastMessage]);

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

	const setSegmentsOnlyPromptMode = useCallback(() => {
		handleSettingChange('playNextPromptMode', 'segmentsOnly');
		closePlayNextPromptModePopup();
	}, [closePlayNextPromptModePopup, handleSettingChange]);

	const setSegmentsOrLast60PromptMode = useCallback(() => {
		handleSettingChange('playNextPromptMode', 'segmentsOrLast60');
		closePlayNextPromptModePopup();
	}, [closePlayNextPromptModePopup, handleSettingChange]);

	const getBitrateLabel = useCallback(
		(value) => getOptionLabel(BITRATE_OPTIONS, value, `${value} Mbps`),
		[]
	);

	const getLanguageLabel = useCallback(
		(value) => getOptionLabel(LANGUAGE_OPTIONS, value, value),
		[]
	);

	const getNavbarThemeLabel = useCallback(
		(value) => getOptionLabel(NAVBAR_THEME_OPTIONS, value, 'Classic'),
		[]
	);

	const getCapabilityProbeRefreshPeriodLabel = useCallback(
		(value) => getOptionLabel(
			CAPABILITY_PROBE_REFRESH_OPTIONS,
			normalizeCapabilityProbeRefreshDaysSetting(value),
			getCapabilityProbeRefreshLabel(value)
		),
		[]
	);

	const handleRefreshCapabilitiesNow = useCallback(() => {
		try {
			const refreshed = refreshRuntimePlatformCapabilities();
			bumpCapabilitySnapshotVersion((version) => version + 1);
			const refreshedAt = refreshed?.capabilityProbe?.checkedAt;
			const refreshedLabel = formatCapabilityTimestamp(refreshedAt);
			setToastMessage(`Capabilities refreshed (${refreshedLabel}).`);
		} catch (error) {
			console.error('Failed to refresh runtime capabilities:', error);
			setToastMessage('Failed to refresh capabilities.');
		}
	}, [setToastMessage]);

	const handlePanelBack = useCallback(() => {
		for (const disclosureKey of DISCLOSURE_BACK_PRIORITY) {
			if (disclosures[disclosureKey] !== true) continue;
			if (
				disclosureKey === SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM &&
				cacheWipeInProgress
			) {
				return true;
			}
			closeDisclosure(disclosureKey);
			return true;
		}
		return false;
	}, [
		cacheWipeInProgress,
		closeDisclosure,
		disclosures
	]);

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
						styleDebugEnabled={STYLE_DEBUG_ENABLED}
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
						videoCodecsLabel={videoCodecsLabel}
						audioCodecsLabel={audioCodecsLabel}
						atmosLabel={atmosLabel}
						hdAudioLabel={hdAudioLabel}
						maxAudioChannelsLabel={maxAudioChannelsLabel}
						maxStreamingBitrateLabel={maxStreamingBitrateLabel}
						openStylingDebugPanel={openStylingDebugPanel}
						appLogCount={appLogCount}
						cacheWipeInProgress={cacheWipeInProgress}
						openLogsPopup={openLogsPopup}
						openWipeCacheConfirm={openWipeCacheConfirm}
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
					cacheWipeInProgress={cacheWipeInProgress}
					cacheWipeError={cacheWipeError}
					handleWipeCacheConfirm={handleWipeCacheConfirm}
				/>
			</Panel>
		);
	};

export default SettingsPanel;
