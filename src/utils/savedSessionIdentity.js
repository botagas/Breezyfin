export const getSavedSessionKey = (entry) => {
	if (!entry?.serverId || !entry?.userId) return null;
	return `${entry.serverId}:${entry.userId}`;
};

const normalizeServerUrl = (value) => String(value || '').replace(/\/+$/, '');

export const captureRuntimeSessionIdentity = (runtime = {}) => {
	const sessionGeneration = Number(runtime.sessionGeneration);
	const serverUrl = normalizeServerUrl(runtime.serverUrl);
	const userId = String(runtime.userId || '');
	const accessToken = String(runtime.accessToken || '');
	if (!Number.isSafeInteger(sessionGeneration) || !serverUrl || !userId || !accessToken) {
		return null;
	}
	return {
		sessionGeneration,
		serverUrl,
		userId,
		accessToken
	};
};

export const isRuntimeSessionIdentityCurrent = (identity, runtime = {}) => {
	if (!identity) return false;
	const currentIdentity = captureRuntimeSessionIdentity(runtime);
	return currentIdentity !== null &&
		currentIdentity.sessionGeneration === identity.sessionGeneration &&
		currentIdentity.serverUrl === identity.serverUrl &&
		currentIdentity.userId === identity.userId &&
		currentIdentity.accessToken === identity.accessToken;
};

export const resolveExpiredSavedSessionKey = (entries, runtime = {}) => {
	const savedEntries = Array.isArray(entries) ? entries : [];
	const activeEntry = savedEntries.find((entry) => entry?.isActive && getSavedSessionKey(entry));
	if (activeEntry) return getSavedSessionKey(activeEntry);

	const runtimeUserId = String(runtime.userId || '');
	const runtimeServerUrl = normalizeServerUrl(runtime.serverUrl);
	if (!runtimeUserId || !runtimeServerUrl) return null;

	const matchingEntry = savedEntries.find((entry) => (
		String(entry?.userId || '') === runtimeUserId &&
		normalizeServerUrl(entry?.url) === runtimeServerUrl
	));
	return getSavedSessionKey(matchingEntry);
};
