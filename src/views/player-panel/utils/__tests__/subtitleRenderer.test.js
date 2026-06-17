import {
	findActiveSubtitleCues,
	findActiveSubtitleText,
	normalizeSubtitleEvents,
	parseSubtitleCueText,
	sanitizeSubtitleHtml
} from '../subtitleRenderer';

describe('subtitleRenderer utilities', () => {
	it('normalizes and sorts subtitle events', () => {
		const events = normalizeSubtitleEvents([
			{StartPositionTicks: 20000000, EndPositionTicks: 30000000, Text: 'Second'},
			{StartPositionTicks: 0, EndPositionTicks: 10000000, Text: 'First'},
			{StartPositionTicks: 40000000, EndPositionTicks: 30000000, Text: 'Invalid'},
			{StartPositionTicks: 50000000, EndPositionTicks: 60000000, Text: ''}
		]);

		expect(events).toEqual([
			{
				startTicks: 0,
				endTicks: 10000000,
				lines: ['First'],
				format: 'jellyfin-track-event',
				position: null,
				alignment: null,
				placement: 'bottom',
				horizontalAlign: 'center',
				hasAssOverrides: false
			},
			{
				startTicks: 20000000,
				endTicks: 30000000,
				lines: ['Second'],
				format: 'jellyfin-track-event',
				position: null,
				alignment: null,
				placement: 'bottom',
				horizontalAlign: 'center',
				hasAssOverrides: false
			}
		]);
	});

	it('normalizes multiline and positioned cues', () => {
		const events = normalizeSubtitleEvents([
			{
				StartPositionTicks: 0,
				EndPositionTicks: 10000000,
				Text: 'Line 1\n<b data-x="1">Line 2</b>',
				Position: '42',
				Alignment: 'center'
			}
		]);

		expect(events).toEqual([
			{
				startTicks: 0,
				endTicks: 10000000,
				lines: ['Line 1', '<b>Line 2</b>'],
				format: 'jellyfin-track-event',
				position: 42,
				alignment: 'center',
				placement: 'bottom',
				horizontalAlign: 'center',
				hasAssOverrides: false
			}
		]);
	});

	it('strips ASS override blocks and maps top alignment cues', () => {
		const parsed = parseSubtitleCueText('{\\an8}- Sign text\\NSecond line');
		expect(parsed).toEqual({
			text: '- Sign text\nSecond line',
			assPlacement: 'top',
			assAlignment: 'center',
			hasAssOverrides: true
		});

		const events = normalizeSubtitleEvents([
			{
				StartPositionTicks: 0,
				EndPositionTicks: 10000000,
				Text: '{\\an8}- Sign text\\NSecond line'
			}
		]);

		expect(events[0].lines).toEqual(['- Sign text', 'Second line']);
		expect(events[0].placement).toBe('top');
		expect(events[0].horizontalAlign).toBe('center');
		expect(events[0].hasAssOverrides).toBe(true);
	});

	it('maps ASS alignment codes to vertical regions and horizontal alignment', () => {
		const events = normalizeSubtitleEvents([
			{StartPositionTicks: 0, EndPositionTicks: 10000000, Text: '{\\an7}Top left'},
			{StartPositionTicks: 10000000, EndPositionTicks: 20000000, Text: '{\\an8}Top center'},
			{StartPositionTicks: 20000000, EndPositionTicks: 30000000, Text: '{\\an9}Top right'},
			{StartPositionTicks: 30000000, EndPositionTicks: 40000000, Text: '{\\an4}Middle left'},
			{StartPositionTicks: 40000000, EndPositionTicks: 50000000, Text: '{\\an5}Middle center'},
			{StartPositionTicks: 50000000, EndPositionTicks: 60000000, Text: '{\\an6}Middle right'},
			{StartPositionTicks: 60000000, EndPositionTicks: 70000000, Text: '{\\an1}Bottom left'},
			{StartPositionTicks: 70000000, EndPositionTicks: 80000000, Text: '{\\an2}Bottom center'},
			{StartPositionTicks: 80000000, EndPositionTicks: 90000000, Text: '{\\an3}Bottom right'}
		]);

		expect(events.map((event) => [event.placement, event.horizontalAlign])).toEqual([
			['top', 'left'],
			['top', 'center'],
			['top', 'right'],
			['middle', 'left'],
			['middle', 'center'],
			['middle', 'right'],
			['bottom', 'left'],
			['bottom', 'center'],
			['bottom', 'right']
		]);
	});

	it('converts basic ASS inline formatting before sanitizing subtitle lines', () => {
		const events = normalizeSubtitleEvents([
			{
				StartPositionTicks: 0,
				EndPositionTicks: 10000000,
				Text: '{\\b1}Bold{\\b0} {\\i1}Italic{\\i0} {\\u1}Under{\\u0}'
			}
		]);

		expect(events[0].lines).toEqual(['<b>Bold</b> <i>Italic</i> <u>Under</u>']);
		expect(events[0].hasAssOverrides).toBe(true);
	});

	it('uses Jellyfin alignment and position as placement fallbacks', () => {
		const events = normalizeSubtitleEvents([
			{StartPositionTicks: 0, EndPositionTicks: 10000000, Text: 'Top', Alignment: 'top'},
			{StartPositionTicks: 0, EndPositionTicks: 10000000, Text: 'Position Top', Position: '10'},
			{StartPositionTicks: 0, EndPositionTicks: 10000000, Text: 'Bottom', Position: '90'}
		]);

		expect(events.map((event) => [event.placement, event.horizontalAlign])).toEqual([
			['top', 'center'],
			['top', 'center'],
			['bottom', 'center']
		]);
	});

	it('stores sanitized cue lines in the normalized model', () => {
		const events = normalizeSubtitleEvents([
			{
				StartPositionTicks: 0,
				EndPositionTicks: 10000000,
				Text: '<span><b onclick="bad()">Safe</b></span><script>alert(1)</script>'
			}
		]);

		expect(events[0].lines).toEqual(['<b>Safe</b>']);
	});

	it('matches active and overlapping cues by current time', () => {
		const events = normalizeSubtitleEvents([
			{StartPositionTicks: 0, EndPositionTicks: 20000000, Text: 'Line 1'},
			{StartPositionTicks: 10000000, EndPositionTicks: 30000000, Text: 'Line 2'},
			{StartPositionTicks: 40000000, EndPositionTicks: 50000000, Text: 'Line 3'}
		]);

		expect(findActiveSubtitleText(events, 1.5)).toEqual({
			text: 'Line 1\nLine 2',
			activeCount: 2
		});
		expect(findActiveSubtitleText(events, 3.5)).toEqual({
			text: '',
			activeCount: 0
		});
	});

	it('returns normalized active cues for overlay rendering', () => {
		const events = normalizeSubtitleEvents([
			{StartPositionTicks: 0, EndPositionTicks: 20000000, Text: 'Line 1'},
			{StartPositionTicks: 10000000, EndPositionTicks: 30000000, Text: 'Line 2'}
		]);

		const active = findActiveSubtitleCues(events, 1.5);

		expect(active.activeCount).toBe(2);
		expect(active.cues.map((cue) => cue.lines)).toEqual([
			['Line 1'],
			['Line 2']
		]);
	});

	it('sanitizes subtitle html while keeping basic formatting', () => {
		expect(sanitizeSubtitleHtml('<b>Hello</b><script>alert(1)</script><i data-x="1">world</i>'))
			.toBe('<b>Hello</b><i>world</i>');
		expect(sanitizeSubtitleHtml('Line 1\nLine 2')).toBe('Line 1<br>Line 2');
	});

	it('sanitizes children before unwrapping unsupported tags', () => {
		expect(sanitizeSubtitleHtml('<span><b data-x="1">Safe</b></span>'))
			.toBe('<b>Safe</b>');
	});
});
