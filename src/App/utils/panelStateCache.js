export const KEYED_PANEL_STATE_CACHE_LIMIT = 180;

export const normalizePanelStatePayload = (nextState) => nextState || null;

export const upsertKeyedPanelState = (previousState, key, nextState) => {
	const normalizedKey = String(key);
	const normalizedState = normalizePanelStatePayload(nextState);
	const nextStateMap = {
		...previousState
	};
	if (Object.prototype.hasOwnProperty.call(nextStateMap, normalizedKey)) {
		delete nextStateMap[normalizedKey];
	}
	nextStateMap[normalizedKey] = normalizedState;
	const keys = Object.keys(nextStateMap);
	if (keys.length <= KEYED_PANEL_STATE_CACHE_LIMIT) {
		return nextStateMap;
	}
	const keysToDrop = keys.slice(0, keys.length - KEYED_PANEL_STATE_CACHE_LIMIT);
	keysToDrop.forEach((oldKey) => {
		delete nextStateMap[oldKey];
	});
	return nextStateMap;
};

export const clearKeyedPanelState = (previousState, key) => {
	const normalizedKey = String(key);
	if (!Object.prototype.hasOwnProperty.call(previousState, normalizedKey)) {
		return previousState;
	}
	const nextStateMap = {
		...previousState
	};
	delete nextStateMap[normalizedKey];
	return nextStateMap;
};
