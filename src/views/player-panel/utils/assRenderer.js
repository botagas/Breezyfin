import {buildAssRendererOptions} from './assRendererOptions';
import {supportsLibassRuntime} from './subtitle-renderers/rendererSupport';

export const supportsAssRenderer = () => supportsLibassRuntime();

const createAssRenderer = async (options, onError) => {
	try {
		const libassModule = require('libass-wasm');
		const SubtitlesOctopus = libassModule.default || libassModule;
		return new SubtitlesOctopus(buildAssRendererOptions(options, onError));
	} catch (error) {
		console.warn('[AssRenderer] Failed to initialize:', error);
		return null;
	}
};

const normalizeSubtitleSource = (subtitleSource) => {
	if (typeof subtitleSource === 'string') {
		return subtitleSource ? {subUrl: subtitleSource} : null;
	}
	const content = subtitleSource?.content || subtitleSource?.subContent;
	const canvas = subtitleSource?.canvas || null;
	if (content) {
		return canvas ? {subContent: content, canvas} : {subContent: content};
	}
	const url = subtitleSource?.url || subtitleSource?.subUrl;
	if (url) {
		return canvas ? {subUrl: url, canvas} : {subUrl: url};
	}
	return null;
};

export const initAssRenderer = async (videoElement, subtitleSource, onError) => {
	const sourceOptions = normalizeSubtitleSource(subtitleSource);
	if (!videoElement || !sourceOptions) return null;
	return createAssRenderer({video: videoElement, ...sourceOptions}, onError);
};

export const initAssCanvasRenderer = async (canvasElement, subtitleSource, onError) => {
	const sourceOptions = normalizeSubtitleSource(subtitleSource);
	if (!canvasElement || !sourceOptions) return null;
	return createAssRenderer({canvas: canvasElement, ...sourceOptions}, onError);
};

export const disposeAssRenderer = (renderer) => {
	if (!renderer) return;
	try {
		if (typeof renderer.dispose === 'function') {
			renderer.dispose();
		}
	} catch (error) {
		console.warn('[AssRenderer] Error disposing renderer:', error);
	}
};
