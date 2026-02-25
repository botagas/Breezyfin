import webOSPlatform from '@enact/webos/platform';
import {readBreezyfinSettings} from './settingsStorage';

let runtimeCapabilitiesCache = null;
let runtimeCapabilitiesNeedsDomProbe = false;
const RUNTIME_CAPABILITIES_CACHE_KEY = 'breezyfinRuntimeCapabilities:v2';
const RUNTIME_CAPABILITIES_CACHE_VERSION = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS = 30;
const MIN_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS = 1;
const MAX_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS = 365;
let runtimeCapabilitiesCacheTtlMs = DEFAULT_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS * DAY_MS;
let runtimeCapabilitiesCacheTtlInitialized = false;
const CHROME_TO_WEBOS = [
	[120, 25],
	[108, 24],
	[94, 23],
	[87, 22],
	[79, 6],
	[68, 5],
	[53, 4],
	[38, 3],
	[34, 2],
	[26, 1]
];

const getStorage = () => {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage;
	} catch (_) {
		return null;
	}
};

const normalizeRuntimeCapabilitiesRefreshDays = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return DEFAULT_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS;
	const rounded = Math.trunc(parsed);
	if (rounded < MIN_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS || rounded > MAX_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS) {
		return DEFAULT_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS;
	}
	return rounded;
};

const applyRuntimeCapabilitiesCacheTtlDays = (daysValue) => {
	const days = normalizeRuntimeCapabilitiesRefreshDays(daysValue);
	runtimeCapabilitiesCacheTtlMs = days * DAY_MS;
	runtimeCapabilitiesCacheTtlInitialized = true;
	if (runtimeCapabilitiesCache?.capabilityProbe && Number.isFinite(runtimeCapabilitiesCache.capabilityProbe.checkedAt)) {
		runtimeCapabilitiesCache = {
			...runtimeCapabilitiesCache,
			capabilityProbe: {
				...runtimeCapabilitiesCache.capabilityProbe,
				ttlMs: runtimeCapabilitiesCacheTtlMs,
				nextRefreshAt: runtimeCapabilitiesCache.capabilityProbe.checkedAt + runtimeCapabilitiesCacheTtlMs
			}
		};
	}
	return days;
};

const ensureRuntimeCapabilitiesCacheTtlInitialized = () => {
	if (runtimeCapabilitiesCacheTtlInitialized) return;
	const settings = readBreezyfinSettings();
	applyRuntimeCapabilitiesCacheTtlDays(settings?.capabilityProbeRefreshDays);
};

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

const normalizeWebOSVersionCandidate = (value) => {
	if (!Number.isFinite(value)) return null;
	if (value >= 7 && value <= 15) return value + 15;
	return value;
};

const isPlausibleWebOSVersion = (value) => Number.isFinite(value) && value >= 1 && value <= 30;

const mapChromeToWebOSVersion = (chromeVersion) => {
	for (const [chrome, webosVersion] of CHROME_TO_WEBOS) {
		if (chromeVersion >= chrome) {
			return webosVersion;
		}
	}
	return null;
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

const parseWebOSVersionFromPlatform = () => {
	return parseMajorVersion(webOSPlatform?.version);
};

const buildRuntimeSignature = () => {
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

const canPlayVideoType = (type) => {
	if (typeof document === 'undefined') return null;
	const video = document.createElement('video');
	if (!video?.canPlayType) return null;
	try {
		const result = video.canPlayType(type);
		return result === 'probably' || result === 'maybe';
	} catch (_) {
		return null;
	}
};

const detectCodecSupport = (types) => {
	let sawSignal = false;
	for (const type of types) {
		const supported = canPlayVideoType(type);
		if (supported == null) continue;
		sawSignal = true;
		if (supported) return true;
	}
	return sawSignal ? false : null;
};

const detectImageFormatSupport = (mimeType) => {
	if (typeof document === 'undefined') return null;
	try {
		const canvas = document.createElement('canvas');
		if (!canvas?.getContext) return null;
		const encoded = canvas.toDataURL(mimeType);
		return typeof encoded === 'string' && encoded.startsWith(`data:${mimeType}`);
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

const stripCapabilityProbeMetadata = (capabilities) => {
	if (!capabilities || typeof capabilities !== 'object') return capabilities;
	const sanitized = {...capabilities};
	delete sanitized.capabilityProbe;
	return sanitized;
};

const withCapabilityProbeMetadata = (capabilities, source, checkedAt) => {
	const resolvedCheckedAt = Number.isFinite(checkedAt) ? checkedAt : Date.now();
	const ttlMs = runtimeCapabilitiesCacheTtlMs;
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

const readCachedRuntimeCapabilities = (signature) => {
	const storage = getStorage();
	if (!storage) return null;
	try {
		const raw = storage.getItem(RUNTIME_CAPABILITIES_CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed?.version !== RUNTIME_CAPABILITIES_CACHE_VERSION) return null;
		if (parsed?.signature !== signature) return null;
		if (!Number.isFinite(parsed?.checkedAt)) return null;
		if ((Date.now() - parsed.checkedAt) > runtimeCapabilitiesCacheTtlMs) return null;
		if (!hasPlaybackCapabilitiesShape(parsed?.capabilities)) return null;
		return {
			capabilities: parsed.capabilities,
			checkedAt: parsed.checkedAt
		};
	} catch (_) {
		return null;
	}
};

const writeCachedRuntimeCapabilities = (signature, capabilities, checkedAt) => {
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.setItem(
			RUNTIME_CAPABILITIES_CACHE_KEY,
			JSON.stringify({
				version: RUNTIME_CAPABILITIES_CACHE_VERSION,
				signature,
				checkedAt,
				capabilities: stripCapabilityProbeMetadata(capabilities)
			})
		);
	} catch (_) {
		// Ignore write failures (quota/private mode)
	}
};

const buildPlaybackCapabilitySnapshot = ({
	webos,
	version,
	chrome,
	hasChromeVersion
}) => {
	const webosVersion = Number.isFinite(version) ? version : (hasChromeVersion ? mapChromeToWebOSVersion(chrome) : null);
	const versionBucket = Number.isFinite(webosVersion) ? webosVersion : 0;
	const webos25Plus = webos && (
		versionBucket >= 25 ||
		(hasChromeVersion && chrome >= 120)
	);
	const hevcProbe = detectCodecSupport([
		'video/mp4; codecs="hvc1.1.6.L93.B0"',
		'video/mp4; codecs="hev1.1.6.L93.B0"',
		'video/mp4; codecs="hvc1"'
	]);
	const av1Probe = detectCodecSupport([
		'video/mp4; codecs="av01.0.08M.08"',
		'video/webm; codecs="av01.0.08M.08"'
	]);
	const vp9Probe = detectCodecSupport([
		'video/webm; codecs="vp9"',
		'video/mp4; codecs="vp09.00.10.08"'
	]);
	const ac3Probe = detectCodecSupport([
		'audio/mp4; codecs="ac-3"',
		'audio/mp4; codecs="ac3"'
	]);
	const eac3Probe = detectCodecSupport([
		'audio/mp4; codecs="ec-3"',
		'audio/mp4; codecs="dec3"'
	]);
	const atmosProbe = detectCodecSupport([
		'audio/mp4; codecs="ec+3"'
	]);
	const webpImageProbe = detectImageFormatSupport('image/webp');
	const dolbyVisionProbe = detectCodecSupport([
		'video/mp4; codecs="dvh1.05.06"',
		'video/mp4; codecs="dvhe.05.06"',
		'video/mp4; codecs="dvh1"',
		'video/mp4; codecs="dvhe"'
	]);

	const supportsHevc = hevcProbe != null ? hevcProbe : (webos && versionBucket >= 4);
	const supportsAv1 = av1Probe != null ? av1Probe : (webos && versionBucket >= 5);
	const supportsVp9 = vp9Probe != null ? vp9Probe : (webos && versionBucket >= 4);
	const supportsAc3 = ac3Probe != null ? ac3Probe : webos;
	const supportsEac3 = eac3Probe != null ? eac3Probe : webos;
	const supportsDolbyVision = Boolean(dolbyVisionProbe || webos25Plus);
	const supportsAtmos = atmosProbe != null ? atmosProbe : null;
	const supportsOpus = webos && versionBucket >= 24;

	const commonAudioCodecs = ['aac', 'mp3', 'mp2'];
	if (supportsAc3) commonAudioCodecs.push('ac3');
	if (supportsEac3) commonAudioCodecs.push('eac3');
	const pcmAudioCodecs = ['pcm_s16le', 'pcm_s24le'];
	const mkvAudioCodecs = supportsOpus
		? [...commonAudioCodecs, ...pcmAudioCodecs, 'flac', 'opus']
		: [...commonAudioCodecs, ...pcmAudioCodecs, 'flac'];
	const mp4AudioCodecs = [...commonAudioCodecs];
	const tsAudioCodecs = supportsOpus
		? [...commonAudioCodecs, ...pcmAudioCodecs, 'opus']
		: [...commonAudioCodecs, ...pcmAudioCodecs];

	return {
		webosVersion,
		webos25Plus,
		supportsHevc,
		supportsAv1,
		supportsVp9,
		supportsAc3,
		supportsEac3,
		supportsAtmos,
		supportsHdr10: webos && versionBucket >= 4,
		supportsHlg: webos && versionBucket >= 4,
		supportsDolbyVision,
		supportsDolbyVisionInMkv: webos25Plus,
		supportsWebpImage: webpImageProbe,
		supportsDts: false,
		supportsTrueHd: false,
		nativeHls: webos,
		nativeHlsFmp4: webos && versionBucket >= 5,
		maxAudioChannels: webos25Plus ? 8 : 6,
		maxStreamingBitrate: webos && versionBucket >= 24 ? 120000000 : 100000000,
		audioCodecs: Array.from(new Set([...commonAudioCodecs, ...pcmAudioCodecs, ...(supportsOpus ? ['opus'] : []), 'flac'])),
		audioCodecsByContainer: {
			mp4: mp4AudioCodecs,
			m4v: mp4AudioCodecs,
			mov: mp4AudioCodecs,
			mkv: mkvAudioCodecs,
			ts: tsAudioCodecs,
			mpegts: tsAudioCodecs,
			hls: tsAudioCodecs
		}
	};
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
	runtimeCapabilitiesNeedsDomProbe = flexGapSupport == null;
	const playback = buildPlaybackCapabilitySnapshot({
		webos,
		version,
		chrome,
		hasChromeVersion
	});

	return {
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
	};
};

export const getRuntimePlatformCapabilities = () => {
	ensureRuntimeCapabilitiesCacheTtlInitialized();
	const canRunDeferredDomProbe = typeof document !== 'undefined' && Boolean(document.body);
	const shouldRefreshForDomProbe = runtimeCapabilitiesNeedsDomProbe && canRunDeferredDomProbe;
	if (runtimeCapabilitiesCache && !shouldRefreshForDomProbe) {
		const cachedCheckedAt = Number(runtimeCapabilitiesCache?.capabilityProbe?.checkedAt);
		const isFresh = Number.isFinite(cachedCheckedAt)
			? (Date.now() - cachedCheckedAt) <= runtimeCapabilitiesCacheTtlMs
			: true;
		if (isFresh) return runtimeCapabilitiesCache;
		runtimeCapabilitiesCache = null;
	}

	const signature = buildRuntimeSignature();
	if (!runtimeCapabilitiesCache && !shouldRefreshForDomProbe) {
		const cachedEntry = readCachedRuntimeCapabilities(signature);
		if (cachedEntry) {
			runtimeCapabilitiesNeedsDomProbe = false;
			runtimeCapabilitiesCache = withCapabilityProbeMetadata(cachedEntry.capabilities, 'cache', cachedEntry.checkedAt);
			return runtimeCapabilitiesCache;
		}
	}

	const computedCapabilities = computeRuntimePlatformCapabilities();
	const checkedAt = Date.now();
	runtimeCapabilitiesCache = withCapabilityProbeMetadata(computedCapabilities, 'probe', checkedAt);
	if (!runtimeCapabilitiesNeedsDomProbe) {
		writeCachedRuntimeCapabilities(signature, computedCapabilities, checkedAt);
	}
	return runtimeCapabilitiesCache;
};

export const resetRuntimePlatformCapabilitiesCache = () => {
	runtimeCapabilitiesCache = null;
	runtimeCapabilitiesNeedsDomProbe = false;
};

export const setRuntimeCapabilityProbeRefreshDays = (daysValue) => {
	return applyRuntimeCapabilitiesCacheTtlDays(daysValue);
};

export const getRuntimeCapabilityProbeRefreshDays = () => {
	ensureRuntimeCapabilitiesCacheTtlInitialized();
	return Math.max(
		MIN_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS,
		Math.round(runtimeCapabilitiesCacheTtlMs / DAY_MS)
	);
};

export const refreshRuntimePlatformCapabilities = () => {
	ensureRuntimeCapabilitiesCacheTtlInitialized();
	runtimeCapabilitiesCache = null;
	return getRuntimePlatformCapabilities();
};
