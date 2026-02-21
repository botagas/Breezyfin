import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import Item from '@enact/sandstone/Item';
import SwitchItem from '@enact/sandstone/SwitchItem';
import Button from '../../../components/BreezyButton';
import {HOME_ROW_ORDER} from '../../../constants/homeRows';
import css from '../../SettingsPanel.module.less';

const SettingsSections = ({
	styleDebugEnabled,
	loading,
	serverInfo,
	serverUrl,
	savedServers,
	switchingServerId,
	handleSwitchServerClick,
	handleForgetServerClick,
	settings,
	homeRowToggleHandlers,
	moveHomeRowUp,
	moveHomeRowDown,
	getHomeRowLabel,
	userInfo,
	openLogoutConfirm,
	settingToggleHandlers,
	getPlayNextPromptModeLabel,
	openPlayNextPromptModePopup,
	getLanguageLabel,
	openAudioLangPopup,
	openSubtitleLangPopup,
	getBitrateLabel,
	openBitratePopup,
	getNavbarThemeLabel,
	openNavbarThemePopup,
	appVersion,
	webosVersionLabel,
	openStylingDebugPanel,
	appLogCount,
	cacheWipeInProgress,
	openLogsPopup,
	openWipeCacheConfirm
}) => {
	return (
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
						<Item className={css.infoItem} label="Server URL" slotAfter={serverUrl || 'Not connected'} />
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
					onToggle={homeRowToggleHandlers.recentlyAdded}
				>
					Recently Added
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					selected={settings.homeRows?.continueWatching !== false}
					onToggle={homeRowToggleHandlers.continueWatching}
				>
					Continue Watching
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					selected={settings.homeRows?.nextUp !== false}
					onToggle={homeRowToggleHandlers.nextUp}
				>
					Next Up
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					selected={settings.homeRows?.latestMovies !== false}
					onToggle={homeRowToggleHandlers.latestMovies}
				>
					Latest Movies
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					selected={settings.homeRows?.latestShows !== false}
					onToggle={homeRowToggleHandlers.latestShows}
				>
					Latest TV Shows
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					selected={settings.homeRows?.myRequests !== false}
					onToggle={homeRowToggleHandlers.myRequests}
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
					onToggle={settingToggleHandlers.autoPlayNext}
					selected={settings.autoPlayNext}
				>
					Auto-play Next Episode
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					onToggle={settingToggleHandlers.showPlayNextPrompt}
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
					onToggle={settingToggleHandlers.skipIntro}
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
					onToggle={settingToggleHandlers.enableTranscoding}
					selected={settings.enableTranscoding}
				>
					Enable Transcoding
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					onToggle={settingToggleHandlers.forceTranscoding}
					selected={settings.forceTranscoding}
				>
					Force Transcoding (always)
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					onToggle={settingToggleHandlers.forceTranscodingWithSubtitles}
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
					onToggle={settingToggleHandlers.showBackdrops}
					selected={settings.showBackdrops}
				>
					Show Background Images
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					onToggle={settingToggleHandlers.showSeasonImages}
					selected={settings.showSeasonImages === true}
				>
					Show Season Card Images (Elegant)
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					onToggle={settingToggleHandlers.useSidewaysEpisodeList}
					selected={settings.useSidewaysEpisodeList !== false}
				>
					Sideways Episode List (Elegant)
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					onToggle={settingToggleHandlers.disableAnimations}
					selected={settings.disableAnimations}
				>
					Disable Animations (Performance Mode)
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					onToggle={settingToggleHandlers.disableAllAnimations}
					selected={settings.disableAllAnimations}
				>
					Disable ALL Animations (Performance+ Mode)
				</SwitchItem>
				<SwitchItem
					className={css.switchItem}
					onToggle={settingToggleHandlers.showMediaBar}
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
					onToggle={settingToggleHandlers.showPerformanceOverlay}
					selected={settings.showPerformanceOverlay === true}
				>
					Performance Overlay (FPS/Input)
				</SwitchItem>
				{styleDebugEnabled ? (
					<SwitchItem
						className={css.switchItem}
						onToggle={settingToggleHandlers.relaxedPlaybackProfile}
						selected={settings.relaxedPlaybackProfile === true}
					>
						Relaxed Playback Profile (Debug)
					</SwitchItem>
				) : null}
				{styleDebugEnabled ? (
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
	);
};

export default SettingsSections;
