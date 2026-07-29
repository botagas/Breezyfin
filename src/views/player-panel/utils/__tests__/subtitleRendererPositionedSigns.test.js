import {render, screen} from '@testing-library/react';
import PlayerSubtitleOverlay from '../../components/PlayerSubtitleOverlay';
import {findActiveSubtitleCues, normalizeSubtitleText} from '../subtitleRenderer';

const POSITIONED_SIGNS_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 640
PlayResY: 360
LayoutResX: 640
LayoutResY: 360
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sign,Arial,20,&H00000000,&H000000FF,&H00FFFFFF,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:09.00,Sign,,0,0,0,,{\\b1\\fs12\\fnGeorgia\\c&H210105&\\3c&HE1EAF2&\\fad(200,1)\\pos(485,111)}Label A
Dialogue: 0,0:00:01.00,0:00:09.00,Sign,,0,0,0,,{\\b1\\fs12\\fnGeorgia\\c&H210105&\\3c&HE1EAF2&\\fad(200,1)\\pos(279,119)}Label B\\NLine 2
Dialogue: 0,0:00:01.00,0:00:09.00,Sign,,0,0,0,,{\\b1\\fs12\\fnGeorgia\\c&H210105&\\3c&HE1EAF2&\\fad(200,1)\\pos(169,141)}Label C\\NLine 2
Dialogue: 0,0:00:01.00,0:00:09.00,Sign,,0,0,0,,{\\b1\\fs12\\fnGeorgia\\c&H210105&\\3c&HE1EAF2&\\fad(200,1)\\pos(512,328)}Label D
Dialogue: 0,0:00:01.00,0:00:09.00,Sign,,0,0,0,,{\\b1\\fs12\\fnGeorgia\\c&H210105&\\3c&HE1EAF2&\\fad(200,1)\\pos(189,359)}Label E`;

const getActiveSigns = () => {
	const events = normalizeSubtitleText(POSITIONED_SIGNS_ASS, 'ass');
	return findActiveSubtitleCues(events, 2).cues;
};

describe('positioned ASS sign rendering', () => {
	it('keeps each sign associated with its authored position and size', () => {
		const cues = getActiveSigns();

		expect(cues).toHaveLength(5);
		expect(cues.map((cue) => ({
			text: cue.runLines.flat().map((run) => run.text).join(' '),
			x: cue.absolutePosition.x,
			y: cue.absolutePosition.y,
			fontSize: cue.sourceFontSize.size
		}))).toEqual([
			{text: 'Label A', x: 485, y: 111, fontSize: 12},
			{text: 'Label B Line 2', x: 279, y: 119, fontSize: 12},
			{text: 'Label C Line 2', x: 169, y: 141, fontSize: 12},
			{text: 'Label D', x: 512, y: 328, fontSize: 12},
			{text: 'Label E', x: 189, y: 359, fontSize: 12}
		]);
	});

	it('preserves the authored sign font, colors, outline, and zero shadow', () => {
		const [cue] = getActiveSigns();
		const style = cue.runLines[0][0].style;

			expect(style).toEqual(expect.objectContaining({
			color: 'rgb(5, 1, 33)',
			fontFamily: "'Georgia', sans-serif",
			fontSize: '3.333vh',
			fontWeight: 700,
			'--bf-player-subtitle-current-border-color': 'rgb(242, 234, 225)',
			'--bf-player-subtitle-current-outline-size': '0.556vh',
			'--bf-player-subtitle-current-shadow-distance': '0.000vh'
		}));
	});

	it('places every rendered sign at its own stage coordinate', () => {
		render(
			<PlayerSubtitleOverlay
				cues={getActiveSigns()}
				settings={{}}
				videoElement={{
					clientHeight: 1080,
					clientWidth: 1920,
					videoHeight: 1080,
					videoWidth: 1920
				}}
			/>
		);

		const expectedX = ['75.781%', '43.594%', '26.406%', '80.000%', '29.531%'];
		['Label A', 'Label B', 'Label C', 'Label D', 'Label E'].forEach((label, index) => {
			const copies = screen.getAllByText(label);
			const text = copies.find((node) => node.closest('[data-ass-layer="content"]'));
			const effect = copies.find((node) => node.closest('[data-ass-layer="effects"]'));
			const cue = text.closest('[data-region]');
			expect(copies).toHaveLength(2);
			expect(effect).toBeTruthy();
			expect(cue.style.getPropertyValue('--bf-player-subtitle-absolute-x')).toBe(expectedX[index]);
			expect(text.style.color).toBe('rgb(5, 1, 33)');
			expect(text.dataset.text).toBeUndefined();
			expect(text.dataset.assEffects).toBe('true');
			expect(text.dataset.assOutline).toBe('true');
			expect(text.dataset.assShadow).toBeUndefined();
			expect(text.style.getPropertyValue('--bf-player-subtitle-current-border-color')).toBe('rgb(242, 234, 225)');
			expect(Number.parseFloat(
				text.style.getPropertyValue('--bf-player-subtitle-current-outline-size')
			)).toBeCloseTo(6, 1);
		});
	});
});
