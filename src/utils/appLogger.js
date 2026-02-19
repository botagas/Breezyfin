import {isPersistentAppLoggingEnabled} from './featureFlags';

const LOG_STORAGE_KEY = 'breezyfinAppLogs';
const VERBOSE_LOG_STORAGE_KEY = 'breezyfinVerboseLogs';
const MAX_LOG_ENTRIES = 400;
let loggerInitialized = false;
let logListenersInitialized = false;
let patchedConsole = false;
const nativeConsole = {};
const PERSISTENT_LOGGING_ENABLED = isPersistentAppLoggingEnabled();
const REDACTION_RULES = [
	{pattern: /([?&](?:api_key|access_token|token)=)([^&#\s]+)/gi, replacement: '$1[REDACTED]'},
	{pattern: /("?(?:api_key|access_token|accesstoken|x-emby-token|authorization|token)"?\s*:\s*")([^"]+)(")/gi, replacement: '$1[REDACTED]$3'},
	{pattern: /(Authorization\s*[:=]\s*Bearer\s+)([^\s,]+)/gi, replacement: '$1[REDACTED]'},
	{pattern: /(X-Emby-Token\s*[:=]\s*)([^\s,]+)/gi, replacement: '$1[REDACTED]'}
];

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

const sanitizeMessage = (message) => REDACTION_RULES.reduce(
	(current, rule) => current.replace(rule.pattern, rule.replacement),
	String(message || '')
);

const trimMessage = (message) => {
	const normalized = sanitizeMessage(message).replace(/\s+/g, ' ').trim();
	if (normalized.length <= 1200) return normalized;
	return `${normalized.slice(0, 1197)}...`;
};

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
	if (!PERSISTENT_LOGGING_ENABLED) return false;
	if (level === 'warn' || level === 'error') return true;
	return isVerboseLoggingEnabled();
};

export const appendAppLog = (level, ...args) => {
	if (!PERSISTENT_LOGGING_ENABLED) return;
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
	if (!PERSISTENT_LOGGING_ENABLED) return;

	if (!patchedConsole && typeof console !== 'undefined') {
		['log', 'info', 'warn', 'error'].forEach((level) => {
			nativeConsole[level] = console[level] ? console[level].bind(console) : () => {};
			console[level] = (...args) => {
				nativeConsole[level](...args);
				if (shouldCaptureLevel(level)) {
					appendAppLog(level, ...args);
				}
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
