const REDACTED_VALUE = '[REDACTED]';
const MAX_SANITIZE_DEPTH = 5;
const MAX_ARRAY_ENTRIES = 50;
const MAX_OBJECT_ENTRIES = 80;

const normalizeSecretKey = (value) => String(value || '')
	.toLowerCase()
	.replace(/[^a-z0-9]/g, '');

export const isSensitiveDataKey = (value) => {
	const normalized = normalizeSecretKey(value);
	return normalized === 'apikey' ||
		normalized === 'accesstoken' ||
		normalized === 'token' ||
		normalized === 'authorization' ||
		normalized === 'xembytoken';
};

export const redactSensitiveText = (value) => {
	let text = String(value ?? '');
	text = text.replace(
		/(Authorization\s*[:=]\s*)(?:Bearer\s+)?([^\s,}\]]+)/gi,
		`$1${REDACTED_VALUE}`
	);
	text = text.replace(
		/(X-Emby-Token\s*[:=]\s*)([^\s,}\]]+)/gi,
		`$1${REDACTED_VALUE}`
	);
	text = text.replace(
		/(["']?(?:api[_-]?key|apikey|access[_-]?token|accesstoken|token)["']?\s*[:=]\s*["']?)([^&\#"'\s,}\]]+)/gi,
		`$1${REDACTED_VALUE}`
	);
	text = text.replace(
		/([?&](?:api[_-]?key|apikey|access[_-]?token|accesstoken|token)=)([^&#\s"'<>]+)/gi,
		`$1${REDACTED_VALUE}`
	);
	return text;
};

export const redactSensitiveUrl = (value, {includeOrigin = true} = {}) => {
	if (!value) return '';
	try {
		const baseUrl = typeof window !== 'undefined' && window.location?.origin
			? window.location.origin
			: 'http://localhost';
		const url = new URL(String(value), baseUrl);
		for (const key of Array.from(url.searchParams.keys())) {
			if (isSensitiveDataKey(key)) url.searchParams.set(key, REDACTED_VALUE);
		}
		const redacted = includeOrigin
			? url.toString()
			: `${url.pathname}${url.search}${url.hash}`;
		return redactSensitiveText(redacted).replace(/%5BREDACTED%5D/gi, REDACTED_VALUE);
	} catch (_) {
		return redactSensitiveText(value);
	}
};

const sanitizeSensitiveValueInternal = (value, seen, depth) => {
	if (typeof value === 'string') return redactSensitiveText(value);
	if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
		return redactSensitiveText(String(value));
	}
	if (value instanceof Error) {
		return {
			name: redactSensitiveText(value.name),
			message: redactSensitiveText(value.message),
			stack: redactSensitiveText(value.stack || '')
		};
	}
	if (depth >= MAX_SANITIZE_DEPTH) return '[MaxDepth]';
	if (seen.has(value)) return '[Circular]';
	seen.add(value);

	if (Array.isArray(value)) {
		const sanitized = value.slice(0, MAX_ARRAY_ENTRIES)
			.map((entry) => sanitizeSensitiveValueInternal(entry, seen, depth + 1));
		if (value.length > MAX_ARRAY_ENTRIES) sanitized.push(`[${value.length - MAX_ARRAY_ENTRIES} more]`);
		seen.delete(value);
		return sanitized;
	}

	const result = {};
	let entries;
	try {
		entries = Object.entries(value).slice(0, MAX_OBJECT_ENTRIES);
	} catch (_) {
		seen.delete(value);
		return redactSensitiveText(String(value));
	}
	for (const [key, entry] of entries) {
		result[key] = isSensitiveDataKey(key)
			? REDACTED_VALUE
			: sanitizeSensitiveValueInternal(entry, seen, depth + 1);
	}
	if (Object.keys(value).length > MAX_OBJECT_ENTRIES) {
		result.__truncated = Object.keys(value).length - MAX_OBJECT_ENTRIES;
	}
	seen.delete(value);
	return result;
};

export const sanitizeSensitiveValue = (value) => sanitizeSensitiveValueInternal(value, new WeakSet(), 0);

export const sanitizeConsoleArgs = (args = []) => (
	Array.from(args).map((value) => sanitizeSensitiveValue(value))
);

export const REDACTED_SENSITIVE_VALUE = REDACTED_VALUE;
