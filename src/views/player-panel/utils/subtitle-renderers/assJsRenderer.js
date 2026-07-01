import {collectExternalRendererDiagnostics} from './rendererDiagnostics';
import {supportsAssJsRuntime} from './rendererSupport';

const clearContainer = (containerElement) => {
	if (!containerElement) return;
	while (containerElement.firstChild) {
		containerElement.removeChild(containerElement.firstChild);
	}
};

export const ASS_JS_OPTIONS = Object.freeze({
	resampling: 'video_width',
	disableVideoFrameCallback: true
});

const runWithVideoFrameCallbackDisabled = (videoElement, callback) => {
	if (!videoElement || typeof videoElement.requestVideoFrameCallback !== 'function') {
		return {disabled: false, value: callback()};
	}
	const hadOwnRequest = Object.prototype.hasOwnProperty.call(videoElement, 'requestVideoFrameCallback');
	const hadOwnCancel = Object.prototype.hasOwnProperty.call(videoElement, 'cancelVideoFrameCallback');
	const originalRequest = videoElement.requestVideoFrameCallback;
	const originalCancel = videoElement.cancelVideoFrameCallback;
	try {
		Object.defineProperty(videoElement, 'requestVideoFrameCallback', {
			configurable: true,
			writable: true,
			value: undefined
		});
		Object.defineProperty(videoElement, 'cancelVideoFrameCallback', {
			configurable: true,
			writable: true,
			value: undefined
		});
		return {disabled: true, value: callback()};
	} finally {
		if (hadOwnRequest) {
			Object.defineProperty(videoElement, 'requestVideoFrameCallback', {
				configurable: true,
				writable: true,
				value: originalRequest
			});
		} else {
			delete videoElement.requestVideoFrameCallback;
		}
		if (hadOwnCancel) {
			Object.defineProperty(videoElement, 'cancelVideoFrameCallback', {
				configurable: true,
				writable: true,
				value: originalCancel
			});
		} else {
			delete videoElement.cancelVideoFrameCallback;
		}
	}
};

export const supportsAssJsRenderer = () => supportsAssJsRuntime();

export const initAssJsRenderer = async ({
	videoElement,
	containerElement,
	subtitleContent
}) => {
	if (!containerElement) return {instance: null, debug: {engine: 'assjs', status: 'missing-container'}};
	clearContainer(containerElement);
	const assJsModule = require('assjs');
	const ASS = assJsModule.default || assJsModule;
	const createRenderer = () => new ASS(subtitleContent, videoElement, {
		container: containerElement,
		resampling: ASS_JS_OPTIONS.resampling
	});
	const rendererResult = ASS_JS_OPTIONS.disableVideoFrameCallback
		? runWithVideoFrameCallbackDisabled(videoElement, createRenderer)
		: {disabled: false, value: createRenderer()};
	const renderer = rendererResult.value;
	if (typeof renderer.show === 'function') renderer.show();
	return {
		instance: renderer,
		debug: {
			mode: 'dom-attached',
			engine: 'assjs',
			resampling: ASS_JS_OPTIONS.resampling,
			timing: rendererResult.disabled ? 'raf-forced' : 'native-or-raf',
			containerChildren: containerElement.childNodes.length,
			...collectExternalRendererDiagnostics({
				containerElement,
				renderer,
				videoElement
			})
		}
	};
};

export const disposeAssJsRenderer = (renderer, containerElement) => {
	try {
		if (renderer && typeof renderer.destroy === 'function') {
			renderer.destroy();
		}
	} catch (error) {
		console.warn('[AssJsRenderer] Error disposing renderer:', error);
	}
	clearContainer(containerElement);
};
