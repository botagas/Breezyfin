import {
	ASS_RENDERER_MODE,
	ASS_RENDERER_OPTIONS,
	buildAssRendererOptions,
	getAssRendererDebugInfo,
	hasAssRendererCanvasParent
} from '../assRendererOptions';

describe('assRenderer', () => {
	it('uses webOS-friendly JS blending by default', () => {
		expect(ASS_RENDERER_OPTIONS.renderMode).toBe('js-blend');
	});

	it('builds video-attached libass options with an optional caller-owned canvas', () => {
		const video = document.createElement('video');
		const canvas = document.createElement('canvas');
		const onError = jest.fn();
		const {
			canvas: optionCanvas,
			video: optionVideo,
			subUrl,
			renderMode,
			targetFps,
			prescaleFactor,
			maxRenderHeight,
			onError: optionOnError
		} = buildAssRendererOptions({
			video,
			canvas,
			subUrl: '/subtitle.ass'
		}, onError);

		expect(optionVideo).toBe(video);
		expect(optionCanvas).toBe(canvas);
		expect(subUrl).toBe('/subtitle.ass');
		expect(renderMode).toBe(ASS_RENDERER_OPTIONS.renderMode);
		expect(targetFps).toBe(ASS_RENDERER_OPTIONS.targetFps);
		expect(prescaleFactor).toBe(ASS_RENDERER_OPTIONS.prescaleFactor);
		expect(maxRenderHeight).toBe(ASS_RENDERER_OPTIONS.maxRenderHeight);
		expect(optionOnError).toBe(onError);
	});

	it('supports app-fetched subtitle content to avoid worker URL fetches', () => {
		const video = document.createElement('video');
		const {subContent, subUrl} = buildAssRendererOptions({
			video,
			subContent: '[Script Info]\nTitle: Test'
		});

		expect(subContent).toBe('[Script Info]\nTitle: Test');
		expect(subUrl).toBeUndefined();
	});

	it('reports generated libass canvas parent diagnostics', () => {
		const parent = document.createElement('div');
		const video = document.createElement('video');
		const canvasParent = document.createElement('div');
		canvasParent.className = 'libassjs-canvas-parent';
		parent.appendChild(video);
		parent.appendChild(canvasParent);

		expect(hasAssRendererCanvasParent(video)).toBe(true);
		const callerOwnedCanvas = document.createElement('canvas');
		expect(getAssRendererDebugInfo(video, callerOwnedCanvas)).toEqual({
			mode: ASS_RENDERER_MODE,
			renderMode: ASS_RENDERER_OPTIONS.renderMode,
			targetFps: ASS_RENDERER_OPTIONS.targetFps,
			prescaleFactor: ASS_RENDERER_OPTIONS.prescaleFactor,
			maxRenderHeight: ASS_RENDERER_OPTIONS.maxRenderHeight,
			canvasMode: 'caller-owned',
			canvasParent: 'yes'
		});
		expect(getAssRendererDebugInfo(video, {
			canvasElement: callerOwnedCanvas,
			canvasMode: 'auto-moved'
		})).toEqual({
			mode: ASS_RENDERER_MODE,
			renderMode: ASS_RENDERER_OPTIONS.renderMode,
			targetFps: ASS_RENDERER_OPTIONS.targetFps,
			prescaleFactor: ASS_RENDERER_OPTIONS.prescaleFactor,
			maxRenderHeight: ASS_RENDERER_OPTIONS.maxRenderHeight,
			canvasMode: 'auto-moved',
			canvasParent: 'yes'
		});
	});

});
