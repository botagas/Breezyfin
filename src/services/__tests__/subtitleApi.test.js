import {
	buildSubtitleEventsPath,
	getSubtitleTrackEvents
} from '../jellyfin/subtitleApi';

describe('subtitleApi', () => {
	it('builds Jellyfin subtitle event paths', () => {
		expect(buildSubtitleEventsPath('item 1', 'source/1', 3))
			.toBe('/Videos/item%201/source%2F1/Subtitles/3/Stream.js');
		expect(buildSubtitleEventsPath('item-1', 'source-1', -1)).toBe(null);
		expect(buildSubtitleEventsPath('', 'source-1', 3)).toBe(null);
	});

	it('fetches subtitle track events through the service request helper', async () => {
		const service = {
			_request: jest.fn().mockResolvedValue({
				TrackEvents: [
					{StartPositionTicks: 0, EndPositionTicks: 100, Text: 'Hello'}
				]
			})
		};

		const result = await getSubtitleTrackEvents(service, 'item-1', 'source-1', 3);

		expect(service._request).toHaveBeenCalledWith(
			'/Videos/item-1/source-1/Subtitles/3/Stream.js',
			{context: 'getSubtitleTrackEvents'}
		);
		expect(result).toEqual({
			ok: true,
			events: [
				{StartPositionTicks: 0, EndPositionTicks: 100, Text: 'Hello'}
			],
			rawShape: 'track-events',
			error: '',
			path: '/Videos/item-1/source-1/Subtitles/3/Stream.js'
		});
	});

	it('returns a structured failure for invalid context', async () => {
		const service = {
			_request: jest.fn()
		};

		await expect(getSubtitleTrackEvents(service, 'item-1', '', 3)).resolves.toEqual({
			ok: false,
			events: [],
			rawShape: 'invalid-context',
			error: 'missing-subtitle-context',
			path: null
		});
		expect(service._request).not.toHaveBeenCalled();
	});

	it('returns a structured failure for unsupported subtitle payloads', async () => {
		const service = {
			_request: jest.fn().mockResolvedValue({Events: []})
		};

		await expect(getSubtitleTrackEvents(service, 'item-1', 'source-1', 3)).resolves.toEqual({
			ok: false,
			events: [],
			rawShape: 'object',
			error: 'unsupported-subtitle-event-payload',
			path: '/Videos/item-1/source-1/Subtitles/3/Stream.js'
		});
	});

	it('keeps empty TrackEvents as a valid response for renderer-level handling', async () => {
		const service = {
			_request: jest.fn().mockResolvedValue({TrackEvents: []})
		};

		await expect(getSubtitleTrackEvents(service, 'item-1', 'source-1', 3)).resolves.toEqual({
			ok: true,
			events: [],
			rawShape: 'track-events',
			error: '',
			path: '/Videos/item-1/source-1/Subtitles/3/Stream.js'
		});
	});
});
