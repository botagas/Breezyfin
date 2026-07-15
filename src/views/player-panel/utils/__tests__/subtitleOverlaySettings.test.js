import {
	getSubtitleAbsolutePositionStyle,
	getSubtitleClipLayerStyle,
	getSubtitleCueTextStyle,
	getSubtitleCueTransformLayerStyle,
	getSubtitleDrawingSvgStyle,
	getSubtitleOverlayAttributes,
	getSubtitleOverlayStyle,
	getSubtitleTextStyle,
	groupSubtitleCuesByPlacement,
	groupSubtitleCuesByLayer,
	isClippedSubtitleCue,
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
			fontSize: '48.000px',
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
			'--bf-player-subtitle-current-outline-size': '3.899px',
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
			width: '192.000px',
			height: '108.000px'
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
			marginTop: '80.000px',
			maxWidth: 'calc(100% - 18.750%)',
			whiteSpace: 'pre-wrap',
			overflowWrap: 'anywhere'
		});
	});

	it('leaves large text at its base size for the bounded runtime fit pass', () => {
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
			fontSize: '52px',
			'--bf-player-subtitle-current-outline-size': '10px',
			lineHeight: 1.12,
			maxWidth: '100%',
			padding: '0.08em 0.28em'
		});
	});

	it('keeps source font sizing before the bounded runtime fit pass', () => {
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
			fontSize: '78.000px',
			lineHeight: 1.12
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

	it('preserves source-authored absolute cue anchors for stage clipping', () => {
		expect(getSubtitleAbsolutePositionStyle({
			absolutePosition: {
				xPercent: -20,
				yPercent: 140
			}
		})).toEqual({
			'--bf-player-subtitle-absolute-x': '-20.000%',
			'--bf-player-subtitle-absolute-y': '140.000%',
			'--bf-player-subtitle-absolute-max-width': 'none',
			'--bf-player-subtitle-absolute-max-height': 'none'
		});
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
		const clipPath = 'polygon(evenodd, 10.000% 20.000%, 10.000% 50.000%, 60.000% 50.000%, 60.000% 20.000%, 10.000% 20.000%, 0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%)';

		expect(isClippedSubtitleCue(inverseCue)).toBe(true);
		expect(getSubtitleClipLayerStyle(inverseCue)).toEqual({
			clipPath,
			WebkitClipPath: clipPath
		});
		expect(groups.top.left).toEqual([]);
	});

	it('keeps ASS collision allocation separate per layer', () => {
		expect(groupSubtitleCuesByLayer([
			{layer: 2, text: 'upper'},
			{layer: 0, text: 'dialogue'},
			{layer: 2, text: 'second upper'}
		])).toEqual([
			{layer: 0, cues: [{layer: 0, text: 'dialogue'}]},
			{layer: 2, cues: [{layer: 2, text: 'upper'}, {layer: 2, text: 'second upper'}]}
		]);
	});

	it('scales vector clips into the video-aligned stage for text cues', () => {
		const cue = {
			clip: {
				type: 'drawing',
				pathData: 'M 0.000 0.000 L 10.000 0.000 L 10.000 10.000 Z',
				inverted: false
			},
			scriptGeometry: {
				playResX: 100,
				playResY: 100,
				layoutResX: 200,
				layoutResY: 100
			}
		};
		const stageGeometry = {
			width: 200,
			height: 100,
			videoWidth: 200,
			videoHeight: 100
		};

		expect(isClippedSubtitleCue(cue)).toBe(true);
		expect(getSubtitleClipLayerStyle(cue, stageGeometry)).toEqual({
			clipPath: 'path(evenodd, "M 0.000 0.000 L 20.000 0.000 L 20.000 10.000 Z")',
			WebkitClipPath: 'path(evenodd, "M 0.000 0.000 L 20.000 0.000 L 20.000 10.000 Z")'
		});
	});

	it('keeps ASS border dimensions unscaled when requested by script metadata', () => {
		const style = getSubtitleCueTextStyle({}, {
			sourceStyle: {
				'--bf-player-subtitle-current-outline-size': '1vh'
			},
			scriptGeometry: {
				playResY: 100,
				scaledBorderAndShadow: false
			}
		}, {height: 500});

		expect(style['--bf-player-subtitle-current-outline-size']).toBe('5.000px');
	});
});
