import {
	findActiveSubtitleCues,
	findActiveSubtitleText,
	normalizeSubtitleEvents,
	normalizeSubtitleText,
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

	it('normalizes raw WebVTT subtitle text into cue events', () => {
		const events = normalizeSubtitleText(`WEBVTT

00:00:01.000 --> 00:00:03.500 align:start position:10%
Hello <b>world</b>

00:00:04.000 --> 00:00:05.000
Second cue`, 'vtt');
		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(expect.objectContaining({
			startTicks: 10000000,
			endTicks: 35000000,
			lines: ['Hello <b>world</b>'],
			format: 'vtt'
		}));
	});

	it('normalizes raw SRT subtitle text into cue events', () => {
		const events = normalizeSubtitleText(`1
00:00:01,250 --> 00:00:02,000
Hello

2
00:00:03,000 --> 00:00:04,000
World`, 'srt');
		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(expect.objectContaining({
			startTicks: 12500000,
			endTicks: 20000000,
			lines: ['Hello'],
			format: 'srt'
		}));
	});

	it('preserves safe SRT HTML formatting and color hints', () => {
		const events = normalizeSubtitleText(`1
00:00:01,000 --> 00:00:02,000
<i>Italic</i> <font color="#ffff00">Yellow</font> <span style="color: rgb(255, 0, 0); position:absolute">Red</span>

2
00:00:03,000 --> 00:00:04,000
<span onclick="bad()" style="background:url(javascript:bad); color: expression(bad)">Unsafe</span>`, 'srt');

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(expect.objectContaining({
			lines: [
				'<i>Italic</i> <font style="color: #ffff00">Yellow</font> <span style="color: rgb(255, 0, 0)">Red</span>'
			],
			format: 'srt'
		}));
		expect(events[1]).toEqual(expect.objectContaining({
			lines: ['Unsafe']
		}));
	});

	it('decodes escaped SRT formatting tags before sanitizing', () => {
		const events = normalizeSubtitleText(`1
00:00:01,000 --> 00:00:02,000
&lt;i&gt;Escaped italic&lt;/i&gt; &lt;b&gt;bold&lt;/b&gt; &lt;script&gt;bad&lt;/script&gt;`, 'srt');

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(expect.objectContaining({
			lines: ['<i>Escaped italic</i> <b>bold</b> &lt;script&gt;bad&lt;/script&gt;']
		}));
	});

	it('normalizes raw ASS dialogue text into simplified cue events', () => {
		const events = normalizeSubtitleText(`[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.50,0:00:03.00,Default,,0,0,0,,{\\an8}Top sign\\NSecond line`, 'ass');
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(expect.objectContaining({
			startTicks: 15000000,
			endTicks: 30000000,
			lines: ['Top sign', 'Second line'],
			format: 'ass',
			placement: 'top',
			horizontalAlign: 'center',
			hasAssOverrides: true
		}));
	});

	it('strips ASS override blocks and maps top alignment cues', () => {
		const parsed = parseSubtitleCueText('{\\an8}- Sign text\\NSecond line');
		expect(parsed).toEqual(expect.objectContaining({
			text: '- Sign text\nSecond line',
			assPlacement: 'top',
			assAlignment: 'center',
			absolutePosition: null,
			hasAssOverrides: true
		}));
		expect(parsed.runLines).toEqual([
			[{text: '- Sign text', style: {}}],
			[{text: 'Second line', style: {}}]
		]);

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

	it('extracts inline ASS font size overrides as source font-size metadata', () => {
		const parsed = parseSubtitleCueText('{\\an8\\fs54}Large top sign', 1920, 1080);

		expect(parsed).toEqual(expect.objectContaining({
			text: 'Large top sign',
			assPlacement: 'top',
			sourceFontSize: expect.objectContaining({
				size: 54,
				playResY: 1080
			})
		}));
		expect(parsed.sourceFontSize.fontSizeVh).toBeCloseTo(5, 2);
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

	it('maps legacy SSA alignment codes to ASS numpad placement and alignment', () => {
		const events = normalizeSubtitleEvents([
			{StartPositionTicks: 0, EndPositionTicks: 10000000, Text: '{\\a5}Legacy top left'},
			{StartPositionTicks: 10000000, EndPositionTicks: 20000000, Text: '{\\a10}Legacy middle center'},
			{StartPositionTicks: 20000000, EndPositionTicks: 30000000, Text: '{\\a3}Legacy bottom right'},
			{StartPositionTicks: 30000000, EndPositionTicks: 40000000, Text: '{\\a5\\an2}Numpad wins'}
		]);

		expect(events.map((event) => [event.placement, event.horizontalAlign])).toEqual([
			['top', 'left'],
			['middle', 'center'],
			['bottom', 'right'],
			['bottom', 'center']
		]);
	});

	it('maps ASS absolute pos coordinates to overlay percentages using fallback play resolution', () => {
		const parsed = parseSubtitleCueText('{\\an8\\pos(192,48)}Top sign');

		expect(parsed.assPlacement).toBe('top');
		expect(parsed.assAlignment).toBe('center');
		expect(parsed.absolutePosition).toEqual(expect.objectContaining({
			x: 192,
			y: 48,
			playResX: 384,
			playResY: 288,
			xPercent: 50
		}));
		expect(parsed.absolutePosition.yPercent).toBeCloseTo(16.67, 2);

		const events = normalizeSubtitleEvents([
			{StartPositionTicks: 0, EndPositionTicks: 10000000, Text: '{\\pos(192,48)}Top sign'}
		]);

		expect(events[0].absolutePosition).toEqual(expect.objectContaining({
			xPercent: 50
		}));
		expect(events[0].absolutePosition.yPercent).toBeCloseTo(16.67, 2);
	});

	it('preserves ASS origin coordinates as script-resolution metadata', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResX: 1000
PlayResY: 500

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\pos(300,200)\\org(100,50)\\frz45}Origin rotated`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0].origin).toEqual(expect.objectContaining({
			x: 100,
			y: 50,
			playResX: 1000,
			playResY: 500,
			xPercent: 10,
			yPercent: 10
		}));
		expect(events[0].absolutePosition).toEqual(expect.objectContaining({
			x: 300,
			y: 200,
			xPercent: 30,
			yPercent: 40
		}));
		expect(events[0].sourceStyle.transform).toEqual(expect.stringContaining('rotate(45.000deg)'));
		expect(events[0].sourceStyle.transformOrigin).toBe('center center');
		expect(events[0].runLines[0][0].style.transform).toBeUndefined();
	});

	it('maps raw ASS absolute pos coordinates with PlayResX and PlayResY metadata', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResX: 1920
PlayResY: 1080

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\an7\\pos(960,108)}Top sign`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(expect.objectContaining({
			placement: 'top',
			horizontalAlign: 'left',
			hasAssOverrides: true
		}));
		expect(events[0].absolutePosition).toEqual(expect.objectContaining({
			x: 960,
			y: 108,
			playResX: 1920,
			playResY: 1080,
			xPercent: 50,
			yPercent: 10
		}));
	});

	it('parses bounded rectangular ASS clip metadata using script resolution', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResX: 1920
PlayResY: 1080

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\clip(100,200,700,500)\\pos(400,300)}Clipped sign`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0].clip).toEqual(expect.objectContaining({
			x1: 100,
			y1: 200,
			x2: 700,
			y2: 500,
			playResX: 1920,
			playResY: 1080,
			inverted: false
		}));
		expect(events[0].clip.leftPercent).toBeCloseTo(5.21, 2);
		expect(events[0].clip.topPercent).toBeCloseTo(18.52, 2);
		expect(events[0].clip.rightPercent).toBeCloseTo(36.46, 2);
		expect(events[0].clip.bottomPercent).toBeCloseTo(46.3, 2);
		expect(events[0].absolutePosition).toEqual(expect.objectContaining({
			x: 400,
			y: 300
		}));
	});

	it('preserves rectangular ASS inverse clip metadata for overlay clipping', () => {
		const parsed = parseSubtitleCueText('{\\iclip(10,20,30,40)}Inverse clip', 100, 100);

		expect(parsed.clip).toEqual(expect.objectContaining({
			x1: 10,
			y1: 20,
			x2: 30,
			y2: 40,
			inverted: true,
			leftPercent: 10,
			topPercent: 20,
			rightPercent: 30,
			bottomPercent: 40
		}));
	});

	it('uses raw ASS style font size when no inline font size override is present', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,0,2,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Styled dialogue`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0].sourceFontSize).toEqual(expect.objectContaining({
			size: 48,
			playResY: 1080
		}));
		expect(events[0].sourceFontSize.fontSizeVh).toBeCloseTo(4.44, 2);
	});

	it('uses raw ASS style alignment, margins, and WrapStyle as lightweight layout metadata', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResX: 1920
PlayResY: 1080
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, Alignment, MarginL, MarginR, MarginV
Style: ScreenText,Arial,44,7,120,240,80

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 2,0:00:01.00,0:00:03.00,ScreenText,,0,0,0,,Large page sign`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(expect.objectContaining({
			placement: 'top',
			horizontalAlign: 'left',
			wrapStyle: 1,
			layer: 2,
			sourceOrder: 0
		}));
		expect(events[0].sourceMargins).toEqual(expect.objectContaining({
			left: 120,
			right: 240,
			vertical: 80,
			playResX: 1920,
			playResY: 1080
		}));
		expect(events[0].sourceMargins.leftPercent).toBeCloseTo(6.25, 2);
		expect(events[0].sourceMargins.rightPercent).toBeCloseTo(12.5, 2);
		expect(events[0].sourceMargins.verticalPercent).toBeCloseTo(7.41, 2);
	});

	it('lets ASS dialogue margins and inline wrap style override style/script defaults', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResX: 1000
PlayResY: 500
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, Alignment, MarginL, MarginR, MarginV
Style: Default,Arial,40,2,10,10,10

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,50,100,25,,{\\q2}No wrap dialogue`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(expect.objectContaining({
			placement: 'bottom',
			horizontalAlign: 'center',
			wrapStyle: 2,
			hasAssOverrides: true
		}));
		expect(events[0].sourceMargins).toEqual(expect.objectContaining({
			left: 50,
			right: 100,
			vertical: 25,
			leftPercent: 5,
			rightPercent: 10,
			verticalPercent: 5
		}));
	});

	it('lets inline ASS font size override the dialogue style font size', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,36

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\fs72}Large dialogue`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0].sourceFontSize).toEqual(expect.objectContaining({
			size: 72,
			playResY: 1080
		}));
		expect(events[0].sourceFontSize.fontSizeVh).toBeCloseTo(6.67, 2);
	});

	it('supports relative ASS font size overrides from the active source style', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResY: 360

[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,26

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Base {\\fs+4}Larger {\\fs-10}Smaller`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0].sourceFontSize).toEqual(expect.objectContaining({
			size: 20,
			playResY: 360
		}));
		expect(events[0].runLines[0]).toEqual([
			expect.objectContaining({
				text: 'Base ',
				style: expect.objectContaining({fontSize: '7.222vh'})
			}),
			expect.objectContaining({
				text: 'Larger ',
				style: expect.objectContaining({fontSize: '8.333vh'})
			}),
			expect.objectContaining({
				text: 'Smaller',
				style: expect.objectContaining({fontSize: '5.556vh'})
			})
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

	it('parses advanced ASS source colors, fonts, borders, shadows, and fades', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResX: 640
PlayResY: 360

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Roboto Medium,26,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,1.3,0,2,20,20,23,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,{\\fad(600,1)\\fnTimes New Roman\\fs10\\shad0\\b1\\an9\\u1\\3c&HB6EAF3&\\c&H0C2F5F&}Example Character{\\u0}\\N\\NRole: Example`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(expect.objectContaining({
			placement: 'top',
			horizontalAlign: 'right',
			fade: {fadeInMs: 600, fadeOutMs: 1}
		}));
		expect(events[0].runLines[0][0]).toEqual(expect.objectContaining({
			text: 'Example Character',
			style: expect.objectContaining({
				fontFamily: "'Times New Roman', sans-serif",
				fontSize: '2.778vh',
				color: 'rgb(95, 47, 12)',
				'--bf-player-subtitle-current-border-color': 'rgb(243, 234, 182)',
				'--bf-player-subtitle-current-shadow-distance': '0.000vh',
				fontWeight: 700,
				textDecoration: 'underline'
			})
		}));
	});

	it('applies global ASS alpha to text, outline, and shadow colors', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResY: 360

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour
Style: Default,Arial,26,&H00FFFFFF,&H00000000,&H64000000

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\alpha&H80&}Faded text`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0].runLines[0][0]).toEqual(expect.objectContaining({
			text: 'Faded text',
			style: expect.objectContaining({
				color: 'rgba(255, 255, 255, 0.498)',
				'--bf-player-subtitle-current-border-color': 'rgba(0, 0, 0, 0.498)'
			})
		}));
	});

	it('decorates basic ASS karaoke runs with secondary and primary colors over time', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResY: 360

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour
Style: Default,Arial,26,&H00FFFFFF,&H00FF0000,&H00000000,&H64000000

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\k50}First {\\k50}Second`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0].runLines[0]).toEqual([
			expect.objectContaining({
				text: 'First ',
				karaoke: expect.objectContaining({
					mode: 'k',
					startOffsetMs: 0,
					durationMs: 500,
					primaryColor: 'rgb(255, 255, 255)',
					secondaryColor: 'rgb(0, 0, 255)'
				})
			}),
			expect.objectContaining({
				text: 'Second',
				karaoke: expect.objectContaining({
					startOffsetMs: 500,
					durationMs: 500
				})
			})
		]);

		const firstSyllable = findActiveSubtitleCues(events, 1.25).cues[0];
		expect(firstSyllable.runLines[0][0]).toEqual(expect.objectContaining({
			style: expect.objectContaining({color: 'rgb(255, 255, 255)'}),
			karaoke: expect.objectContaining({active: true, progress: 0.5})
		}));
		expect(firstSyllable.runLines[0][1]).toEqual(expect.objectContaining({
			style: expect.objectContaining({color: 'rgb(0, 0, 255)'}),
			karaoke: expect.objectContaining({active: false, progress: 0})
		}));

		const secondSyllable = findActiveSubtitleCues(events, 1.75).cues[0];
		expect(secondSyllable.runLines[0][1]).toEqual(expect.objectContaining({
			style: expect.objectContaining({color: 'rgb(255, 255, 255)'}),
			karaoke: expect.objectContaining({active: true, progress: 0.5})
		}));
	});

	it('decorates ASS kf/K karaoke with an active sweep gradient', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResY: 360

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour
Style: Default,Arial,26,&H00FFFFFF,&H00FF0000

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\K50}Sweep`, 'ass');

		expect(events[0].runLines[0][0]).toEqual(expect.objectContaining({
			karaoke: expect.objectContaining({mode: 'kf'})
		}));

		const activeCue = findActiveSubtitleCues(events, 1.25).cues[0];
		expect(activeCue.runLines[0][0]).toEqual(expect.objectContaining({
			style: expect.objectContaining({
				backgroundClip: 'text',
				backgroundImage: 'linear-gradient(to right, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 50.00%, rgb(0, 0, 255) 50.00%, rgb(0, 0, 255) 100%)',
				display: 'inline-block',
				WebkitBackgroundClip: 'text',
				WebkitTextFillColor: 'transparent'
			}),
			karaoke: expect.objectContaining({active: true, progress: 0.5})
		}));
	});

	it('decorates active cues with fade opacity and limited transform styles', () => {
		const events = normalizeSubtitleEvents([
			{
				StartPositionTicks: 10000000,
				EndPositionTicks: 50000000,
				Text: '{\\fad(1000,1000)\\bord1\\t(0,1000,\\bord4\\blur2)}Transform'
			}
		]);

		const early = findActiveSubtitleCues(events, 1.5).cues[0];
		const late = findActiveSubtitleCues(events, 2.5).cues[0];

		expect(early.opacity).toBeCloseTo(0.5, 1);
		expect(events[0].runLines[0][0].style).toEqual(expect.objectContaining({
			'--bf-player-subtitle-current-outline-size': '0.347vh'
		}));
		expect(early.activeSourceStyle).toEqual(expect.objectContaining({
			'--bf-player-subtitle-current-outline-size': '0.868vh',
			'--bf-player-subtitle-current-shadow-blur': '0.347vh'
		}));
		expect(late.activeSourceStyle).toEqual(expect.objectContaining({
			'--bf-player-subtitle-current-outline-size': '1.389vh',
			'--bf-player-subtitle-current-shadow-blur': '0.694vh'
		}));
	});

	it('interpolates ASS transform scale, rotation, and colors over time', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResY: 360

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\fscx100\\frz0\\c&HFFFFFF&\\t(0,1000,\\fscx200\\frz90\\c&H0000FF&)}Morph`, 'ass');

		const mid = findActiveSubtitleCues(events, 1.5).cues[0];
		const final = findActiveSubtitleCues(events, 2.25).cues[0];

		expect(events[0].runLines[0][0].style).toEqual(expect.objectContaining({
			color: 'rgb(255, 255, 255)'
		}));
		expect(mid.activeSourceStyle).toEqual(expect.objectContaining({
			color: 'rgb(255, 128, 128)',
			display: 'inline-block'
		}));
		expect(mid.activeSourceStyle.transform).toEqual(expect.stringContaining('scaleX(1.500)'));
		expect(mid.activeSourceStyle.transform).toEqual(expect.stringContaining('rotate(45.000deg)'));
		expect(final.activeSourceStyle).toEqual(expect.objectContaining({
			color: 'rgb(255, 0, 0)'
		}));
		expect(final.activeSourceStyle.transform).toEqual(expect.stringContaining('scaleX(2.000)'));
		expect(final.activeSourceStyle.transform).toEqual(expect.stringContaining('rotate(90.000deg)'));
	});

	it('supports ASS move and complex fade timing in active cues', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResX: 1000
PlayResY: 500

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,{\\move(100,50,900,450,0,4000)\\fade(255,0,255,0,1000,3000,4000)}Moving`, 'ass');

		expect(events).toHaveLength(1);
		expect(events[0].absolutePosition).toEqual(expect.objectContaining({
			x: 100,
			y: 50,
			xPercent: 10,
			yPercent: 10
		}));

		const midpoint = findActiveSubtitleCues(events, 3).cues[0];
		expect(midpoint.absolutePosition.x).toBeCloseTo(500, 1);
		expect(midpoint.absolutePosition.y).toBeCloseTo(250, 1);
		expect(midpoint.absolutePosition.xPercent).toBeCloseTo(50, 1);
		expect(midpoint.opacity).toBeCloseTo(1, 2);

		const ending = findActiveSubtitleCues(events, 4.5).cues[0];
		expect(ending.absolutePosition.x).toBeCloseTo(800, 1);
		expect(ending.opacity).toBeLessThan(0.6);
	});

	it('supports ASS source scale, spacing, angle, and reset-to-named-style overrides', () => {
		const events = normalizeSubtitleText(`[Script Info]
PlayResX: 640
PlayResY: 360

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,24,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,1,0,2,20,20,20,1
Style: Sign,Times New Roman,20,&H0000FFFF,&H00000000,&H64000000,0,0,0,0,150,80,2,15,1,1,0,7,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Normal {\\rSign}Sign {\\fscx200\\fscy120\\fsp4\\frz30\\fax0.2}Scaled`, 'ass');

		expect(events).toHaveLength(1);
		const signRun = events[0].runLines[0][1];
		const scaledRun = events[0].runLines[0][2];

		expect(signRun).toEqual(expect.objectContaining({
			text: 'Sign ',
			style: expect.objectContaining({
				fontFamily: "'Times New Roman', sans-serif",
				color: 'rgb(255, 255, 0)',
				letterSpacing: '0.556vh',
				transform: expect.stringContaining('scaleX(1.500)')
			})
		}));
		expect(signRun.style.transform).toEqual(expect.stringContaining('scaleY(0.800)'));
		expect(signRun.style.transform).toEqual(expect.stringContaining('rotate(15.000deg)'));
		expect(scaledRun).toEqual(expect.objectContaining({
			text: 'Scaled',
			style: expect.objectContaining({
				letterSpacing: '1.111vh',
				transform: expect.stringContaining('scaleX(2.000)')
			})
		}));
		expect(scaledRun.style.transform).toEqual(expect.stringContaining('scaleY(1.200)'));
		expect(scaledRun.style.transform).toEqual(expect.stringContaining('rotate(30.000deg)'));
		expect(scaledRun.style.transform).toEqual(expect.stringContaining('skewX(0.197rad)'));
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

	it('keeps long-running overlapping cues active after later shorter cues end', () => {
		const events = normalizeSubtitleEvents([
			{StartPositionTicks: 0, EndPositionTicks: 100000000, Text: 'Persistent sign'},
			{StartPositionTicks: 10000000, EndPositionTicks: 20000000, Text: 'Short dialogue'},
			{StartPositionTicks: 30000000, EndPositionTicks: 40000000, Text: 'Later short dialogue'}
		]);

		expect(findActiveSubtitleText(events, 5)).toEqual({
			text: 'Persistent sign',
			activeCount: 1
		});
	});

	it('orders active overlapping cues by ASS layer and source order for rendering', () => {
		const events = normalizeSubtitleEvents([
			{StartPositionTicks: 0, EndPositionTicks: 100000000, Text: 'Top layer', Layer: 10, SourceOrder: 0},
			{StartPositionTicks: 10000000, EndPositionTicks: 90000000, Text: 'Middle layer', Layer: 5, SourceOrder: 1},
			{StartPositionTicks: 20000000, EndPositionTicks: 80000000, Text: 'Bottom layer later source', Layer: 0, SourceOrder: 2},
			{StartPositionTicks: 20000000, EndPositionTicks: 80000000, Text: 'Bottom layer earlier source', Layer: 0, SourceOrder: 1}
		]);

		const active = findActiveSubtitleCues(events, 3);

		expect(active.activeCount).toBe(4);
		expect(active.cues.map((cue) => cue.lines[0])).toEqual([
			'Bottom layer earlier source',
			'Bottom layer later source',
			'Middle layer',
			'Top layer'
		]);
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

	it('sanitizes subtitle color tags without preserving arbitrary styles', () => {
		expect(sanitizeSubtitleHtml('<font color="#ff0" onclick="bad()">Yellow</font><span style="font-size:200px;color:cyan">Cyan</span>'))
			.toBe('<font style="color: #ff0">Yellow</font><span style="color: cyan">Cyan</span>');
		expect(sanitizeSubtitleHtml('<font color="url(javascript:bad)">Bad</font>'))
			.toBe('Bad');
		expect(sanitizeSubtitleHtml('&lt;i&gt;Escaped&lt;/i&gt;'))
			.toBe('<i>Escaped</i>');
	});

	it('sanitizes children before unwrapping unsupported tags', () => {
		expect(sanitizeSubtitleHtml('<span><b data-x="1">Safe</b></span>'))
			.toBe('<b>Safe</b>');
	});
});
