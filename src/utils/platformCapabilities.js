import {readBreezyfinSettings} from './settingsStorage';
import {applyRuntimeLunaOverridesToCapabilities} from './platform-capabilities/lunaOverrides';
import {
	buildRuntimeSignature,
	isWebOsRuntime
} from './platform-capabilities/runtimeSignature';
import {computeRuntimePlatformCapabilities} from './platform-capabilities/runtimeComputation';
import {probeRuntimeLunaCapabilityOverrides} from './platform-capabilities/lunaProbe';
import {
	hasFreshRuntimeLunaCapabilityEntry,
	readCachedRuntimeCapabilities,
	readCachedRuntimeLunaCapabilityEntry,
	stripCapabilityProbeMetadata,
	withCapabilityProbeMetadata,
	writeCachedRuntimeCapabilities,
	writeCachedRuntimeLunaCapabilityEntry
} from './platform-capabilities/runtimeCache';

let runtimeCapabilitiesCache = null;
let runtimeCapabilitiesNeedsDomProbe = false;
const RUNTIME_CAPABILITIES_CACHE_KEY = 'breezyfinRuntimeCapabilities:v2';
const RUNTIME_CAPABILITIES_CACHE_VERSION = 3;
const RUNTIME_LUNA_CAPABILITIES_CACHE_KEY = 'breezyfinRuntimeLunaCapabilities:v1';
const RUNTIME_LUNA_CAPABILITIES_CACHE_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS = 30;
const MIN_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS = 1;
const MAX_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS = 365;
const LUNA_CONFIG_TIMEOUT_MS = 1800;
let runtimeCapabilitiesCacheTtlMs = DEFAULT_RUNTIME_CAPABILITIES_CACHE_TTL_DAYS * DAY_MS;
let runtimeCapabilitiesCacheTtlInitialized = false;
let runtimeLunaCapabilityEntry = null;
let runtimeLunaProbePromise = null;

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

const ensureRuntimeLunaCapabilityEntry = (signature) => {
	if (
		runtimeLunaCapabilityEntry &&
		runtimeLunaCapabilityEntry.signature === signature &&
		hasFreshRuntimeLunaCapabilityEntry(runtimeLunaCapabilityEntry, runtimeCapabilitiesCacheTtlMs)
	) {
		return;
	}
	const cachedEntry = readCachedRuntimeLunaCapabilityEntry({
		cacheKey: RUNTIME_LUNA_CAPABILITIES_CACHE_KEY,
		cacheVersion: RUNTIME_LUNA_CAPABILITIES_CACHE_VERSION,
		signature
	});
	if (cachedEntry && hasFreshRuntimeLunaCapabilityEntry(cachedEntry, runtimeCapabilitiesCacheTtlMs)) {
		runtimeLunaCapabilityEntry = cachedEntry;
		return;
	}
	runtimeLunaCapabilityEntry = null;
};

const maybeScheduleRuntimeLunaCapabilityProbe = (signature) => {
	if (!isWebOsRuntime()) return;
	if (
		runtimeLunaCapabilityEntry &&
		runtimeLunaCapabilityEntry.signature === signature &&
		hasFreshRuntimeLunaCapabilityEntry(runtimeLunaCapabilityEntry, runtimeCapabilitiesCacheTtlMs)
	) {
		return;
	}
	if (runtimeLunaProbePromise) return;
	runtimeLunaProbePromise = probeRuntimeLunaCapabilityOverrides(LUNA_CONFIG_TIMEOUT_MS)
		.then((overrides) => {
			if (!overrides) return;
			const checkedAt = Date.now();
			runtimeLunaCapabilityEntry = {
				signature,
				checkedAt,
				overrides
			};
			writeCachedRuntimeLunaCapabilityEntry({
				cacheKey: RUNTIME_LUNA_CAPABILITIES_CACHE_KEY,
				cacheVersion: RUNTIME_LUNA_CAPABILITIES_CACHE_VERSION,
				signature,
				overrides,
				checkedAt
			});
			if (!runtimeCapabilitiesCache) return;
			const cachedSource = runtimeCapabilitiesCache?.capabilityProbe?.source || 'probe';
			const cachedCheckedAt = Number(runtimeCapabilitiesCache?.capabilityProbe?.checkedAt);
			const refreshedCapabilities = applyRuntimeLunaOverridesToCapabilities(
				stripCapabilityProbeMetadata(runtimeCapabilitiesCache),
				overrides
			);
			runtimeCapabilitiesCache = withCapabilityProbeMetadata({
				capabilities: refreshedCapabilities,
				source: cachedSource,
				checkedAt: Number.isFinite(cachedCheckedAt) ? cachedCheckedAt : Date.now(),
				ttlMs: runtimeCapabilitiesCacheTtlMs
			});
		})
		.finally(() => {
			runtimeLunaProbePromise = null;
		});
};

export const getRuntimePlatformCapabilities = () => {
	ensureRuntimeCapabilitiesCacheTtlInitialized();
	const signature = buildRuntimeSignature();
	ensureRuntimeLunaCapabilityEntry(signature);
	const lunaOverrides = runtimeLunaCapabilityEntry?.overrides || null;
	const canRunDeferredDomProbe = typeof document !== 'undefined' && Boolean(document.body);
	const shouldRefreshForDomProbe = runtimeCapabilitiesNeedsDomProbe && canRunDeferredDomProbe;
	if (runtimeCapabilitiesCache && !shouldRefreshForDomProbe) {
		const cachedCheckedAt = Number(runtimeCapabilitiesCache?.capabilityProbe?.checkedAt);
		const isFresh = Number.isFinite(cachedCheckedAt)
			? (Date.now() - cachedCheckedAt) <= runtimeCapabilitiesCacheTtlMs
			: true;
		if (isFresh) {
			runtimeCapabilitiesCache = applyRuntimeLunaOverridesToCapabilities(runtimeCapabilitiesCache, lunaOverrides);
			maybeScheduleRuntimeLunaCapabilityProbe(signature);
			return runtimeCapabilitiesCache;
		}
		runtimeCapabilitiesCache = null;
	}

	if (!runtimeCapabilitiesCache && !shouldRefreshForDomProbe) {
		const cachedEntry = readCachedRuntimeCapabilities({
			cacheKey: RUNTIME_CAPABILITIES_CACHE_KEY,
			cacheVersion: RUNTIME_CAPABILITIES_CACHE_VERSION,
			signature,
			ttlMs: runtimeCapabilitiesCacheTtlMs
		});
		if (cachedEntry) {
			runtimeCapabilitiesNeedsDomProbe = false;
			const cachedCapabilities = applyRuntimeLunaOverridesToCapabilities(
				cachedEntry.capabilities,
				lunaOverrides
			);
			runtimeCapabilitiesCache = withCapabilityProbeMetadata({
				capabilities: cachedCapabilities,
				source: 'cache',
				checkedAt: cachedEntry.checkedAt,
				ttlMs: runtimeCapabilitiesCacheTtlMs
			});
			maybeScheduleRuntimeLunaCapabilityProbe(signature);
			return runtimeCapabilitiesCache;
		}
	}

	const {capabilities: computedCapabilities, needsDomProbe} = computeRuntimePlatformCapabilities(lunaOverrides);
	runtimeCapabilitiesNeedsDomProbe = needsDomProbe;
	const checkedAt = Date.now();
	runtimeCapabilitiesCache = withCapabilityProbeMetadata({
		capabilities: computedCapabilities,
		source: 'probe',
		checkedAt,
		ttlMs: runtimeCapabilitiesCacheTtlMs
	});
	if (!runtimeCapabilitiesNeedsDomProbe) {
		writeCachedRuntimeCapabilities({
			cacheKey: RUNTIME_CAPABILITIES_CACHE_KEY,
			cacheVersion: RUNTIME_CAPABILITIES_CACHE_VERSION,
			signature,
			capabilities: computedCapabilities,
			checkedAt
		});
	}
	maybeScheduleRuntimeLunaCapabilityProbe(signature);
	return runtimeCapabilitiesCache;
};

export const resetRuntimePlatformCapabilitiesCache = () => {
	runtimeCapabilitiesCache = null;
	runtimeCapabilitiesNeedsDomProbe = false;
	runtimeLunaCapabilityEntry = null;
	runtimeLunaProbePromise = null;
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

export const refreshRuntimePlatformCapabilitiesWithLuna = async () => {
	ensureRuntimeCapabilitiesCacheTtlInitialized();
	const signature = buildRuntimeSignature();
	const overrides = await probeRuntimeLunaCapabilityOverrides(LUNA_CONFIG_TIMEOUT_MS);
	if (overrides) {
		const checkedAt = Date.now();
		runtimeLunaCapabilityEntry = {
			signature,
			checkedAt,
			overrides
		};
		writeCachedRuntimeLunaCapabilityEntry({
			cacheKey: RUNTIME_LUNA_CAPABILITIES_CACHE_KEY,
			cacheVersion: RUNTIME_LUNA_CAPABILITIES_CACHE_VERSION,
			signature,
			overrides,
			checkedAt
		});
	} else {
		ensureRuntimeLunaCapabilityEntry(signature);
	}
	runtimeCapabilitiesCache = null;
	return getRuntimePlatformCapabilities();
};
