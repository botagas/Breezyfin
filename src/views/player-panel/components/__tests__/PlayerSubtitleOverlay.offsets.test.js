import {act, render, screen} from '@testing-library/react';
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
 it.each(['initial', 'empty', 'plain'])('measures the first styled cue after %s content', (previous) => {
  const frames = [];
  const frame = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {frames.push(callback); return frames.length;});
  const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const rect = jest.spyOn(window.Element.prototype, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080});
  const styled = getCues().filter(cue => cue.lines?.[0] === 'Styled dialogue');
  const props = {videoElement: metrics, diagnosticsEnabled: true};
  const initial = previous === 'initial' ? styled : (previous === 'empty' ? [] : [{lines: ['Plain caption']}]);
  const view = render(<PlayerSubtitleOverlay {...props} cues={initial} />);
  if (previous !== 'initial') {
   frames.length = 0;
   view.rerender(<PlayerSubtitleOverlay {...props} cues={styled} />);
  }
  expect(frames.length).toBeGreaterThan(0);
  act(() => {
   while (frames.length) frames.shift()();
  });
  expect(rect).toHaveBeenCalled();
  const stage = screen.getByText('Styled dialogue').closest('[data-subtitle-stage]');
  expect(stage.dataset.subtitleStage).toBe('styled');
  expect(screen.getByText('Styled dialogue').closest('[data-ass-fit-scale]')).toBeTruthy();
  view.unmount();
  frame.mockRestore(); cancel.mockRestore(); rect.mockRestore();
 });

});
