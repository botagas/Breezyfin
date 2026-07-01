export const ASS_RENDERER_MODE = 'video-attached';
export const ASS_RENDERER_OPTIONS = Object.freeze({
	targetFps: 10,
	renderMode: 'js-blend',
	prescaleFactor: 1,
	maxRenderHeight: 0
});

export const buildAssRendererOptions = (options, onError) => {
	const fallbackFontUrl = 'breezyfin-subtitle-fallback.ttf';
	return {
		...options,
		workerUrl: 'subtitles-octopus-worker.js',
		legacyWorkerUrl: 'subtitles-octopus-worker-legacy.js',
		fallbackFont: fallbackFontUrl,
		availableFonts: {
			arial: fallbackFontUrl,
			'sans-serif': fallbackFontUrl,
			'museo sans': fallbackFontUrl
		},
		onError: onError || null,
		targetFps: ASS_RENDERER_OPTIONS.targetFps,
		renderMode: ASS_RENDERER_OPTIONS.renderMode,
		prescaleFactor: ASS_RENDERER_OPTIONS.prescaleFactor,
		maxRenderHeight: ASS_RENDERER_OPTIONS.maxRenderHeight,
		debug: false
	};
};

export const hasAssRendererCanvasParent = (videoElement) => {
	const parent = videoElement?.parentNode;
	if (!parent || typeof parent.querySelector !== 'function') return false;
	return Boolean(parent.querySelector('.libassjs-canvas-parent'));
};

const normalizeCanvasDebugOptions = (canvasDebugOptions) => {
	if (!canvasDebugOptions) {
		return {
			canvasElement: null,
			canvasMode: 'auto-sibling'
		};
	}
	if (canvasDebugOptions.nodeType) {
		return {
			canvasElement: canvasDebugOptions,
			canvasMode: 'caller-owned'
		};
	}
	return {
		canvasElement: canvasDebugOptions.canvasElement || null,
		canvasMode: canvasDebugOptions.canvasMode || (canvasDebugOptions.canvasElement ? 'caller-owned' : 'auto-sibling')
	};
};

export const getAssRendererDebugInfo = (videoElement, canvasDebugOptions = null) => {
	const {canvasMode} = normalizeCanvasDebugOptions(canvasDebugOptions);
	return {
		mode: ASS_RENDERER_MODE,
		renderMode: ASS_RENDERER_OPTIONS.renderMode,
		targetFps: ASS_RENDERER_OPTIONS.targetFps,
		prescaleFactor: ASS_RENDERER_OPTIONS.prescaleFactor,
		maxRenderHeight: ASS_RENDERER_OPTIONS.maxRenderHeight,
		canvasMode,
		canvasParent: hasAssRendererCanvasParent(videoElement) ? 'yes' : 'no'
	};
};
