import {itemMatchesUserRequestTag} from '../../utils/myRequests';
import {normalizeOptionalQueryValue} from './queryParams';

const REQUESTS_PLUGIN_ENDPOINT = '/Breezyfin/MyRequests';
const CAPABILITIES_PLUGIN_ENDPOINT = '/Breezyfin/Capabilities';
const MY_REQUESTS_FEATURE_ID = 'myRequests.v1';
const SUPPORTED_CONTRACT_VERSION = '1.0';
const PLUGIN_REQUEST_TIMEOUT_MS = 65000;
const FALLBACK_SCAN_MULTIPLIER = 4;
const FALLBACK_SCAN_PAGE_LIMIT = 8;
const pluginSessionCache = new WeakMap();

const normalizePositiveInteger = (value, fallback) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(500, Math.max(1, Math.trunc(parsed)));
};

const normalizeStartIndex = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return 0;
	return Math.max(0, Math.trunc(parsed));
};

const getPluginSessionKey = (service) => {
	if (!service?.serverUrl || !service?.userId) return '';
	return JSON.stringify([
		String(service.serverUrl),
		String(service.userId),
		String(service.accessToken || '')
	]);
};

const getPluginSessionEntry = (service) => {
	const key = getPluginSessionKey(service);
	if (!key || (typeof service !== 'object' && typeof service !== 'function')) return null;
	const cached = pluginSessionCache.get(service);
	if (cached?.key === key) return cached;
	const next = {
		key,
		capabilitiesPromise: null,
		myRequestsMissing: false
	};
	pluginSessionCache.set(service, next);
	return next;
};

const getErrorStatus = (error) => {
	const directStatus = Number(error?.status);
	if (Number.isInteger(directStatus) && directStatus >= 100 && directStatus <= 599) {
		return directStatus;
	}
	const match = String(error?.message || error || '').match(/\bstatus\s+(\d{3})\b/i);
	return match ? Number(match[1]) : null;
};

const shouldPropagatePluginError = (error) => {
	const status = getErrorStatus(error);
	return status != null && status >= 400 && status < 500 && status !== 404;
};

const getPluginFailureReason = (error, prefix) => {
	const status = getErrorStatus(error);
	if (status === 404) return `${prefix}-missing`;
	if (status != null && status >= 500) return `${prefix}-server-error`;
	if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return `${prefix}-timeout`;
	if (error instanceof SyntaxError) return `${prefix}-malformed`;
	return `${prefix}-unavailable`;
};

const requestPluginJson = async (service, path, context) => {
	const controller = typeof AbortController === 'function' ? new AbortController() : null;
	let timeoutId = null;
	const timeoutPromise = new Promise((_, reject) => {
		timeoutId = setTimeout(() => {
			controller?.abort();
			const error = new Error(`${context} timed out`);
			error.name = 'TimeoutError';
			reject(error);
		}, PLUGIN_REQUEST_TIMEOUT_MS);
	});
	try {
		return await Promise.race([
			service._request(path, {
				context,
				...(controller ? {signal: controller.signal} : {})
			}),
			timeoutPromise
		]);
	} finally {
		clearTimeout(timeoutId);
	}
};

const normalizeCapabilitiesResponse = (data) => {
	if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
	if (
		typeof data.PluginVersion !== 'string' || !data.PluginVersion.trim() ||
		typeof data.ContractVersion !== 'string' || !data.ContractVersion.trim() ||
		typeof data.ServerAbi !== 'string' || !data.ServerAbi.trim() ||
		!Array.isArray(data.Features) ||
		!data.Features.every((feature) => (
			feature &&
			typeof feature === 'object' &&
			typeof feature.Id === 'string' &&
			typeof feature.Enabled === 'boolean'
		))
	) {
		return null;
	}
	return {
		contractVersion: data.ContractVersion,
		myRequestsEnabled: data.Features.some((feature) => (
			feature.Id === MY_REQUESTS_FEATURE_ID && feature.Enabled === true
		))
	};
};

const loadPluginCapabilities = async (service) => {
	let data;
	try {
		data = await requestPluginJson(
			service,
			CAPABILITIES_PLUGIN_ENDPOINT,
			'getBreezyfinCapabilities plugin'
		);
	} catch (error) {
		if (shouldPropagatePluginError(error)) throw error;
		return {
			available: false,
			diagnosticReason: getPluginFailureReason(error, 'plugin-capabilities')
		};
	}
	const capabilities = normalizeCapabilitiesResponse(data);
	if (!capabilities) {
		return {
			available: false,
			diagnosticReason: 'plugin-capabilities-malformed'
		};
	}
	if (capabilities.contractVersion !== SUPPORTED_CONTRACT_VERSION) {
		return {
			available: false,
			diagnosticReason: 'plugin-contract-unsupported'
		};
	}
	if (!capabilities.myRequestsEnabled) {
		return {
			available: false,
			diagnosticReason: 'plugin-feature-disabled'
		};
	}
	return {
		available: true,
		diagnosticReason: 'plugin-capabilities'
	};
};

const getPluginCapabilities = (service, sessionEntry) => {
	if (!sessionEntry.capabilitiesPromise) {
		sessionEntry.capabilitiesPromise = loadPluginCapabilities(service);
	}
	return sessionEntry.capabilitiesPromise;
};

const normalizePluginResponse = (data, {startIndex}) => {
	if (!data || typeof data !== 'object' || !Array.isArray(data.Items)) return null;
	if (!data.Items.every((item) => (
		item &&
		typeof item === 'object' &&
		typeof item.Id === 'string' &&
		item.Id.trim()
	))) {
		return null;
	}
	const items = data.Items;
	const totalRecordCount = data.TotalRecordCount;
	if (!Number.isInteger(totalRecordCount) || totalRecordCount < 0) return null;
	const nextStartIndex = startIndex + items.length;
	return {
		items,
		source: 'plugin',
		scannedCount: items.length,
		nextStartIndex,
		hasMore: nextStartIndex < totalRecordCount,
		diagnosticReason: 'plugin'
	};
};

const getMyRequestsFromPlugin = async (service, {
	parentId,
	itemTypes,
	limit = 60,
	startIndex = 0
} = {}) => {
	const sessionEntry = getPluginSessionEntry(service);
	if (!sessionEntry) {
		return {
			available: false,
			diagnosticReason: 'missing-user-id'
		};
	}
	if (sessionEntry.myRequestsMissing) {
		return {
			available: false,
			diagnosticReason: 'plugin-missing-cached'
		};
	}
	const capabilities = await getPluginCapabilities(service, sessionEntry);
	if (capabilities.available !== true) return capabilities;
	try {
		const safeLimit = normalizePositiveInteger(limit, 60);
		const safeStartIndex = normalizeStartIndex(startIndex);
		const params = new URLSearchParams();
		params.set('userId', service.userId);
		const safeParentId = normalizeOptionalQueryValue(parentId);
		if (safeParentId) params.set('parentId', safeParentId);
		params.set('limit', String(safeLimit));
		params.set('startIndex', String(safeStartIndex));
		if (Array.isArray(itemTypes) && itemTypes.length > 0) {
			params.set('includeItemTypes', itemTypes.join(','));
		} else if (typeof itemTypes === 'string' && itemTypes.trim()) {
			params.set('includeItemTypes', itemTypes.trim());
		}
		const data = await requestPluginJson(
			service,
			`${REQUESTS_PLUGIN_ENDPOINT}?${params.toString()}`,
			'getMyRequests plugin'
		);
		const result = normalizePluginResponse(data, {
			startIndex: safeStartIndex
		});
		if (!result) {
			return {
				available: false,
				diagnosticReason: 'plugin-response-malformed'
			};
		}
		return {
			available: true,
			result
		};
	} catch (error) {
		if (shouldPropagatePluginError(error)) throw error;
		if (getErrorStatus(error) === 404) {
			sessionEntry.myRequestsMissing = true;
		}
		return {
			available: false,
			diagnosticReason: getPluginFailureReason(error, 'plugin')
		};
	}
};

const collectTaggedFallbackPage = async (service, {
	parentId,
	itemTypes,
	limit,
	startIndex,
	username,
	pluginDiagnosticReason
}) => {
	const safeLimit = normalizePositiveInteger(limit, 60);
	const safeStartIndex = normalizeStartIndex(startIndex);
	if (!String(username || '').trim()) {
		return {
			items: [],
			source: 'tags-fallback',
			scannedCount: 0,
			nextStartIndex: safeStartIndex,
			hasMore: false,
			diagnosticReason: 'missing-username'
		};
	}

	const rawLimit = Math.max(safeLimit, safeLimit * FALLBACK_SCAN_MULTIPLIER);
	let cursor = safeStartIndex;
	let scannedCount = 0;
	let scanPages = 0;
	let sourceHasMore = true;
	const collected = [];

	while (collected.length < safeLimit && scanPages < FALLBACK_SCAN_PAGE_LIMIT && sourceHasMore) {
		const rawItems = await service.getLibraryItems(parentId, itemTypes, rawLimit, cursor);
		const safeRawItems = Array.isArray(rawItems) ? rawItems : [];
		if (safeRawItems.length === 0) {
			sourceHasMore = false;
			break;
		}

		for (let index = 0; index < safeRawItems.length; index += 1) {
			const item = safeRawItems[index];
			scannedCount += 1;
			const rawItemIndex = cursor + index;
			if (!itemMatchesUserRequestTag(item, username)) continue;
			collected.push(item);
			if (collected.length >= safeLimit) {
				const nextStartIndex = rawItemIndex + 1;
				const rawPageEndIndex = cursor + safeRawItems.length;
				const hasMore = nextStartIndex < rawPageEndIndex || safeRawItems.length >= rawLimit;
				return {
					items: collected,
					source: 'tags-fallback',
					scannedCount: nextStartIndex - safeStartIndex,
					nextStartIndex,
					hasMore,
					diagnosticReason: pluginDiagnosticReason || 'tags-fallback-filled'
				};
			}
		}

		cursor += safeRawItems.length;
		sourceHasMore = safeRawItems.length >= rawLimit;
		scanPages += 1;
	}

	const stoppedByScanLimit = sourceHasMore && scanPages >= FALLBACK_SCAN_PAGE_LIMIT;
	return {
		items: collected,
		source: 'tags-fallback',
		scannedCount,
		nextStartIndex: safeStartIndex + scannedCount,
		hasMore: stoppedByScanLimit,
		diagnosticReason: stoppedByScanLimit
			? 'tags-fallback-scan-limit'
			: (pluginDiagnosticReason || 'tags-fallback-exhausted')
	};
};

export const getMyRequestItems = async (service, {
	parentId,
	itemTypes,
	limit = 60,
	startIndex = 0,
	username = ''
} = {}) => {
	const safeParentId = normalizeOptionalQueryValue(parentId);
	const pluginResult = await getMyRequestsFromPlugin(service, {
		parentId: safeParentId,
		itemTypes,
		limit,
		startIndex
	});
	if (pluginResult.available === true) {
		return pluginResult.result;
	}

	return collectTaggedFallbackPage(service, {
		parentId: safeParentId,
		itemTypes,
		limit,
		startIndex,
		username,
		pluginDiagnosticReason: pluginResult.diagnosticReason
	});
};
