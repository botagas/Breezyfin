import {toInteger} from '../../utils/numberParsing';

const buildSubtitleEventsResult = ({
	ok = false,
	events = [],
	rawShape = 'unknown',
	error = '',
	path = null
} = {}) => ({
	ok,
	events,
	rawShape,
	error,
	path
});

const buildSubtitleTextResult = ({
	ok = false,
	text = '',
	format = '',
	rawShape = 'text',
	error = '',
	path = null,
	url = null,
	contentType = ''
} = {}) => ({
	ok,
	text,
	format,
	rawShape,
	error,
	path,
	url,
	contentType
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

export const buildSubtitleStreamUrl = (service, itemId, mediaSourceId, subtitleStreamIndex, format) => {
	const path = buildSubtitleStreamPath(itemId, mediaSourceId, subtitleStreamIndex, format);
	if (!path || !service?.serverUrl || !service?.accessToken) return null;
	const params = new URLSearchParams({api_key: service.accessToken});
	return `${service.serverUrl}${path}?${params.toString()}`;
};

export const getSubtitleTrackEvents = async (service, itemId, mediaSourceId, subtitleStreamIndex) => {
	const path = buildSubtitleEventsPath(itemId, mediaSourceId, subtitleStreamIndex);
	if (!path) {
		return buildSubtitleEventsResult({
			rawShape: 'invalid-context',
			error: 'missing-subtitle-context'
		});
	}
	const data = await service._request(path, {
		context: 'getSubtitleTrackEvents'
	});
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
	const response = await service._request(path, {
		context: 'getSubtitleTrackText',
		expectJson: false
	});
	const text = await response.text();
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
