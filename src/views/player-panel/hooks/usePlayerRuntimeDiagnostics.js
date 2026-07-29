import {useCallback, useEffect, useState} from 'react';

import {createPlaybackDiagnostic} from '../../../utils/playbackDiagnostics';

const MAX_RUNTIME_DIAGNOSTICS = 40;

export const usePlayerRuntimeDiagnostics = ({enabled = false, itemId = null} = {}) => {
	const [diagnostics, setDiagnostics] = useState([]);

	const append = useCallback((entry) => {
		if (!enabled) return;
		const diagnostic = createPlaybackDiagnostic(entry);
		setDiagnostics((current) => [...current, diagnostic].slice(-MAX_RUNTIME_DIAGNOSTICS));
	}, [enabled]);

	useEffect(() => {
		if (enabled) return;
		setDiagnostics([]);
	}, [enabled]);

	useEffect(() => {
		setDiagnostics([]);
	}, [itemId]);

	return {append, diagnostics};
};

export default usePlayerRuntimeDiagnostics;
