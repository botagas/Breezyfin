const FALLBACK_APP_VERSION = '0.0.0';
let cachedVersion = null;
let loadingPromise = null;

const getRuntimeAppVersion = () => {
	try {
		const appInfo = window?.webOS?.fetchAppInfo?.();
		if (appInfo?.version) return appInfo.version;
	} catch (error) {
		// Ignore runtime lookup failures and fall back to build metadata.
	}
	return null;
};

const getBuildAppVersion = () => {
	const runtimeVersion = getRuntimeAppVersion();
	if (runtimeVersion) return runtimeVersion;

	if (typeof process !== 'undefined') {
		const envVersion = process.env?.REACT_APP_VERSION || process.env?.npm_package_version;
		if (envVersion) return envVersion;
	}

	return null;
};

const loadVersionFromAppInfoFile = async () => {
	try {
		const response = await fetch('appinfo.json', {cache: 'no-store'});
		if (!response.ok) return null;
		const appInfo = await response.json();
		return appInfo?.version || null;
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

		cachedVersion = getBuildAppVersion() || FALLBACK_APP_VERSION;
		return cachedVersion;
	})();

	return loadingPromise;
};

export const APP_VERSION = getAppVersion();
