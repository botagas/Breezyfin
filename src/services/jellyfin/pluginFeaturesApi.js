import {
	getBreezyfinCapabilities,
	getUnavailablePluginResult,
	normalizePluginPage,
	requestBreezyfinPluginJson
} from './requestsApi';

const normalizeLimit = (value, fallback) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(500, Math.max(1, Math.trunc(parsed)));
};

const normalizeStartIndex = (value) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

export const getPluginFeaturePage = async (service, {
	featureId,
	path,
	context,
	startIndex = 0,
	validateItem
}) => {
	const capabilities = await getBreezyfinCapabilities(service);
	if (capabilities.available !== true) return capabilities;
	if (capabilities.features?.[featureId] !== true) {
		return {available: false, diagnosticReason: 'plugin-feature-disabled'};
	}

	try {
		const data = await requestBreezyfinPluginJson(service, path, context);
		const page = normalizePluginPage(data, {startIndex, validateItem});
		if (!page) {
			return {available: false, diagnosticReason: 'plugin-response-malformed'};
		}
		return {available: true, result: page};
	} catch (error) {
		return getUnavailablePluginResult(error);
	}
};

export const createPluginPaging = (limit, startIndex, fallbackLimit) => ({
	limit: normalizeLimit(limit, fallbackLimit),
	startIndex: normalizeStartIndex(startIndex)
});

export const buildAuthenticatedPluginImageUrl = (service, relativePath, width = 500) => {
	if (!service?.serverUrl || !service?.accessToken || typeof relativePath !== 'string') return null;
	if (!relativePath.startsWith('/Breezyfin/ExternalImages/')) return null;
	const safeWidth = Math.min(1920, Math.max(64, Math.trunc(Number(width) || 500)));
	let url;
	try {
		url = new URL(relativePath, service.serverUrl);
	} catch (_) {
		return null;
	}
	url.searchParams.set('width', String(safeWidth));
	url.searchParams.set('api_key', service.accessToken);
	return url.toString();
};

export const addAuthenticatedPluginImageUrls = (service, response) => {
	if (response.available !== true) return response;
	return {
		...response,
		result: {
			...response.result,
			items: response.result.items.map((item) => ({
				...item,
				AuthenticatedImageUrl: buildAuthenticatedPluginImageUrl(service, item.ImageUrl)
			}))
		}
	};
};

export const addAuthenticatedPluginImageUrl = (service, item) => ({
	...item,
	AuthenticatedImageUrl: buildAuthenticatedPluginImageUrl(service, item?.ImageUrl)
});
