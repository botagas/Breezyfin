import {useRef} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Scroller from '../../../components/AppScroller';
import Button from '../../../components/BreezyButton';
import {usePopupInitialFocus} from '../../../hooks/usePopupInitialFocus';
import {
	getWipeCacheConfirmCopy,
	isSubtitleBurnInCodecSelected,
	isSubtitleOptionSelected
} from '../utils/settingsViewModel';
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
	assSubtitleRendererPopupOpen,
	closeAssSubtitleRendererPopup,
	assSubtitleRendererOptions,
	handleAssSubtitleRendererSelect,
	bitmapSubtitleRendererPopupOpen,
	closeBitmapSubtitleRendererPopup,
	bitmapSubtitleRendererOptions,
	handleBitmapSubtitleRendererSelect,
	subtitleOverlaySizePopupOpen,
	closeSubtitleOverlaySizePopup,
	subtitleOverlayFontSizeLabel,
	handleSubtitleOverlayFontSizeDecrease,
	handleSubtitleOverlayFontSizeIncrease,
	handleSubtitleOverlayFontSizeReset,
	subtitleOverlayPositionPopupOpen,
	closeSubtitleOverlayPositionPopup,
	subtitleOverlayPositionOptions,
	handleSubtitleOverlayPositionSelect,
	subtitleOverlayBackgroundPopupOpen,
	closeSubtitleOverlayBackgroundPopup,
	subtitleOverlayBackgroundOptions,
	handleSubtitleOverlayBackgroundSelect,
	subtitleOverlayWeightPopupOpen,
	closeSubtitleOverlayWeightPopup,
	subtitleOverlayWeightOptions,
	handleSubtitleOverlayWeightSelect,
	subtitleOverlayTextColorPopupOpen,
	closeSubtitleOverlayTextColorPopup,
	subtitleOverlayTextColorOptions,
	handleSubtitleOverlayTextColorSelect,
	subtitleOverlayBorderStylePopupOpen,
	closeSubtitleOverlayBorderStylePopup,
	subtitleOverlayBorderStyleOptions,
	handleSubtitleOverlayBorderStyleSelect,
	subtitleOverlayBorderColorPopupOpen,
	closeSubtitleOverlayBorderColorPopup,
	subtitleOverlayBorderColorOptions,
	handleSubtitleOverlayBorderColorSelect,
	subtitleOverlayBorderStrengthPopupOpen,
	closeSubtitleOverlayBorderStrengthPopup,
	subtitleOverlayBorderStrengthOptions,
	handleSubtitleOverlayBorderStrengthSelect,
	subtitleOverlayOutlineSizePopupOpen,
	closeSubtitleOverlayOutlineSizePopup,
	subtitleOverlayOutlineSizeLabel,
	handleSubtitleOverlayOutlineSizeDecrease,
	handleSubtitleOverlayOutlineSizeIncrease,
	handleSubtitleOverlayOutlineSizeReset,
	subtitleOverlayShadowDistancePopupOpen,
	closeSubtitleOverlayShadowDistancePopup,
	subtitleOverlayShadowDistanceOptions,
	handleSubtitleOverlayShadowDistanceSelect,
	subtitleOverlayShadowAnglePopupOpen,
	closeSubtitleOverlayShadowAnglePopup,
	subtitleOverlayShadowAngleOptions,
	handleSubtitleOverlayShadowAngleSelect,
	navbarThemePopupOpen,
	closeNavbarThemePopup,
	navbarThemeOptions,
	handleNavbarThemeSelect,
	screensaverTimeoutPopupOpen,
	closeScreensaverTimeoutPopup,
	screensaverTimeoutOptions,
	handleScreensaverTimeoutSelect,
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
	const {
		title: wipeCacheTitle,
		message: wipeCacheMessage,
		actionLabel: wipeCacheActionLabel
	} = getWipeCacheConfirmCopy(wipeCacheKeepLogin);
	const bitratePopupContentRef = useRef(null);
	const audioLangPopupContentRef = useRef(null);
	const capabilityProbeRefreshPopupContentRef = useRef(null);
	const subtitleLangPopupContentRef = useRef(null);
	const subtitleBurnInTextCodecsPopupContentRef = useRef(null);
	const assSubtitleRendererPopupContentRef = useRef(null);
	const bitmapSubtitleRendererPopupContentRef = useRef(null);
	const subtitleOverlaySizePopupContentRef = useRef(null);
	const subtitleOverlayPositionPopupContentRef = useRef(null);
	const subtitleOverlayBackgroundPopupContentRef = useRef(null);
	const subtitleOverlayWeightPopupContentRef = useRef(null);
	const subtitleOverlayTextColorPopupContentRef = useRef(null);
	const subtitleOverlayBorderStylePopupContentRef = useRef(null);
	const subtitleOverlayBorderColorPopupContentRef = useRef(null);
	const subtitleOverlayBorderStrengthPopupContentRef = useRef(null);
	const subtitleOverlayOutlineSizePopupContentRef = useRef(null);
	const subtitleOverlayShadowDistancePopupContentRef = useRef(null);
	const subtitleOverlayShadowAnglePopupContentRef = useRef(null);
	const navbarThemePopupContentRef = useRef(null);
	const screensaverTimeoutPopupContentRef = useRef(null);
	const playNextPromptModePopupContentRef = useRef(null);
	const logoutConfirmPopupContentRef = useRef(null);
	const logsPopupContentRef = useRef(null);
	const wipeCacheConfirmPopupContentRef = useRef(null);

	usePopupInitialFocus(bitratePopupOpen, bitratePopupContentRef);
	usePopupInitialFocus(audioLangPopupOpen, audioLangPopupContentRef);
	usePopupInitialFocus(capabilityProbeRefreshPopupOpen, capabilityProbeRefreshPopupContentRef);
	usePopupInitialFocus(subtitleLangPopupOpen, subtitleLangPopupContentRef);
	usePopupInitialFocus(subtitleBurnInTextCodecsPopupOpen, subtitleBurnInTextCodecsPopupContentRef);
	usePopupInitialFocus(assSubtitleRendererPopupOpen, assSubtitleRendererPopupContentRef);
	usePopupInitialFocus(bitmapSubtitleRendererPopupOpen, bitmapSubtitleRendererPopupContentRef);
	usePopupInitialFocus(subtitleOverlaySizePopupOpen, subtitleOverlaySizePopupContentRef);
	usePopupInitialFocus(subtitleOverlayPositionPopupOpen, subtitleOverlayPositionPopupContentRef);
	usePopupInitialFocus(subtitleOverlayBackgroundPopupOpen, subtitleOverlayBackgroundPopupContentRef);
	usePopupInitialFocus(subtitleOverlayWeightPopupOpen, subtitleOverlayWeightPopupContentRef);
	usePopupInitialFocus(subtitleOverlayTextColorPopupOpen, subtitleOverlayTextColorPopupContentRef);
	usePopupInitialFocus(subtitleOverlayBorderStylePopupOpen, subtitleOverlayBorderStylePopupContentRef);
	usePopupInitialFocus(subtitleOverlayBorderColorPopupOpen, subtitleOverlayBorderColorPopupContentRef);
	usePopupInitialFocus(subtitleOverlayBorderStrengthPopupOpen, subtitleOverlayBorderStrengthPopupContentRef);
	usePopupInitialFocus(subtitleOverlayOutlineSizePopupOpen, subtitleOverlayOutlineSizePopupContentRef);
	usePopupInitialFocus(subtitleOverlayShadowDistancePopupOpen, subtitleOverlayShadowDistancePopupContentRef);
	usePopupInitialFocus(subtitleOverlayShadowAnglePopupOpen, subtitleOverlayShadowAnglePopupContentRef);
	usePopupInitialFocus(navbarThemePopupOpen, navbarThemePopupContentRef);
	usePopupInitialFocus(screensaverTimeoutPopupOpen, screensaverTimeoutPopupContentRef);
	usePopupInitialFocus(playNextPromptModePopupOpen, playNextPromptModePopupContentRef);
	usePopupInitialFocus(logoutConfirmOpen, logoutConfirmPopupContentRef);
	usePopupInitialFocus(logsPopupOpen, logsPopupContentRef);
	usePopupInitialFocus(wipeCacheConfirmOpen, wipeCacheConfirmPopupContentRef);

	const renderSubtitleOptionPopup = ({
		open,
		onClose,
		contentRef,
		title,
		options,
		settingKey,
		onSelect,
		fallback
	}) => (
		<Popup
			open={open}
			onClose={onClose}
			css={popupShellCss}
		>
			<div ref={contentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
				<BodyText className={css.popupTitle}>{title}</BodyText>
				<div className={css.popupOptions}>
					{options.map((option) => (
						<Button
							key={option.value}
							data-value={option.value}
							className={css.popupOption}
							selected={isSubtitleOptionSelected(settings, settingKey, fallback, option.value)}
							onClick={onSelect}
						>
							{option.label}
						</Button>
					))}
				</div>
			</div>
		</Popup>
	);

	const renderSubtitleNumericPopup = ({
		open,
		onClose,
		contentRef,
		title,
		message,
		valueLabel,
		onDecrease,
		onIncrease,
		onReset
	}) => (
		<Popup
			open={open}
			onClose={onClose}
			css={popupShellCss}
		>
			<div ref={contentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
				<BodyText className={css.popupTitle}>{title}</BodyText>
				<BodyText className={css.popupMessage}>{message}</BodyText>
				<BodyText className={css.popupNumericValue}>{valueLabel}</BodyText>
				<div className={css.popupNumericActions}>
					<Button className={css.popupOption} onClick={onDecrease}>-</Button>
					<Button className={css.popupOption} onClick={onReset}>Reset</Button>
					<Button className={css.popupOption} onClick={onIncrease}>+</Button>
				</div>
				<div className={css.popupActions}>
					<Button onClick={onClose} className={css.popupOption}>Done</Button>
				</div>
			</div>
		</Popup>
	);

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

			{renderSubtitleOptionPopup({
				open: screensaverTimeoutPopupOpen,
				onClose: closeScreensaverTimeoutPopup,
				contentRef: screensaverTimeoutPopupContentRef,
				title: 'Screensaver Timeout',
				options: screensaverTimeoutOptions,
				settingKey: 'screensaverTimeoutMinutes',
				onSelect: handleScreensaverTimeoutSelect,
				fallback: '1'
			})}

			{renderSubtitleOptionPopup({
				open: subtitleOverlayWeightPopupOpen,
				onClose: closeSubtitleOverlayWeightPopup,
				contentRef: subtitleOverlayWeightPopupContentRef,
				title: 'Breezyfin Subtitle Font Weight',
				options: subtitleOverlayWeightOptions,
				settingKey: 'subtitleOverlayWeight',
				onSelect: handleSubtitleOverlayWeightSelect,
				fallback: 'bold'
			})}

			{renderSubtitleOptionPopup({
				open: subtitleOverlayTextColorPopupOpen,
				onClose: closeSubtitleOverlayTextColorPopup,
				contentRef: subtitleOverlayTextColorPopupContentRef,
				title: 'Breezyfin Subtitle Text Color',
				options: subtitleOverlayTextColorOptions,
				settingKey: 'subtitleOverlayTextColor',
				onSelect: handleSubtitleOverlayTextColorSelect,
				fallback: 'white'
			})}

			{renderSubtitleOptionPopup({
				open: subtitleOverlayBorderStylePopupOpen,
				onClose: closeSubtitleOverlayBorderStylePopup,
				contentRef: subtitleOverlayBorderStylePopupContentRef,
				title: 'Breezyfin Subtitle Border Style',
				options: subtitleOverlayBorderStyleOptions,
				settingKey: 'subtitleOverlayBorderStyle',
				onSelect: handleSubtitleOverlayBorderStyleSelect,
				fallback: 'outline'
			})}

			{renderSubtitleOptionPopup({
				open: subtitleOverlayBorderColorPopupOpen,
				onClose: closeSubtitleOverlayBorderColorPopup,
				contentRef: subtitleOverlayBorderColorPopupContentRef,
				title: 'Breezyfin Subtitle Border Color',
				options: subtitleOverlayBorderColorOptions,
				settingKey: 'subtitleOverlayBorderColor',
				onSelect: handleSubtitleOverlayBorderColorSelect,
				fallback: 'black'
			})}

			{renderSubtitleOptionPopup({
				open: subtitleOverlayBorderStrengthPopupOpen,
				onClose: closeSubtitleOverlayBorderStrengthPopup,
				contentRef: subtitleOverlayBorderStrengthPopupContentRef,
				title: 'Breezyfin Subtitle Box Border Strength',
				options: subtitleOverlayBorderStrengthOptions,
				settingKey: 'subtitleOverlayBorderStrength',
				onSelect: handleSubtitleOverlayBorderStrengthSelect,
				fallback: 'medium'
			})}

			{renderSubtitleNumericPopup({
				open: subtitleOverlayOutlineSizePopupOpen,
				onClose: closeSubtitleOverlayOutlineSizePopup,
				contentRef: subtitleOverlayOutlineSizePopupContentRef,
				title: 'Breezyfin Subtitle Outline Size',
				message: 'Controls the pixel width of Breezyfin DOM subtitle outlines.',
				valueLabel: subtitleOverlayOutlineSizeLabel,
				onDecrease: handleSubtitleOverlayOutlineSizeDecrease,
				onIncrease: handleSubtitleOverlayOutlineSizeIncrease,
				onReset: handleSubtitleOverlayOutlineSizeReset
			})}

			{renderSubtitleOptionPopup({
				open: subtitleOverlayShadowDistancePopupOpen,
				onClose: closeSubtitleOverlayShadowDistancePopup,
				contentRef: subtitleOverlayShadowDistancePopupContentRef,
				title: 'Breezyfin Subtitle Shadow Distance',
				options: subtitleOverlayShadowDistanceOptions,
				settingKey: 'subtitleOverlayShadowDistance',
				onSelect: handleSubtitleOverlayShadowDistanceSelect,
				fallback: 'medium'
			})}

			{renderSubtitleOptionPopup({
				open: subtitleOverlayShadowAnglePopupOpen,
				onClose: closeSubtitleOverlayShadowAnglePopup,
				contentRef: subtitleOverlayShadowAnglePopupContentRef,
				title: 'Breezyfin Subtitle Shadow Angle',
				options: subtitleOverlayShadowAngleOptions,
				settingKey: 'subtitleOverlayShadowAngle',
				onSelect: handleSubtitleOverlayShadowAngleSelect,
				fallback: 'down'
			})}

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
						Manual mode only. Selected formats will prefer burn-in/transcoding. Leave empty to keep quality-first playback.
					</BodyText>
					<div className={css.popupOptions}>
						{subtitleBurnInTextCodecOptions.map((option) => (
							<Button
								key={option.value}
								data-codec={option.value}
								className={css.popupOption}
								selected={isSubtitleBurnInCodecSelected(settings, option.value)}
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

			{renderSubtitleOptionPopup({
				open: assSubtitleRendererPopupOpen,
				onClose: closeAssSubtitleRendererPopup,
				contentRef: assSubtitleRendererPopupContentRef,
				title: 'ASS/SSA Subtitle Renderer',
				options: assSubtitleRendererOptions,
				settingKey: 'assSubtitleRenderer',
				onSelect: handleAssSubtitleRendererSelect,
				fallback: 'auto'
			})}

			{renderSubtitleOptionPopup({
				open: bitmapSubtitleRendererPopupOpen,
				onClose: closeBitmapSubtitleRendererPopup,
				contentRef: bitmapSubtitleRendererPopupContentRef,
				title: 'Bitmap Subtitle Renderer',
				options: bitmapSubtitleRendererOptions,
				settingKey: 'bitmapSubtitleRenderer',
				onSelect: handleBitmapSubtitleRendererSelect,
				fallback: 'auto'
			})}

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

			{renderSubtitleNumericPopup({
				open: subtitleOverlaySizePopupOpen,
				onClose: closeSubtitleOverlaySizePopup,
				contentRef: subtitleOverlaySizePopupContentRef,
				title: 'Breezyfin Subtitle Font Size',
				message: 'Controls Breezyfin DOM subtitles. Libass subtitles keep authored ASS/SSA sizing.',
				valueLabel: subtitleOverlayFontSizeLabel,
				onDecrease: handleSubtitleOverlayFontSizeDecrease,
				onIncrease: handleSubtitleOverlayFontSizeIncrease,
				onReset: handleSubtitleOverlayFontSizeReset
			})}

			<Popup
				open={subtitleOverlayPositionPopupOpen}
				onClose={closeSubtitleOverlayPositionPopup}
				css={popupShellCss}
			>
				<div ref={subtitleOverlayPositionPopupContentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Breezyfin Subtitle Position</BodyText>
					<div className={css.popupOptions}>
						{subtitleOverlayPositionOptions.map((option) => (
							<Button
								key={option.value}
								data-value={option.value}
								className={css.popupOption}
								selected={(settings.subtitleOverlayPosition || 'standard') === option.value}
								onClick={handleSubtitleOverlayPositionSelect}
							>
								{option.label}
							</Button>
						))}
					</div>
				</div>
			</Popup>

			<Popup
				open={subtitleOverlayBackgroundPopupOpen}
				onClose={closeSubtitleOverlayBackgroundPopup}
				css={popupShellCss}
			>
				<div ref={subtitleOverlayBackgroundPopupContentRef} className={`${popupStyles.popupSurface} ${css.popupContent}`}>
					<BodyText className={css.popupTitle}>Breezyfin Subtitle Background</BodyText>
					<div className={css.popupOptions}>
						{subtitleOverlayBackgroundOptions.map((option) => (
							<Button
								key={option.value}
								data-value={option.value}
								className={css.popupOption}
								selected={(settings.subtitleOverlayBackground || 'none') === option.value}
								onClick={handleSubtitleOverlayBackgroundSelect}
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
