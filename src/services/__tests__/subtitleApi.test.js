import {
	buildSubtitleEventsPath,
	buildSubtitleStreamPath,
	buildSubtitleStreamUrl,
	getSubtitleTrackEvents,
	getSubtitleTrackText
} from '../jellyfin/subtitleApi';

describe('subtitleApi', () => {
	it('builds Jellyfin subtitle event paths', () => {
		expect(buildSubtitleEventsPath('item 1', 'source/1', 3))
			.toBe('/Videos/item%201/source%2F1/Subtitles/3/Stream.js');
		expect(buildSubtitleEventsPath('item-1', 'source-1', -1)).toBe(null);
		expect(buildSubtitleEventsPath('', 'source-1', 3)).toBe(null);
	});

	it('builds raw subtitle stream paths and authenticated urls', () => {
		expect(buildSubtitleStreamPath('item 1', 'source/1', 3, 'vtt'))
			.toBe('/Videos/item%201/source%2F1/Subtitles/3/Stream.vtt');
		expect(buildSubtitleStreamPath('item-1', 'source-1', -1, 'vtt')).toBe(null);
		expect(buildSubtitleStreamPath('item-1', 'source-1', 3, '')).toBe(null);
		expect(buildSubtitleStreamUrl({
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token'
		}, 'item-1', 'source-1', 3, 'ass')).toBe(
			'https://jellyfin.example/Videos/item-1/source-1/Subtitles/3/Stream.ass?api_key=token'
		);
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

	it('fetches raw subtitle text through the service request helper', async () => {
		const response = {
			text: jest.fn().mockResolvedValue('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello'),
			headers: {get: jest.fn().mockReturnValue('text/vtt')}
		};
		const service = {
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token',
			_request: jest.fn().mockResolvedValue(response)
		};

		const result = await getSubtitleTrackText(service, 'item-1', 'source-1', 3, 'vtt');

		expect(service._request).toHaveBeenCalledWith(
			'/Videos/item-1/source-1/Subtitles/3/Stream.vtt',
			{context: 'getSubtitleTrackText', expectJson: false}
		);
		expect(result).toEqual(expect.objectContaining({
			ok: true,
			text: 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello',
			format: 'vtt',
			path: '/Videos/item-1/source-1/Subtitles/3/Stream.vtt',
			url: 'https://jellyfin.example/Videos/item-1/source-1/Subtitles/3/Stream.vtt?api_key=token',
			contentType: 'text/vtt'
		}));
	});

	it('returns a structured failure for empty raw subtitle text', async () => {
		const service = {
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token',
			_request: jest.fn().mockResolvedValue({
				text: jest.fn().mockResolvedValue('   '),
				headers: {get: jest.fn().mockReturnValue('text/plain')}
			})
		};

		await expect(getSubtitleTrackText(service, 'item-1', 'source-1', 3, 'srt')).resolves.toEqual(
			expect.objectContaining({
				ok: false,
				text: '',
				format: 'srt',
				error: 'empty-subtitle-text',
				path: '/Videos/item-1/source-1/Subtitles/3/Stream.srt'
			})
		);
	});
});
