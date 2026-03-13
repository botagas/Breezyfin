import webOSPlatform from '@enact/webos/platform';
import {
	normalizeWebOSVersionCandidate,
	parseMajorVersion
} from './versionParsing';

export const isWebOsRuntime = () => {
	const hasWebOSGlobals = typeof window !== 'undefined' && Boolean(window.webOSSystem || window.PalmSystem);
	return Boolean(webOSPlatform?.webos || hasWebOSGlobals);
};

export const parseDeviceInfoVersion = () => {
	if (typeof window === 'undefined') return null;
	const webOSSystem = window.webOSSystem || window.PalmSystem;
	if (!webOSSystem) return null;
	try {
		const rawDeviceInfo = webOSSystem.deviceInfo;
		const deviceInfo = typeof rawDeviceInfo === 'string'
			? JSON.parse(rawDeviceInfo)
			: rawDeviceInfo;
		const preferredCandidates = [
			deviceInfo?.sdkVersion,
			deviceInfo?.platformVersion,
			deviceInfo?.webosVersion,
			webOSSystem?.platformVersion
		];
		for (const candidate of preferredCandidates) {
			const parsed = parseMajorVersion(candidate);
			if (parsed != null) return parsed;
		}
		const fallbackCandidates = [
			deviceInfo?.platformVersionMajor,
			webOSSystem.platformVersion
		];
		for (const candidate of fallbackCandidates) {
			const parsed = parseMajorVersion(candidate);
			if (parsed != null) return parsed;
		}
		return null;
	} catch (_) {
		return parseMajorVersion(webOSSystem.platformVersion);
	}
};

export const parseWebOSVersionFromPlatform = () => {
	return parseMajorVersion(webOSPlatform?.version);
};

export const buildRuntimeSignature = () => {
	const hasWebOSGlobals = typeof window !== 'undefined' && Boolean(window.webOSSystem || window.PalmSystem);
	const chrome = Number(webOSPlatform?.chrome);
	const hasChromeVersion = Number.isFinite(chrome);
	const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
	return JSON.stringify({
		webos: Boolean(webOSPlatform?.webos || hasWebOSGlobals),
		platformVersion: webOSPlatform?.version ?? null,
		chrome: hasChromeVersion ? chrome : null,
		deviceVersion: normalizeWebOSVersionCandidate(parseDeviceInfoVersion()),
		userAgent
	});
};
