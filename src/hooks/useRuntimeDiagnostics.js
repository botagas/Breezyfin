import {createContext, useContext, useEffect} from 'react';
import {resetMediaPerformanceMetrics} from '../utils/mediaPerformanceMetrics';

const RuntimeDiagnosticsContext = createContext(false);

export const RuntimeDiagnosticsProvider = ({enabled = false, children}) => {
	const diagnosticsEnabled = enabled === true;

	useEffect(() => {
		if (!diagnosticsEnabled) resetMediaPerformanceMetrics();
	}, [diagnosticsEnabled]);

	return (
		<RuntimeDiagnosticsContext.Provider value={diagnosticsEnabled}>
			{children}
		</RuntimeDiagnosticsContext.Provider>
	);
};

export const useRuntimeDiagnosticsEnabled = () => useContext(RuntimeDiagnosticsContext) === true;
