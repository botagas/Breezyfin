import {
	getAssCoordinatePlane,
	getAssCueContainment,
	getAssCueContainmentPolicy,
	getAssStageLengthPx,
	getAssStagePercent,
	getSubtitleVideoStageGeometry
} from '../subtitleRendererAssStage';

describe('subtitleRendererAssStage', () => {
	it('fits ultrawide video into the player viewport', () => {
		const geometry = getSubtitleVideoStageGeometry({
			viewportWidth: 1920,
			viewportHeight: 1080,
			videoWidth: 3840,
			videoHeight: 1600
		});
		expect(geometry.width).toBeCloseTo(1920, 3);
		expect(geometry.height).toBeCloseTo(800, 3);
		expect(geometry.top).toBeCloseTo(140, 3);
		expect(geometry.style).toEqual({
			left: '0.0000%',
			top: '12.9630%',
			width: '100.0000%',
			height: '74.0741%'
		});
	});

	it('fits pillarboxed video into the player viewport', () => {
		const geometry = getSubtitleVideoStageGeometry({
			viewportWidth: 1920,
			viewportHeight: 1080,
			videoWidth: 1440,
			videoHeight: 1080
		});
		expect(geometry.width).toBeCloseTo(1440, 3);
		expect(geometry.left).toBeCloseTo(240, 3);
		expect(geometry.style.left).toBe('12.5000%');
	});

	it('maps the authored PlayRes plane across ultrawide video without centering a second viewport', () => {
		const stage = getSubtitleVideoStageGeometry({
			viewportWidth: 1920,
			viewportHeight: 1080,
			videoWidth: 3840,
			videoHeight: 1600
		});
		const cue = {scriptGeometry: {playResX: 640, playResY: 360}};
		const plane = getAssCoordinatePlane(cue, stage);
		expect(plane.width).toBe(640);
		expect(plane.height).toBe(360);
		expect(plane.scaleX).toBeCloseTo(3, 3);
		expect(plane.scaleY).toBeCloseTo(2.222, 3);
		expect(plane.offsetX).toBe(0);
		expect(plane.offsetY).toBe(0);
		expect(getAssStagePercent(320, 'x', cue, stage)).toBeCloseTo(50, 3);
		expect(getAssStagePercent(180, 'y', cue, stage)).toBeCloseTo(50, 3);
		expect(getAssStageLengthPx(10, 'y', cue, stage)).toBeCloseTo(22.222, 3);
	});

	it('maps PlayRes independently across pillarboxed video dimensions', () => {
		const stage = getSubtitleVideoStageGeometry({
			viewportWidth: 1920,
			viewportHeight: 1080,
			videoWidth: 1440,
			videoHeight: 1080
		});
		const cue = {scriptGeometry: {playResX: 640, playResY: 360}};
		const plane = getAssCoordinatePlane(cue, stage);
		expect(plane.scaleX).toBeCloseTo(2.25, 3);
		expect(plane.scaleY).toBeCloseTo(3, 3);
		expect(plane.offsetX).toBe(0);
		expect(plane.offsetY).toBe(0);
		expect(getAssStagePercent(0, 'y', cue, stage)).toBe(0);
		expect(getAssStagePercent(360, 'y', cue, stage)).toBe(100);
	});

	it('keeps LayoutRes as source-layout scaling metadata rather than cue coordinates', () => {
		const stage = getSubtitleVideoStageGeometry({
			viewportWidth: 1920,
			viewportHeight: 1080,
			videoWidth: 1920,
			videoHeight: 1080
		});
		const plane = getAssCoordinatePlane({
			scriptGeometry: {
				playResX: 640,
				playResY: 360,
				layoutResX: 1920,
				layoutResY: 1080
			}
		}, stage);

		expect(plane.scaleX).toBe(3);
		expect(plane.scaleY).toBe(3);
		expect(plane.layoutScaleX).toBe(1);
		expect(plane.layoutScaleY).toBe(1);
		expect(plane.pixelAspectScale).toBe(1);
	});

	it('fits and contains managed cue boxes', () => {
		const fitted = getAssCueContainment({
			cueRect: {left: 0, top: 0, width: 2000, height: 1200},
			stageRect: {left: 0, top: 0, width: 1920, height: 1080}
		});
		expect(fitted.scale).toBeCloseTo(0.864, 3);
		expect(fitted.reason).toBe('fit-and-contain');

		const shifted = getAssCueContainment({
			cueRect: {left: -20, top: 300, width: 400, height: 100},
			stageRect: {left: 0, top: 0, width: 1920, height: 1080}
		});
		expect(shifted.scale).toBe(1);
		expect(shifted.offsetX).toBeCloseTo(58.4, 3);
		expect(shifted.reason).toBe('contain');

		expect(getAssCueContainment({
			cueRect: {left: -20, top: 1200, width: 400, height: 100},
			stageRect: {left: 0, top: 0, width: 1920, height: 1080},
			preserveOverflow: true,
			sourceAuthored: true
		})).toEqual({
			sourceAuthored: true,
			scale: 1,
			offsetX: 0,
			offsetY: 0,
			reason: 'preserve-authored-overflow'
		});
	});

	it('preserves authored positions and other protected geometry', () => {
		expect(getAssCueContainmentPolicy({
			absolutePosition: {xPercent: 50, yPercent: 2}
		})).toEqual({
			contain: false,
			sourceAuthored: true,
			reason: 'authored-position'
		});
		expect(getAssCueContainmentPolicy({
			absolutePosition: {xPercent: 50, yPercent: -5}
		})).toEqual(expect.objectContaining({
			contain: false,
			reason: 'authored-offscreen'
		}));
		expect(getAssCueContainmentPolicy({
			absolutePosition: {xPercent: 50, yPercent: 5},
			clip: {leftPercent: 0, topPercent: 0, rightPercent: 50, bottomPercent: 50}
		})).toEqual(expect.objectContaining({
			contain: false,
			reason: 'authored-clip'
		}));
		expect(getAssCueContainmentPolicy({
			move: {startPosition: {xPercent: 10, yPercent: 10}}
		})).toEqual(expect.objectContaining({
			contain: false,
			reason: 'authored-motion'
		}));
	});
});
