import {redactSensitiveUrl} from '../../../utils/sensitiveData';
import {
	normalizeSubtitleEvents,
	normalizeSubtitleText
} from './subtitleRenderer';
import {getRawSubtitleFormats} from './subtitleRawFormats';
import {normalizeSubtitleRendererFailureReason} from './subtitleRendererStatus';

const createCancelledResult = (debug) => ({
	cancelled: true,
	events: [],
	fallbackReason: '',
	debug
});

export const loadClientSubtitleEvents = async ({
	cacheKey = '',
	codec,
	fetchEvents,
	fetchText,
	isCancelled = () => false,
	now = Date.now,
	preferRawDocument = false
} = {}) => {
	const startedAt = now();
	const rawFormats = getRawSubtitleFormats(codec);
	let debug = {
		cacheKey,
		cacheHit: false,
		sourcePriority: preferRawDocument ? 'raw-document-first' : 'track-events-first'
	};
	let fallbackReason = '';

	const loadRawDocument = async () => {
		for (const rawFormat of rawFormats) {
			const rawResult = await fetchText(rawFormat);
			if (isCancelled()) return createCancelledResult(debug);
			debug = {
				...debug,
				rawPath: rawResult?.path || '',
				rawUrl: redactSensitiveUrl(rawResult?.url || ''),
				rawShape: rawResult?.rawShape || 'text',
				rawFormat,
				rawTried: rawFormats.join(','),
				rawContentType: rawResult?.contentType || '',
				fetchMs: now() - startedAt
			};
			if (rawResult?.ok === true) {
				const events = normalizeSubtitleText(rawResult.text, rawFormat);
				if (events.length > 0) {
					return {events, fallbackReason: '', debug: {...debug, source: 'raw-document'}};
				}
				fallbackReason = 'empty-raw-subtitle-text';
			} else {
				fallbackReason = normalizeSubtitleRendererFailureReason(rawResult?.error, 'raw-fetch-failed');
			}
		}
		return {events: [], fallbackReason, debug};
	};

	const loadTrackEvents = async () => {
		const result = await fetchEvents();
		if (isCancelled()) return createCancelledResult(debug);
		debug = {
			...debug,
			path: result?.path || '',
			eventRawShape: result?.rawShape || 'unknown',
			fetchMs: now() - startedAt
		};
		if (result?.ok !== true) {
			fallbackReason = normalizeSubtitleRendererFailureReason(result?.error);
			return {events: [], fallbackReason, debug};
		}
		const events = normalizeSubtitleEvents(result.events);
		if (events.length === 0) {
			fallbackReason = 'empty-events';
			return {events: [], fallbackReason, debug};
		}
		return {events, fallbackReason: '', debug: {...debug, source: 'track-events'}};
	};

	const loaders = preferRawDocument
		? [loadRawDocument, loadTrackEvents]
		: [loadTrackEvents, loadRawDocument];
	for (const load of loaders) {
		const result = await load();
		if (result.cancelled || result.events.length > 0) return result;
		fallbackReason = result.fallbackReason;
		debug = result.debug;
	}
	return {
		cancelled: false,
		events: [],
		fallbackReason: fallbackReason || 'empty-events',
		debug
	};
};
