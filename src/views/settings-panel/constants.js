import {HOME_ROW_ORDER} from '../../constants/homeRows';

export const DEFAULT_SETTINGS = {
	maxBitrate: '40',
	enableTranscoding: true,
	forceTranscoding: false,
	smartSubtitleTranscoding: true,
	enableSubtitleBurnIn: true,
	forceTranscodingWithSubtitles: false,
	subtitleBurnInTextCodecs: ['ass', 'ssa'],
	subtitleOverlaySize: 'medium',
	subtitleOverlayPosition: 'standard',
	subtitleOverlayBackground: 'medium',
	subtitleOverlayWeight: 'bold',
	subtitleOverlayTextColor: 'white',
	subtitleOverlayBorderStyle: 'shadow',
	subtitleOverlayBorderColor: 'black',
	subtitleOverlayBorderStrength: 'medium',
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
	capabilityProbeRefreshDays: '30',
	showBackdrops: true,
	showSeasonImages: false,
	useSidewaysEpisodeList: true,
	showPerformanceOverlay: false,
	showExtendedPlayerDebugOverlay: false,
	showFocusDebugOverlay: false,
	showDebugErrorMenu: false,
	verboseAppLogs: false,
	forceDolbyVision: false,
	enableFmp4HlsContainerPreference: false,
	forceFmp4HlsContainerPreference: false,
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

export const BITRATE_OPTIONS = [
	{value: '10', label: '10 Mbps'},
	{value: '20', label: '20 Mbps'},
	{value: '40', label: '40 Mbps (Default)'},
	{value: '60', label: '60 Mbps'},
	{value: '80', label: '80 Mbps'},
	{value: '100', label: '100 Mbps'},
	{value: '120', label: '120 Mbps'}
];

export const LANGUAGE_OPTIONS = [
	{value: 'eng', label: 'English'},
	{value: 'spa', label: 'Spanish'},
	{value: 'fre', label: 'French'},
	{value: 'ger', label: 'German'},
	{value: 'ita', label: 'Italian'},
	{value: 'jpn', label: 'Japanese'},
	{value: 'kor', label: 'Korean'},
	{value: 'chi', label: 'Chinese'},
	{value: 'por', label: 'Portuguese'},
	{value: 'rus', label: 'Russian'}
];

export const NAVBAR_THEME_OPTIONS = [
	{value: 'classic', label: 'Classic'},
	{value: 'elegant', label: 'Elegant'}
];

export const CAPABILITY_PROBE_REFRESH_OPTIONS = [
	{value: '7', label: '7 days'},
	{value: '14', label: '14 days'},
	{value: '30', label: '30 days (Default)'},
	{value: '60', label: '60 days'},
	{value: '90', label: '90 days'}
];

export const SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS = [
	{value: 'ass', label: 'ASS'},
	{value: 'ssa', label: 'SSA'},
	{value: 'srt', label: 'SRT/SubRip'},
	{value: 'webvtt', label: 'WebVTT'},
	{value: 'sami', label: 'SAMI/SMI'},
	{value: 'ttml', label: 'TTML/DFXP'}
];

export const SUBTITLE_OVERLAY_SIZE_OPTIONS = [
	{value: 'small', label: 'Small'},
	{value: 'medium', label: 'Medium (Default)'},
	{value: 'large', label: 'Large'}
];

export const SUBTITLE_OVERLAY_POSITION_OPTIONS = [
	{value: 'low', label: 'Low'},
	{value: 'standard', label: 'Standard (Default)'},
	{value: 'raised', label: 'Raised'}
];

export const SUBTITLE_OVERLAY_BACKGROUND_OPTIONS = [
	{value: 'none', label: 'None'},
	{value: 'low', label: 'Low'},
	{value: 'medium', label: 'Medium (Default)'},
	{value: 'high', label: 'High'}
];

export const SUBTITLE_OVERLAY_WEIGHT_OPTIONS = [
	{value: 'regular', label: 'Regular'},
	{value: 'bold', label: 'Bold (Default)'},
	{value: 'black', label: 'Black'}
];

export const SUBTITLE_OVERLAY_TEXT_COLOR_OPTIONS = [
	{value: 'white', label: 'White (Default)'},
	{value: 'warmWhite', label: 'Warm White'},
	{value: 'yellow', label: 'Yellow'},
	{value: 'black', label: 'Black'}
];

export const SUBTITLE_OVERLAY_BORDER_STYLE_OPTIONS = [
	{value: 'none', label: 'None'},
	{value: 'shadow', label: 'Shadow (Default)'},
	{value: 'outline', label: 'Outline'},
	{value: 'box', label: 'Box'}
];

export const SUBTITLE_OVERLAY_BORDER_COLOR_OPTIONS = [
	{value: 'black', label: 'Black (Default)'},
	{value: 'white', label: 'White'},
	{value: 'yellow', label: 'Yellow'},
	{value: 'accent', label: 'Theme Accent'}
];

export const SUBTITLE_OVERLAY_BORDER_STRENGTH_OPTIONS = [
	{value: 'low', label: 'Low'},
	{value: 'medium', label: 'Medium (Default)'},
	{value: 'high', label: 'High'}
];

export const SETTINGS_DISCLOSURE_KEYS = {
	BITRATE: 'bitratePopup',
	CAPABILITY_PROBE_REFRESH: 'capabilityProbeRefreshPopup',
	AUDIO_LANGUAGE: 'audioLanguagePopup',
	SUBTITLE_LANGUAGE: 'subtitleLanguagePopup',
	SUBTITLE_BURN_IN_TEXT_CODECS: 'subtitleBurnInTextCodecsPopup',
	SUBTITLE_OVERLAY_SIZE: 'subtitleOverlaySizePopup',
	SUBTITLE_OVERLAY_POSITION: 'subtitleOverlayPositionPopup',
	SUBTITLE_OVERLAY_BACKGROUND: 'subtitleOverlayBackgroundPopup',
	SUBTITLE_OVERLAY_WEIGHT: 'subtitleOverlayWeightPopup',
	SUBTITLE_OVERLAY_TEXT_COLOR: 'subtitleOverlayTextColorPopup',
	SUBTITLE_OVERLAY_BORDER_STYLE: 'subtitleOverlayBorderStylePopup',
	SUBTITLE_OVERLAY_BORDER_COLOR: 'subtitleOverlayBorderColorPopup',
	SUBTITLE_OVERLAY_BORDER_STRENGTH: 'subtitleOverlayBorderStrengthPopup',
	NAVBAR_THEME: 'navbarThemePopup',
	PLAY_NEXT_PROMPT_MODE: 'playNextPromptModePopup',
	LOGOUT_CONFIRM: 'logoutConfirmPopup',
	LOGS: 'logsPopup',
	WIPE_CACHE_CONFIRM: 'wipeCacheConfirmPopup'
};

export const SETTINGS_DISCLOSURE_KEY_LIST = [
	SETTINGS_DISCLOSURE_KEYS.BITRATE,
	SETTINGS_DISCLOSURE_KEYS.CAPABILITY_PROBE_REFRESH,
	SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_BURN_IN_TEXT_CODECS,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_SIZE,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_POSITION,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BACKGROUND,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_WEIGHT,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_TEXT_COLOR,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STYLE,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_COLOR,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STRENGTH,
	SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME,
	SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE,
	SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM,
	SETTINGS_DISCLOSURE_KEYS.LOGS,
	SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM
];

export const INITIAL_SETTINGS_DISCLOSURES = {
	[SETTINGS_DISCLOSURE_KEYS.BITRATE]: false,
	[SETTINGS_DISCLOSURE_KEYS.CAPABILITY_PROBE_REFRESH]: false,
	[SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE]: false,
	[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE]: false,
	[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_BURN_IN_TEXT_CODECS]: false,
	[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_SIZE]: false,
	[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_POSITION]: false,
	[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BACKGROUND]: false,
	[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_WEIGHT]: false,
	[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_TEXT_COLOR]: false,
	[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STYLE]: false,
	[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_COLOR]: false,
	[SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STRENGTH]: false,
	[SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME]: false,
	[SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE]: false,
	[SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM]: false,
	[SETTINGS_DISCLOSURE_KEYS.LOGS]: false,
	[SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM]: false
};

export const DISCLOSURE_BACK_PRIORITY = [
	SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM,
	SETTINGS_DISCLOSURE_KEYS.LOGS,
	SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM,
	SETTINGS_DISCLOSURE_KEYS.PLAY_NEXT_PROMPT_MODE,
	SETTINGS_DISCLOSURE_KEYS.NAVBAR_THEME,
	SETTINGS_DISCLOSURE_KEYS.CAPABILITY_PROBE_REFRESH,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STRENGTH,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_COLOR,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BORDER_STYLE,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_TEXT_COLOR,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_WEIGHT,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_BACKGROUND,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_POSITION,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_OVERLAY_SIZE,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_BURN_IN_TEXT_CODECS,
	SETTINGS_DISCLOSURE_KEYS.SUBTITLE_LANGUAGE,
	SETTINGS_DISCLOSURE_KEYS.AUDIO_LANGUAGE,
	SETTINGS_DISCLOSURE_KEYS.BITRATE
];

export const HOME_ROW_LABELS = {
	recentlyAdded: 'Recently Added',
	continueWatching: 'Continue Watching',
	nextUp: 'Next Up',
	latestMovies: 'Latest Movies',
	latestShows: 'Latest TV Shows',
	myRequests: 'My Requests'
};
