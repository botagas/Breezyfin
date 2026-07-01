import {
	normalizeSubtitleText,
	parseSubtitleCueText
} from '../subtitleRenderer';
import {buildAssDrawingPathFromText} from '../subtitleRendererAssDrawing';

describe('subtitleRenderer ASS drawing utilities', () => {
	it('renders common ASS vector drawing payloads as SVG path metadata without leaking path text', () => {
		const events = normalizeSubtitleText(`[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\p1\\c&H00FF00&\\3c&H0000FF&\\bord2}m 0 0 l 20 0 l 20 20 c{\\p0}
Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,{\\p1}m 1 1 l 10 10{\\p0}Visible label`, 'ass');

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(expect.objectContaining({
			startTicks: 10000000,
			endTicks: 20000000,
			lines: [],
			hasAssOverrides: true,
			drawing: expect.objectContaining({
				viewBox: expect.objectContaining({
					value: '-2.000 -2.000 24.000 24.000'
				}),
				paths: [
					expect.objectContaining({
						d: 'M 0.000 0.000 L 20.000 0.000 L 20.000 20.000 Z',
						fill: 'rgb(0, 255, 0)',
						stroke: 'rgb(255, 0, 0)',
						strokeWidth: 2
					})
				]
			})
		}));
		expect(events[1]).toEqual(expect.objectContaining({
			startTicks: 30000000,
			endTicks: 40000000,
			lines: ['Visible label'],
			hasAssOverrides: true
		}));
		expect(events[1].runLines).toEqual([
			[{text: 'Visible label', style: {}}]
		]);
		expect(events[1].drawing).toEqual(expect.objectContaining({
			paths: [expect.objectContaining({d: 'M 1.000 1.000 L 10.000 10.000'})]
		}));
	});

	it('converts ASS spline drawing commands into SVG cubic Bezier path data', () => {
		const drawingPath = buildAssDrawingPathFromText('m 0 0 s 10 0 20 10 30 0 p 40 -10 c', 1);

		expect(drawingPath).toEqual(expect.objectContaining({
			pathData: [
				'M 0.000 0.000',
				'L 10.000 1.667',
				'C 13.333 3.333 16.667 6.667 20.000 6.667',
				'C 23.333 6.667 26.667 3.333 30.000 0.000',
				'C 33.333 -3.333 36.667 -6.667 31.667 -6.667',
				'C 26.667 -6.667 13.333 -3.333 8.333 -1.667',
				'C 3.333 0.000 6.667 0.000 10.000 1.667',
				'Z'
			].join(' ')
		}));
		expect(drawingPath.bounds.minY).toBeLessThan(0);
		expect(drawingPath.bounds.maxX).toBeCloseTo(36.67, 2);
	});

	it('normalizes ASS spline drawing cues as cubic SVG drawing paths', () => {
		const events = normalizeSubtitleText(`[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\p1}m 0 0 s 10 0 20 10 30 0 p 40 -10 c`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0].drawing.paths[0].d).toContain('C 13.333 3.333 16.667 6.667 20.000 6.667');
		expect(events[0].drawing.paths[0].d).toContain('Z');
		expect(events[0].lines).toEqual([]);
	});

	it('applies ASS drawing baseline offset metadata from pbo', () => {
		const events = normalizeSubtitleText(`[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\p1\\pbo20}m 0 0 l 10 10`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0].drawing).toEqual(expect.objectContaining({
			viewBox: expect.objectContaining({
				value: '0.000 20.000 10.000 10.000'
			}),
			paths: [
				expect.objectContaining({
					d: 'M 0.000 0.000 L 10.000 10.000',
					baselineOffset: 20
				})
			]
		}));
	});

	it('closes short spline fallback paths when ASS uses close-path', () => {
		const drawingPath = buildAssDrawingPathFromText('m 0 0 s 10 0 c', 1);

		expect(drawingPath.pathData).toBe('M 0.000 0.000 L 10.000 0.000 Z');
	});

	it('preserves ASS vector clip metadata for drawing cues', () => {
		const events = normalizeSubtitleText(`[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\clip(m 0 0 l 10 0 l 10 10 c)\\p1}m 0 0 l 20 0 l 20 20 c`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(expect.objectContaining({
			lines: [],
			clip: expect.objectContaining({
				type: 'drawing',
				inverted: false,
				mode: 1,
				pathData: 'M 0.000 0.000 L 10.000 0.000 L 10.000 10.000 Z'
			}),
			drawing: expect.objectContaining({
				paths: [expect.objectContaining({d: 'M 0.000 0.000 L 20.000 0.000 L 20.000 20.000 Z'})]
			})
		}));
	});

	it('preserves scaled inverse ASS vector clip metadata', () => {
		const parsed = parseSubtitleCueText('{\\iclip(2,m 0 0 l 20 0 l 20 20 c)\\p1}m 0 0 l 20 20', 100, 100);

		expect(parsed.clip).toEqual(expect.objectContaining({
			type: 'drawing',
			inverted: true,
			mode: 2,
			pathData: 'M 0.000 0.000 L 10.000 0.000 L 10.000 10.000 Z'
		}));
	});
});
