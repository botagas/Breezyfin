import {itemMatchesUserRequestTag} from '../../utils/myRequests';
import {normalizeOptionalQueryValue} from './queryParams';

const REQUESTS_PLUGIN_ENDPOINT = '/Breezyfin/MyRequests';
const CAPABILITIES_PLUGIN_ENDPOINT = '/Breezyfin/Capabilities';
export const BREEZYFIN_FEATURE_IDS = Object.freeze({
	MY_REQUESTS: 'myRequests.v1',
	HOME_SECTIONS: 'homeSections.v1',
	DISCOVERY: 'discovery.v1',
	CALENDAR: 'calendar.v1',
	WATCHLIST_INSIGHTS: 'watchlistInsights.v1'
});
const MY_REQUESTS_FEATURE_ID = BREEZYFIN_FEATURE_IDS.MY_REQUESTS;
const SUPPORTED_CONTRACT_VERSION = '1.0';
const PLUGIN_REQUEST_TIMEOUT_MS = 65000;
const CAPABILITIES_FAILURE_TTL_MS = 15000;
const FALLBACK_SCAN_MULTIPLIER = 4;
const FALLBACK_SCAN_PAGE_LIMIT = 8;
const PLUGIN_EMPTY_REASONS = new Set([
	'no-provider-events',
	'item-type-filter',
	'requested-only-filter',
	'no-enabled-sections',
	'upstream-empty',
	'upstream-empty-with-enabled-sections'
]);
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
		capabilitiesExpiresAt: 0,
		myRequestsMissing: false
	};
	pluginSessionCache.set(service, next);
	return next;
};

export const getPluginErrorStatus = (error) => {
	const directStatus = Number(error?.status);
	if (Number.isInteger(directStatus) && directStatus >= 100 && directStatus <= 599) {
		return directStatus;
	}
	const match = String(error?.message || error || '').match(/\bstatus\s+(\d{3})\b/i);
	return match ? Number(match[1]) : null;
};

export const shouldPropagatePluginError = (error) => {
	const status = getPluginErrorStatus(error);
	return status != null && status >= 400 && status < 500 && status !== 404;
};

export const getPluginFailureReason = (error, prefix) => {
	const providerReason = String(error?.problemDetails?.reason || '').trim();
	if (providerReason) return `${prefix}-${providerReason}`;
	const status = getPluginErrorStatus(error);
	if (status === 404) return `${prefix}-missing`;
	if (status != null && status >= 500) return `${prefix}-server-error`;
	if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return `${prefix}-timeout`;
	if (error instanceof SyntaxError) return `${prefix}-malformed`;
	return `${prefix}-unavailable`;
};

const isPluginFailureRetryable = (error) => {
	if (typeof error?.problemDetails?.retryable === 'boolean') {
		return error.problemDetails.retryable;
	}
	const status = getPluginErrorStatus(error);
	if (status != null) return status >= 500;
	if (error instanceof SyntaxError) return false;
	return true;
};

export const getPluginFailureDetails = (error, prefix = 'plugin') => ({
	diagnosticReason: getPluginFailureReason(error, prefix),
	status: getPluginErrorStatus(error),
	problemDetails: error?.problemDetails || null,
	retryable: isPluginFailureRetryable(error)
});

export const getUnavailablePluginResult = (error, prefix = 'plugin') => {
	if (shouldPropagatePluginError(error)) throw error;
	return {
		available: false,
		...getPluginFailureDetails(error, prefix)
	};
};

export const requestBreezyfinPluginJson = async (
	service,
	path,
	context,
	{suppressAuthHandling = false} = {}
) => {
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
				suppressAuthHandling,
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
	const features = {};
	data.Features.forEach((feature) => {
		features[feature.Id] = feature.Enabled === true;
	});
	return {
		pluginVersion: data.PluginVersion,
		contractVersion: data.ContractVersion,
		serverAbi: data.ServerAbi,
		features: Object.freeze(features)
	};
};

const loadPluginCapabilities = async (service) => {
	let data;
	try {
		data = await requestBreezyfinPluginJson(
			service,
			CAPABILITIES_PLUGIN_ENDPOINT,
			'getBreezyfinCapabilities plugin',
			{suppressAuthHandling: true}
		);
	} catch (error) {
		const status = getPluginErrorStatus(error);
		if (![401, 403].includes(status) && shouldPropagatePluginError(error)) throw error;
		const failure = getPluginFailureDetails(error, 'plugin-capabilities');
		return {
			available: false,
			...failure
		};
	}
	const capabilities = normalizeCapabilitiesResponse(data);
	if (!capabilities) {
		return {
			available: false,
			diagnosticReason: 'plugin-capabilities-malformed',
			retryable: false
		};
	}
	if (capabilities.contractVersion !== SUPPORTED_CONTRACT_VERSION) {
		return {
			available: false,
			diagnosticReason: 'plugin-contract-unsupported',
			retryable: false
		};
	}
	return {
		available: true,
		diagnosticReason: 'plugin-capabilities',
		...capabilities
	};
};

const getPluginCapabilities = (service, sessionEntry) => {
	const now = Date.now();
	if (!sessionEntry.capabilitiesPromise || now >= sessionEntry.capabilitiesExpiresAt) {
		const request = loadPluginCapabilities(service);
		sessionEntry.capabilitiesPromise = request;
		sessionEntry.capabilitiesExpiresAt = Number.POSITIVE_INFINITY;
		request.then((result) => {
			if (sessionEntry.capabilitiesPromise !== request) return;
			if (result?.available !== true && result?.retryable === true) {
				sessionEntry.capabilitiesExpiresAt = Date.now() + CAPABILITIES_FAILURE_TTL_MS;
			}
		}).catch(() => {
			if (sessionEntry.capabilitiesPromise === request) {
				sessionEntry.capabilitiesPromise = null;
				sessionEntry.capabilitiesExpiresAt = 0;
			}
		});
	}
	return sessionEntry.capabilitiesPromise;
};

export const getBreezyfinCapabilities = async (service) => {
	const sessionEntry = getPluginSessionEntry(service);
	if (!sessionEntry) {
		return {
			available: false,
			diagnosticReason: 'missing-user-id',
			features: Object.freeze({})
		};
	}
	return getPluginCapabilities(service, sessionEntry);
};

export const normalizePluginPage = (data, {startIndex = 0, validateItem} = {}) => {
	if (!data || typeof data !== 'object' || !Array.isArray(data.Items)) return null;
	if (typeof validateItem === 'function' && !data.Items.every(validateItem)) return null;
	if (!Number.isInteger(data.TotalRecordCount) || data.TotalRecordCount < 0) return null;
	const safeStartIndex = normalizeStartIndex(startIndex);
	const explicitNextStartIndex = Number(data.NextStartIndex);
	const nextStartIndex = Number.isInteger(explicitNextStartIndex) && explicitNextStartIndex > safeStartIndex
		? explicitNextStartIndex
		: safeStartIndex + data.Items.length;
	const cursorAdvanced = nextStartIndex > safeStartIndex;
	const warnings = Array.isArray(data.Warnings) ? data.Warnings.filter((warning) => (
		warning && typeof warning === 'object' && typeof warning.Code === 'string'
	)).map((warning) => ({
		code: String(warning.Code).slice(0, 120),
		provider: typeof warning.Provider === 'string' ? warning.Provider.slice(0, 120) : '',
		operation: typeof warning.Operation === 'string' ? warning.Operation.slice(0, 120) : '',
		reason: typeof warning.Reason === 'string' ? warning.Reason.slice(0, 120) : '',
		retryable: warning.Retryable !== false,
		upstreamStatus: Number.isInteger(warning.UpstreamStatus) && warning.UpstreamStatus >= 100 && warning.UpstreamStatus <= 599
			? warning.UpstreamStatus
			: null,
		failedPage: Number.isInteger(warning.FailedPage) && warning.FailedPage >= 1
			? warning.FailedPage
			: null
	})) : [];
	const result = {
		items: data.Items,
		totalRecordCount: data.TotalRecordCount,
		nextStartIndex,
		hasMore: cursorAdvanced && (typeof data.HasMore === 'boolean' ? data.HasMore : nextStartIndex < data.TotalRecordCount),
		warnings
	};
	if (Object.prototype.hasOwnProperty.call(data, 'EmptyReason')) {
		result.emptyReason = PLUGIN_EMPTY_REASONS.has(data.EmptyReason) ? data.EmptyReason : null;
	}
	if (Number.isInteger(data.ConfiguredSectionCount) && data.ConfiguredSectionCount >= 0) {
		result.configuredSectionCount = data.ConfiguredSectionCount;
	}
	if (data.Diagnostics && typeof data.Diagnostics === 'object') {
		const diagnostics = data.Diagnostics;
		result.providerDiagnostics = {
			configuredProviderCount: Number.isInteger(diagnostics.ConfiguredProviderCount)
				? diagnostics.ConfiguredProviderCount : null,
			successfulProviderCount: Number.isInteger(diagnostics.SuccessfulProviderCount)
				? diagnostics.SuccessfulProviderCount : null,
			providerEventCount: Number.isInteger(diagnostics.ProviderEventCount)
				? diagnostics.ProviderEventCount : null,
			typeMatchedCount: Number.isInteger(diagnostics.TypeMatchedCount)
				? diagnostics.TypeMatchedCount : null,
			visibilityMatchedCount: Number.isInteger(diagnostics.VisibilityMatchedCount)
				? diagnostics.VisibilityMatchedCount : null,
			visibilityMode: typeof diagnostics.VisibilityMode === 'string'
				? diagnostics.VisibilityMode.slice(0, 80) : '',
			start: typeof diagnostics.Start === 'string' ? diagnostics.Start.slice(0, 20) : '',
			end: typeof diagnostics.End === 'string' ? diagnostics.End.slice(0, 20) : ''
		};
	}
	return result;
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
	if (capabilities.features?.[MY_REQUESTS_FEATURE_ID] !== true) {
		return {
			available: false,
			diagnosticReason: 'plugin-feature-disabled'
		};
	}
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
		const data = await requestBreezyfinPluginJson(
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
		if (getPluginErrorStatus(error) === 404) {
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
