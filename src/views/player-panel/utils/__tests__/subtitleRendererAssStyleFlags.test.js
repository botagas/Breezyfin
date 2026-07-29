import {normalizeSubtitleText} from '../subtitleRenderer';

const STYLE_FLAGS_ASS = `[Script Info]
PlayResY: 360

[V4+ Styles]
Format: Name, Fontname, Fontsize, Bold, Italic, Underline, StrikeOut
Style: Default,Trebuchet MS,24,0,0,0,0

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Regular {\\b1\\i1\\u1\\s1}Styled{\\b0\\i0\\u0\\s0} Reset`;

describe('ASS source style flags', () => {
	it('preserves explicit regular style flags and inline resets', () => {
		const events = normalizeSubtitleText(STYLE_FLAGS_ASS, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0].sourceStyle).toEqual(expect.objectContaining({
			fontWeight: 400,
			fontStyle: 'normal',
			textDecoration: 'none'
		}));
		expect(events[0].runLines[0]).toEqual([
			expect.objectContaining({
				text: 'Regular ',
				style: expect.objectContaining({
					fontWeight: 400,
					fontStyle: 'normal',
					textDecoration: 'none'
				})
			}),
			expect.objectContaining({
				text: 'Styled',
				style: expect.objectContaining({
					fontWeight: 700,
					fontStyle: 'italic',
					textDecoration: 'underline line-through'
				})
			}),
			expect.objectContaining({
				text: ' Reset',
				style: expect.objectContaining({
					fontWeight: 400,
					fontStyle: 'normal',
					textDecoration: 'none'
				})
			})
		]);
	});
});
