import {loadClientSubtitleEvents} from '../subtitleTextLoader';
import {shouldPreferRawSubtitleDocument} from '../subtitleRawFormats';

const RAW_ASS = `[Script Info]
PlayResX: 640
PlayResY: 360

[V4+ Styles]
Format: Name, Fontname, Fontsize, Alignment
Style: Sign,Georgia,20,2

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:09.00,Sign,,0,0,0,,{\\fs12\\pos(279,119)}Positioned sign`;

describe('loadClientSubtitleEvents', () => {
	it('selects raw-document priority only for the lightweight ASS renderer', () => {
		expect(shouldPreferRawSubtitleDocument({codec: 'ass', renderer: 'client-ass-lightweight'})).toBe(true);
		expect(shouldPreferRawSubtitleDocument({codec: 'ssa', renderer: 'client-ass-lightweight'})).toBe(true);
		expect(shouldPreferRawSubtitleDocument({codec: 'srt', renderer: 'client-ass-lightweight'})).toBe(false);
		expect(shouldPreferRawSubtitleDocument({codec: 'ass', renderer: 'client-ass-libass'})).toBe(false);
	});

	it('prefers the raw ASS document so script geometry and styles are retained', async () => {
		const fetchEvents = jest.fn();
		const fetchText = jest.fn().mockResolvedValue({
			ok: true,
			text: RAW_ASS,
			format: 'ass',
			path: '/subtitle/Stream.ass',
			url: 'https://example.test/subtitle/Stream.ass?api_key=secret'
		});

		const result = await loadClientSubtitleEvents({
			cacheKey: 'item:source:track',
			codec: 'ass',
			fetchEvents,
			fetchText,
			preferRawDocument: true
		});

		expect(fetchText).toHaveBeenCalledWith('ass');
		expect(fetchEvents).not.toHaveBeenCalled();
		expect(result.events[0]).toEqual(expect.objectContaining({
			absolutePosition: expect.objectContaining({x: 279, y: 119, playResX: 640, playResY: 360}),
			scriptGeometry: expect.objectContaining({playResX: 640, playResY: 360}),
			sourceFontSize: expect.objectContaining({size: 12, playResY: 360})
		}));
		expect(result.debug.source).toBe('raw-document');
		expect(result.debug.rawUrl).not.toContain('secret');
	});

	it('falls back to Stream.js events when raw ASS delivery is unavailable', async () => {
		const fetchEvents = jest.fn().mockResolvedValue({
			ok: true,
			events: [{
				StartPositionTicks: 10000000,
				EndPositionTicks: 90000000,
				Text: 'Fallback event'
			}],
			path: '/subtitle/Stream.js',
			rawShape: 'track-events'
		});
		const fetchText = jest.fn().mockResolvedValue({ok: false, error: 'raw-fetch-failed'});

		const result = await loadClientSubtitleEvents({
			codec: 'ass',
			fetchEvents,
			fetchText,
			preferRawDocument: true
		});

		expect(fetchText).toHaveBeenCalledTimes(2);
		expect(fetchEvents).toHaveBeenCalledTimes(1);
		expect(result.events[0].lines).toEqual(['Fallback event']);
		expect(result.debug.source).toBe('track-events');
	});

	it('keeps event-first delivery for plain text subtitles', async () => {
		const fetchEvents = jest.fn().mockResolvedValue({
			ok: true,
			events: [{
				StartPositionTicks: 10000000,
				EndPositionTicks: 90000000,
				Text: 'Plain text'
			}]
		});
		const fetchText = jest.fn();

		const result = await loadClientSubtitleEvents({
			codec: 'srt',
			fetchEvents,
			fetchText
		});

		expect(fetchEvents).toHaveBeenCalledTimes(1);
		expect(fetchText).not.toHaveBeenCalled();
		expect(result.events[0].lines).toEqual(['Plain text']);
	});
});
