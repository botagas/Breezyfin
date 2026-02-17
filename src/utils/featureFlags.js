const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const isTruthyFlag = (value) => {
	if (value === undefined || value === null) return false;
	return TRUE_VALUES.has(String(value).trim().toLowerCase());
};

const styleDebugForcedOn = isTruthyFlag(process.env.REACT_APP_ENABLE_STYLE_DEBUG);
const styleDebugForcedOff = isTruthyFlag(process.env.REACT_APP_DISABLE_STYLE_DEBUG);
const persistentLogsForcedOn = isTruthyFlag(process.env.REACT_APP_ENABLE_PERSISTENT_LOGS);
const persistentLogsForcedOff = isTruthyFlag(process.env.REACT_APP_DISABLE_PERSISTENT_LOGS);

const isNonProduction = process.env.NODE_ENV !== 'production';

export const isStyleDebugEnabled = () => {
	if (styleDebugForcedOff) return false;
	if (styleDebugForcedOn) return true;
	return isNonProduction;
};

export const isPersistentAppLoggingEnabled = () => {
	if (persistentLogsForcedOff) return false;
	if (persistentLogsForcedOn) return true;
	return isStyleDebugEnabled();
};
