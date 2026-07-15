import {normalizeSubtitleText} from '../subtitleRenderer';

describe('subtitleRenderer ASS metadata', () => {
	it('preserves layout resolution and border scaling metadata', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResX: 640
PlayResY: 360
LayoutResX: 1920
LayoutResY: 800
ScaledBorderAndShadow: no

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,24,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Test`, 'ass');

		expect(events[0].scriptGeometry).toEqual({
			playResX: 640,
			playResY: 360,
			layoutResX: 1920,
			layoutResY: 800,
			scaledBorderAndShadow: false
		});
	});
});
