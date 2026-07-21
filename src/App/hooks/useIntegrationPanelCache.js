import {useCallback, useEffect, useMemo, useState} from 'react';
import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../../constants/integrationEvents';
import {normalizePanelStatePayload} from '../utils/panelStateCache';

const EMPTY_STATE = Object.freeze({
	discovery: null,
	calendar: null,
	syncPlay: null,
	watchParty: null
});

export const useIntegrationPanelCache = ({onUserDataInvalidated}) => {
	const [cacheState, setCacheState] = useState(() => ({...EMPTY_STATE}));
	const reset = useCallback(() => setCacheState({...EMPTY_STATE}), []);
	const clear = useCallback((key) => {
		if (!Object.prototype.hasOwnProperty.call(EMPTY_STATE, key)) return false;
		setCacheState((current) => current[key] === null ? current : {...current, [key]: null});
		return true;
	}, []);
	const cacheActions = useMemo(() => Object.fromEntries(
		Object.keys(EMPTY_STATE).map((key) => [key, (nextState) => {
			setCacheState((current) => ({
				...current,
				[key]: normalizePanelStatePayload(nextState)
			}));
		}])
	), []);

	useEffect(() => {
		const handleInvalidation = () => {
			reset();
			onUserDataInvalidated?.();
		};
		window.addEventListener(BREEZYFIN_USER_DATA_INVALIDATED_EVENT, handleInvalidation);
		return () => window.removeEventListener(BREEZYFIN_USER_DATA_INVALIDATED_EVENT, handleInvalidation);
	}, [onUserDataInvalidated, reset]);

	return {cacheState, cacheActions, reset, clear};
};
