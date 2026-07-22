import {normalizeSubtitleText} from '../subtitleRenderer';

describe('subtitleRenderer ASS vertical text', () => {
	it('preserves vertical-font intent for styles and inline font overrides', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, Alignment
Style: Vertical,@Yu Gothic,44,8

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:04.00,Vertical,,0,0,0,,縦書き
Dialogue: 0,0:00:05.00,0:00:08.00,Default,,0,0,0,,{\\fn@MS Gothic}字幕`, 'ass');

		expect(events[0].sourceStyle).toEqual(expect.objectContaining({
			fontFamily: "'Yu Gothic', sans-serif",
			writingMode: 'vertical-rl',
			WebkitWritingMode: 'vertical-rl',
			textOrientation: 'mixed'
		}));
		expect(events[1].runLines[0][0].style).toEqual(expect.objectContaining({
			fontFamily: "'MS Gothic', sans-serif",
			writingMode: 'vertical-rl',
			WebkitWritingMode: 'vertical-rl',
			textOrientation: 'mixed'
		}));
	});
});
