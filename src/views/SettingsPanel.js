import { useState, useEffect, useCallback } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Button from '../components/BreezyButton';
import Scroller from '../components/AppScroller';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import Item from '@enact/sandstone/Item';
import SwitchItem from '@enact/sandstone/SwitchItem';
import Popup from '@enact/sandstone/Popup';
import jellyfinService from '../services/jellyfinService';
import SettingsToolbar from '../components/SettingsToolbar';
import {HOME_ROW_ORDER} from '../constants/homeRows';
import {getAppLogs, clearAppLogs} from '../utils/appLogger';
import {getAppVersion, loadAppVersion} from '../utils/appInfo';
import {isStyleDebugEnabled} from '../utils/featureFlags';
import { usePanelBackHandler } from '../hooks/usePanelBackHandler';
import { useDisclosureMap } from '../hooks/useDisclosureMap';
import { useMapById } from '../hooks/useMapById';
import { usePanelScrollState } from '../hooks/usePanelScrollState';
import { useToolbarActions } from '../hooks/useToolbarActions';
import { useToolbarBackHandler } from '../hooks/useToolbarBackHandler';
import { readBreezyfinSettings, writeBreezyfinSettings } from '../utils/settingsStorage';
import { wipeAllAppCache } from '../utils/cacheMaintenance';
import {getRuntimePlatformCapabilities} from '../utils/platformCapabilities';

import css from './SettingsPanel.module.less';
import popupStyles from '../styles/popupStyles.module.less';
import {popupShellCss} from '../styles/popupStyles';

const DEFAULT_SETTINGS = {
	maxBitrate: '40',
	enableTranscoding: true,
	forceTranscoding: false,
	forceTranscodingWithSubtitles: true,
	relaxedPlaybackProfile: false,
	preferredAudioLanguage: 'eng',
	preferredSubtitleLanguage: 'eng',
	disableAnimations: true,
	disableAllAnimations: false,
	showMediaBar: true,
	navbarTheme: 'elegant',
	autoPlayNext: true,
	showPlayNextPrompt: true,
	playNextPromptMode: 'segmentsOrLast60',
	skipIntro: true,
	showBackdrops: true,
	showSeasonImages: false,
	useSidewaysEpisodeList: true,
	showPerformanceOverlay: false,
	homeRows: {
		recentlyAdded: true,
		continueWatching: true,
		nextUp: true,
		latestMovies: true,
		latestShows: true,
		myRequests: true
	},
	homeRowOrder: HOME_ROW_ORDER
};

const BITRATE_OPTIONS = [
	{ value: '10', label: '10 Mbps' },
	{ value: '20', label: '20 Mbps' },
	{ value: '40', label: '40 Mbps (Default)' },
	{ value: '60', label: '60 Mbps' },
	{ value: '80', label: '80 Mbps' },
	{ value: '100', label: '100 Mbps' },
	{ value: '120', label: '120 Mbps' }
];

const LANGUAGE_OPTIONS = [
	{ value: 'eng', label: 'English' },
	{ value: 'spa', label: 'Spanish' },
	{ value: 'fre', label: 'French' },
	{ value: 'ger', label: 'German' },
	{ value: 'ita', label: 'Italian' },
	{ value: 'jpn', label: 'Japanese' },
	{ value: 'kor', label: 'Korean' },
	{ value: 'chi', label: 'Chinese' },
	{ value: 'por', label: 'Portuguese' },
	{ value: 'rus', label: 'Russian' }
];

const NAVBAR_THEME_OPTIONS = [
	{ value: 'classic', label: 'Classic' },
	{ value: 'elegant', label: 'Elegant' }
];
const STYLE_DEBUG_ENABLED = isStyleDebugEnabled();
const SETTINGS_DISCLOSURE_KEYS = {
	BITRATE: 'bitratePopup',
	AUDIO_LANGUAGE: 'audioLanguagePopup',
	SUBTITLE_LANGUAGE: 'subtitleLanguagePopup',
	NAVBAR_THEME: 'navbarThemePopup',
	PLAY_NEXT_PROMPT_MODE: 'playNextPromptModePopup',
	LOGOUT_CONFIRM: 'logoutConfirmPopup',
	LOGS: 'logsPopup',
	WIPE_CACHE_CONFIRM: 'wipeCacheConfirmPopup'
};
const INITIAL_SETTINGS_DISCLOSURES = {
	[SETTINGS_DISCLOSURE_KEYS.BITRATE]: false,
	[SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE]: false,
	[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE]: false,
	[SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME]: false,
	[SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE]: false,
	[SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM]: false,
	[SETTINGS_DISCLOSURE_KEYS.LOGS]: false,
	[SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM]: false
};
const DISCLOSURE_BACK_PRIORITY = [
	SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM,
	SETTINGS_DISCLOSURE_KEYS.LOGS,
	SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM,
	SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE,
	SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE,
	SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE,
	SETTINGS_DISCLOSURE_KEYS.BITRATE
];

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
		disclosures,
		openDisclosure,
		closeDisclosure
	} = useDisclosureMap(INITIAL_SETTINGS_DISCLOSURES);
	const {
		registerToolbarBackHandler,
		runToolbarBackHandler
	} = useToolbarBackHandler();
	const savedServerKeySelector = useCallback(
		(entry) => `${entry.serverId}:${entry.userId}`,
		[]
	);
	const savedServersByKey = useMapById(savedServers, savedServerKeySelector);
	const bitratePopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.BITRATE] === true;
	const audioLangPopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE] === true;
	const subtitleLangPopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE] === true;
	const navbarThemePopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME] === true;
	const playNextPromptModePopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE] === true;
	const logoutConfirmOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM] === true;
	const logsPopupOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.LOGS] === true;
	const wipeCacheConfirmOpen = disclosures[SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM] === true;
	const hasRuntimeVersionInfo = runtimeCapabilities.version != null || runtimeCapabilities.chrome != null;
	const webosVersionLabel = hasRuntimeVersionInfo
		? `${runtimeCapabilities.version ?? 'Unknown'}${runtimeCapabilities.chrome ? ` (Chrome ${runtimeCapabilities.chrome})` : ''}`
		: 'Unknown';
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
			setSettings({
				...DEFAULT_SETTINGS,
				...parsed,
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

	const getHomeRowLabel = (rowKey) => {
		switch (rowKey) {
			case 'recentlyAdded':
				return 'Recently Added';
			case 'continueWatching':
				return 'Continue Watching';
			case 'nextUp':
				return 'Next Up';
			case 'latestMovies':
				return 'Latest Movies';
			case 'latestShows':
				return 'Latest TV Shows';
			case 'myRequests':
				return 'My Requests';
			default:
				return rowKey;
		}
	};

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
		refreshSavedServers();
	}, [refreshSavedServers]);

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

	const toggleHomeRowRecentlyAdded = useCallback(() => {
		handleHomeRowToggle('recentlyAdded');
	}, [handleHomeRowToggle]);

	const toggleHomeRowContinueWatching = useCallback(() => {
		handleHomeRowToggle('continueWatching');
	}, [handleHomeRowToggle]);

	const toggleHomeRowNextUp = useCallback(() => {
		handleHomeRowToggle('nextUp');
	}, [handleHomeRowToggle]);

	const toggleHomeRowLatestMovies = useCallback(() => {
		handleHomeRowToggle('latestMovies');
	}, [handleHomeRowToggle]);

	const toggleHomeRowLatestShows = useCallback(() => {
		handleHomeRowToggle('latestShows');
	}, [handleHomeRowToggle]);

	const toggleHomeRowMyRequests = useCallback(() => {
		handleHomeRowToggle('myRequests');
	}, [handleHomeRowToggle]);

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

	const openLogoutConfirm = useCallback(() => {
		openDisclosure(SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM);
	}, [openDisclosure]);

	const closeLogoutConfirm = useCallback(() => {
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM);
	}, [closeDisclosure]);

	const openBitratePopup = useCallback(() => {
		openDisclosure(SETTINGS_DISCLOSURE_KEYS.BITRATE);
	}, [openDisclosure]);

	const closeBitratePopup = useCallback(() => {
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.BITRATE);
	}, [closeDisclosure]);

	const openAudioLangPopup = useCallback(() => {
		openDisclosure(SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE);
	}, [openDisclosure]);

	const closeAudioLangPopup = useCallback(() => {
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE);
	}, [closeDisclosure]);

	const openSubtitleLangPopup = useCallback(() => {
		openDisclosure(SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE);
	}, [openDisclosure]);

	const closeSubtitleLangPopup = useCallback(() => {
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE);
	}, [closeDisclosure]);

	const openNavbarThemePopup = useCallback(() => {
		openDisclosure(SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME);
	}, [openDisclosure]);

	const closeNavbarThemePopup = useCallback(() => {
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME);
	}, [closeDisclosure]);

	const closePlayNextPromptModePopup = useCallback(() => {
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE);
	}, [closeDisclosure]);

	const closeLogsPopup = useCallback(() => {
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.LOGS);
	}, [closeDisclosure]);

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

	const toolbarActions = useToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler: registerToolbarBackHandler
	});

	const toggleBooleanSetting = useCallback((key) => {
		handleSettingChange(key, !settings[key]);
	}, [handleSettingChange, settings]);

	const toggleEnableTranscoding = useCallback(() => {
		toggleBooleanSetting('enableTranscoding');
	}, [toggleBooleanSetting]);

	const toggleAutoPlayNext = useCallback(() => {
		toggleBooleanSetting('autoPlayNext');
	}, [toggleBooleanSetting]);

	const toggleShowPlayNextPrompt = useCallback(() => {
		toggleBooleanSetting('showPlayNextPrompt');
	}, [toggleBooleanSetting]);

	const openPlayNextPromptModePopup = useCallback(() => {
		if (settings.showPlayNextPrompt !== false) {
			openDisclosure(SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE);
		}
	}, [openDisclosure, settings.showPlayNextPrompt]);

	const toggleSkipIntro = useCallback(() => {
		toggleBooleanSetting('skipIntro');
	}, [toggleBooleanSetting]);

	const toggleForceTranscoding = useCallback(() => {
		toggleBooleanSetting('forceTranscoding');
	}, [toggleBooleanSetting]);

	const toggleForceTranscodingWithSubtitles = useCallback(() => {
		toggleBooleanSetting('forceTranscodingWithSubtitles');
	}, [toggleBooleanSetting]);

	const toggleRelaxedPlaybackProfile = useCallback(() => {
		toggleBooleanSetting('relaxedPlaybackProfile');
	}, [toggleBooleanSetting]);

	const toggleShowBackdrops = useCallback(() => {
		toggleBooleanSetting('showBackdrops');
	}, [toggleBooleanSetting]);

	const toggleShowSeasonImages = useCallback(() => {
		toggleBooleanSetting('showSeasonImages');
	}, [toggleBooleanSetting]);

	const toggleSidewaysEpisodeList = useCallback(() => {
		toggleBooleanSetting('useSidewaysEpisodeList');
	}, [toggleBooleanSetting]);

	const toggleDisableAnimations = useCallback(() => {
		toggleBooleanSetting('disableAnimations');
	}, [toggleBooleanSetting]);

	const toggleDisableAllAnimations = useCallback(() => {
		toggleBooleanSetting('disableAllAnimations');
	}, [toggleBooleanSetting]);

	const toggleShowMediaBar = useCallback(() => {
		toggleBooleanSetting('showMediaBar');
	}, [toggleBooleanSetting]);

	const toggleShowPerformanceOverlay = useCallback(() => {
		toggleBooleanSetting('showPerformanceOverlay');
	}, [toggleBooleanSetting]);

	const handleNavbarThemeSelect = useCallback((event) => {
		const themeValue = event.currentTarget.dataset.theme;
		if (!themeValue) return;
		handleSettingChange('navbarTheme', themeValue);
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME);
	}, [closeDisclosure, handleSettingChange]);

	const handleBitrateSelect = useCallback((event) => {
		const bitrate = event.currentTarget.dataset.bitrate;
		if (!bitrate) return;
		handleSettingChange('maxBitrate', bitrate);
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.BITRATE);
	}, [closeDisclosure, handleSettingChange]);

	const handleAudioLanguageSelect = useCallback((event) => {
		const language = event.currentTarget.dataset.language;
		if (!language) return;
		handleSettingChange('preferredAudioLanguage', language);
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE);
	}, [closeDisclosure, handleSettingChange]);

	const handleSubtitleLanguageSelect = useCallback((event) => {
		const language = event.currentTarget.dataset.language;
		if (!language) return;
		handleSettingChange('preferredSubtitleLanguage', language);
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE);
	}, [closeDisclosure, handleSettingChange]);

	const setSegmentsOnlyPromptMode = useCallback(() => {
		handleSettingChange('playNextPromptMode', 'segmentsOnly');
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE);
	}, [closeDisclosure, handleSettingChange]);

	const setSegmentsOrLast60PromptMode = useCallback(() => {
		handleSettingChange('playNextPromptMode', 'segmentsOrLast60');
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE);
	}, [closeDisclosure, handleSettingChange]);

	const getBitrateLabel = (value) => {
		const option = BITRATE_OPTIONS.find(o => o.value === value);
		return option ? option.label : `${value} Mbps`;
	};

	const getLanguageLabel = (value) => {
		const option = LANGUAGE_OPTIONS.find(o => o.value === value);
		return option ? option.label : value;
	};

	const getPlayNextPromptModeLabel = (value) => {
		switch (value) {
			case 'segmentsOnly':
				return 'Outro/Credits Only';
			case 'segmentsOrLast60':
			default:
				return 'Segments or Last 60s';
		}
	};

	const getNavbarThemeLabel = (value) => {
		const option = NAVBAR_THEME_OPTIONS.find((theme) => theme.value === value);
		return option ? option.label : 'Classic';
	};

	const handleInternalBack = useCallback(() => {
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
		return runToolbarBackHandler();
	}, [
		cacheWipeInProgress,
		closeDisclosure,
		disclosures,
		runToolbarBackHandler
	]);

	usePanelBackHandler(registerBackHandler, handleInternalBack, {enabled: isActive});

	return (
		<Panel {...rest}>
			<Header title="Settings" />
			<SettingsToolbar
				{...toolbarActions}
			/>
			<Scroller
				className={css.settingsContainer}
				cbScrollTo={captureSettingsScrollRestore}
				onScrollStop={handleSettingsScrollMemoryStop}
			>
				<div className={css.content}>
					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Server Information</BodyText>
						{loading ? (
							<div className={css.loadingItem}>
								<Spinner size="small" />
							</div>
						) : (
							<>
								<Item className={css.infoItem} label="Server Name" slotAfter={serverInfo?.ServerName || 'Unknown'} />
								<Item className={css.infoItem} label="Server Version" slotAfter={serverInfo?.Version || 'Unknown'} />
								<Item className={css.infoItem} label="Server URL" slotAfter={jellyfinService.serverUrl || 'Not connected'} />
							</>
						)}
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Saved Servers</BodyText>
						{savedServers.length === 0 && (
							<BodyText className={css.mutedText}>No saved servers yet. Sign in to add one.</BodyText>
						)}
						<div className={css.serverList}>
							{savedServers.map((entry) => {
								const key = `${entry.serverId}:${entry.userId}`;
								return (
									<div key={key} className={`${css.serverCard} ${entry.isActive ? css.activeCard : ''}`}>
										<div className={css.serverCardMain}>
											<div className={css.serverTitle}>{entry.serverName || 'Jellyfin Server'}</div>
											<div className={css.serverMeta}>{entry.username} - {entry.url}</div>
										</div>
										<div className={css.serverCardActions}>
												<Button
													size="small"
													minWidth={false}
													data-server-key={key}
													onClick={handleSwitchServerClick}
													selected={switchingServerId === key}
												>
												{entry.isActive ? 'Active' : switchingServerId === key ? 'Switching...' : 'Switch'}
											</Button>
												<Button
													size="small"
													minWidth={false}
													data-server-key={key}
													onClick={handleForgetServerClick}
												>
												Forget
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Home Rows</BodyText>
							<SwitchItem
								className={css.switchItem}
								selected={settings.homeRows?.recentlyAdded !== false}
								onToggle={toggleHomeRowRecentlyAdded}
							>
							Recently Added
						</SwitchItem>
							<SwitchItem
								className={css.switchItem}
								selected={settings.homeRows?.continueWatching !== false}
								onToggle={toggleHomeRowContinueWatching}
							>
							Continue Watching
						</SwitchItem>
							<SwitchItem
								className={css.switchItem}
								selected={settings.homeRows?.nextUp !== false}
								onToggle={toggleHomeRowNextUp}
							>
							Next Up
						</SwitchItem>
							<SwitchItem
								className={css.switchItem}
								selected={settings.homeRows?.latestMovies !== false}
								onToggle={toggleHomeRowLatestMovies}
							>
							Latest Movies
						</SwitchItem>
							<SwitchItem
								className={css.switchItem}
								selected={settings.homeRows?.latestShows !== false}
								onToggle={toggleHomeRowLatestShows}
							>
							Latest TV Shows
						</SwitchItem>
							<SwitchItem
								className={css.switchItem}
								selected={settings.homeRows?.myRequests !== false}
								onToggle={toggleHomeRowMyRequests}
							>
							My Requests
						</SwitchItem>
						<div className={css.rowOrderHeader}>Row Order</div>
						<div className={css.rowOrderList}>
							{(settings.homeRowOrder || HOME_ROW_ORDER).map((rowKey, index, list) => (
								<div key={rowKey} className={css.rowOrderItem}>
									<BodyText className={css.rowOrderLabel}>{getHomeRowLabel(rowKey)}</BodyText>
									<div className={css.rowOrderActions}>
											<Button
												size="small"
												minWidth={false}
												disabled={index === 0}
												data-row-key={rowKey}
												onClick={moveHomeRowUp}
											>
											Up
										</Button>
											<Button
												size="small"
												minWidth={false}
												disabled={index === list.length - 1}
												data-row-key={rowKey}
												onClick={moveHomeRowDown}
											>
											Down
										</Button>
									</div>
								</div>
							))}
						</div>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Account</BodyText>
						{loading ? (
							<div className={css.loadingItem}>
								<Spinner size="small" />
							</div>
						) : (
							<>
								<Item className={css.infoItem} label="Username" slotAfter={userInfo?.Name || 'Unknown'} />
								<Item className={css.infoItem} label="User ID" slotAfter={userInfo?.Id?.substring(0, 8) + '...' || 'Unknown'} />
									<Button
										className={css.logoutButton}
										onClick={openLogoutConfirm}
										icon="closex"
									>
									Sign Out
								</Button>
							</>
						)}
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Playback</BodyText>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleAutoPlayNext}
								selected={settings.autoPlayNext}
							>
							Auto-play Next Episode
						</SwitchItem>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleShowPlayNextPrompt}
								selected={settings.showPlayNextPrompt !== false}
							>
							Show Play Next Prompt
						</SwitchItem>

							<Item
								className={css.settingItem}
								label="Play Next Prompt Mode"
								slotAfter={getPlayNextPromptModeLabel(settings.playNextPromptMode)}
								onClick={openPlayNextPromptModePopup}
							/>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleSkipIntro}
								selected={settings.skipIntro}
							>
							Show Skip Intro/Recap Prompt
						</SwitchItem>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Language Preferences</BodyText>

							<Item
								className={css.settingItem}
								label="Preferred Audio Language"
								slotAfter={getLanguageLabel(settings.preferredAudioLanguage)}
								onClick={openAudioLangPopup}
							/>

							<Item
								className={css.settingItem}
								label="Preferred Subtitle Language"
								slotAfter={getLanguageLabel(settings.preferredSubtitleLanguage)}
								onClick={openSubtitleLangPopup}
							/>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Transcoding</BodyText>

							<Item
								className={css.settingItem}
								label="Maximum Bitrate"
								slotAfter={getBitrateLabel(settings.maxBitrate)}
								onClick={openBitratePopup}
							/>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleEnableTranscoding}
								selected={settings.enableTranscoding}
							>
							Enable Transcoding
						</SwitchItem>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleForceTranscoding}
								selected={settings.forceTranscoding}
							>
							Force Transcoding (always)
						</SwitchItem>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleForceTranscodingWithSubtitles}
								selected={settings.forceTranscodingWithSubtitles}
							>
							Force Transcoding with Subtitles (burn-in subs)
						</SwitchItem>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Display</BodyText>

							<Item
								className={css.settingItem}
								label="Navigation Theme"
								slotAfter={getNavbarThemeLabel(settings.navbarTheme)}
								onClick={openNavbarThemePopup}
							/>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleShowBackdrops}
								selected={settings.showBackdrops}
							>
							Show Background Images
						</SwitchItem>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleShowSeasonImages}
								selected={settings.showSeasonImages === true}
							>
							Show Season Card Images (Elegant)
						</SwitchItem>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleSidewaysEpisodeList}
								selected={settings.useSidewaysEpisodeList !== false}
							>
							Sideways Episode List (Elegant)
						</SwitchItem>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleDisableAnimations}
								selected={settings.disableAnimations}
							>
							Disable Animations (Performance Mode)
						</SwitchItem>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleDisableAllAnimations}
								selected={settings.disableAllAnimations}
							>
							Disable ALL Animations (Performance+ Mode)
						</SwitchItem>

							<SwitchItem
								className={css.switchItem}
								onToggle={toggleShowMediaBar}
								selected={settings.showMediaBar !== false}
							>
							Show Media Bar on Home
						</SwitchItem>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>About</BodyText>
						<Item className={css.infoItem} label="App Version" slotAfter={appVersion} />
						<Item className={css.infoItem} label="Platform" slotAfter="webOS TV" />
						<Item className={css.infoItem} label="webOS Version" slotAfter={webosVersionLabel} />
					</section>

						<section className={css.section}>
							<BodyText className={css.sectionTitle}>Diagnostics</BodyText>
							<SwitchItem
								className={css.switchItem}
								onToggle={toggleShowPerformanceOverlay}
								selected={settings.showPerformanceOverlay === true}
							>
								Performance Overlay (FPS/Input)
							</SwitchItem>
							{STYLE_DEBUG_ENABLED ? (
								<SwitchItem
									className={css.switchItem}
									onToggle={toggleRelaxedPlaybackProfile}
									selected={settings.relaxedPlaybackProfile === true}
								>
									Relaxed Playback Profile (Debug)
								</SwitchItem>
							) : null}
							{STYLE_DEBUG_ENABLED ? (
								<Item
									className={css.settingItem}
									label="Styling Debug Panel"
									slotAfter="Open"
									onClick={openStylingDebugPanel}
								/>
							) : null}
							<Item
								className={css.settingItem}
								label="Logs"
								slotAfter={`${appLogCount} entries`}
								onClick={openLogsPopup}
							/>
							<Item
								className={css.settingItem}
								label="Wipe App Cache"
								slotAfter={cacheWipeInProgress ? 'Wiping...' : 'Run'}
								onClick={openWipeCacheConfirm}
							/>
						</section>
				</div>
			</Scroller>

				<Popup
					open={bitratePopupOpen}
					onClose={closeBitratePopup}
					css={popupShellCss}
				>
				<div className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Select Maximum Bitrate</BodyText>
						{BITRATE_OPTIONS.map(option => (
							<Button
								key={option.value}
								data-bitrate={option.value}
								className={css.popupOption}
								selected={settings.maxBitrate === option.value}
								onClick={handleBitrateSelect}
							>
							{option.label}
						</Button>
					))}
				</div>
			</Popup>

				<Popup
					open={audioLangPopupOpen}
					onClose={closeAudioLangPopup}
					css={popupShellCss}
				>
				<div className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Preferred Audio Language</BodyText>
					<div className={css.popupOptions}>
							{LANGUAGE_OPTIONS.map(option => (
								<Button
									key={option.value}
									data-language={option.value}
									className={css.popupOption}
									selected={settings.preferredAudioLanguage === option.value}
									onClick={handleAudioLanguageSelect}
								>
								{option.label}
							</Button>
						))}
					</div>
				</div>
			</Popup>

				<Popup
					open={subtitleLangPopupOpen}
					onClose={closeSubtitleLangPopup}
					css={popupShellCss}
				>
				<div className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Preferred Subtitle Language</BodyText>
					<div className={css.popupOptions}>
							{LANGUAGE_OPTIONS.map(option => (
								<Button
									key={option.value}
									data-language={option.value}
									className={css.popupOption}
									selected={settings.preferredSubtitleLanguage === option.value}
									onClick={handleSubtitleLanguageSelect}
								>
								{option.label}
							</Button>
						))}
					</div>
				</div>
			</Popup>

				<Popup
					open={navbarThemePopupOpen}
					onClose={closeNavbarThemePopup}
					css={popupShellCss}
				>
				<div className={`${popupStyles.popupSurface} ${css.nativeThemePopupContent}`}>
					<BodyText className={css.popupTitle}>Navigation Theme</BodyText>
					<div className={css.nativeThemePopupOptions}>
							{NAVBAR_THEME_OPTIONS.map((option) => (
								<Button
									key={option.value}
									size="small"
									data-theme={option.value}
									selected={settings.navbarTheme === option.value}
									onClick={handleNavbarThemeSelect}
									className={css.popupOption}
								>
								{option.label}
							</Button>
						))}
					</div>
				</div>
			</Popup>

				<Popup
					open={playNextPromptModePopupOpen}
					onClose={closePlayNextPromptModePopup}
					css={popupShellCss}
				>
				<div className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Play Next Prompt Mode</BodyText>
						<Button
							className={css.popupOption}
							selected={settings.playNextPromptMode === 'segmentsOnly'}
							onClick={setSegmentsOnlyPromptMode}
						>
						Outro/Credits Only
					</Button>
						<Button
							className={css.popupOption}
							selected={settings.playNextPromptMode !== 'segmentsOnly'}
							onClick={setSegmentsOrLast60PromptMode}
						>
						Segments or Last 60s
					</Button>
				</div>
			</Popup>

				<Popup
					open={logoutConfirmOpen}
					onClose={closeLogoutConfirm}
					css={popupShellCss}
				>
				<div className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Sign Out</BodyText>
						<BodyText className={css.popupMessage}>
							Are you sure you want to sign out from {serverInfo?.ServerName || 'this server'}?
						</BodyText>
						<div className={css.popupActions}>
							<Button onClick={closeLogoutConfirm} className={css.popupOption}>Cancel</Button>
							<Button onClick={handleLogoutConfirm} className={`${css.popupOption} ${css.dangerButton}`}>Sign Out</Button>
						</div>
					</div>
				</Popup>

			<Popup
				open={logsPopupOpen}
				onClose={closeLogsPopup}
				css={popupShellCss}
			>
				<div className={`${popupStyles.popupSurface} ${css.logPopupContent}`}>
					<BodyText className={css.popupTitle}>Recent Logs</BodyText>
						<div className={css.logActions}>
							<Button size="small" onClick={handleClearLogs} className={css.popupOption}>Clear Logs</Button>
							<Button size="small" onClick={closeLogsPopup} className={css.popupOption}>Close</Button>
						</div>
					<Scroller className={css.logScroller}>
						{appLogs.length === 0 && (
							<BodyText className={css.mutedText}>No logs captured yet.</BodyText>
						)}
						{appLogs.map((entry, index) => (
							<div key={`${entry.ts}-${index}`} className={css.logEntry}>
								<BodyText className={css.logMeta}>[{entry.ts}] {entry.level?.toUpperCase()}</BodyText>
								<BodyText className={css.logText}>{entry.message}</BodyText>
							</div>
						))}
					</Scroller>
				</div>
			</Popup>

			<Popup
				open={wipeCacheConfirmOpen}
				onClose={closeWipeCacheConfirm}
				noAutoDismiss={cacheWipeInProgress}
				css={popupShellCss}
			>
				<div className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Wipe App Cache</BodyText>
					<BodyText className={css.popupMessage}>
						This clears local storage, session storage, cache storage, and IndexedDB, then reloads the app.
					</BodyText>
					{cacheWipeError ? (
						<BodyText className={css.popupMessage}>{cacheWipeError}</BodyText>
					) : null}
					<div className={css.popupActions}>
						<Button
							onClick={closeWipeCacheConfirm}
							disabled={cacheWipeInProgress}
						>
							Cancel
						</Button>
						<Button
							onClick={handleWipeCacheConfirm}
							className={css.dangerButton}
							disabled={cacheWipeInProgress}
							selected={cacheWipeInProgress}
						>
							{cacheWipeInProgress ? 'Wiping...' : 'Wipe & Reload'}
						</Button>
					</div>
				</div>
			</Popup>
		</Panel>
	);
};

export default SettingsPanel;
