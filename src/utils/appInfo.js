const FALLBACK_APP_VERSION = '0.0.0';
let cachedVersion = null;
let loadingPromise = null;

const toVersionString = (value) => {
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	return normalized || null;
};

const getRuntimeAppVersion = () => {
	try {
		const appInfo = window?.webOS?.fetchAppInfo?.();
		const runtimeVersion = toVersionString(appInfo?.version);
		if (runtimeVersion) return runtimeVersion;
	} catch (error) {
		// Ignore runtime lookup failures and fall back to build metadata.
	}
	return null;
};

const getBuildAppVersion = () => {
	const runtimeVersion = getRuntimeAppVersion();
	if (runtimeVersion) return runtimeVersion;

	if (typeof process !== 'undefined') {
		const envVersion = toVersionString(process.env?.REACT_APP_VERSION || process.env?.npm_package_version);
		if (envVersion) return envVersion;
	}

	return null;
};

const loadVersionFromAppInfoFile = async () => {
	try {
		const response = await fetch('appinfo.json', {cache: 'no-store'});
		if (!response.ok) return null;
		const appInfo = await response.json();
		return toVersionString(appInfo?.version);
	} catch (error) {
		return null;
	}
};

export const getAppVersion = () => cachedVersion || getBuildAppVersion() || FALLBACK_APP_VERSION;

export const loadAppVersion = async () => {
	if (cachedVersion) return cachedVersion;
	if (loadingPromise) return loadingPromise;

	loadingPromise = (async () => {
		const runtimeVersion = getRuntimeAppVersion();
		if (runtimeVersion) {
			cachedVersion = runtimeVersion;
			return cachedVersion;
		}

		const fileVersion = await loadVersionFromAppInfoFile();
		if (fileVersion) {
			cachedVersion = fileVersion;
			return cachedVersion;
		}

		const buildVersion = getBuildAppVersion();
		if (buildVersion) {
			cachedVersion = buildVersion;
			return cachedVersion;
		}

		return FALLBACK_APP_VERSION;
	})();

	try {
		return await loadingPromise;
	} finally {
		loadingPromise = null;
	}
};
