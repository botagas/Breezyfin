import {isPersistentAppLoggingAvailable} from './featureFlags';
import {
	redactSensitiveText,
	sanitizeConsoleArgs,
	sanitizeSensitiveValue
} from './sensitiveData';

const LOG_STORAGE_KEY = 'breezyfinAppLogs';
const VERBOSE_LOG_STORAGE_KEY = 'breezyfinVerboseLogs';
const MAX_LOG_ENTRIES = 400;
const LOG_FLUSH_DELAY_MS = 500;
let loggerInitialized = false;
let patchedConsole = false;
let diagnosticsEnabled = false;
let flushTimer = null;
let pendingEntries = [];
const nativeConsole = {};
const PERSISTENT_LOGGING_AVAILABLE = isPersistentAppLoggingAvailable();

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
	const sanitized = sanitizeSensitiveValue(value);
	if (typeof sanitized === 'string') return sanitized;
	try {
		return JSON.stringify(sanitized);
	} catch (_) {
		return redactSensitiveText(String(sanitized));
	}
};

const trimMessage = (message) => {
	const normalized = redactSensitiveText(message).replace(/\s+/g, ' ').trim();
	if (normalized.length <= 1200) return normalized;
	return `${normalized.slice(0, 1197)}...`;
};

const createLogEntry = (level, args) => ({
	ts: new Date().toISOString(),
	level: String(level || 'info').toLowerCase(),
	message: trimMessage(args.map(stringifyArg).join(' '))
});

export const isVerboseLoggingEnabled = () => {
	try {
		return localStorage.getItem(VERBOSE_LOG_STORAGE_KEY) === '1';
	} catch (_) {
		return false;
	}
};

export const setVerboseLoggingEnabled = (enabled) => {
	try {
		if (enabled) {
			localStorage.setItem(VERBOSE_LOG_STORAGE_KEY, '1');
			return;
		}
		localStorage.removeItem(VERBOSE_LOG_STORAGE_KEY);
	} catch (_) {
		// Ignore storage write failures.
	}
};

const shouldCaptureLevel = (level) => {
	if (!PERSISTENT_LOGGING_AVAILABLE || !diagnosticsEnabled) return false;
	if (level === 'warn' || level === 'error') return true;
	return isVerboseLoggingEnabled();
};

export const flushAppLogs = () => {
	if (flushTimer !== null) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}
	if (!PERSISTENT_LOGGING_AVAILABLE || pendingEntries.length === 0) return;
	const entries = pendingEntries;
	pendingEntries = [];
	const logs = safeReadLogs();
	logs.push(...entries);
	if (logs.length > MAX_LOG_ENTRIES) {
		logs.splice(0, logs.length - MAX_LOG_ENTRIES);
	}
	safeWriteLogs(logs);
};

const scheduleLogFlush = () => {
	if (flushTimer !== null) return;
	flushTimer = setTimeout(flushAppLogs, LOG_FLUSH_DELAY_MS);
};

const appendBufferedEntry = (level, args) => {
	pendingEntries.push(createLogEntry(level, args));
	if (pendingEntries.length >= 20) {
		flushAppLogs();
		return;
	}
	scheduleLogFlush();
};

export const appendAppLog = (level, ...args) => {
	if (!shouldCaptureLevel(level)) return;
	appendBufferedEntry(level, args);
};

export const appendCriticalAppLog = (level, ...args) => {
	if (!PERSISTENT_LOGGING_AVAILABLE) return;
	pendingEntries.push(createLogEntry(level || 'error', args));
	flushAppLogs();
};

const patchConsole = () => {
	if (patchedConsole || typeof console === 'undefined') return;
	['log', 'info', 'warn', 'error'].forEach((level) => {
		nativeConsole[level] = typeof console[level] === 'function' ? console[level] : () => {};
		console[level] = (...args) => {
			const sanitizedArgs = sanitizeConsoleArgs(args);
			nativeConsole[level].apply(console, sanitizedArgs);
			appendAppLog(level, ...sanitizedArgs);
		};
	});
	patchedConsole = true;
};

const restoreConsole = () => {
	if (!patchedConsole || typeof console === 'undefined') return;
	Object.entries(nativeConsole).forEach(([level, method]) => {
		console[level] = method;
	});
	patchedConsole = false;
};

export const configureAppDiagnostics = ({enabled = false, verbose = false} = {}) => {
	diagnosticsEnabled = PERSISTENT_LOGGING_AVAILABLE && enabled === true;
	setVerboseLoggingEnabled(verbose === true);
	if (diagnosticsEnabled) {
		patchConsole();
		return;
	}
	flushAppLogs();
	restoreConsole();
};

export const isAppDiagnosticsLoggingEnabled = () => diagnosticsEnabled;

export const logCriticalAppError = (...args) => {
	const sanitizedArgs = sanitizeConsoleArgs(args);
	const errorConsole = patchedConsole
		? nativeConsole.error
		: (typeof console !== 'undefined' ? console.error : null);
	if (typeof errorConsole === 'function') {
		errorConsole.apply(console, sanitizedArgs);
	}
	appendCriticalAppLog('error', ...sanitizedArgs);
};

export const getAppLogs = () => {
	flushAppLogs();
	return safeReadLogs();
};

export const clearAppLogs = () => {
	pendingEntries = [];
	if (flushTimer !== null) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}
	try {
		localStorage.removeItem(LOG_STORAGE_KEY);
	} catch (_) {
		// Ignore storage clear failures.
	}
};

export const initAppLogger = () => {
	if (loggerInitialized || typeof window === 'undefined') return;
	loggerInitialized = true;
	if (!PERSISTENT_LOGGING_AVAILABLE) return;
	window.addEventListener('pagehide', flushAppLogs);
};
