import {useCallback, useState} from 'react';
import {readBreezyfinSettings} from '../utils/settingsStorage';
import {getPerformanceMode} from '../utils/performanceMode';
import {useBreezyfinSettingsSync} from './useBreezyfinSettingsSync';

export const usePerformanceMode = () => {
	const [mode, setMode] = useState(() => getPerformanceMode(readBreezyfinSettings()));
	const applySettings = useCallback((settings) => {
		setMode(getPerformanceMode(settings));
	}, []);
	useBreezyfinSettingsSync(applySettings);
	return mode;
};
