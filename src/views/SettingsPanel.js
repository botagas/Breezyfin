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

import css from './SettingsPanel.module.less';

// Settings defaults
const DEFAULT_SETTINGS = {
	maxBitrate: '40',
	enableTranscoding: true,
	forceTranscoding: false,
	forceTranscodingWithSubtitles: true,
	preferredAudioLanguage: 'eng',
	preferredSubtitleLanguage: 'eng',
	autoPlayNext: true,
	showBackdrops: true
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

const SettingsPanel = ({ onNavigate, onLogout, onExit, ...rest }) => {
	const [settings, setSettings] = useState(DEFAULT_SETTINGS);
	const [serverInfo, setServerInfo] = useState(null);
	const [userInfo, setUserInfo] = useState(null);
	const [loading, setLoading] = useState(true);
	const [bitratePopupOpen, setBitratePopupOpen] = useState(false);
	const [audioLangPopupOpen, setAudioLangPopupOpen] = useState(false);
	const [subtitleLangPopupOpen, setSubtitleLangPopupOpen] = useState(false);
	const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

	useEffect(() => {
		loadSettings();
		loadServerInfo();
	}, []);

	const loadSettings = () => {
		try {
			const stored = localStorage.getItem('breezyfinSettings');
			if (stored) {
				setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
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

	const handleLogoutConfirm = () => {
		setLogoutConfirmOpen(false);
		onLogout();
	};

	const getBitrateLabel = (value) => {
		const option = BITRATE_OPTIONS.find(o => o.value === value);
		return option ? option.label : `${value} Mbps`;
	};

	const getLanguageLabel = (value) => {
		const option = LANGUAGE_OPTIONS.find(o => o.value === value);
		return option ? option.label : value;
	};

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
					{/* Server Info Section */}
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

					{/* User Info Section */}
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

					{/* Playback Settings */}
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
					</section>

					{/* Language Preferences */}
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

					{/* Playback Settings */}
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

					{/* Display Settings */}
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

					{/* About Section */}
					<section className={css.section}>
						<BodyText className={css.sectionTitle}>About</BodyText>
						<Item className={css.infoItem} label="App Version" slotAfter="1.0.0" />
						<Item className={css.infoItem} label="Platform" slotAfter="webOS TV" />
					</section>
				</div>
			</Scroller>

			{/* Bitrate Selection Popup */}
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

			{/* Audio Language Popup */}
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

			{/* Subtitle Language Popup */}
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

			{/* Logout Confirmation Popup */}
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
		</Panel>
	);
};

export default SettingsPanel;
