import webOSPlatform from '@enact/webos/platform';
import {
	detectBackdropFilterSupport,
	detectFlexGapSupport
} from './mediaDetection';
import {buildPlaybackCapabilitySnapshot} from './playbackSnapshot';
import {parseDeviceInfoVersion, parseWebOSVersionFromPlatform} from './runtimeSignature';
import {
	isPlausibleWebOSVersion,
	mapChromeToWebOSVersion,
	normalizeWebOSVersionCandidate
} from './versionParsing';

export const computeRuntimePlatformCapabilities = (lunaCapabilityOverrides = null) => {
	const hasWebOSGlobals = typeof window !== 'undefined' && Boolean(window.webOSSystem || window.PalmSystem);
	const webos = Boolean(webOSPlatform?.webos || hasWebOSGlobals);
	const platformVersion = normalizeWebOSVersionCandidate(parseWebOSVersionFromPlatform());
	const deviceVersion = normalizeWebOSVersionCandidate(parseDeviceInfoVersion());
	let version = platformVersion ?? deviceVersion;
	const chrome = Number(webOSPlatform?.chrome);
	const hasChromeVersion = Number.isFinite(chrome);
	const chromeDerivedVersion = hasChromeVersion ? mapChromeToWebOSVersion(chrome) : null;
	const normalizedChromeVersion = normalizeWebOSVersionCandidate(chromeDerivedVersion);
	const candidateVersions = [platformVersion, deviceVersion, normalizedChromeVersion]
		.filter((candidate) => candidate != null);
	const plausibleCandidates = candidateVersions.filter(isPlausibleWebOSVersion);
	if (plausibleCandidates.length > 0) {
		if (isPlausibleWebOSVersion(normalizedChromeVersion)) {
			version = plausibleCandidates.reduce((best, candidate) => {
				if (best == null) return candidate;
				const candidateDistance = Math.abs(candidate - normalizedChromeVersion);
				const bestDistance = Math.abs(best - normalizedChromeVersion);
				if (candidateDistance < bestDistance) return candidate;
				if (candidateDistance === bestDistance && candidate > best) return candidate;
				return best;
			}, null);
		} else {
			version = Math.max(...plausibleCandidates);
		}
	} else if (candidateVersions.length > 0) {
		version = candidateVersions[0];
	}
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
	const needsDomProbe = flexGapSupport == null;
	const playback = buildPlaybackCapabilitySnapshot({
		webos,
		version,
		chrome,
		hasChromeVersion
	}, lunaCapabilityOverrides);

	return {
		capabilities: {
			webos,
			version: Number.isFinite(version) ? version : null,
			chrome: hasChromeVersion ? chrome : null,
			webosV6Compat,
			webosV22Compat,
			legacyWebOS: isLegacyWebOS,
			supportsFlexGap: flexGapSupport ?? true,
			supportsAspectRatio,
			supportsBackdropFilter: detectBackdropFilterSupport(),
			playback
		},
		needsDomProbe
	};
};
