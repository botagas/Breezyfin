const getStorage = () => {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage;
	} catch (_) {
		return null;
	}
};

const hasPlaybackCapabilitiesShape = (value) => {
	return Boolean(
		value &&
		typeof value === 'object' &&
		value.playback &&
		typeof value.playback === 'object'
	);
};

export const stripCapabilityProbeMetadata = (capabilities) => {
	if (!capabilities || typeof capabilities !== 'object') return capabilities;
	const sanitized = {...capabilities};
	delete sanitized.capabilityProbe;
	return sanitized;
};

export const withCapabilityProbeMetadata = ({
	capabilities,
	source,
	checkedAt,
	ttlMs
}) => {
	const resolvedCheckedAt = Number.isFinite(checkedAt) ? checkedAt : Date.now();
	return {
		...capabilities,
		capabilityProbe: {
			source,
			checkedAt: resolvedCheckedAt,
			nextRefreshAt: resolvedCheckedAt + ttlMs,
			ttlMs
		}
	};
};

export const readCachedRuntimeCapabilities = ({
	cacheKey,
	cacheVersion,
	signature,
	ttlMs
}) => {
	const storage = getStorage();
	if (!storage) return null;
	try {
		const raw = storage.getItem(cacheKey);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed?.version !== cacheVersion) return null;
		if (parsed?.signature !== signature) return null;
		if (!Number.isFinite(parsed?.checkedAt)) return null;
		if ((Date.now() - parsed.checkedAt) > ttlMs) return null;
		if (!hasPlaybackCapabilitiesShape(parsed?.capabilities)) return null;
		return {
			capabilities: parsed.capabilities,
			checkedAt: parsed.checkedAt
		};
	} catch (_) {
		return null;
	}
};

export const writeCachedRuntimeCapabilities = ({
	cacheKey,
	cacheVersion,
	signature,
	capabilities,
	checkedAt
}) => {
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.setItem(
			cacheKey,
			JSON.stringify({
				version: cacheVersion,
				signature,
				checkedAt,
				capabilities: stripCapabilityProbeMetadata(capabilities)
			})
		);
	} catch (_) {
		// Ignore write failures (quota/private mode)
	}
};

export const hasFreshRuntimeLunaCapabilityEntry = (entry, ttlMs) => {
	if (!entry || !Number.isFinite(entry.checkedAt)) return false;
	return (Date.now() - entry.checkedAt) <= ttlMs;
};

export const readCachedRuntimeLunaCapabilityEntry = ({
	cacheKey,
	cacheVersion,
	signature
}) => {
	const storage = getStorage();
	if (!storage) return null;
	try {
		const raw = storage.getItem(cacheKey);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed?.version !== cacheVersion) return null;
		if (parsed?.signature !== signature) return null;
		if (!Number.isFinite(parsed?.checkedAt)) return null;
		const overrides = parsed?.overrides || {};
		const hasValidOverride = (
			typeof overrides.supportsDolbyVision === 'boolean' ||
			typeof overrides.supportsHdr10 === 'boolean' ||
			typeof overrides.supportsHlg === 'boolean'
		);
		if (!hasValidOverride) return null;
		return {
			signature,
			checkedAt: parsed.checkedAt,
			overrides
		};
	} catch (_) {
		return null;
	}
};

export const writeCachedRuntimeLunaCapabilityEntry = ({
	cacheKey,
	cacheVersion,
	signature,
	overrides,
	checkedAt
}) => {
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.setItem(
			cacheKey,
			JSON.stringify({
				version: cacheVersion,
				signature,
				checkedAt,
				overrides
			})
		);
	} catch (_) {
		// Ignore write failures (quota/private mode)
	}
};
