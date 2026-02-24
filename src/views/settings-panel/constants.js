import {HOME_ROW_ORDER} from '../../constants/homeRows';

export const DEFAULT_SETTINGS = {
	maxBitrate: '40',
	enableTranscoding: true,
	forceTranscoding: false,
	forceTranscodingWithSubtitles: false,
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

export const SETTINGS_DISCLOSURE_KEYS = {
	BITRATE: 'bitratePopup',
	CAPABILITY_PROBE_REFRESH: 'capabilityProbeRefreshPopup',
	AUDIO_LANGUAGE: 'audioLanguagePopup',
	SUBTITLE_LANGUAGE: 'subtitleLanguagePopup',
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
