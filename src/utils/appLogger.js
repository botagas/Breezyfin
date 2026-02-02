const LOG_STORAGE_KEY = 'breezyfinAppLogs';
const MAX_LOG_ENTRIES = 400;
let loggerInitialized = false;
let logListenersInitialized = false;
let patchedConsole = false;
const nativeConsole = {};

const safeReadLogs = () => {
	try {
		const raw = localStorage.getItem(LOG_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch (_) {
		return [];
	}
};

const safeWriteLogs = (logs) => {
	try {
		localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
	} catch (_) {
		// Ignore storage write failures.
	}
};

const stringifyArg = (value) => {
	if (typeof value === 'string') return value;
	if (value instanceof Error) {
		return `${value.name}: ${value.message}${value.stack ? ` | ${value.stack}` : ''}`;
	}
	try {
		return JSON.stringify(value);
	} catch (_) {
		return String(value);
	}
};

const trimMessage = (message) => {
	const normalized = String(message || '').replace(/\s+/g, ' ').trim();
	if (normalized.length <= 1200) return normalized;
	return `${normalized.slice(0, 1197)}...`;
};

export const appendAppLog = (level, ...args) => {
	const message = trimMessage(args.map(stringifyArg).join(' '));
	const logs = safeReadLogs();
	logs.push({
		ts: new Date().toISOString(),
		level: String(level || 'info').toLowerCase(),
		message
	});
	if (logs.length > MAX_LOG_ENTRIES) {
		logs.splice(0, logs.length - MAX_LOG_ENTRIES);
	}
	safeWriteLogs(logs);
};

export const getAppLogs = () => safeReadLogs();

export const clearAppLogs = () => {
	try {
		localStorage.removeItem(LOG_STORAGE_KEY);
	} catch (_) {
		// Ignore storage clear failures.
	}
};

export const initAppLogger = () => {
	if (loggerInitialized || typeof window === 'undefined') return;
	loggerInitialized = true;

	if (!patchedConsole && typeof console !== 'undefined') {
		['log', 'info', 'warn', 'error'].forEach((level) => {
			nativeConsole[level] = console[level] ? console[level].bind(console) : () => {};
			console[level] = (...args) => {
				nativeConsole[level](...args);
				appendAppLog(level, ...args);
			};
		});
		patchedConsole = true;
	}

	if (!logListenersInitialized) {
		window.addEventListener('error', (event) => {
			appendAppLog('error', '[window.error]', event?.message || 'Unhandled error', event?.error || '');
		});
		window.addEventListener('unhandledrejection', (event) => {
			appendAppLog('error', '[unhandledrejection]', event?.reason || 'Unhandled promise rejection');
		});
		logListenersInitialized = true;
	}
};

