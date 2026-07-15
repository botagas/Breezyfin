const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const isTruthyFlag = (value) => {
	if (value === undefined || value === null) return false;
	return TRUE_VALUES.has(String(value).trim().toLowerCase());
};

const persistentLogsForcedOn = isTruthyFlag(process.env.REACT_APP_ENABLE_PERSISTENT_LOGS);
const persistentLogsForcedOff = isTruthyFlag(process.env.REACT_APP_DISABLE_PERSISTENT_LOGS);
const devToolsForcedOn = isTruthyFlag(process.env.REACT_APP_ENABLE_DEV_TOOLS);
const releaseChannel = String(process.env.REACT_APP_RELEASE_CHANNEL || '').trim().toLowerCase();
const STABLE_RELEASE_CHANNELS = new Set(['stable', 'main']);

const isNonProduction = process.env.NODE_ENV !== 'production';

export const isPersistentAppLoggingEnabled = () => {
	if (persistentLogsForcedOff) return false;
	if (persistentLogsForcedOn) return true;
	return isNonProduction;
};

// Release builds opt into the capability, while runtime collection is still
// controlled by the Enable Diagnostics setting.
export const isPersistentAppLoggingAvailable = isPersistentAppLoggingEnabled;

export const isNonStableBuild = () => {
	if (devToolsForcedOn) return true;
	if (releaseChannel) return !STABLE_RELEASE_CHANNELS.has(releaseChannel);
	return isNonProduction;
};

export const isDevelopBuild = isNonStableBuild;
