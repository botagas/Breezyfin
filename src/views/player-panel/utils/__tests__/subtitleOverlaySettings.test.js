import {
	getSubtitleClipLayerStyle,
	getSubtitleCueTextStyle,
	getSubtitleCueTransformLayerStyle,
	getSubtitleDrawingClipPath,
	getSubtitleDrawingSvgStyle,
	getSubtitleOverlayAttributes,
	getSubtitleOverlayStyle,
	getSubtitleTextStyle,
	groupSubtitleCuesByPlacement,
	isClippedSubtitleCue,
	isDrawingVectorClippedSubtitleCue,
	isDrawingSubtitleCue
} from '../subtitleOverlaySettings';

describe('subtitleOverlaySettings utilities', () => {
	it('builds overlay data attributes from subtitle appearance settings', () => {
		expect(getSubtitleOverlayAttributes({
			subtitleOverlayWeight: 'black',
			subtitleOverlayTextColor: 'yellow',
			subtitleOverlayBorderStyle: 'outline',
			subtitleOverlayBorderColor: 'white',
			subtitleOverlayBorderStrength: 'high',
			subtitleOverlayOutlineSize: 'extra',
			subtitleOverlayShadowDistance: 'high',
			subtitleOverlayShadowAngle: 'upLeft'
		}, true)).toEqual({
			'data-size': 'medium',
			'data-position': 'standard',
			'data-background': 'none',
			'data-weight': 'black',
			'data-text-color': 'yellow',
			'data-border-style': 'outline',
			'data-border-color': 'white',
			'data-border-strength': 'high',
			'data-outline-size': 'extra',
			'data-shadow-distance': 'high',
			'data-shadow-angle': 'upLeft',
			'data-controls-visible': 'true'
		});
	});

	it('builds overlay CSS variables from numeric subtitle appearance settings', () => {
		expect(getSubtitleOverlayStyle({
			subtitleOverlayFontSizePx: '48',
			subtitleOverlayOutlineSizePx: '8'
		})).toEqual({
			'--bf-player-subtitle-current-font-size': '48px',
			'--bf-player-subtitle-current-outline-size': '8px'
		});
	});

	it('builds direct text styles for numeric subtitle appearance settings', () => {
		expect(getSubtitleTextStyle({
			subtitleOverlayFontSizePx: '52',
			subtitleOverlayOutlineSizePx: '10'
		})).toEqual({
			fontSize: '52px',
			'--bf-player-subtitle-current-outline-size': '10px'
		});
	});

	it('allows source-authored ASS font size to override the base text font size per cue', () => {
		const baseTextStyle = getSubtitleTextStyle({
			subtitleOverlayFontSizePx: '52',
			subtitleOverlayOutlineSizePx: '10'
		});

		expect(getSubtitleCueTextStyle(baseTextStyle, {
			sourceFontSize: {
				size: 48,
				playResY: 1080,
				fontSizeVh: 4.444444
			}
		})).toEqual({
			fontSize: '4.444vh',
			'--bf-player-subtitle-current-outline-size': '10px'
		});
	});

	it('lets structured ASS source style override Breezyfin appearance per cue', () => {
		const baseTextStyle = getSubtitleTextStyle({
			subtitleOverlayFontSizePx: '52',
			subtitleOverlayOutlineSizePx: '10'
		});

		expect(getSubtitleCueTextStyle(baseTextStyle, {
			runLines: [[{text: 'Sign', style: {}}]],
			sourceStyle: {
				color: 'rgb(95, 47, 12)',
				fontFamily: "'Times New Roman', sans-serif",
				'--bf-player-subtitle-current-border-color': 'rgb(243, 234, 182)',
				'--bf-player-subtitle-current-outline-size': '0.361vh'
			},
			opacity: 0.5
		})).toEqual({
			fontSize: '52px',
			background: 'transparent',
			boxShadow: 'none',
			color: 'rgb(95, 47, 12)',
			fontFamily: "'Times New Roman', sans-serif",
			'--bf-player-subtitle-current-border-color': 'rgb(243, 234, 182)',
			'--bf-player-subtitle-current-outline-size': '0.361vh',
			opacity: 0.5
		});
	});

	it('uses transparent text chrome and script-resolution sizing for ASS drawing cues', () => {
		const baseTextStyle = getSubtitleTextStyle({
			subtitleOverlayFontSizePx: '52',
			subtitleOverlayOutlineSizePx: '10'
		});
		const cue = {
			drawing: {
				playResX: 1920,
				playResY: 1080,
				viewBox: {
					value: '0 0 192 108',
					width: 192,
					height: 108
				},
				paths: [{d: 'M 0 0 L 192 108'}]
			}
		};

		expect(isDrawingSubtitleCue(cue)).toBe(true);
		expect(getSubtitleCueTextStyle(baseTextStyle, cue)).toEqual({
			fontSize: '52px',
			'--bf-player-subtitle-current-outline-size': '10px',
			background: 'transparent',
			boxShadow: 'none',
			padding: 0
		});
		expect(getSubtitleDrawingSvgStyle(cue)).toEqual({
			width: '10.000vw',
			height: '10.000vh'
		});
	});

	it('builds SVG clip data for ASS vector-clipped drawing cues', () => {
		const cue = {
			clip: {
				type: 'drawing',
				pathData: 'M 0.000 0.000 L 20.000 0.000 L 20.000 20.000 Z',
				inverted: false
			},
			drawing: {
				playResX: 100,
				playResY: 100,
				viewBox: {
					x: -2,
					y: -2,
					value: '-2 -2 24 24',
					width: 24,
					height: 24
				},
				paths: [{d: 'M 0 0 L 40 40'}]
			}
		};

		expect(isDrawingVectorClippedSubtitleCue(cue)).toBe(true);
		expect(getSubtitleDrawingClipPath(cue)).toEqual({
			d: 'M 0.000 0.000 L 20.000 0.000 L 20.000 20.000 Z',
			inverted: false
		});
	});

	it('builds even-odd SVG clip data for inverse ASS vector-clipped drawing cues', () => {
		const cue = {
			clip: {
				type: 'drawing',
				pathData: 'M 0.000 0.000 L 20.000 0.000 L 20.000 20.000 Z',
				inverted: true
			},
			drawing: {
				playResX: 100,
				playResY: 100,
				viewBox: {
					x: -2,
					y: -3,
					value: '-2 -3 24 25',
					width: 24,
					height: 25
				},
				paths: [{d: 'M 0 0 L 40 40'}]
			}
		};

		expect(getSubtitleDrawingClipPath(cue)).toEqual({
			d: 'M -2.000 -3.000 H 22.000 V 22.000 H -2.000 Z M 0.000 0.000 L 20.000 0.000 L 20.000 20.000 Z',
			inverted: true
		});
	});

	it('moves ASS origin transforms to a cue-level layer for absolute cues', () => {
		const cue = {
			absolutePosition: {xPercent: 30, yPercent: 40},
			origin: {xPercent: 10, yPercent: 20},
			sourceStyle: {
				color: 'rgb(255, 255, 255)',
				display: 'inline-block',
				transform: 'rotate(45.000deg)',
				transformOrigin: 'center center'
			}
		};
		const baseTextStyle = getSubtitleTextStyle({
			subtitleOverlayFontSizePx: '52',
			subtitleOverlayOutlineSizePx: '10'
		});

		expect(getSubtitleCueTransformLayerStyle(cue)).toEqual({
			transform: 'rotate(45.000deg)',
			transformOrigin: '10.000% 20.000%'
		});
		expect(getSubtitleCueTextStyle(baseTextStyle, cue)).toEqual({
			fontSize: '52px',
			'--bf-player-subtitle-current-outline-size': '10px',
			color: 'rgb(255, 255, 255)'
		});
	});

	it('applies source-authored ASS margins and wrap style per cue', () => {
		const baseTextStyle = getSubtitleTextStyle({
			subtitleOverlayFontSizePx: '52',
			subtitleOverlayOutlineSizePx: '10'
		});

		expect(getSubtitleCueTextStyle(baseTextStyle, {
			placement: 'top',
			wrapStyle: 1,
			sourceMargins: {
				leftPercent: 6.25,
				rightPercent: 12.5,
				verticalPercent: 7.4074
			}
		})).toEqual({
			fontSize: '52px',
			'--bf-player-subtitle-current-outline-size': '10px',
			marginLeft: '6.250%',
			marginRight: '12.500%',
			marginTop: '7.407vh',
			maxWidth: 'calc(100% - 18.750%)',
			whiteSpace: 'pre-wrap',
			overflowWrap: 'anywhere'
		});
	});

	it('uses compact page-style layout for large subtitle text blocks', () => {
		const baseTextStyle = getSubtitleTextStyle({
			subtitleOverlayFontSizePx: '52',
			subtitleOverlayOutlineSizePx: '10'
		});

		expect(getSubtitleCueTextStyle(baseTextStyle, {
			lines: [
				'Line 1',
				'Line 2',
				'Line 3',
				'Line 4',
				'Line 5'
			]
		})).toEqual({
			fontSize: '2.200vh',
			'--bf-player-subtitle-current-outline-size': '10px',
			lineHeight: 1.12,
			maxHeight: '86vh',
			maxWidth: '100%',
			overflow: 'hidden',
			padding: '0.08em 0.28em'
		});
	});

	it('fits source-authored large ASS page signs into the visible subtitle region', () => {
		const baseTextStyle = getSubtitleTextStyle({
			subtitleOverlayFontSizePx: '52',
			subtitleOverlayOutlineSizePx: '10'
		});

		expect(getSubtitleCueTextStyle(baseTextStyle, {
			lines: Array.from({length: 30}, (_, index) => `Line ${index}`),
			sourceFontSize: {
				size: 26,
				playResY: 360,
				fontSizeVh: 7.222
			}
		})).toEqual(expect.objectContaining({
			fontSize: '2.321vh',
			lineHeight: 1.12,
			maxHeight: '86vh'
		}));
	});

	it('clamps invalid numeric subtitle appearance settings', () => {
		expect(getSubtitleOverlayStyle({
			subtitleOverlayFontSizePx: '200',
			subtitleOverlayOutlineSizePx: '0'
		})).toEqual({
			'--bf-player-subtitle-current-font-size': '72px',
			'--bf-player-subtitle-current-outline-size': '1px'
		});
	});

	it('falls back to readable defaults for invalid appearance settings', () => {
		expect(getSubtitleOverlayAttributes({
			subtitleOverlayWeight: 'invalid',
			subtitleOverlayTextColor: 'invalid',
			subtitleOverlayBorderStyle: 'invalid',
			subtitleOverlayBorderColor: 'invalid',
			subtitleOverlayBorderStrength: 'invalid',
			subtitleOverlayOutlineSize: 'invalid',
			subtitleOverlayShadowDistance: 'invalid',
			subtitleOverlayShadowAngle: 'invalid'
		})).toMatchObject({
			'data-background': 'none',
			'data-weight': 'bold',
			'data-text-color': 'white',
			'data-border-style': 'outline',
			'data-border-color': 'black',
			'data-border-strength': 'medium',
			'data-outline-size': 'medium',
			'data-shadow-distance': 'medium',
			'data-shadow-angle': 'down'
		});
	});

	it('groups cues by source-driven vertical placement and horizontal alignment', () => {
		const groups = groupSubtitleCuesByPlacement([
			{placement: 'top', horizontalAlign: 'right', text: 'sign'},
			{placement: 'middle', horizontalAlign: 'left', text: 'middle'},
			{placement: 'unknown', horizontalAlign: 'unknown', text: 'dialogue'}
		]);

		expect(groups.top.right).toEqual([{placement: 'top', horizontalAlign: 'right', text: 'sign'}]);
		expect(groups.middle.left).toEqual([{placement: 'middle', horizontalAlign: 'left', text: 'middle'}]);
		expect(groups.bottom.center).toEqual([{placement: 'unknown', horizontalAlign: 'unknown', text: 'dialogue'}]);
	});

	it('leaves absolute-positioned cues out of region grouping', () => {
		const absoluteCue = {
			placement: 'top',
			horizontalAlign: 'left',
			absolutePosition: {xPercent: 50, yPercent: 20},
			text: 'absolute sign'
		};
		const groups = groupSubtitleCuesByPlacement([
			absoluteCue,
			{placement: 'bottom', horizontalAlign: 'center', text: 'dialogue'}
		]);

		expect(groups.top.left).toEqual([]);
		expect(groups.bottom.center).toEqual([{placement: 'bottom', horizontalAlign: 'center', text: 'dialogue'}]);
	});

	it('builds full-layer clip-path styles for direct ASS rectangular clips', () => {
		const cue = {
			clip: {
				leftPercent: 10,
				topPercent: 20,
				rightPercent: 60,
				bottomPercent: 50,
				inverted: false
			}
		};

		expect(isClippedSubtitleCue(cue)).toBe(true);
		expect(getSubtitleClipLayerStyle(cue)).toEqual({
			clipPath: 'inset(20.000% 40.000% 50.000% 10.000%)',
			WebkitClipPath: 'inset(20.000% 40.000% 50.000% 10.000%)'
		});
	});

	it('renders inverse ASS rectangular clips as outside-rectangle clip paths', () => {
		const inverseCue = {
			placement: 'top',
			horizontalAlign: 'left',
			clip: {
				leftPercent: 10,
				topPercent: 20,
				rightPercent: 60,
				bottomPercent: 50,
				inverted: true
			}
		};
		const groups = groupSubtitleCuesByPlacement([inverseCue]);
		const clipPath = 'path(evenodd, "M0 0 H100 V100 H0 Z M10.000 20.000 H60.000 V50.000 H10.000 Z")';

		expect(isClippedSubtitleCue(inverseCue)).toBe(true);
		expect(getSubtitleClipLayerStyle(inverseCue)).toEqual({
			clipPath,
			WebkitClipPath: clipPath
		});
		expect(groups.top.left).toEqual([]);
	});
});
