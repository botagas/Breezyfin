import {
	isExternalAssRendererId,
	SUBTITLE_RENDERER_IDS
} from './rendererIds';
import {
	supportsAssJsRuntime,
	supportsJassubManualRuntime,
	supportsJassubRuntime,
	supportsLibassRuntime
} from './rendererSupport';

const SUPPORT_CHECKS = {
	[SUBTITLE_RENDERER_IDS.ASS_LIBASS]: supportsLibassRuntime,
	[SUBTITLE_RENDERER_IDS.ASS_LIBASS_MANUAL]: supportsLibassRuntime,
	[SUBTITLE_RENDERER_IDS.ASS_JASSUB]: supportsJassubRuntime,
	[SUBTITLE_RENDERER_IDS.ASS_JASSUB_MANUAL]: supportsJassubManualRuntime,
	[SUBTITLE_RENDERER_IDS.ASS_ASSJS]: supportsAssJsRuntime
};

const loadLibassAdapter = () => new Promise((resolve) => {
	if (typeof require.ensure !== 'function') {
		resolve(require('./libassRenderer'));
		return;
	}
	require.ensure(['./libassRenderer'], () => {
		resolve(require('./libassRenderer'));
	}, 'ass-renderer-libass');
});

const loadJassubAdapter = () => new Promise((resolve) => {
	if (typeof require.ensure !== 'function') {
		resolve(require('./jassubRenderer'));
		return;
	}
	require.ensure(['./jassubRenderer'], () => {
		resolve(require('./jassubRenderer'));
	}, 'ass-renderer-jassub');
});

const loadAssJsAdapter = () => new Promise((resolve) => {
	if (typeof require.ensure !== 'function') {
		resolve(require('./assJsRenderer'));
		return;
	}
	require.ensure(['./assJsRenderer'], () => {
		resolve(require('./assJsRenderer'));
	}, 'ass-renderer-assjs');
});

const loadRendererAdapter = async (rendererId) => {
	switch (rendererId) {
		case SUBTITLE_RENDERER_IDS.ASS_LIBASS:
		case SUBTITLE_RENDERER_IDS.ASS_LIBASS_MANUAL:
			return loadLibassAdapter();
		case SUBTITLE_RENDERER_IDS.ASS_JASSUB:
		case SUBTITLE_RENDERER_IDS.ASS_JASSUB_MANUAL:
			return loadJassubAdapter();
		case SUBTITLE_RENDERER_IDS.ASS_ASSJS:
			return loadAssJsAdapter();
		default:
			return null;
	}
};

const getAdapterFunction = (adapter, functionName) => {
	const defaultExport = adapter?.default;
	const namespace = defaultExport && typeof defaultExport === 'object'
		? {...defaultExport, ...adapter}
		: adapter;
	const adapterFunction = namespace?.[functionName];
	return typeof adapterFunction === 'function' ? adapterFunction : null;
};

const clearContainer = (containerElement) => {
	if (!containerElement) return;
	while (containerElement.firstChild) {
		containerElement.removeChild(containerElement.firstChild);
	}
};

const restoreMovedLibassCanvasParent = (renderer) => {
	const canvasParent = renderer?.__breezyfinCanvasParent || renderer?.canvasParent;
	const videoParent = renderer?.video?.parentNode;
	if (!canvasParent || !videoParent || canvasParent.parentNode === videoParent) return;
	try {
		videoParent.appendChild(canvasParent);
	} catch (error) {
		console.warn('[SubtitleRendererRegistry] Error restoring libass canvas parent:', error);
	}
};

export const supportsExternalAssRenderer = (rendererId) => {
	const supports = SUPPORT_CHECKS[rendererId];
	return isExternalAssRendererId(rendererId) && typeof supports === 'function' && supports();
};

export const initExternalAssRenderer = async (rendererId, context) => {
	const adapter = await loadRendererAdapter(rendererId);
	if (!adapter) {
		return {
			instance: null,
			debug: {
				engine: rendererId,
				status: 'unknown-renderer'
			}
		};
	}
	let initFunctionName = '';
	if (rendererId === SUBTITLE_RENDERER_IDS.ASS_LIBASS) {
		initFunctionName = 'initLibassRenderer';
	} else if (rendererId === SUBTITLE_RENDERER_IDS.ASS_LIBASS_MANUAL) {
		initFunctionName = 'initLibassManualRenderer';
	} else if (rendererId === SUBTITLE_RENDERER_IDS.ASS_JASSUB) {
		initFunctionName = 'initJassubRenderer';
	} else if (rendererId === SUBTITLE_RENDERER_IDS.ASS_JASSUB_MANUAL) {
		initFunctionName = 'initJassubManualRenderer';
	} else if (rendererId === SUBTITLE_RENDERER_IDS.ASS_ASSJS) {
		initFunctionName = 'initAssJsRenderer';
	}
	const initRenderer = getAdapterFunction(adapter, initFunctionName);
	if (initRenderer) {
		return initRenderer(context);
	}
	return {
		instance: null,
		debug: {
			engine: rendererId,
			status: initFunctionName ? 'missing-adapter-function' : 'unknown-renderer',
			adapterFunction: initFunctionName
		}
	};
};

export const disposeExternalAssRenderer = (rendererId, renderer, context = {}) => {
	if (!isExternalAssRendererId(rendererId) || !renderer) return;
	try {
		if (rendererId === SUBTITLE_RENDERER_IDS.ASS_LIBASS) {
			restoreMovedLibassCanvasParent(renderer);
		}
		if (typeof renderer.__breezyfinCleanup === 'function') {
			renderer.__breezyfinCleanup();
			renderer.__breezyfinCleanup = null;
		}
		if (typeof renderer.dispose === 'function') {
			renderer.dispose();
		} else if (typeof renderer.destroy === 'function') {
			renderer.destroy();
		}
	} catch (error) {
		console.warn('[SubtitleRendererRegistry] Error disposing external renderer:', error);
	}
	try {
		if (renderer.__breezyfinCanvasParent && renderer.__breezyfinCanvasParent.parentNode) {
			renderer.__breezyfinCanvasParent.parentNode.removeChild(renderer.__breezyfinCanvasParent);
		}
		if (renderer.__breezyfinCanvas && renderer.__breezyfinCanvas.parentNode) {
			renderer.__breezyfinCanvas.parentNode.removeChild(renderer.__breezyfinCanvas);
		}
		if (rendererId === SUBTITLE_RENDERER_IDS.ASS_ASSJS) {
			clearContainer(context.containerElement);
		}
	} catch (error) {
		console.warn('[SubtitleRendererRegistry] Error clearing external renderer output:', error);
	}
};

export {isExternalAssRendererId, SUBTITLE_RENDERER_IDS};
