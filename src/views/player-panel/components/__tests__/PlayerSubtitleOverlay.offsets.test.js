import {render, screen} from '@testing-library/react';
import PlayerSubtitleOverlay from '../PlayerSubtitleOverlay';
import PlayerMediaSurface from '../PlayerMediaSurface';
import {normalizeSubtitleText, findActiveSubtitleCues} from '../../utils/subtitleRenderer';

const assDocument = `[Script Info]
ScriptType: v4.00+
PlayResX: 640
PlayResY: 360
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, Bold, Alignment
Style: Default,Arial,20,&H00FFFFFF,0,2
[Events]
Format: Layer, Start, End, Style, Text
Dialogue: 0,0:00:00.00,0:00:10.00,Default,{\\pos(320,300)\\clip(0,0,640,360)}Positioned sign
Dialogue: 0,0:00:00.00,0:00:10.00,Default,Styled dialogue`;

const getCues = () => [
	...findActiveSubtitleCues(normalizeSubtitleText(assDocument, 'ass'), 2).cues,
	{lines: ['Plain caption'], placement: 'bottom', horizontalAlign: 'center'},
	{lines: ['Plain top caption'], placement: 'top', horizontalAlign: 'center'}
];

const metrics = {clientHeight: 1080, clientWidth: 1920, videoHeight: 1080, videoWidth: 1920};

describe('styled subtitle offset ownership', () => {
	it.each([false, true])('keeps ASS signs and dialogue together in an opt-in offset layer (enabled: %s)', (enabled) => {
		render(<PlayerSubtitleOverlay cues={getCues()} videoElement={metrics} settings={{subtitleOverlayOffsetXPx: '40', subtitleOverlayOffsetYPx: '80', subtitleOverlayOffsetStyled: enabled}} />);
		const sign = screen.getByText('Positioned sign');
		const styledLayer = sign.closest('.subtitleStyledLayer');
		expect(styledLayer).toBeTruthy();
		expect(styledLayer.dataset.offsetStyled).toBe(String(enabled));
		expect(screen.getByText('Styled dialogue').closest('.subtitleStyledLayer')).toBe(styledLayer);
		const plain = screen.getByText('Plain caption');
		const plainTop = screen.getByText('Plain top caption');
		expect(plain.closest('.subtitleStyledLayer')).toBeNull();
		expect(plainTop.closest('.subtitleStyledLayer')).toBeNull();
		expect(sign.closest('.subtitleClipLayer')).toBeTruthy();
		expect(sign.closest('.subtitleAbsoluteCue').style.getPropertyValue('--bf-player-subtitle-absolute-x')).toBe('50.000%');
		expect(sign.closest('.subtitleOverlay').style.getPropertyValue('--bf-player-subtitle-offset-x')).toBe('40px');
	});

	it('uses the same opt-in setting for external and lightweight renderer layers', () => {
		const externalSubtitleLayerRef = {current: null};
		render(<PlayerMediaSurface videoRef={{current: metrics}} externalSubtitleLayerRef={externalSubtitleLayerRef} subtitleCues={getCues()} playbackSettings={{subtitleOverlayOffsetXPx: '40', subtitleOverlayOffsetYPx: '80', subtitleOverlayOffsetStyled: true}} />);
		const external = externalSubtitleLayerRef.current;
		const lightweight = screen.getByText('Positioned sign').closest('.subtitleStyledLayer');
		expect(external.dataset.offsetStyled).toBe(lightweight.dataset.offsetStyled);
		expect(external.style.getPropertyValue('--bf-player-subtitle-offset-y')).toBe('80px');
		expect(lightweight.closest('.subtitleOverlay').style.getPropertyValue('--bf-player-subtitle-offset-y')).toBe('80px');
	});
});
