import { useState, useEffect } from 'react';
import { Panel, Header } from '@enact/sandstone/Panels';
import Button from '@enact/sandstone/Button';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import Item from '@enact/sandstone/Item';
import SwitchItem from '@enact/sandstone/SwitchItem';
import Popup from '@enact/sandstone/Popup';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';
import {KeyCodes, isBackKey} from '../utils/keyCodes';
import {getAppLogs, clearAppLogs} from '../utils/appLogger';
import {getAppVersion, loadAppVersion} from '../utils/appInfo';

import css from './SettingsPanel.module.less';

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
	autoPlayNext: true,
	showPlayNextPrompt: true,
	playNextPromptMode: 'segmentsOrLast60',
	skipIntro: true,
	showBackdrops: true,
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

const SettingsPanel = ({ onNavigate, onLogout, onExit, isActive = false, ...rest }) => {
	const [appVersion, setAppVersion] = useState(getAppVersion());
	const [settings, setSettings] = useState(DEFAULT_SETTINGS);
	const [serverInfo, setServerInfo] = useState(null);
	const [userInfo, setUserInfo] = useState(null);
	const [loading, setLoading] = useState(true);
	const [bitratePopupOpen, setBitratePopupOpen] = useState(false);
	const [audioLangPopupOpen, setAudioLangPopupOpen] = useState(false);
	const [subtitleLangPopupOpen, setSubtitleLangPopupOpen] = useState(false);
	const [playNextPromptModePopupOpen, setPlayNextPromptModePopupOpen] = useState(false);
	const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
	const [savedServers, setSavedServers] = useState([]);
	const [switchingServerId, setSwitchingServerId] = useState(null);
	const [logsPopupOpen, setLogsPopupOpen] = useState(false);
	const [appLogs, setAppLogs] = useState([]);

	useEffect(() => {
		loadSettings();
		loadServerInfo();
		refreshSavedServers();
	}, []);

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

	const loadSettings = () => {
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
	};

	const saveSettings = (newSettings) => {
		try {
			localStorage.setItem('breezyfinSettings', JSON.stringify(newSettings));
			setSettings(newSettings);
		} catch (error) {
			console.error('Failed to save settings:', error);
		}
	};

	const loadServerInfo = async () => {
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
	};

	const handleSettingChange = (key, value) => {
		const newSettings = { ...settings, [key]: value };
		saveSettings(newSettings);
	};

	const handleHomeRowToggle = (rowKey) => {
		const updated = {
			...settings,
			homeRows: {
				...settings.homeRows,
				[rowKey]: !settings.homeRows?.[rowKey]
			}
		};
		saveSettings(updated);
	};

	const handleHomeRowReorder = (rowKey, direction) => {
		const order = Array.isArray(settings.homeRowOrder) ? [...settings.homeRowOrder] : [...HOME_ROW_ORDER];
		const index = order.indexOf(rowKey);
		if (index === -1) return;
		const swapIndex = direction === 'up' ? index - 1 : index + 1;
		if (swapIndex < 0 || swapIndex >= order.length) return;
		[order[index], order[swapIndex]] = [order[swapIndex], order[index]];
		saveSettings({ ...settings, homeRowOrder: order });
	};

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

	const refreshSavedServers = () => {
		try {
			setSavedServers(jellyfinService.getSavedServers() || []);
		} catch (err) {
			console.error('Failed to fetch saved servers:', err);
		}
	};

	const handleSwitchServer = async (entry) => {
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
	};

	const handleForgetServer = (entry) => {
		if (!entry) return;
		jellyfinService.forgetServer(entry.serverId, entry.userId);
		refreshSavedServers();
	};

	const handleLogoutConfirm = () => {
		setLogoutConfirmOpen(false);
		onLogout();
	};

	const openLogsPopup = () => {
		setAppLogs(getAppLogs().slice().reverse());
		setLogsPopupOpen(true);
	};

	const handleClearLogs = () => {
		clearAppLogs();
		setAppLogs([]);
	};

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

	// Improve remote back handling so physical back/escape keys always leave settings
	useEffect(() => {
		if (!isActive) return undefined;
		const handleKeyDown = (e) => {
			const code = e.keyCode || e.which;
			if (isBackKey(code)) {
				e.preventDefault();
				onNavigate('home');
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isActive, onNavigate]);

	return (
		<Panel {...rest}>
			<Header title="Settings" />
			<Toolbar
				activeSection="settings"
				onNavigate={onNavigate}
				onLogout={onLogout}
				onExit={onExit}
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
												onClick={() => handleSwitchServer(entry)}
												selected={switchingServerId === key}
											>
												{entry.isActive ? 'Active' : switchingServerId === key ? 'Switching...' : 'Switch'}
											</Button>
											<Button
												size="small"
												minWidth={false}
												onClick={() => handleForgetServer(entry)}
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
							onToggle={() => handleHomeRowToggle('recentlyAdded')}
						>
							Recently Added
						</SwitchItem>
						<SwitchItem
							className={css.switchItem}
							selected={settings.homeRows?.continueWatching !== false}
							onToggle={() => handleHomeRowToggle('continueWatching')}
						>
							Continue Watching
						</SwitchItem>
						<SwitchItem
							className={css.switchItem}
							selected={settings.homeRows?.nextUp !== false}
							onToggle={() => handleHomeRowToggle('nextUp')}
						>
							Next Up
						</SwitchItem>
						<SwitchItem
							className={css.switchItem}
							selected={settings.homeRows?.latestMovies !== false}
							onToggle={() => handleHomeRowToggle('latestMovies')}
						>
							Latest Movies
						</SwitchItem>
						<SwitchItem
							className={css.switchItem}
							selected={settings.homeRows?.latestShows !== false}
							onToggle={() => handleHomeRowToggle('latestShows')}
						>
							Latest TV Shows
						</SwitchItem>
						<SwitchItem
							className={css.switchItem}
							selected={settings.homeRows?.myRequests !== false}
							onToggle={() => handleHomeRowToggle('myRequests')}
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
											onClick={() => handleHomeRowReorder(rowKey, 'up')}
										>
											Up
										</Button>
										<Button
											size="small"
											minWidth={false}
											disabled={index === list.length - 1}
											onClick={() => handleHomeRowReorder(rowKey, 'down')}
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
									onClick={() => setLogoutConfirmOpen(true)}
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
							onClick={() => setBitratePopupOpen(true)}
						/>
						
						<SwitchItem
							className={css.switchItem}
							onToggle={() => handleSettingChange('enableTranscoding', !settings.enableTranscoding)}
							selected={settings.enableTranscoding}
						>
							Enable Transcoding
						</SwitchItem>
						
						<SwitchItem
							className={css.switchItem}
							onToggle={() => handleSettingChange('autoPlayNext', !settings.autoPlayNext)}
							selected={settings.autoPlayNext}
						>
							Auto-play Next Episode
						</SwitchItem>

						<SwitchItem
							className={css.switchItem}
							onToggle={() => handleSettingChange('showPlayNextPrompt', !settings.showPlayNextPrompt)}
							selected={settings.showPlayNextPrompt !== false}
						>
							Show Play Next Prompt
						</SwitchItem>

						<Item
							className={css.settingItem}
							label="Play Next Prompt Mode"
							slotAfter={getPlayNextPromptModeLabel(settings.playNextPromptMode)}
							onClick={() => {
								if (settings.showPlayNextPrompt !== false) {
									setPlayNextPromptModePopupOpen(true);
								}
							}}
						/>
						
						<SwitchItem
							className={css.switchItem}
							onToggle={() => handleSettingChange('skipIntro', !settings.skipIntro)}
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
							onClick={() => setAudioLangPopupOpen(true)}
						/>
						
						<Item
							className={css.settingItem}
							label="Preferred Subtitle Language"
							slotAfter={getLanguageLabel(settings.preferredSubtitleLanguage)}
							onClick={() => setSubtitleLangPopupOpen(true)}
						/>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Playback</BodyText>
						
						<SwitchItem
							className={css.switchItem}
							onToggle={() => handleSettingChange('forceTranscoding', !settings.forceTranscoding)}
							selected={settings.forceTranscoding}
						>
							Force Transcoding (always)
						</SwitchItem>
						
						<SwitchItem
							className={css.switchItem}
							onToggle={() => handleSettingChange('forceTranscodingWithSubtitles', !settings.forceTranscodingWithSubtitles)}
							selected={settings.forceTranscodingWithSubtitles}
						>
							Force Transcoding with Subtitles (burn-in subs)
						</SwitchItem>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Display</BodyText>
						
						<SwitchItem
							className={css.switchItem}
							onToggle={() => handleSettingChange('showBackdrops', !settings.showBackdrops)}
							selected={settings.showBackdrops}
						>
							Show Background Images
						</SwitchItem>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>About</BodyText>
						<Item className={css.infoItem} label="App Version" slotAfter={appVersion} />
						<Item className={css.infoItem} label="Platform" slotAfter="webOS TV" />
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Diagnostics</BodyText>
						<Item
							className={css.settingItem}
							label="Logs"
							slotAfter={`${getAppLogs().length} entries`}
							onClick={openLogsPopup}
						/>
					</section>
				</div>
			</Scroller>

			<Popup
				open={bitratePopupOpen}
				onClose={() => setBitratePopupOpen(false)}
				className={css.popup}
			>
				<div className={css.popupContent}>
					<BodyText className={css.popupTitle}>Select Maximum Bitrate</BodyText>
					{BITRATE_OPTIONS.map(option => (
						<Button
							key={option.value}
							className={css.popupOption}
							selected={settings.maxBitrate === option.value}
							onClick={() => {
								handleSettingChange('maxBitrate', option.value);
								setBitratePopupOpen(false);
							}}
						>
							{option.label}
						</Button>
					))}
				</div>
			</Popup>

			<Popup
				open={audioLangPopupOpen}
				onClose={() => setAudioLangPopupOpen(false)}
				className={css.popup}
			>
				<div className={css.popupContent}>
					<BodyText className={css.popupTitle}>Preferred Audio Language</BodyText>
					<div className={css.popupOptions}>
						{LANGUAGE_OPTIONS.map(option => (
							<Button
								key={option.value}
								className={css.popupOption}
								selected={settings.preferredAudioLanguage === option.value}
								onClick={() => {
									handleSettingChange('preferredAudioLanguage', option.value);
									setAudioLangPopupOpen(false);
								}}
							>
								{option.label}
							</Button>
						))}
					</div>
				</div>
			</Popup>

			<Popup
				open={subtitleLangPopupOpen}
				onClose={() => setSubtitleLangPopupOpen(false)}
				className={css.popup}
			>
				<div className={css.popupContent}>
					<BodyText className={css.popupTitle}>Preferred Subtitle Language</BodyText>
					<div className={css.popupOptions}>
						{LANGUAGE_OPTIONS.map(option => (
							<Button
								key={option.value}
								className={css.popupOption}
								selected={settings.preferredSubtitleLanguage === option.value}
								onClick={() => {
									handleSettingChange('preferredSubtitleLanguage', option.value);
									setSubtitleLangPopupOpen(false);
								}}
							>
								{option.label}
							</Button>
						))}
					</div>
				</div>
			</Popup>

			<Popup
				open={playNextPromptModePopupOpen}
				onClose={() => setPlayNextPromptModePopupOpen(false)}
				className={css.popup}
			>
				<div className={css.popupContent}>
					<BodyText className={css.popupTitle}>Play Next Prompt Mode</BodyText>
					<Button
						className={css.popupOption}
						selected={settings.playNextPromptMode === 'segmentsOnly'}
						onClick={() => {
							handleSettingChange('playNextPromptMode', 'segmentsOnly');
							setPlayNextPromptModePopupOpen(false);
						}}
					>
						Outro/Credits Only
					</Button>
					<Button
						className={css.popupOption}
						selected={settings.playNextPromptMode !== 'segmentsOnly'}
						onClick={() => {
							handleSettingChange('playNextPromptMode', 'segmentsOrLast60');
							setPlayNextPromptModePopupOpen(false);
						}}
					>
						Segments or Last 60s
					</Button>
				</div>
			</Popup>

			<Popup
				open={logoutConfirmOpen}
				onClose={() => setLogoutConfirmOpen(false)}
				className={css.popup}
			>
				<div className={css.popupContent}>
					<BodyText className={css.popupTitle}>Sign Out</BodyText>
					<BodyText className={css.popupMessage}>
						Are you sure you want to sign out from {serverInfo?.ServerName || 'this server'}?
					</BodyText>
					<div className={css.popupActions}>
						<Button onClick={() => setLogoutConfirmOpen(false)}>Cancel</Button>
						<Button onClick={handleLogoutConfirm} className={css.dangerButton}>Sign Out</Button>
					</div>
				</div>
			</Popup>

			<Popup
				open={logsPopupOpen}
				onClose={() => setLogsPopupOpen(false)}
				className={css.popup}
			>
				<div className={css.logPopupContent}>
					<BodyText className={css.popupTitle}>Recent Logs</BodyText>
					<div className={css.logActions}>
						<Button size="small" onClick={handleClearLogs}>Clear Logs</Button>
						<Button size="small" onClick={() => setLogsPopupOpen(false)}>Close</Button>
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
