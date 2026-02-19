import { useEffect } from 'react';
import {readBreezyfinSettings, BREEZYFIN_SETTINGS_KEY} from '../utils/settingsStorage';

export const useBreezyfinSettingsSync = (onSettings, options = {}) => {
	const {enabled = true, applyOnMount = true} = options;

	useEffect(() => {
		if (!enabled || typeof onSettings !== 'function') return undefined;
		if (applyOnMount) {
			onSettings(readBreezyfinSettings());
		}

		const handleSettingsChanged = (event) => {
			onSettings(event?.detail && typeof event.detail === 'object' ? event.detail : {});
		};
		const handleStorage = (event) => {
			if (event?.key !== BREEZYFIN_SETTINGS_KEY) return;
			onSettings(readBreezyfinSettings(event.newValue));
		};

		window.addEventListener('breezyfin-settings-changed', handleSettingsChanged);
		window.addEventListener('storage', handleStorage);
		return () => {
			window.removeEventListener('breezyfin-settings-changed', handleSettingsChanged);
			window.removeEventListener('storage', handleStorage);
		};
	}, [applyOnMount, enabled, onSettings]);
};
