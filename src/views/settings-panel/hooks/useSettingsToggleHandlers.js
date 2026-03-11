import {useCallback, useMemo} from 'react';

import {writeBreezyfinSettings} from '../../../utils/settingsStorage';

const TOGGLE_SETTING_KEYS = [
	'enableTranscoding',
	'autoPlayNext',
	'showPlayNextPrompt',
	'skipIntro',
	'forceTranscoding',
	'enableSubtitleBurnIn',
	'forceTranscodingWithSubtitles',
	'relaxedPlaybackProfile',
	'showBackdrops',
	'showSeasonImages',
	'useSidewaysEpisodeList',
	'disableAnimations',
	'disableAllAnimations',
	'showMediaBar',
	'showPerformanceOverlay',
	'showExtendedPlayerDebugOverlay',
	'forceDolbyVision',
	'enableFmp4HlsContainerPreference',
	'forceFmp4HlsContainerPreference'
];

export const useSettingsToggleHandlers = ({settings, setSettings}) => {
	const handleSettingsPatch = useCallback((patch) => {
		setSettings((previousSettings) => {
			const nextSettings = {...previousSettings, ...patch};
			if (!writeBreezyfinSettings(nextSettings)) {
				console.error('Failed to save settings');
			}
			return nextSettings;
		});
	}, [setSettings]);

	const handleSettingChange = useCallback((key, value) => {
		handleSettingsPatch({[key]: value});
	}, [handleSettingsPatch]);

	const toggleBooleanSetting = useCallback((key) => {
		handleSettingChange(key, !settings[key]);
	}, [handleSettingChange, settings]);

		const settingToggleHandlers = useMemo(() => {
			const handlers = TOGGLE_SETTING_KEYS.reduce((acc, key) => {
				acc[key] = () => toggleBooleanSetting(key);
				return acc;
			}, {});
			handlers.enableFmp4HlsContainerPreference = () => {
				const nextEnable = settings.enableFmp4HlsContainerPreference === false;
				if (!nextEnable) {
					handleSettingsPatch({
						enableFmp4HlsContainerPreference: false,
					forceFmp4HlsContainerPreference: false
				});
				return;
			}
			handleSettingsPatch({enableFmp4HlsContainerPreference: true});
		};
		handlers.forceFmp4HlsContainerPreference = () => {
			const nextForce = settings.forceFmp4HlsContainerPreference !== true;
			if (nextForce) {
				handleSettingsPatch({
					enableFmp4HlsContainerPreference: true,
					forceFmp4HlsContainerPreference: true
				});
				return;
			}
			handleSettingsPatch({forceFmp4HlsContainerPreference: false});
		};
		return handlers;
	}, [handleSettingsPatch, settings.enableFmp4HlsContainerPreference, settings.forceFmp4HlsContainerPreference, toggleBooleanSetting]);

	return {
		handleSettingChange,
		settingToggleHandlers
	};
};
