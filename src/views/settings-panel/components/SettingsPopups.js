import {useRef} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Scroller from '../../../components/AppScroller';
import Button from '../../../components/BreezyButton';
import {usePopupInitialFocus} from '../../../hooks/usePopupInitialFocus';
import css from '../../SettingsPanel.module.less';
import popupStyles from '../../../styles/popupStyles.module.less';

const SettingsPopups = ({
	popupShellCss,
	bitratePopupOpen,
	closeBitratePopup,
	bitrateOptions,
	capabilityProbeRefreshPopupOpen,
	closeCapabilityProbeRefreshPopup,
	capabilityProbeRefreshOptions,
	settings,
	handleBitrateSelect,
	handleCapabilityProbeRefreshSelect,
	audioLangPopupOpen,
	closeAudioLangPopup,
	languageOptions,
	handleAudioLanguageSelect,
	subtitleLangPopupOpen,
	closeSubtitleLangPopup,
	handleSubtitleLanguageSelect,
	subtitleBurnInTextCodecsPopupOpen,
	closeSubtitleBurnInTextCodecsPopup,
	subtitleBurnInTextCodecOptions,
	handleSubtitleBurnInTextCodecToggle,
	navbarThemePopupOpen,
	closeNavbarThemePopup,
	navbarThemeOptions,
	handleNavbarThemeSelect,
	playNextPromptModePopupOpen,
	closePlayNextPromptModePopup,
	setSegmentsOnlyPromptMode,
	setSegmentsOrLast60PromptMode,
	logoutConfirmOpen,
	closeLogoutConfirm,
	serverInfo,
	handleLogoutConfirm,
	logsPopupOpen,
	closeLogsPopup,
	handleClearLogs,
	appLogs,
	wipeCacheConfirmOpen,
	closeWipeCacheConfirm,
	wipeCacheKeepLogin,
	cacheWipeInProgress,
	cacheWipeError,
	handleWipeCacheConfirm
}) => {
	const wipeCacheTitle = wipeCacheKeepLogin ? 'Wipe Cache (Keep Login)' : 'Wipe App Cache';
	const wipeCacheMessage = wipeCacheKeepLogin
		? 'This clears cache/storage data and reloads the app, while preserving saved login session data.'
		: 'This clears local storage, session storage, cache storage, and IndexedDB, then reloads the app.';
	const wipeCacheActionLabel = wipeCacheKeepLogin ? 'Wipe (Keep Login) & Reload' : 'Wipe & Reload';
	const bitratePopupContentRef = useRef(null);
	const audioLangPopupContentRef = useRef(null);
	const capabilityProbeRefreshPopupContentRef = useRef(null);
	const subtitleLangPopupContentRef = useRef(null);
	const subtitleBurnInTextCodecsPopupContentRef = useRef(null);
	const navbarThemePopupContentRef = useRef(null);
	const playNextPromptModePopupContentRef = useRef(null);
	const logoutConfirmPopupContentRef = useRef(null);
	const logsPopupContentRef = useRef(null);
	const wipeCacheConfirmPopupContentRef = useRef(null);

	usePopupInitialFocus(bitratePopupOpen, bitratePopupContentRef);
	usePopupInitialFocus(audioLangPopupOpen, audioLangPopupContentRef);
	usePopupInitialFocus(capabilityProbeRefreshPopupOpen, capabilityProbeRefreshPopupContentRef);
	usePopupInitialFocus(subtitleLangPopupOpen, subtitleLangPopupContentRef);
	usePopupInitialFocus(subtitleBurnInTextCodecsPopupOpen, subtitleBurnInTextCodecsPopupContentRef);
	usePopupInitialFocus(navbarThemePopupOpen, navbarThemePopupContentRef);
	usePopupInitialFocus(playNextPromptModePopupOpen, playNextPromptModePopupContentRef);
	usePopupInitialFocus(logoutConfirmOpen, logoutConfirmPopupContentRef);
	usePopupInitialFocus(logsPopupOpen, logsPopupContentRef);
	usePopupInitialFocus(wipeCacheConfirmOpen, wipeCacheConfirmPopupContentRef);

	return (
		<>
			<Popup
				open={bitratePopupOpen}
				onClose={closeBitratePopup}
				css={popupShellCss}
			>
				<div ref={bitratePopupContentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Select Maximum Bitrate</BodyText>
					{bitrateOptions.map((option) => (
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
				<div ref={audioLangPopupContentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Preferred Audio Language</BodyText>
					<div className={css.popupOptions}>
						{languageOptions.map((option) => (
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
				open={capabilityProbeRefreshPopupOpen}
				onClose={closeCapabilityProbeRefreshPopup}
				css={popupShellCss}
			>
				<div ref={capabilityProbeRefreshPopupContentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Capability Probe Refresh Period</BodyText>
					{capabilityProbeRefreshOptions.map((option) => (
						<Button
							key={option.value}
							data-days={option.value}
							className={css.popupOption}
							selected={String(settings.capabilityProbeRefreshDays) === option.value}
							onClick={handleCapabilityProbeRefreshSelect}
						>
							{option.label}
						</Button>
					))}
				</div>
			</Popup>

			<Popup
				open={subtitleLangPopupOpen}
				onClose={closeSubtitleLangPopup}
				css={popupShellCss}
			>
				<div ref={subtitleLangPopupContentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Preferred Subtitle Language</BodyText>
					<div className={css.popupOptions}>
						{languageOptions.map((option) => (
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
				open={subtitleBurnInTextCodecsPopupOpen}
				onClose={closeSubtitleBurnInTextCodecsPopup}
				css={popupShellCss}
			>
				<div ref={subtitleBurnInTextCodecsPopupContentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Subtitle Burn-in Formats</BodyText>
					<BodyText className={css.popupMessage}>
						Selected formats will prefer burn-in/transcoding. Leave empty to keep quality-first playback.
					</BodyText>
					<div className={css.popupOptions}>
						{subtitleBurnInTextCodecOptions.map((option) => (
							<Button
								key={option.value}
								data-codec={option.value}
								className={css.popupOption}
								selected={(settings.subtitleBurnInTextCodecs || []).includes(option.value)}
								onClick={handleSubtitleBurnInTextCodecToggle}
							>
								{option.label}
							</Button>
						))}
					</div>
					<div className={css.popupActions}>
						<Button onClick={closeSubtitleBurnInTextCodecsPopup} className={css.popupOption}>Done</Button>
					</div>
				</div>
			</Popup>

			<Popup
				open={navbarThemePopupOpen}
				onClose={closeNavbarThemePopup}
				css={popupShellCss}
			>
				<div ref={navbarThemePopupContentRef} className={`${popupStyles.popupSurface} ${css.nativeThemePopupContent}`}>
					<BodyText className={css.popupTitle}>Navigation Theme</BodyText>
					<div className={css.nativeThemePopupOptions}>
						{navbarThemeOptions.map((option) => (
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
				<div ref={playNextPromptModePopupContentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
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
				<div ref={logoutConfirmPopupContentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
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
				<div ref={logsPopupContentRef} className={`${popupStyles.popupSurface} ${css.logPopupContent}`}>
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
				<div ref={wipeCacheConfirmPopupContentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>{wipeCacheTitle}</BodyText>
					<BodyText className={css.popupMessage}>
						{wipeCacheMessage}
					</BodyText>
					{cacheWipeError ? (
						<BodyText className={css.popupMessage}>{cacheWipeError}</BodyText>
					) : null}
					<div className={css.popupActions}>
						<Button onClick={closeWipeCacheConfirm} disabled={cacheWipeInProgress} className={css.popupOption}>Cancel</Button>
						<Button
							onClick={handleWipeCacheConfirm}
							className={`${css.popupOption} ${css.dangerButton}`}
							disabled={cacheWipeInProgress}
							selected={cacheWipeInProgress}
						>
							{cacheWipeInProgress ? 'Wiping...' : wipeCacheActionLabel}
						</Button>
					</div>
				</div>
			</Popup>
		</>
	);
};

export default SettingsPopups;
