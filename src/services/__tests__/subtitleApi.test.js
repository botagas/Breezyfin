import {
	buildSubtitleBinaryStreamPath,
	buildSubtitleBinaryStreamUrl,
	buildSubtitleEventsPath,
	buildSubtitleStreamPath,
	buildSubtitleStreamUrl,
	getBitmapSubtitleDeliveryCandidates,
	getSubtitleTrackBinary,
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
			'https://jellyfin.example/Videos/item-1/source-1/Subtitles/3/Stream.ass?ApiKey=token'
		);
	});

	it('builds timed binary subtitle stream paths and authenticated urls', () => {
		expect(buildSubtitleBinaryStreamPath('item 1', 'source/1', 3, 'sup'))
			.toBe('/Videos/item%201/source%2F1/Subtitles/3/0/Stream.sup');
		expect(buildSubtitleBinaryStreamPath('item-1', 'source-1', -1, 'sup')).toBe(null);
		expect(buildSubtitleBinaryStreamUrl({
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token'
		}, 'item-1', 'source-1', 3, 'pgs')).toBe(
			'https://jellyfin.example/Videos/item-1/source-1/Subtitles/3/0/Stream.pgs?ApiKey=token'
		);
	});

	it('resolves bitmap subtitle delivery candidates from DeliveryUrl before generated raw paths', () => {
		const result = getBitmapSubtitleDeliveryCandidates({
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token'
		}, 'item-1', {
			Id: 'source-1',
			MediaStreams: [
				{
					Type: 'Subtitle',
					Index: 4,
					Codec: 'pgssub',
					DeliveryUrl: '/Videos/item-1/source-1/Subtitles/4/0/Stream.sup?api_key=existing',
					DeliveryMethod: 'External'
				}
			]
		}, 4);

		expect(result).toEqual(expect.objectContaining({
			ok: true,
			streamIndex: 4,
			mediaSourceId: 'source-1',
			deliveryMethod: 'External'
		}));
		expect(result.candidates.map((candidate) => `${candidate.source}:${candidate.format}`)).toEqual([
			'delivery-url:sup',
			'generated-raw:sup',
			'generated-raw:pgs',
			'generated-raw:pgssub'
		]);
		expect(result.candidates[0]).toEqual(expect.objectContaining({
			url: 'https://jellyfin.example/Videos/item-1/source-1/Subtitles/4/0/Stream.sup?api_key=existing',
			debugUrl: 'https://jellyfin.example/Videos/item-1/source-1/Subtitles/4/0/Stream.sup?api_key=[REDACTED]',
			path: '/Videos/item-1/source-1/Subtitles/4/0/Stream.sup?api_key=existing'
		}));
	});

	it('resolves generated bitmap subtitle candidates in sup pgs pgssub order', () => {
		const result = getBitmapSubtitleDeliveryCandidates({
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token'
		}, 'item-1', {
			Id: 'source-1',
			MediaStreams: [
				{Type: 'Subtitle', Index: 4, Codec: 'pgs'}
			]
		}, 4);

		expect(result.candidates.map((candidate) => candidate.path)).toEqual([
			'/Videos/item-1/source-1/Subtitles/4/0/Stream.sup',
			'/Videos/item-1/source-1/Subtitles/4/0/Stream.pgs',
			'/Videos/item-1/source-1/Subtitles/4/0/Stream.pgssub'
		]);
		expect(result.candidates[0].url).toBe(
			'https://jellyfin.example/Videos/item-1/source-1/Subtitles/4/0/Stream.sup?ApiKey=token'
		);
	});

	it('returns structured bitmap delivery failure for missing context', () => {
		expect(getBitmapSubtitleDeliveryCandidates({
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token'
		}, 'item-1', {Id: 'source-1', MediaStreams: []}, 4)).toEqual(expect.objectContaining({
			ok: false,
			candidates: [],
			error: 'subtitle-stream-missing',
			streamIndex: 4,
			mediaSourceId: 'source-1'
		}));
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
			path: '/Videos/item-1/source-1/Subtitles/3/Stream.js',
			status: null
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
			path: null,
			status: null
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
			path: '/Videos/item-1/source-1/Subtitles/3/Stream.js',
			status: null
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
			path: '/Videos/item-1/source-1/Subtitles/3/Stream.js',
			status: null
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
			url: 'https://jellyfin.example/Videos/item-1/source-1/Subtitles/3/Stream.vtt?ApiKey=token',
			contentType: 'text/vtt'
		}));
	});

	it('fetches raw bitmap subtitle binary through the service request helper', async () => {
		const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
		const response = {
			arrayBuffer: jest.fn().mockResolvedValue(buffer),
			headers: {get: jest.fn().mockReturnValue('application/octet-stream')},
			status: 200
		};
		const service = {
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token',
			_request: jest.fn().mockResolvedValue(response)
		};

		const result = await getSubtitleTrackBinary(service, 'item-1', 'source-1', 3, 'sup');

		expect(service._request).toHaveBeenCalledWith(
			'/Videos/item-1/source-1/Subtitles/3/0/Stream.sup',
			{context: 'getSubtitleTrackBinary', expectJson: false}
		);
		expect(result).toEqual(expect.objectContaining({
			ok: true,
			data: buffer,
			format: 'sup',
			path: '/Videos/item-1/source-1/Subtitles/3/0/Stream.sup',
			url: 'https://jellyfin.example/Videos/item-1/source-1/Subtitles/3/0/Stream.sup?ApiKey=token',
			debugUrl: 'https://jellyfin.example/Videos/item-1/source-1/Subtitles/3/0/Stream.sup?ApiKey=[REDACTED]',
			contentType: 'application/octet-stream',
			status: 200,
			failureStage: '',
			byteLength: 4,
			firstBytes: '01 02 03 04',
			pgsMagic: false
		}));
	});

	it('returns a structured failure for invalid bitmap subtitle context without fetching', async () => {
		const service = {
			_request: jest.fn()
		};

		await expect(getSubtitleTrackBinary(service, 'item-1', 'source-1', -1, 'sup')).resolves.toEqual(
			expect.objectContaining({
				ok: false,
				data: null,
				format: 'sup',
				rawShape: 'invalid-context',
				error: 'missing-subtitle-context',
				failureStage: 'context',
				path: null
			})
		);
		expect(service._request).not.toHaveBeenCalled();
	});

	it('returns a structured failure for empty bitmap subtitle binary', async () => {
		const service = {
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token',
			_request: jest.fn().mockResolvedValue({
				arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
				headers: {get: jest.fn().mockReturnValue('application/octet-stream')}
			})
		};

		await expect(getSubtitleTrackBinary(service, 'item-1', 'source-1', 3, 'pgs')).resolves.toEqual(
			expect.objectContaining({
				ok: false,
				data: null,
				format: 'pgs',
				error: 'empty-subtitle-binary',
				path: '/Videos/item-1/source-1/Subtitles/3/0/Stream.pgs'
			})
		);
	});

	it('marks fetched PGS/SUP binary payloads with PG magic diagnostics', async () => {
		const buffer = new Uint8Array([0x50, 0x47, 0x00, 0x01]).buffer;
		const service = {
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token',
			_request: jest.fn().mockResolvedValue({
				arrayBuffer: jest.fn().mockResolvedValue(buffer),
				headers: {get: jest.fn().mockReturnValue('application/octet-stream')}
			})
		};

		await expect(getSubtitleTrackBinary(service, 'item-1', 'source-1', 3, 'pgssub')).resolves.toEqual(
			expect.objectContaining({
				ok: true,
				format: 'pgssub',
				byteLength: 4,
				firstBytes: '50 47 00 01',
				pgsMagic: true
			})
		);
	});

	it('returns a structured failure for bitmap subtitle request errors', async () => {
		const requestError = new Error('getSubtitleTrackBinary failed with status 400');
		requestError.status = 400;
		const service = {
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token',
			_request: jest.fn().mockRejectedValue(requestError)
		};

		await expect(getSubtitleTrackBinary(service, 'item-1', 'source-1', 3, 'sup')).resolves.toEqual(
			expect.objectContaining({
				ok: false,
				data: null,
				format: 'sup',
				error: 'getSubtitleTrackBinary failed with status 400',
				status: 400,
				failureStage: 'request',
				path: '/Videos/item-1/source-1/Subtitles/3/0/Stream.sup',
				url: 'https://jellyfin.example/Videos/item-1/source-1/Subtitles/3/0/Stream.sup?ApiKey=token',
				debugUrl: 'https://jellyfin.example/Videos/item-1/source-1/Subtitles/3/0/Stream.sup?ApiKey=[REDACTED]'
			})
		);
	});

	it('returns a structured failure when reading the bitmap response body fails', async () => {
		const service = {
			serverUrl: 'https://jellyfin.example',
			accessToken: 'token',
			_request: jest.fn().mockResolvedValue({
				arrayBuffer: jest.fn().mockRejectedValue(new Error('body read failed')),
				headers: {get: jest.fn().mockReturnValue('application/octet-stream')},
				status: 200
			})
		};

		await expect(getSubtitleTrackBinary(service, 'item-1', 'source-1', 3, 'sup')).resolves.toEqual(
			expect.objectContaining({
				ok: false,
				error: 'body read failed',
				status: 200,
				failureStage: 'body-read',
				debugUrl: 'https://jellyfin.example/Videos/item-1/source-1/Subtitles/3/0/Stream.sup?ApiKey=[REDACTED]'
			})
		);
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
