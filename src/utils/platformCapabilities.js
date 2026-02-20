import webOSPlatform from '@enact/webos/platform';

let runtimeCapabilitiesCache = null;
let runtimeCapabilitiesNeedsDomProbe = false;

const parseMajorVersion = (value) => {
	if (value == null) return null;
	if (typeof value === 'number') {
		return Number.isFinite(value) ? Math.trunc(value) : null;
	}
	if (typeof value !== 'string') return null;
	const match = value.match(/(\d{1,3})/);
	if (!match) return null;
	const parsed = Number(match[1]);
	return Number.isFinite(parsed) ? parsed : null;
};

const parseDeviceInfoVersion = () => {
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
			deviceInfo?.version,
			webOSSystem?.platformVersion,
			webOSSystem?.version
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
		return parseMajorVersion(webOSSystem.platformVersion) ?? parseMajorVersion(webOSSystem.version);
	}
};

const parseWebOSVersionFromPlatform = () => {
	return parseMajorVersion(webOSPlatform?.version);
};

const detectFlexGapSupport = () => {
	if (typeof document === 'undefined' || !document.body) return null;
	const flex = document.createElement('div');
	flex.style.display = 'flex';
	flex.style.flexDirection = 'column';
	flex.style.rowGap = '1px';

	const childA = document.createElement('div');
	childA.style.height = '0';
	const childB = document.createElement('div');
	childB.style.height = '0';

	flex.appendChild(childA);
	flex.appendChild(childB);
	document.body.appendChild(flex);
	const supported = flex.scrollHeight === 1;
	document.body.removeChild(flex);
	return supported;
};

const detectBackdropFilterSupport = () => {
	if (typeof window === 'undefined' || !window.CSS?.supports) return false;
	return (
		window.CSS.supports('backdrop-filter', 'blur(1px)') ||
		window.CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
	);
};

const computeRuntimePlatformCapabilities = () => {
	const hasWebOSGlobals = typeof window !== 'undefined' && Boolean(window.webOSSystem || window.PalmSystem);
	const webos = Boolean(webOSPlatform?.webos || hasWebOSGlobals);
	const platformVersion = parseWebOSVersionFromPlatform();
	const deviceVersion = parseDeviceInfoVersion();
	let version = platformVersion ?? deviceVersion;
	if (platformVersion != null && deviceVersion != null && platformVersion !== deviceVersion) {
		// Prefer user-facing version buckets (>= 3) when one source reports legacy low major values.
		if (platformVersion <= 2 && deviceVersion >= 3) {
			version = deviceVersion;
		} else if (deviceVersion <= 2 && platformVersion >= 3) {
			version = platformVersion;
		}
	}
	const chrome = Number(webOSPlatform?.chrome);
	const hasChromeVersion = Number.isFinite(chrome);
	const webosV6Compat = webos && (
		(Number.isFinite(version) && version <= 6) ||
		(hasChromeVersion && chrome <= 79)
	);
	const webosV22Compat = webos && (
		(Number.isFinite(version) && version === 22) ||
		(hasChromeVersion && chrome === 87)
	);
	const isLegacyWebOS = webos && (
		webosV6Compat ||
		(hasChromeVersion && chrome < 84)
	);
	const supportsAspectRatio = typeof window !== 'undefined' && Boolean(
		window.CSS?.supports?.('aspect-ratio', '1 / 1')
	);
	const flexGapSupport = detectFlexGapSupport();
	runtimeCapabilitiesNeedsDomProbe = flexGapSupport == null;

	return {
		webos,
		version: Number.isFinite(version) ? version : null,
		chrome: hasChromeVersion ? chrome : null,
		webosV6Compat,
		webosV22Compat,
		legacyWebOS: isLegacyWebOS,
		supportsFlexGap: flexGapSupport ?? true,
		supportsAspectRatio,
		supportsBackdropFilter: detectBackdropFilterSupport()
	};
};

export const getRuntimePlatformCapabilities = () => {
	const canRunDeferredDomProbe = typeof document !== 'undefined' && Boolean(document.body);
	const shouldRefreshForDomProbe = runtimeCapabilitiesNeedsDomProbe && canRunDeferredDomProbe;
	if (!runtimeCapabilitiesCache || shouldRefreshForDomProbe) {
		runtimeCapabilitiesCache = computeRuntimePlatformCapabilities();
	}
	return runtimeCapabilitiesCache;
};

export const resetRuntimePlatformCapabilitiesCache = () => {
	runtimeCapabilitiesCache = null;
	runtimeCapabilitiesNeedsDomProbe = false;
};
