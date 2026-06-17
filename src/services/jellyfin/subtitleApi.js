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

export const buildSubtitleEventsPath = (itemId, mediaSourceId, subtitleStreamIndex) => {
	const streamIndex = toInteger(subtitleStreamIndex);
	if (!itemId || !mediaSourceId || streamIndex === null || streamIndex < 0) {
		return null;
	}
	return `/Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(mediaSourceId)}/Subtitles/${streamIndex}/Stream.js`;
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
