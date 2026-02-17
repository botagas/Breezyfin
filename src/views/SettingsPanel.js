import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Button from '../components/BreezyButton';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import Item from '@enact/sandstone/Item';
import SwitchItem from '@enact/sandstone/SwitchItem';
import Popup from '@enact/sandstone/Popup';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';
import {getAppLogs, clearAppLogs} from '../utils/appLogger';
import {getAppVersion, loadAppVersion} from '../utils/appInfo';
import {isStyleDebugEnabled} from '../utils/featureFlags';

import css from './SettingsPanel.module.less';
import popupStyles from '../styles/popupStyles.module.less';
import {popupShellCss} from '../styles/popupStyles';

const HOME_ROW_ORDER = [
	'myRequests',
	'continueWatching',
	'nextUp',
	'recentlyAdded',
	'latestMovies',
	'latestShows'
];

// Settings defaults
const DEFAULT_SETTINGS = {
	maxBitrate: '40',
	enableTranscoding: true,
	forceTranscoding: false,
	forceTranscodingWithSubtitles: true,
	preferredAudioLanguage: 'eng',
	preferredSubtitleLanguage: 'eng',
	disableAnimations: false,
	disableAllAnimations: false,
	showMediaBar: true,
	navbarTheme: 'classic',
	autoPlayNext: true,
	showPlayNextPrompt: true,
	playNextPromptMode: 'segmentsOrLast60',
	skipIntro: true,
	showBackdrops: true,
	showSeasonImages: false,
	useSidewaysEpisodeList: true,
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

const SettingsPanel = ({ onNavigate, onSwitchUser, onLogout, onSignOut, onExit, registerBackHandler, isActive = false, ...rest }) => {
	const [appVersion, setAppVersion] = useState(getAppVersion());
	const [settings, setSettings] = useState(DEFAULT_SETTINGS);
	const [serverInfo, setServerInfo] = useState(null);
	const [userInfo, setUserInfo] = useState(null);
	const [loading, setLoading] = useState(true);
	const [bitratePopupOpen, setBitratePopupOpen] = useState(false);
	const [audioLangPopupOpen, setAudioLangPopupOpen] = useState(false);
	const [subtitleLangPopupOpen, setSubtitleLangPopupOpen] = useState(false);
	const [navbarThemePopupOpen, setNavbarThemePopupOpen] = useState(false);
	const [playNextPromptModePopupOpen, setPlayNextPromptModePopupOpen] = useState(false);
	const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
	const [savedServers, setSavedServers] = useState([]);
	const [switchingServerId, setSwitchingServerId] = useState(null);
	const [logsPopupOpen, setLogsPopupOpen] = useState(false);
	const [appLogs, setAppLogs] = useState([]);
	const [appLogCount, setAppLogCount] = useState(0);
	const toolbarBackHandlerRef = useRef(null);
	const savedServersByKey = useMemo(() => {
		const map = new Map();
		savedServers.forEach((entry) => {
			map.set(`${entry.serverId}:${entry.userId}`, entry);
		});
		return map;
	}, [savedServers]);

	const loadSettings = useCallback(() => {
		try {
			const stored = localStorage.getItem('breezyfinSettings');
			if (stored) {
				const parsed = JSON.parse(stored);
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
			}
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
			try {
				localStorage.setItem('breezyfinSettings', JSON.stringify(newSettings));
				if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
					window.dispatchEvent(new CustomEvent('breezyfin-settings-changed', { detail: newSettings }));
				}
			} catch (error) {
				console.error('Failed to save settings:', error);
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
			try {
				localStorage.setItem('breezyfinSettings', JSON.stringify(updated));
			} catch (error) {
				console.error('Failed to save settings:', error);
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
			try {
				localStorage.setItem('breezyfinSettings', JSON.stringify(updated));
			} catch (error) {
				console.error('Failed to save settings:', error);
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
		setLogoutConfirmOpen(false);
		if (typeof onSignOut === 'function') {
			onSignOut();
			return;
		}
		onLogout();
	}, [onLogout, onSignOut]);

	const openLogsPopup = useCallback(() => {
		const logs = getAppLogs();
		setAppLogs(logs.slice().reverse());
		setAppLogCount(logs.length);
		setLogsPopupOpen(true);
	}, []);

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
		setLogoutConfirmOpen(true);
	}, []);

	const closeLogoutConfirm = useCallback(() => {
		setLogoutConfirmOpen(false);
	}, []);

	const openBitratePopup = useCallback(() => {
		setBitratePopupOpen(true);
	}, []);

	const closeBitratePopup = useCallback(() => {
		setBitratePopupOpen(false);
	}, []);

	const openAudioLangPopup = useCallback(() => {
		setAudioLangPopupOpen(true);
	}, []);

	const closeAudioLangPopup = useCallback(() => {
		setAudioLangPopupOpen(false);
	}, []);

	const openSubtitleLangPopup = useCallback(() => {
		setSubtitleLangPopupOpen(true);
	}, []);

	const closeSubtitleLangPopup = useCallback(() => {
		setSubtitleLangPopupOpen(false);
	}, []);

	const openNavbarThemePopup = useCallback(() => {
		setNavbarThemePopupOpen(true);
	}, []);

	const closeNavbarThemePopup = useCallback(() => {
		setNavbarThemePopupOpen(false);
	}, []);

	const closePlayNextPromptModePopup = useCallback(() => {
		setPlayNextPromptModePopupOpen(false);
	}, []);

	const closeLogsPopup = useCallback(() => {
		setLogsPopupOpen(false);
	}, []);

	const openStylingDebugPanel = useCallback(() => {
		if (!STYLE_DEBUG_ENABLED) return;
		if (typeof onNavigate === 'function') {
			onNavigate('styleDebug');
		}
	}, [onNavigate]);

	const registerToolbarBackHandler = useCallback((handler) => {
		toolbarBackHandlerRef.current = handler;
	}, []);

	const toggleEnableTranscoding = useCallback(() => {
		handleSettingChange('enableTranscoding', !settings.enableTranscoding);
	}, [handleSettingChange, settings.enableTranscoding]);

	const toggleAutoPlayNext = useCallback(() => {
		handleSettingChange('autoPlayNext', !settings.autoPlayNext);
	}, [handleSettingChange, settings.autoPlayNext]);

	const toggleShowPlayNextPrompt = useCallback(() => {
		handleSettingChange('showPlayNextPrompt', !settings.showPlayNextPrompt);
	}, [handleSettingChange, settings.showPlayNextPrompt]);

	const openPlayNextPromptModePopup = useCallback(() => {
		if (settings.showPlayNextPrompt !== false) {
			setPlayNextPromptModePopupOpen(true);
		}
	}, [settings.showPlayNextPrompt]);

	const toggleSkipIntro = useCallback(() => {
		handleSettingChange('skipIntro', !settings.skipIntro);
	}, [handleSettingChange, settings.skipIntro]);

	const toggleForceTranscoding = useCallback(() => {
		handleSettingChange('forceTranscoding', !settings.forceTranscoding);
	}, [handleSettingChange, settings.forceTranscoding]);

	const toggleForceTranscodingWithSubtitles = useCallback(() => {
		handleSettingChange('forceTranscodingWithSubtitles', !settings.forceTranscodingWithSubtitles);
	}, [handleSettingChange, settings.forceTranscodingWithSubtitles]);

	const toggleShowBackdrops = useCallback(() => {
		handleSettingChange('showBackdrops', !settings.showBackdrops);
	}, [handleSettingChange, settings.showBackdrops]);

	const toggleShowSeasonImages = useCallback(() => {
		handleSettingChange('showSeasonImages', !settings.showSeasonImages);
	}, [handleSettingChange, settings.showSeasonImages]);

	const toggleSidewaysEpisodeList = useCallback(() => {
		handleSettingChange('useSidewaysEpisodeList', !settings.useSidewaysEpisodeList);
	}, [handleSettingChange, settings.useSidewaysEpisodeList]);

	const toggleDisableAnimations = useCallback(() => {
		handleSettingChange('disableAnimations', !settings.disableAnimations);
	}, [handleSettingChange, settings.disableAnimations]);

	const toggleDisableAllAnimations = useCallback(() => {
		handleSettingChange('disableAllAnimations', !settings.disableAllAnimations);
	}, [handleSettingChange, settings.disableAllAnimations]);

	const toggleShowMediaBar = useCallback(() => {
		handleSettingChange('showMediaBar', !settings.showMediaBar);
	}, [handleSettingChange, settings.showMediaBar]);

	const handleNavbarThemeSelect = useCallback((event) => {
		const themeValue = event.currentTarget.dataset.theme;
		if (!themeValue) return;
		handleSettingChange('navbarTheme', themeValue);
		setNavbarThemePopupOpen(false);
	}, [handleSettingChange]);

	const handleBitrateSelect = useCallback((event) => {
		const bitrate = event.currentTarget.dataset.bitrate;
		if (!bitrate) return;
		handleSettingChange('maxBitrate', bitrate);
		setBitratePopupOpen(false);
	}, [handleSettingChange]);

	const handleAudioLanguageSelect = useCallback((event) => {
		const language = event.currentTarget.dataset.language;
		if (!language) return;
		handleSettingChange('preferredAudioLanguage', language);
		setAudioLangPopupOpen(false);
	}, [handleSettingChange]);

	const handleSubtitleLanguageSelect = useCallback((event) => {
		const language = event.currentTarget.dataset.language;
		if (!language) return;
		handleSettingChange('preferredSubtitleLanguage', language);
		setSubtitleLangPopupOpen(false);
	}, [handleSettingChange]);

	const setSegmentsOnlyPromptMode = useCallback(() => {
		handleSettingChange('playNextPromptMode', 'segmentsOnly');
		setPlayNextPromptModePopupOpen(false);
	}, [handleSettingChange]);

	const setSegmentsOrLast60PromptMode = useCallback(() => {
		handleSettingChange('playNextPromptMode', 'segmentsOrLast60');
		setPlayNextPromptModePopupOpen(false);
	}, [handleSettingChange]);

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
		if (logsPopupOpen) {
			setLogsPopupOpen(false);
			return true;
		}
		if (logoutConfirmOpen) {
			setLogoutConfirmOpen(false);
			return true;
		}
		if (playNextPromptModePopupOpen) {
			setPlayNextPromptModePopupOpen(false);
			return true;
		}
		if (navbarThemePopupOpen) {
			setNavbarThemePopupOpen(false);
			return true;
		}
		if (subtitleLangPopupOpen) {
			setSubtitleLangPopupOpen(false);
			return true;
		}
		if (audioLangPopupOpen) {
			setAudioLangPopupOpen(false);
			return true;
		}
		if (bitratePopupOpen) {
			setBitratePopupOpen(false);
			return true;
		}
		if (typeof toolbarBackHandlerRef.current === 'function') {
			return toolbarBackHandlerRef.current() === true;
		}
		return false;
	}, [
		audioLangPopupOpen,
		bitratePopupOpen,
		logoutConfirmOpen,
		logsPopupOpen,
		navbarThemePopupOpen,
		playNextPromptModePopupOpen,
		subtitleLangPopupOpen
	]);

	useEffect(() => {
		if (!isActive) return undefined;
		if (typeof registerBackHandler !== 'function') return undefined;
		registerBackHandler(handleInternalBack);
		return () => registerBackHandler(null);
	}, [handleInternalBack, isActive, registerBackHandler]);

	return (
		<Panel {...rest}>
			<Header title="Settings" />
			<Toolbar
				activeSection="settings"
				onNavigate={onNavigate}
				onSwitchUser={onSwitchUser}
				onLogout={onLogout}
				onExit={onExit}
				registerBackHandler={registerToolbarBackHandler}
			/>
			<Scroller className={css.settingsContainer}>
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
						<BodyText className={css.sectionTitle}>Playback</BodyText>

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
					</section>

						<section className={css.section}>
							<BodyText className={css.sectionTitle}>Diagnostics</BodyText>
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
		</Panel>
	);
};

export default SettingsPanel;
