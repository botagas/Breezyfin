const CRASH_RECOVERY_ACTION_KEY = 'breezyfin_crash_recovery_action';
const CRASH_RECOVERY_CONTEXT_KEY = 'breezyfin_crash_recovery_context';
const CRASH_RECOVERY_TTL_MS = 6 * 60 * 60 * 1000;
const RECOVERABLE_VIEWS = new Set([
	'login',
	'home',
	'homeSection',
	'library',
	'search',
	'favorites',
	'settings',
	'details',
	'player'
]);

export const CRASH_RECOVERY_ACTIONS = {
	HOME: 'home',
	BACK: 'back',
	DETAILS: 'details'
};

const getStorage = () => {
	if (typeof window === 'undefined' || !window.localStorage) return null;
	return window.localStorage;
};

const safeParseJson = (value) => {
	if (!value) return null;
	try {
		return JSON.parse(value);
	} catch (_) {
		return null;
	}
};

const safeStringifyJson = (value) => {
	const seen = new WeakSet();
	return JSON.stringify(value, (key, entry) => {
		if (typeof entry === 'function') return undefined;
		if (!entry || typeof entry !== 'object') return entry;
		if (seen.has(entry)) return undefined;
		seen.add(entry);
		return entry;
	});
};

const isExpired = (timestamp) => {
	const numericTimestamp = Number(timestamp);
	if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) return true;
	return Date.now() - numericTimestamp > CRASH_RECOVERY_TTL_MS;
};

const normalizeCrashAction = (value) => {
	if (value === CRASH_RECOVERY_ACTIONS.HOME) return CRASH_RECOVERY_ACTIONS.HOME;
	if (value === CRASH_RECOVERY_ACTIONS.BACK) return CRASH_RECOVERY_ACTIONS.BACK;
	if (value === CRASH_RECOVERY_ACTIONS.DETAILS) return CRASH_RECOVERY_ACTIONS.DETAILS;
	return null;
};

export const queueCrashRecoveryAction = (action) => {
	const normalizedAction = normalizeCrashAction(action);
	if (!normalizedAction) return;
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.setItem(CRASH_RECOVERY_ACTION_KEY, safeStringifyJson({
			action: normalizedAction,
			timestamp: Date.now()
		}));
	} catch (_) {
		// Ignore storage failures in crash flow.
	}
};

export const peekCrashRecoveryAction = () => {
	const storage = getStorage();
	if (!storage) return null;
	const parsed = safeParseJson(storage.getItem(CRASH_RECOVERY_ACTION_KEY));
	if (!parsed || isExpired(parsed.timestamp)) return null;
	return normalizeCrashAction(parsed.action);
};

export const consumeCrashRecoveryAction = () => {
	const storage = getStorage();
	if (!storage) return null;
	const parsed = safeParseJson(storage.getItem(CRASH_RECOVERY_ACTION_KEY));
	try {
		storage.removeItem(CRASH_RECOVERY_ACTION_KEY);
	} catch (_) {
		// Ignore storage failures in crash flow.
	}
	if (!parsed || isExpired(parsed.timestamp)) return null;
	return normalizeCrashAction(parsed.action);
};

const normalizePlainObject = (value) => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value;
};

const normalizeRecoverableView = (value) => {
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	return RECOVERABLE_VIEWS.has(normalized) ? normalized : null;
};

const normalizeDetailsReturnView = (value) => {
	if (typeof value !== 'string') return 'home';
	const normalized = value.trim();
	return normalized || 'home';
};

export const saveCrashNavigationSnapshot = ({
	currentView = 'home',
	selectedItem = null,
	selectedLibrary = null,
	selectedHomeSection = null,
	playbackOptions = null,
	previousItem = null,
	detailsReturnView = 'home',
	playerControlsVisible = true
} = {}) => {
	const storage = getStorage();
	if (!storage) return;
	const payload = {
		currentView: normalizeRecoverableView(currentView) || 'home',
		selectedItem: normalizePlainObject(selectedItem),
		selectedLibrary: normalizePlainObject(selectedLibrary),
		selectedHomeSection: normalizePlainObject(selectedHomeSection),
		playbackOptions: normalizePlainObject(playbackOptions),
		previousItem: normalizePlainObject(previousItem),
		detailsReturnView: normalizeDetailsReturnView(detailsReturnView),
		playerControlsVisible: playerControlsVisible !== false,
		timestamp: Date.now()
	};
	try {
		storage.setItem(CRASH_RECOVERY_CONTEXT_KEY, safeStringifyJson(payload));
	} catch (_) {
		// Ignore storage failures in crash flow.
	}
};

export const readCrashNavigationSnapshot = () => {
	const storage = getStorage();
	if (!storage) return null;
	const parsed = safeParseJson(storage.getItem(CRASH_RECOVERY_CONTEXT_KEY));
	if (!parsed || isExpired(parsed.timestamp)) return null;
	const currentView = normalizeRecoverableView(parsed.currentView) || 'home';
	return {
		currentView,
		selectedItem: normalizePlainObject(parsed.selectedItem),
		selectedLibrary: normalizePlainObject(parsed.selectedLibrary),
		selectedHomeSection: normalizePlainObject(parsed.selectedHomeSection),
		playbackOptions: normalizePlainObject(parsed.playbackOptions),
		previousItem: normalizePlainObject(parsed.previousItem),
		detailsReturnView: normalizeDetailsReturnView(parsed.detailsReturnView),
		playerControlsVisible: parsed.playerControlsVisible !== false
	};
};

// Legacy wrappers retained for compatibility with older callers/tests.
export const saveCrashPlaybackContext = ({
	detailsItem = null,
	playbackItem = null,
	detailsReturnView = 'home'
} = {}) => {
	saveCrashNavigationSnapshot({
		currentView: 'details',
		selectedItem: detailsItem || playbackItem || null,
		previousItem: detailsItem || null,
		detailsReturnView,
		playerControlsVisible: true
	});
};

export const readCrashPlaybackContext = () => {
	const snapshot = readCrashNavigationSnapshot();
	if (!snapshot) return null;
	return {
		detailsItem: snapshot.selectedItem || null,
		playbackItem: snapshot.selectedItem || null,
		detailsReturnView: snapshot.detailsReturnView || 'home',
		timestamp: Date.now()
	};
};

export const clearCrashPlaybackContext = () => {
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.removeItem(CRASH_RECOVERY_CONTEXT_KEY);
	} catch (_) {
		// Ignore storage failures in crash flow.
	}
};
