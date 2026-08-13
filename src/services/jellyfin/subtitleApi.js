import {toInteger} from '../../utils/numberParsing';
import {redactSensitiveUrl} from '../../utils/sensitiveData';
import {AUTH_QUERY_PARAM} from '../../utils/auth';

export const BITMAP_SUBTITLE_DELIVERY_FORMATS = ['sup', 'pgs', 'pgssub'];

const buildSubtitleEventsResult = ({
	ok = false,
	events = [],
	rawShape = 'unknown',
	error = '',
	path = null,
	status = null
} = {}) => ({
	ok,
	events,
	rawShape,
	error,
	path,
	status
});

const buildSubtitleTextResult = ({
	ok = false,
	text = '',
	format = '',
	rawShape = 'text',
	error = '',
	path = null,
	url = null,
	contentType = '',
	status = null
} = {}) => ({
	ok,
	text,
	format,
	rawShape,
	error,
	path,
	url,
	contentType,
	status
});

export const buildSubtitleBinaryResult = ({
	ok = false,
	data = null,
	format = '',
	rawShape = 'binary',
	error = '',
	path = null,
	url = null,
	contentType = '',
	byteLength = null,
	firstBytes = '',
	pgsMagic = null,
	status = null,
	failureStage = '',
	debugUrl = null
} = {}) => ({
	ok,
	data,
	format,
	rawShape,
	error,
	path,
	url,
	contentType,
	byteLength,
	firstBytes,
	pgsMagic,
	status,
	failureStage,
	debugUrl
});

const buildBitmapSubtitleDeliveryResult = ({
	ok = false,
	candidates = [],
	error = '',
	streamIndex = null,
	mediaSourceId = null,
	deliveryMethod = null
} = {}) => ({
	ok,
	candidates,
	error,
	streamIndex,
	mediaSourceId,
	deliveryMethod
});

export const buildSubtitleEventsPath = (itemId, mediaSourceId, subtitleStreamIndex) => {
	const streamIndex = toInteger(subtitleStreamIndex);
	if (!itemId || !mediaSourceId || streamIndex === null || streamIndex < 0) {
		return null;
	}
	return `/Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(mediaSourceId)}/Subtitles/${streamIndex}/Stream.js`;
};

export const buildSubtitleStreamPath = (itemId, mediaSourceId, subtitleStreamIndex, format) => {
	const streamIndex = toInteger(subtitleStreamIndex);
	const normalizedFormat = String(format || '').trim().toLowerCase();
	if (!itemId || !mediaSourceId || streamIndex === null || streamIndex < 0 || !normalizedFormat) {
		return null;
	}
	return `/Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(mediaSourceId)}/Subtitles/${streamIndex}/Stream.${encodeURIComponent(normalizedFormat)}`;
};

export const buildSubtitleBinaryStreamPath = (itemId, mediaSourceId, subtitleStreamIndex, format) => {
	const streamIndex = toInteger(subtitleStreamIndex);
	const normalizedFormat = String(format || '').trim().toLowerCase();
	if (!itemId || !mediaSourceId || streamIndex === null || streamIndex < 0 || !normalizedFormat) {
		return null;
	}
	return `/Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(mediaSourceId)}/Subtitles/${streamIndex}/0/Stream.${encodeURIComponent(normalizedFormat)}`;
};

const hasAuthQueryParam = (url) => /[?&](api_key|apikey|apiKey|ApiKey)=/i.test(String(url || ''));

export const redactSubtitleUrl = (url) => {
	if (!url) return null;
	return redactSensitiveUrl(url);
};

const appendApiKeyToUrl = (url, accessToken) => {
	if (!url || !accessToken || hasAuthQueryParam(url)) return url || null;
	const separator = String(url).includes('?') ? '&' : '?';
	return `${url}${separator}${new URLSearchParams({[AUTH_QUERY_PARAM]: accessToken}).toString()}`;
};

const joinServerUrl = (serverUrl, path) => {
	if (!serverUrl || !path) return null;
	if (/^https?:\/\//i.test(path)) return path;
	const normalizedServer = String(serverUrl).replace(/\/+$/, '');
	const normalizedPath = String(path).startsWith('/') ? String(path) : `/${path}`;
	return `${normalizedServer}${normalizedPath}`;
};

const buildAuthenticatedSubtitleUrl = (service, path) => {
	if (!path || !service?.serverUrl || !service?.accessToken) return null;
	return appendApiKeyToUrl(joinServerUrl(service.serverUrl, path), service.accessToken);
};

const getSubtitleStreamByIndex = (mediaSource, streamIndex) => {
	const index = toInteger(streamIndex);
	if (index === null || index < 0) return null;
	return (mediaSource?.MediaStreams || [])
		.find((stream) => stream?.Type === 'Subtitle' && toInteger(stream.Index) === index) || null;
};

const inferSubtitleFormatFromUrl = (url) => {
	const cleanUrl = String(url || '').split('?')[0].toLowerCase();
	const match = cleanUrl.match(/\.([a-z0-9]+)$/);
	return match?.[1] || '';
};

const inspectBinaryData = (data) => {
	if (!(data instanceof ArrayBuffer)) {
		return {
			byteLength: 0,
			firstBytes: '',
			pgsMagic: false
		};
	}
	const view = new Uint8Array(data.slice(0, Math.min(4, data.byteLength)));
	const firstBytes = Array.from(view)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join(' ');
	return {
		byteLength: data.byteLength,
		firstBytes,
		pgsMagic: view[0] === 0x50 && view[1] === 0x47
	};
};

const buildDeliveryUrlCandidate = ({service, mediaSource, subtitleStream, streamIndex}) => {
	const deliveryUrl = subtitleStream?.DeliveryUrl;
	if (!deliveryUrl || !service?.serverUrl) return null;
	const isExternalUrl = subtitleStream?.IsExternalUrl === true;
	const url = isExternalUrl
		? deliveryUrl
		: appendApiKeyToUrl(joinServerUrl(service.serverUrl, deliveryUrl), service.accessToken);
	if (!url) return null;
	return {
		url,
		debugUrl: redactSubtitleUrl(url),
		path: isExternalUrl ? null : deliveryUrl,
		format: inferSubtitleFormatFromUrl(deliveryUrl) || String(subtitleStream?.Codec || '').toLowerCase(),
		source: 'delivery-url',
		deliveryMethod: subtitleStream?.DeliveryMethod || null,
		isExternalUrl,
		streamIndex,
		mediaSourceId: mediaSource?.Id || null
	};
};

const buildGeneratedRawCandidate = ({service, itemId, mediaSource, streamIndex, format}) => {
	const path = buildSubtitleBinaryStreamPath(itemId, mediaSource?.Id, streamIndex, format);
	const url = buildAuthenticatedSubtitleUrl(service, path);
	if (!path || !url) return null;
	return {
		url,
		debugUrl: redactSubtitleUrl(url),
		path,
		format,
		source: 'generated-raw',
		deliveryMethod: 'External',
		isExternalUrl: false,
		streamIndex,
		mediaSourceId: mediaSource?.Id || null
	};
};

export const getBitmapSubtitleDeliveryCandidates = (
	service,
	itemId,
	mediaSource,
	subtitleStreamIndex,
	formats = BITMAP_SUBTITLE_DELIVERY_FORMATS
) => {
	const streamIndex = toInteger(subtitleStreamIndex);
	const mediaSourceId = mediaSource?.Id || null;
	if (!service?.serverUrl || !service?.accessToken || !itemId || !mediaSourceId || streamIndex === null || streamIndex < 0) {
		return buildBitmapSubtitleDeliveryResult({
			error: 'missing-subtitle-context',
			streamIndex,
			mediaSourceId
		});
	}
	const subtitleStream = getSubtitleStreamByIndex(mediaSource, streamIndex);
	if (!subtitleStream) {
		return buildBitmapSubtitleDeliveryResult({
			error: 'subtitle-stream-missing',
			streamIndex,
			mediaSourceId
		});
	}
	const candidates = [];
	const deliveryUrlCandidate = buildDeliveryUrlCandidate({
		service,
		mediaSource,
		subtitleStream,
		streamIndex
	});
	if (deliveryUrlCandidate) candidates.push(deliveryUrlCandidate);
	const seenFormats = new Set();
	(formats || BITMAP_SUBTITLE_DELIVERY_FORMATS)
		.map((format) => String(format || '').trim().toLowerCase())
		.filter(Boolean)
		.forEach((format) => {
			if (seenFormats.has(format)) return;
			seenFormats.add(format);
			const candidate = buildGeneratedRawCandidate({
				service,
				itemId,
				mediaSource,
				streamIndex,
				format
			});
			if (candidate) candidates.push(candidate);
		});
	return buildBitmapSubtitleDeliveryResult({
		ok: candidates.length > 0,
		candidates,
		error: candidates.length > 0 ? '' : 'no-subtitle-delivery-candidates',
		streamIndex,
		mediaSourceId,
		deliveryMethod: subtitleStream?.DeliveryMethod || null
	});
};

export const buildSubtitleStreamUrl = (service, itemId, mediaSourceId, subtitleStreamIndex, format) => {
	const path = buildSubtitleStreamPath(itemId, mediaSourceId, subtitleStreamIndex, format);
	return buildAuthenticatedSubtitleUrl(service, path);
};

export const buildSubtitleBinaryStreamUrl = (service, itemId, mediaSourceId, subtitleStreamIndex, format) => {
	const path = buildSubtitleBinaryStreamPath(itemId, mediaSourceId, subtitleStreamIndex, format);
	return buildAuthenticatedSubtitleUrl(service, path);
};

export const getSubtitleTrackEvents = async (service, itemId, mediaSourceId, subtitleStreamIndex) => {
	const path = buildSubtitleEventsPath(itemId, mediaSourceId, subtitleStreamIndex);
	if (!path) {
		return buildSubtitleEventsResult({
			rawShape: 'invalid-context',
			error: 'missing-subtitle-context'
		});
	}
	let data;
	try {
		data = await service._request(path, {
			context: 'getSubtitleTrackEvents'
		});
	} catch (error) {
		return buildSubtitleEventsResult({
			rawShape: 'request-error',
			error: error?.message || 'subtitle-event-request-failed',
			path,
			status: Number.isInteger(error?.status) ? error.status : null
		});
	}
	if (Array.isArray(data?.TrackEvents)) {
		return buildSubtitleEventsResult({
			ok: true,
			events: data.TrackEvents,
			rawShape: 'track-events',
			path
		});
	}
	return buildSubtitleEventsResult({
		rawShape: data === null ? 'null' : typeof data,
		error: 'unsupported-subtitle-event-payload',
		path
	});
};

export const getSubtitleTrackText = async (service, itemId, mediaSourceId, subtitleStreamIndex, format) => {
	const path = buildSubtitleStreamPath(itemId, mediaSourceId, subtitleStreamIndex, format);
	if (!path) {
		return buildSubtitleTextResult({
			format,
			rawShape: 'invalid-context',
			error: 'missing-subtitle-context'
		});
	}
	let response;
	let text;
	try {
		response = await service._request(path, {
			context: 'getSubtitleTrackText',
			expectJson: false
		});
		text = await response.text();
	} catch (error) {
		return buildSubtitleTextResult({
			format,
			rawShape: 'request-error',
			path,
			url: buildSubtitleStreamUrl(service, itemId, mediaSourceId, subtitleStreamIndex, format),
			error: error?.message || 'subtitle-text-request-failed',
			status: Number.isInteger(error?.status) ? error.status : null
		});
	}
	if (!text || !String(text).trim()) {
		return buildSubtitleTextResult({
			format,
			path,
			url: buildSubtitleStreamUrl(service, itemId, mediaSourceId, subtitleStreamIndex, format),
			contentType: response.headers?.get?.('content-type') || '',
			error: 'empty-subtitle-text'
		});
	}
	return buildSubtitleTextResult({
		ok: true,
		text,
		format,
		path,
		url: buildSubtitleStreamUrl(service, itemId, mediaSourceId, subtitleStreamIndex, format),
		contentType: response.headers?.get?.('content-type') || ''
	});
};

export const getSubtitleTrackBinary = async (service, itemId, mediaSourceId, subtitleStreamIndex, format) => {
	const path = buildSubtitleBinaryStreamPath(itemId, mediaSourceId, subtitleStreamIndex, format);
	if (!path) {
		return buildSubtitleBinaryResult({
			format,
			rawShape: 'invalid-context',
			error: 'missing-subtitle-context',
			failureStage: 'context'
		});
	}
	const url = buildSubtitleBinaryStreamUrl(service, itemId, mediaSourceId, subtitleStreamIndex, format);
	const debugUrl = redactSubtitleUrl(url);
	let response;
	let data;
	try {
		response = await service._request(path, {
			context: 'getSubtitleTrackBinary',
			expectJson: false
		});
		data = await response.arrayBuffer();
	} catch (error) {
		const responseAvailable = Boolean(response);
		return buildSubtitleBinaryResult({
			format,
			path,
			url,
			debugUrl,
			contentType: response?.headers?.get?.('content-type') || '',
			error: error?.message || (responseAvailable ? 'subtitle-binary-read-failed' : 'subtitle-binary-request-failed'),
			status: Number.isInteger(error?.status)
				? error.status
				: Number.isInteger(response?.status) ? response.status : null,
			failureStage: responseAvailable ? 'body-read' : 'request'
		});
	}
	const binaryInfo = inspectBinaryData(data);
	if (!data || data.byteLength <= 0) {
		return buildSubtitleBinaryResult({
			format,
			path,
			url,
			debugUrl,
			contentType: response.headers?.get?.('content-type') || '',
			error: 'empty-subtitle-binary',
			status: Number.isInteger(response?.status) ? response.status : null,
			failureStage: 'empty-body',
			...binaryInfo
		});
	}
	return buildSubtitleBinaryResult({
		ok: true,
		data,
		format,
		path,
		url,
		debugUrl,
		contentType: response.headers?.get?.('content-type') || '',
		status: Number.isInteger(response?.status) ? response.status : null,
		...binaryInfo
	});
};
