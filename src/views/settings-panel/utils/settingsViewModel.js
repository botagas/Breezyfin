export const SETTINGS_TABS = [
	{key: 'info', label: 'Info'},
	{key: 'home', label: 'Home'},
	{key: 'playback', label: 'Playback'},
	{key: 'subtitles', label: 'Subtitles'},
	{key: 'display', label: 'Display'},
	{key: 'about', label: 'About'},
	{key: 'diagnostics', label: 'Diagnostics'}
];

export const TAB_SECTION_KEYS = {
	info: ['serverInfo', 'savedServers', 'account'],
	home: ['homeRows'],
	playback: ['playback', 'transcoding'],
	subtitles: ['subtitles', 'subtitleAppearance'],
	display: ['display', 'languages'],
	about: ['about'],
	diagnostics: ['diagnostics', 'capabilities']
};

export const DEFAULT_SETTINGS_TAB_KEY = SETTINGS_TABS[0].key;

export const isSettingsTabKey = (tabKey) => (
	Object.prototype.hasOwnProperty.call(TAB_SECTION_KEYS, tabKey)
);

export const getSettingsSectionKeys = (tabKey) => (
	isSettingsTabKey(tabKey) ? TAB_SECTION_KEYS[tabKey] : TAB_SECTION_KEYS[DEFAULT_SETTINGS_TAB_KEY]
);

export const shouldRenderSettingsSection = (activeTabKey, sectionKey) => (
	getSettingsSectionKeys(activeTabKey).includes(sectionKey)
);

export const isSmartSubtitleHandlingEnabled = (settings = {}) => (
	settings.smartSubtitleTranscoding !== false
);

export const getAssSubtitleRendererControlState = (settings, enabledLabel) => {
	const enabled = isSmartSubtitleHandlingEnabled(settings);
	return {
		enabled,
		label: enabled ? enabledLabel : 'Manual mode'
	};
};

export const getBitmapSubtitleRendererControlState = (settings, enabledLabel) => {
	const enabled = isSmartSubtitleHandlingEnabled(settings);
	return {
		enabled,
		label: enabled ? enabledLabel : 'Manual mode'
	};
};

export const getSubtitleBurnInFormatsControlState = (settings, enabledLabel) => {
	if (isSmartSubtitleHandlingEnabled(settings)) {
		return {
			enabled: false,
			label: 'Managed by Smart'
		};
	}
	return {
		enabled: true,
		label: settings?.enableSubtitleBurnIn === false ? 'Disabled' : enabledLabel
	};
};

export const isSubtitleOptionSelected = (settings, settingKey, fallback, optionValue) => (
	(settings?.[settingKey] || fallback) === optionValue
);

export const isSubtitleBurnInCodecSelected = (settings, codec) => (
	(settings?.subtitleBurnInTextCodecs || []).includes(codec)
);

export const getWipeCacheConfirmCopy = (wipeCacheKeepLogin) => (
	wipeCacheKeepLogin ? {
		title: 'Wipe Cache (Keep Login)',
		message: 'This clears cache/storage data and reloads the app, while preserving saved login session data.',
		actionLabel: 'Wipe (Keep Login) & Reload'
	} : {
		title: 'Wipe App Cache',
		message: 'This clears local storage, session storage, cache storage, and IndexedDB, then reloads the app.',
		actionLabel: 'Wipe & Reload'
	}
);
